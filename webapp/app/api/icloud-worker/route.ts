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

type Candidate={url:string;size:number;mime_type:string;method:string;width?:number;height?:number;asset_id?:string};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
const idFor=(url:string)=>hash(new URL(url).pathname);
const quality=(c:Candidate)=>Math.max(c.size||0,(c.width||0)*(c.height||0));
const imageUrl=(s:string)=>/^https?:\/\/[^\s]+icloud-content\.com\//i.test(s);
function normalize(link:string){const m=link.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||link.match(/icloud\.com\/photos\/#\/?icloudlinks\/([A-Za-z0-9_-]+)/i)||link.match(/icloud\.com\/photos\/#([A-Za-z0-9_-]+)/i);if(!m)throw new Error('Link share.icloud.com/photos inválido.');return `https://www.icloud.com/photos/#${m[1]}`}
async function media(body:any){const r=await fetch(MEDIA_IMPORT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`media-import respondeu ${r.status}`);return d}

function numeric(obj:any,names:string[]){for(const n of names){const v=obj?.[n];if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v?.value==='number'&&Number.isFinite(v.value))return v.value}return 0}
function collectRecordCandidates(record:any,recordIndex:number){
 const recordName=String(record?.recordName||record?.recordID?.recordName||record?.recordId?.recordName||record?.id||`record-${recordIndex}`);
 const found:Candidate[]=[];
 const seen=new Set<any>();
 const walk=(node:any,depth=0)=>{
  if(node==null||depth>14)return;
  if(typeof node==='string'){
   if(imageUrl(node))found.push({url:node,size:0,mime_type:'image/jpeg',method:'cloudkit',asset_id:recordName});
   return;
  }
  if(typeof node!=='object'||seen.has(node))return;seen.add(node);
  const width=numeric(node,['width','pixelWidth','originalWidth']);
  const height=numeric(node,['height','pixelHeight','originalHeight']);
  const size=numeric(node,['size','fileSize','filesize','originalFileSize']);
  const mime=String(node?.mimeType||node?.mime_type||node?.contentType||node?.content_type||'image/jpeg').split(';')[0].toLowerCase();
  for(const [k,v] of Object.entries(node)){
   if(typeof v==='string'&&imageUrl(v))found.push({url:v,size,mime_type:/^image\//.test(mime)?mime:'image/jpeg',method:`cloudkit:${k}`,width:width||undefined,height:height||undefined,asset_id:recordName});
   else walk(v,depth+1);
  }
 };
 walk(record);
 const byPath=new Map<string,Candidate>();
 for(const c of found){try{const key=new URL(c.url).pathname;const prev=byPath.get(key);if(!prev||quality(c)>quality(prev))byPath.set(key,c)}catch{}}
 return Array.from(byPath.values());
}

export async function POST(req:NextRequest){
 let browser:any=null;
 let jobId='',workerToken='';
 try{
  const body=await req.json();jobId=String(body.job_id||'');workerToken=String(body.worker_token||'');
  if(!jobId||!workerToken)return NextResponse.json({error:'Credenciais do job são obrigatórias.'},{status:400});
  const validated=await media({action:'worker_validate',job_id:jobId,worker_token:workerToken});
  const target=normalize(String(validated.link||'')),networkCandidates=new Map<string,Candidate>(),cloudAssets=new Map<string,Candidate>();
  const cloudTasks:Promise<void>[]=[];
  const executablePath=await chromium.executablePath(CHROMIUM_PACK);
  browser=await puppeteer.launch({executablePath,args:[...chromium.args,'--disable-dev-shm-usage','--disable-gpu'],headless:true,defaultViewport:{width:1440,height:1000,deviceScaleFactor:1}});
  const page=await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  page.on('response',res=>{
   try{
    const url=res.url(),u=new URL(url),h=res.headers(),mime=String(h['content-type']||'').split(';')[0].toLowerCase();
    if(/(?:cvws\.)?icloud-content\.com$/i.test(u.hostname)&&/^image\/(jpeg|jpg|png|webp|heic|heif|avif)$/.test(mime)){
     const size=Number(h['content-length']||0),key=u.pathname,next={url,size,mime_type:mime,method:'network'};const prev=networkCandidates.get(key);if(!prev||quality(next)>quality(prev))networkCandidates.set(key,next);
    }
    if(/ckdatabasews\.icloud\.com$/i.test(u.hostname)&&/\/database\/1\/com\.apple\.photos\.cloud\/production\/shared\/records\/(query|lookup)$/i.test(u.pathname)&&mime.includes('json')){
     const task=res.json().then((data:any)=>{const records=Array.isArray(data?.records)?data.records:[];records.forEach((record:any,index:number)=>{const candidates=collectRecordCandidates(record,index);for(const c of candidates){const assetId=String(c.asset_id||idFor(c.url));const prev=cloudAssets.get(assetId);if(!prev||quality(c)>quality(prev))cloudAssets.set(assetId,c)}})}).catch(()=>{});cloudTasks.push(task);
    }
   }catch{}
  });

  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  for(const text of ['Continue','Continuar','Accept','Aceitar','Not Now','Agora não']){try{const handles=await page.$$('button');for(const h of handles){const label=await h.evaluate((el:any)=>String(el.innerText||el.getAttribute('aria-label')||'').trim());if(label.toLowerCase()===text.toLowerCase()){await h.click().catch(()=>{});await sleep(250);break}}}catch{}}

  let stable=0,last=0;
  for(let i=0;i<100&&stable<8;i++){
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(650);
   const current=networkCandidates.size+cloudAssets.size;if(current===last)stable++;else stable=0;last=current;
  }
  await Promise.allSettled(cloudTasks);

  const rendered=await page.$$eval('img',els=>els.map((e:any)=>({url:e.currentSrc||e.src,width:e.naturalWidth||0,height:e.naturalHeight||0})).filter((x:any)=>x.url&&x.width>=160&&x.height>=160));
  for(const x of rendered){try{if(!/(?:cvws\.)?icloud-content\.com/i.test(x.url))continue;const key=new URL(x.url).pathname;const next={url:x.url,size:0,mime_type:'image/jpeg',method:'rendered',width:x.width,height:x.height};const prev=networkCandidates.get(key);if(!prev||quality(next)>quality(prev))networkCandidates.set(key,next)}catch{}}

  const chosen=new Map<string,Candidate>();
  if(cloudAssets.size){for(const [assetId,c] of cloudAssets)chosen.set(`ck:${assetId}`,c)}
  else{for(const c of Array.from(networkCandidates.values()).sort((a,b)=>quality(b)-quality(a))){const id=idFor(c.url),prev=chosen.get(id);if(!prev||quality(c)>quality(prev))chosen.set(id,c)}}
  if(!chosen.size)throw new Error('O iCloud abriu, mas nenhuma imagem do compartilhamento foi descoberta. O link pode ter expirado ou a Apple pode ter alterado o visualizador.');

  const items=Array.from(chosen.entries()).sort((a,b)=>quality(b[1])-quality(a[1])).slice(0,2000).map(([id,c],i)=>({id:hash(id),source_asset_id:c.asset_id||null,name:`icloud-${String(i+1).padStart(4,'0')}.jpg`,url:c.url,size:c.size||null,mime_type:c.mime_type,method:c.method,width:c.width||null,height:c.height||null}));
  await media({action:'worker_register',job_id:jobId,worker_token:workerToken,items,discovery:{cloudkit_assets:cloudAssets.size,network_candidates:networkCandidates.size,strategy:cloudAssets.size?'cloudkit_record':'network_fallback'}});
  const started=await media({action:'worker_ingest',job_id:jobId,worker_token:workerToken});
  return NextResponse.json({ok:true,job_id:jobId,found:items.length,cloudkit_assets:cloudAssets.size,network_candidates:networkCandidates.size,strategy:cloudAssets.size?'cloudkit_record':'network_fallback',processing:true,status:started.status});
 }catch(e:any){if(jobId&&workerToken){await media({action:'worker_fail',job_id:jobId,worker_token:workerToken,error:e?.message||String(e)}).catch(()=>{})}return NextResponse.json({error:e?.message||'Falha no worker do iCloud.'},{status:500})}finally{if(browser)await browser.close().catch(()=>{})}
}
