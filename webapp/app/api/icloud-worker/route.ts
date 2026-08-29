import {NextRequest,NextResponse} from 'next/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import {createHash} from 'node:crypto';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const SB='https://mdhlhriakqqsocopravb.supabase.co';
const MEDIA_IMPORT=`${SB}/functions/v1/media-import`;
const CHROMIUM_PACK='https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';

type Candidate={url:string;size:number;mime_type:string;method:string;width?:number;height?:number;asset_id?:string;name?:string};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
const quality=(c:Candidate)=>Math.max(c.size||0,(c.width||0)*(c.height||0));
const imageUrl=(s:string)=>/^https?:\/\/[^\s]+icloud-content\.com\//i.test(s);
const extForMime=(mime:string)=>({
 'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','image/avif':'avif','image/tiff':'tiff'
} as Record<string,string>)[String(mime||'').toLowerCase()]||'jpg';
const utiMime=(uti:string)=>({
 'public.jpeg':'image/jpeg','public.png':'image/png','public.heic':'image/heic','public.heif':'image/heif','public.tiff':'image/tiff','public.avif':'image/avif','org.webmproject.webp':'image/webp','public.image':'image/heic'
} as Record<string,string>)[String(uti||'').toLowerCase()]||'';
function normalize(link:string){const m=link.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||link.match(/icloud\.com\/photos\/#\/?icloudlinks\/([A-Za-z0-9_-]+)/i)||link.match(/icloud\.com\/photos\/#([A-Za-z0-9_-]+)/i);if(!m)throw new Error('Link share.icloud.com/photos inválido.');return `https://www.icloud.com/photos/#${m[1]}`}
async function media(body:any){const r=await fetch(MEDIA_IMPORT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`media-import respondeu ${r.status}`);return d}
function fieldValue(fields:any,key:string){return fields?.[key]?.value}
function cleanFilename(raw:string,mime:string,fallbackSeed:string){
 let name=String(raw||'').replace(/[\u0000-\u001f\u007f]/g,'').split(/[\\/]/).pop()?.trim()||'';
 const ext=`.${extForMime(mime)}`;
 if(!name)name=`icloud-${hash(fallbackSeed)}${ext}`;
 else if(!/\.[A-Za-z0-9]{2,6}$/.test(name))name+=ext;
 return name.slice(-180);
}
function decodeFilename(fields:any,recordName:string,mime:string){
 const f=fields?.filenameEnc;
 if(!f?.value)return cleanFilename('',mime,recordName);
 let value=String(f.value||'');
 if(String(f.type||'').toUpperCase()!=='STRING'){
  try{const decoded=Buffer.from(value,'base64').toString('utf8');if(decoded)value=decoded}catch{}
 }
 return cleanFilename(value,mime,recordName);
}
function cloudOriginal(record:any):Candidate|null{
 if(String(record?.recordType||'')!=='CPLMaster')return null;
 const fields=record?.fields||{},resource=fieldValue(fields,'resOriginalRes');
 const url=String(resource?.downloadURL||'');
 if(!imageUrl(url))return null;
 const fileType=String(fieldValue(fields,'resOriginalFileType')||fieldValue(fields,'itemType')||'');
 const mime=(fileType.startsWith('image/')?fileType:utiMime(fileType))||'image/jpeg';
 if(!mime.startsWith('image/'))return null;
 const recordName=String(record?.recordName||record?.recordID?.recordName||record?.recordId?.recordName||'');
 if(!recordName)return null;
 const size=Number(resource?.size||0),width=Number(fieldValue(fields,'resOriginalWidth')||0),height=Number(fieldValue(fields,'resOriginalHeight')||0);
 return {url,size:Number.isFinite(size)?size:0,mime_type:mime,method:'cloudkit:resOriginalRes',width:Number.isFinite(width)&&width>0?width:undefined,height:Number.isFinite(height)&&height>0?height:undefined,asset_id:recordName,name:decodeFilename(fields,recordName,mime)};
}

export async function POST(req:NextRequest){
 let browser:any=null;
 let jobId='',workerToken='';
 try{
  const body=await req.json();jobId=String(body.job_id||'');workerToken=String(body.worker_token||'');
  if(!jobId||!workerToken)return NextResponse.json({error:'Credenciais do job são obrigatórias.'},{status:400});
  const validated=await media({action:'worker_validate',job_id:jobId,worker_token:workerToken});
  const target=normalize(String(validated.link||'')),networkCandidates=new Map<string,Candidate>(),cloudOriginals=new Map<string,Candidate>(),recordTypes=new Map<string,number>();
  const cloudTasks:Promise<void>[]=[];
  let cloudResponseSeq=0,latestRelevantSeq=0,cloudHasContinuation=false,cloudRelevantPages=0;
  const executablePath=await chromium.executablePath(CHROMIUM_PACK);
  browser=await puppeteer.launch({executablePath,args:[...chromium.args,'--disable-dev-shm-usage','--disable-gpu'],headless:true,defaultViewport:{width:1440,height:1000,deviceScaleFactor:1}});
  const page=await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  page.on('response',res=>{
   try{
    const url=res.url(),u=new URL(url),h=res.headers(),mime=String(h['content-type']||'').split(';')[0].toLowerCase();
    if(/(?:cvws\.)?icloud-content\.com$/i.test(u.hostname)&&/^image\/(jpeg|jpg|png|webp|heic|heif|avif|tiff)$/.test(mime)){
     const size=Number(h['content-length']||0),key=u.pathname,next={url,size,mime_type:mime,method:'network'};const prev=networkCandidates.get(key);if(!prev||quality(next)>quality(prev))networkCandidates.set(key,next);
    }
    const cloudMatch=/ckdatabasews\.icloud\.com$/i.test(u.hostname)&&/\/database\/1\/com\.apple\.photos\.cloud\/production\/shared\/records\/(query|lookup)$/i.test(u.pathname)&&mime.includes('json');
    if(cloudMatch){
     const seq=++cloudResponseSeq,isQuery=/\/records\/query$/i.test(u.pathname);
     const task=res.json().then((data:any)=>{
      const records=Array.isArray(data?.records)?data.records:[];let relevant=false;
      for(const record of records){
       const type=String(record?.recordType||'unknown');recordTypes.set(type,(recordTypes.get(type)||0)+1);
       if(type==='CPLMaster'||type==='CPLAsset')relevant=true;
       const c=cloudOriginal(record);if(c?.asset_id){const prev=cloudOriginals.get(c.asset_id);if(!prev||quality(c)>quality(prev))cloudOriginals.set(c.asset_id,c)}
      }
      if(isQuery&&relevant){cloudRelevantPages++;if(seq>=latestRelevantSeq){latestRelevantSeq=seq;cloudHasContinuation=Boolean(data?.continuationMarker)}}
     }).catch(()=>{});cloudTasks.push(task);
    }
   }catch{}
  });

  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  for(const text of ['Continue','Continuar','Accept','Aceitar','Not Now','Agora não']){try{const handles=await page.$$('button');for(const h of handles){const label=await h.evaluate((el:any)=>String(el.innerText||el.getAttribute('aria-label')||'').trim());if(label.toLowerCase()===text.toLowerCase()){await h.click().catch(()=>{});await sleep(250);break}}}catch{}}

  let stable=0,last=0;
  for(let i=0;i<140&&(stable<10||cloudHasContinuation);i++){
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(650);
   const current=networkCandidates.size+cloudOriginals.size;if(current===last)stable++;else stable=0;last=current;
  }
  await sleep(750);
  await Promise.allSettled(cloudTasks);

  const rendered=await page.$$eval('img',els=>els.map((e:any)=>({url:e.currentSrc||e.src,width:e.naturalWidth||0,height:e.naturalHeight||0})).filter((x:any)=>x.url&&x.width>=160&&x.height>=160));
  for(const x of rendered){try{if(!/(?:cvws\.)?icloud-content\.com/i.test(x.url))continue;const key=new URL(x.url).pathname;const next={url:x.url,size:0,mime_type:'image/jpeg',method:'rendered',width:x.width,height:x.height};const prev=networkCandidates.get(key);if(!prev||quality(next)>quality(prev))networkCandidates.set(key,next)}catch{}}

  if(!cloudOriginals.size)throw new Error('O iCloud abriu, mas não foi possível confirmar arquivos originais pelo campo CloudKit resOriginalRes. A importação foi interrompida para evitar miniaturas.');
  if(cloudHasContinuation)throw new Error('O iCloud ainda indicou páginas CloudKit pendentes. A importação parcial foi bloqueada para evitar fotos faltando.');

  const chosen=Array.from(cloudOriginals.entries()).sort((a,b)=>quality(b[1])-quality(a[1])).slice(0,2000);
  const items=chosen.map(([assetId,c],i)=>({id:hash(`ck:${assetId}`),name:`icloud-${String(i+1).padStart(4,'0')}-${cleanFilename(c.name||'',c.mime_type,assetId)}`,url:c.url,size:c.size||null,mime_type:c.mime_type,method:c.method,width:c.width||null,height:c.height||null}));
  const typeSummary=Array.from(recordTypes.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([type,count])=>({type,count}));
  await media({action:'worker_register',job_id:jobId,worker_token:workerToken,items,discovery:{cloudkit_originals:cloudOriginals.size,network_candidates:networkCandidates.size,cloudkit_pages:cloudRelevantPages,record_types:typeSummary,strategy:'cloudkit_resOriginalRes'}});
  const started=await media({action:'worker_ingest',job_id:jobId,worker_token:workerToken});
  return NextResponse.json({ok:true,job_id:jobId,found:items.length,cloudkit_originals:cloudOriginals.size,network_candidates:networkCandidates.size,cloudkit_pages:cloudRelevantPages,strategy:'cloudkit_resOriginalRes',processing:true,status:started.status});
 }catch(e:any){if(jobId&&workerToken){await media({action:'worker_fail',job_id:jobId,worker_token:workerToken,error:e?.message||String(e)}).catch(()=>{})}return NextResponse.json({error:e?.message||'Falha no worker do iCloud.'},{status:500})}finally{if(browser)await browser.close().catch(()=>{})}
}
