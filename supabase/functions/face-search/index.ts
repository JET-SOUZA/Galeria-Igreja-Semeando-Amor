import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {RekognitionClient,SearchFacesByImageCommand} from "npm:@aws-sdk/client-rekognition@3.883.0";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const REGION=(Deno.env.get('AWS_REGION')||'sa-east-1').trim();
const AK=(Deno.env.get('AWS_ACCESS_KEY_ID')||'').trim();
const SK=(Deno.env.get('AWS_SECRET_ACCESS_KEY')||'').trim();
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'apikey,content-type,authorization,x-gallery-share',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
};
const svc=()=>({apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'});
const j=(data:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(data),{
  status,
  headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store',...extra},
});
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value)).map(byte=>byte.toString(16).padStart(2,'0')).join('');

async function sha256(value:string){
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}

function retryableAwsError(error:any){
  return ['ProvisionedThroughputExceededException','ThrottlingException','ServiceUnavailableException','InternalServerError'].includes(String(error?.name||''));
}

async function search(rek:RekognitionClient,collection:string,bytes:Uint8Array,threshold:number){
  for(let attempt=0;attempt<5;attempt++){
    try{
      return await rek.send(new SearchFacesByImageCommand({
        CollectionId:collection,
        Image:{Bytes:bytes},
        FaceMatchThreshold:threshold,
        MaxFaces:500,
        QualityFilter:'NONE',
      }));
    }catch(error:any){
      if(!retryableAwsError(error)||attempt===4)throw error;
      const backoff=Math.min(2500,250*(2**attempt))+Math.floor(Math.random()*350);
      await wait(backoff);
    }
  }
  throw Error('FACE_SEARCH_RETRY_EXHAUSTED');
}

function cld(url:string,kind:'thumb'|'display'){
  if(!/res\.cloudinary\.com\//.test(url))return url;
  const transform=kind==='thumb'?'f_auto,q_auto:eco,c_fill,w_480,h_480,dpr_auto':'f_auto,q_auto:good,c_limit,w_1600,dpr_auto';
  return url.replace('/upload/',`/upload/${transform}/`);
}

async function allowPrivate(event:any,share:string){
  if(event.visibility!=='private')return true;
  if(!share)return false;
  const response=await fetch(`${SB}/rest/v1/organizations?id=eq.${event.organization_id}&private_gallery_token=eq.${encodeURIComponent(share)}&select=id&limit=1`,{headers:svc()});
  const data=await response.json();
  return response.ok&&!!data?.[0];
}

async function checkRateLimit(req:Request,eventId:string){
  const forwarded=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||forwarded||'unknown';
  const agent=(req.headers.get('user-agent')||'unknown').slice(0,240);
  const clientKey=await sha256(`${eventId}:${ip}:${agent}`);
  try{
    const response=await fetch(`${SB}/rest/v1/rpc/check_face_search_rate_limit`,{
      method:'POST',
      headers:svc(),
      body:JSON.stringify({p_event_id:eventId,p_client_key:clientKey,p_client_limit:60,p_event_limit:120}),
    });
    if(!response.ok)throw Error(`RATE_LIMIT_RPC_${response.status}`);
    return await response.json();
  }catch(error){
    // A protecao nao pode derrubar a busca se o contador estiver temporariamente
    // indisponivel. O limite da AWS continua protegido pelo retry com backoff.
    console.error('face-search rate limit',error);
    return{allowed:true,retry_after:10};
  }
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return j({error:'Método não suportado'},405);
  try{
    const body=await req.json();
    if(body.consent!==true)return j({error:'CONSENT_REQUIRED'},400);
    const slug=String(body.event_slug||'').trim();
    const share=String(body.share_token||req.headers.get('x-gallery-share')||'').trim();
    const base64=String(body.image_base64||'');
    if(!slug||!base64)return j({error:'Evento e selfie são obrigatórios.'},400);

    const eventResponse=await fetch(`${SB}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&status=eq.published&face_search_enabled=eq.true&select=id,title,is_paid,organization_id,visibility`,{headers:svc()});
    const events=await eventResponse.json();
    if(!eventResponse.ok||!events?.[0])return j({error:'Busca facial indisponível para este evento.'},404);
    const event=events[0];
    if(!(await allowPrivate(event,share)))return j({error:'Este álbum é privado. Abra pelo link enviado pelo responsável.',code:'PRIVATE_LINK_REQUIRED'},403);

    const rate=await checkRateLimit(req,event.id);
    if(rate?.allowed===false){
      const retryAfter=Math.max(1,Number(rate.retry_after||10));
      return j({
        error:'Muitas buscas ao mesmo tempo. Aguarde alguns segundos e tente novamente.',
        code:'FACE_SEARCH_BUSY',
        retry_after:retryAfter,
      },429,{'Retry-After':String(retryAfter)});
    }

    let collectionResponse=await fetch(`${SB}/rest/v1/face_collections?event_id=eq.${encodeURIComponent(event.id)}&status=eq.ready&select=collection_id`,{headers:svc()});
    let collections=await collectionResponse.json();
    if(!collectionResponse.ok||!collections?.[0]){
      try{
        await fetch(`${SB}/functions/v1/face-auto-index`,{
          method:'POST',
          headers:svc(),
          body:JSON.stringify({event_id:event.id,background:true}),
        });
      }catch{}
      collectionResponse=await fetch(`${SB}/rest/v1/face_collections?event_id=eq.${encodeURIComponent(event.id)}&status=eq.ready&select=collection_id`,{headers:svc()});
      collections=await collectionResponse.json();
      if(!collectionResponse.ok||!collections?.[0])return j({error:'Estamos preparando o reconhecimento facial. Aguarde alguns instantes e tente novamente.',code:'FACE_INDEX_PREPARING'},409);
    }

    const clean=base64.replace(/^data:image\/(jpeg|jpg|png|webp);base64,/i,'');
    let bytes:Uint8Array;
    try{bytes=Uint8Array.from(atob(clean),char=>char.charCodeAt(0))}catch{return j({error:'Imagem inválida.'},400)}
    if(bytes.byteLength>5*1024*1024)return j({error:'Imagem acima de 5 MB.'},400);
    const isJpeg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    const isPng=bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
    if(!isJpeg&&!isPng)return j({error:'Imagem inválida. Use uma foto JPG ou PNG.'},400);
    if(!AK||!SK)return j({error:'Reconhecimento indisponível.'},503);

    const rek=new RekognitionClient({region:REGION,credentials:{accessKeyId:AK,secretAccessKey:SK}});
    const collection=collections[0].collection_id;
    let output:any;
    let threshold=85;
    let candidateMode=false;
    try{
      output=await search(rek,collection,bytes,85);
      if(!(output.FaceMatches||[]).length){threshold=74;output=await search(rek,collection,bytes,74)}
      if(!(output.FaceMatches||[]).length){threshold=68;output=await search(rek,collection,bytes,68)}
      if(!(output.FaceMatches||[]).length){threshold=60;candidateMode=true;output=await search(rek,collection,bytes,60)}
    }catch(error:any){
      if(['InvalidParameterException','InvalidImageFormatException'].includes(String(error?.name||'')))return j({error:'Não consegui detectar um rosto nítido. Use uma foto frontal, bem iluminada e sem óculos escuros.'},422);
      if(retryableAwsError(error))return j({error:'O reconhecimento está muito movimentado agora. Aguarde alguns segundos e tente novamente.',code:'FACE_SEARCH_BUSY'},503,{'Retry-After':'5'});
      throw error;
    }

    const byPhoto=new Map<string,number>();
    for(const match of output.FaceMatches||[]){
      const photoId=match.Face?.ExternalImageId;
      if(photoId)byPhoto.set(photoId,Math.max(byPhoto.get(photoId)||0,Number(match.Similarity||0)));
    }
    const ids=[...byPhoto.keys()];
    let photos:any[]=[];
    if(ids.length){
      const expression=`(${ids.join(',')})`;
      const select=event.is_paid?'id,original_filename':'id,secure_url,original_filename';
      const photoResponse=await fetch(`${SB}/rest/v1/photos?id=in.${encodeURIComponent(expression)}&deleted_at=is.null&status=eq.published&select=${select}`,{headers:svc()});
      if(photoResponse.ok)photos=await photoResponse.json();
    }
    const previewVersion='20260923-1';
    photos=photos.map((photo:any)=>event.is_paid?{
      id:photo.id,
      original_filename:photo.original_filename,
      similarity:byPhoto.get(photo.id)||0,
      preview_url:`${SB}/functions/v1/paid-photo-preview?id=${encodeURIComponent(photo.id)}&v=${previewVersion}`,
    }:{
      ...photo,
      original_url:photo.secure_url,
      thumbnail_url:cld(photo.secure_url,'thumb'),
      display_url:cld(photo.secure_url,'display'),
      similarity:byPhoto.get(photo.id)||0,
    }).sort((a:any,b:any)=>b.similarity-a.similarity);

    await fetch(`${SB}/rest/v1/face_search_consents`,{
      method:'POST',
      headers:svc(),
      body:JSON.stringify({event_id:event.id,consent_version:'v1.1',consent_text:'Autorizo o uso temporário da minha imagem exclusivamente para localizar minhas fotos neste evento. A imagem de referência não é armazenada.'}),
    });
    return j({
      ok:true,
      event:{id:event.id,title:event.title,is_paid:event.is_paid},
      matches:photos.length,
      photos,
      search_threshold:threshold,
      expanded_search:threshold<85,
      candidate_mode:candidateMode&&photos.length>0,
    });
  }catch(error:any){
    console.error('face-search',error);
    return j({error:error?.message||'Erro inesperado.'},500);
  }
});
