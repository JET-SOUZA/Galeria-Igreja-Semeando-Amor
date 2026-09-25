import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {DeleteObjectCommand,PutObjectCommand,S3Client} from "npm:@aws-sdk/client-s3@3.883.0";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const ANON=(Deno.env.get('SUPABASE_ANON_KEY')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const R2_ACCESS=(Deno.env.get('R2_ACCESS_KEY_ID')||'').trim();
const R2_SECRET=(Deno.env.get('R2_SECRET_ACCESS_KEY')||'').trim();
const CLOUD='to3hnwdl',PRESET='semeando_memorias';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const svc=()=>({apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'});
const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const c62=(character:string)=>chars.indexOf(character);
const partition=(value:string)=>String(1+(c62(value[0])%40)).padStart(2,'0');
const appleHeaders={'content-type':'text/plain','user-agent':'Photos/5.0'};

function shareToken(value:string){
  const trimmed=value.trim();
  return (trimmed.match(/share\.icloud\.com\/photos\/([\w-]+)/i)||[])[1]
    ||(trimmed.match(/photos\.icloud\.com\/shared\/album\/([\w-]+)/i)||[])[1]
    ||(/^[\w-]{10,}$/.test(trimmed)?trimmed:null);
}

async function authenticated(req:Request){
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))throw Error('Sessão necessária.');
  const response=await fetch(`${SB}/auth/v1/user`,{headers:{apikey:ANON,Authorization:authorization}});
  if(!response.ok)throw Error('Sessão inválida.');
  return authorization;
}

async function stream(token:string){
  let host=`p${partition(token)}-sharedstreams.icloud.com`;
  let response=await fetch(`https://${host}/${token}/sharedstreams/webstream`,{method:'POST',headers:appleHeaders,body:JSON.stringify({streamCtag:null})});
  let text=await response.text();
  if(response.status===330){
    const redirected=JSON.parse(text),nextHost=redirected['X-Apple-MMe-Host'];
    if(nextHost){host=nextHost;response=await fetch(`https://${host}/${token}/sharedstreams/webstream`,{method:'POST',headers:appleHeaders,body:JSON.stringify({streamCtag:null})});text=await response.text()}
  }
  if(!response.ok)throw Error('O iCloud recusou a leitura deste link público.');
  return{host,data:JSON.parse(text)};
}

function best(photo:any){
  return Object.entries(photo.derivatives||{}).map(([key,value]:any)=>({key,...value,size:Number(value.fileSize||0)})).sort((left,right)=>right.size-left.size)[0];
}

async function assetUrls(host:string,token:string,guids:string[]){
  const response=await fetch(`https://${host}/${token}/sharedstreams/webasseturls`,{method:'POST',headers:appleHeaders,body:JSON.stringify({photoGuids:guids})});
  if(!response.ok)throw Error('Não foi possível obter os arquivos do iCloud.');
  return response.json();
}

async function preview(remote:string,folder:string){
  const form=new FormData();form.append('file',remote);form.append('upload_preset',PRESET);form.append('folder',folder);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,{method:'POST',body:form});
  const data=await response.json();
  if(!response.ok)throw Error(data?.error?.message||'Falha ao criar a prévia.');
  return data;
}

async function storageTarget(eventId:string){
  const response=await fetch(`${SB}/rest/v1/event_storage_spaces?event_id=eq.${eventId}&select=object_prefix,storage_backends(id,provider,endpoint,bucket_name,active)`,{headers:svc()});
  const rows=await response.json();
  if(!response.ok||!rows?.[0]?.storage_backends?.active)throw Error('Armazenamento do evento indisponível.');
  return{...rows[0].storage_backends,object_prefix:rows[0].object_prefix};
}

async function preserveOriginal(target:any,blob:Blob,name:string){
  const safe=name.replace(/[^a-zA-Z0-9._-]+/g,'-');
  const path=`${target.object_prefix}/originals/${crypto.randomUUID()}-${safe}`;
  if(target.provider==='r2'){
    if(!R2_ACCESS||!R2_SECRET)throw Error('Credenciais do armazenamento indisponíveis.');
    const client=new S3Client({region:'auto',endpoint:target.endpoint,credentials:{accessKeyId:R2_ACCESS,secretAccessKey:R2_SECRET}});
    await client.send(new PutObjectCommand({Bucket:target.bucket_name,Key:path,Body:new Uint8Array(await blob.arrayBuffer()),ContentType:blob.type||'application/octet-stream'}));
    return{provider:'r2',backend_id:target.id,bucket:target.bucket_name,path,client};
  }
  if(target.provider!=='supabase')throw Error(`Armazenamento ${target.provider} ainda não é suportado por esta importação.`);
  const response=await fetch(`${SB}/storage/v1/object/${target.bucket_name}/${encodeURIComponent(path).replace(/%2F/g,'/')}`,{method:'POST',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':blob.type||'application/octet-stream','x-upsert':'false'},body:blob});
  if(!response.ok)throw Error('Falha ao preservar o original.');
  return{provider:'supabase',backend_id:target.id,bucket:target.bucket_name,path,client:null};
}

async function cleanupOriginal(saved:any){
  if(!saved)return;
  if(saved.provider==='r2')await saved.client.send(new DeleteObjectCommand({Bucket:saved.bucket,Key:saved.path}));
  else await fetch(`${SB}/storage/v1/object/${saved.bucket}/${encodeURIComponent(saved.path).replace(/%2F/g,'/')}`,{method:'DELETE',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`}});
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const authorization=await authenticated(req);
    if(req.method==='GET'){
      const token=shareToken(new URL(req.url).searchParams.get('link')||'');
      if(!token)return json({error:'Link público do iCloud inválido.'},400);
      const {data}=await stream(token);
      const photos=(data.photos||[]).filter((photo:any)=>photo.mediaAssetType!=='video').map((photo:any,index:number)=>{const derivative=best(photo);return{guid:photo.photoGuid,name:photo.caption||`icloud-${index+1}.jpg`,size:derivative?.size||0,width:derivative?.width||0,height:derivative?.height||0,checksum:derivative?.checksum}});
      return json({ok:true,count:photos.length,photos});
    }
    if(req.method!=='POST')return json({error:'Método inválido.'},405);
    const body=await req.json(),token=shareToken(String(body.link||'')),eventId=String(body.event_id||''),guids=(body.guids||[]).map(String).slice(0,25);
    if(!token||!eventId||!guids.length)return json({error:'Dados incompletos.'},400);
    const eventResponse=await fetch(`${SB}/rest/v1/events?id=eq.${eventId}&select=id,slug`,{headers:{apikey:ANON,Authorization:authorization}}),events=await eventResponse.json();
    if(!eventResponse.ok||!events?.[0])return json({error:'Evento não encontrado.'},404);
    const target=await storageTarget(eventId);
    const {data,host}=await stream(token),selected=(data.photos||[]).filter((photo:any)=>guids.includes(String(photo.photoGuid))),assets=await assetUrls(host,token,selected.map((photo:any)=>photo.photoGuid));
    let imported=0,skipped=0,failed=0;const results:any[]=[];
    for(const photo of selected){
      let saved:any=null;
      try{
        const guid=String(photo.photoGuid),existingResponse=await fetch(`${SB}/rest/v1/photos?event_id=eq.${eventId}&source_type=eq.icloud&source_file_id=eq.${guid}&deleted_at=is.null&select=id`,{headers:svc()}),existing=await existingResponse.json();
        if(existing?.length){skipped++;results.push({guid,status:'skipped'});continue}
        const derivative=best(photo),item=assets?.items?.[derivative?.checksum];
        if(!item?.url_location)throw Error('Arquivo temporário indisponível.');
        const remote=`https://${item.url_location}${item.url_path}`,originalResponse=await fetch(remote);
        if(!originalResponse.ok)throw Error('Não foi possível baixar o original.');
        const blob=await originalResponse.blob();
        if(blob.size>100*1024*1024)throw Error('Original acima de 100 MB.');
        const name=String(photo.caption||`icloud-${guid.slice(0,8)}.jpg`);
        saved=await preserveOriginal(target,blob,name);
        const cloud=await preview(remote,`semeando-memorias/eventos/${events[0].slug}`);
        const row={event_id:eventId,cloudinary_asset_id:cloud.asset_id,public_id:cloud.public_id,secure_url:cloud.secure_url,width:cloud.width||null,height:cloud.height||null,bytes:cloud.bytes||null,format:cloud.format||null,original_filename:name,status:'published',source_type:'icloud',source_file_id:guid,source_folder_id:token,source_original_url:String(body.link||''),original_storage_provider:saved.provider,original_storage_backend_id:saved.backend_id,original_storage_bucket:saved.bucket,original_storage_path:saved.path,original_bytes:blob.size,original_mime:blob.type||null};
        const register=await fetch(`${SB}/rest/v1/photos`,{method:'POST',headers:svc(),body:JSON.stringify(row)});
        if(!register.ok)throw Error('Falha ao registrar a foto.');
        imported++;results.push({guid,status:'imported'});saved=null;
      }catch(error:any){failed++;results.push({guid:String(photo.photoGuid),status:'failed',error:error?.message||'Falha inesperada.'});await cleanupOriginal(saved).catch(()=>{})}
    }
    return json({ok:true,imported,skipped,failed,results});
  }catch(error:any){return json({error:error?.message||'Erro inesperado.'},500)}
});
