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

type Candidate={url:string;size:number;mime_type:string;method:string;width?:number;height?:number};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const idFor=(url:string)=>createHash('sha256').update(new URL(url).pathname).digest('hex').slice(0,32);
const quality=(c:Candidate)=>Math.max(c.size||0,(c.width||0)*(c.height||0));
function normalize(link:string){const m=link.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||link.match(/icloud\.com\/photos\/#([A-Za-z0-9_-]+)/i);if(!m)throw new Error('Link share.icloud.com/photos inválido.');return `https://www.icloud.com/photos/#${m[1]}`}
async function media(body:any){const r=await fetch(MEDIA_IMPORT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`media-import respondeu ${r.status}`);return d}

export async function POST(req:NextRequest){
 let browser:any=null;
 let jobId='',workerToken='';
 try{
  const body=await req.json();jobId=String(body.job_id||'');workerToken=String(body.worker_token||'');
  if(!jobId||!workerToken)return NextResponse.json({error:'Credenciais do job são obrigatórias.'},{status:400});
  const validated=await media({action:'worker_validate',job_id:jobId,worker_token:workerToken});
  const target=normalize(String(validated.link||'')),candidates=new Map<string,Candidate>();
  const executablePath=await chromium.executablePath(CHROMIUM_PACK);
  browser=await puppeteer.launch({executablePath,args:[...chromium.args,'--disable-dev-shm-usage','--disable-gpu'],headless:true,defaultViewport:{width:1440,height:1000,deviceScaleFactor:1}});
  const page=await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  page.on('response',res=>{try{const url=res.url();if(!/(?:cvws\.)?icloud-content\.com/i.test(url))return;const h=res.headers(),mime=String(h['content-type']||'').split(';')[0].toLowerCase();if(!/^image\/(jpeg|jpg|png|webp|heic|heif|avif)$/.test(mime))return;const size=Number(h['content-length']||0);const key=new URL(url).pathname;const next={url,size,mime_type:mime,method:'network'};const prev=candidates.get(key);if(!prev||quality(next)>quality(prev))candidates.set(key,next)}catch{}});

  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  for(const text of ['Continue','Continuar','Accept','Aceitar','Not Now','Agora não']){try{const handles=await page.$$('button');for(const h of handles){const label=await h.evaluate((el:any)=>String(el.innerText||el.getAttribute('aria-label')||'').trim());if(label.toLowerCase()===text.toLowerCase()){await h.click().catch(()=>{});await sleep(250);break}}}catch{}}

  let stable=0,last=0;
  for(let i=0;i<80&&stable<6;i++){
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(650);
   const current=candidates.size;if(current===last)stable++;else stable=0;last=current;
  }

  const rendered=await page.$$eval('img',els=>els.map((e:any)=>({url:e.currentSrc||e.src,width:e.naturalWidth||0,height:e.naturalHeight||0})).filter((x:any)=>x.url&&x.width>=160&&x.height>=160));
  for(const x of rendered){try{if(!/(?:cvws\.)?icloud-content\.com/i.test(x.url))continue;const key=new URL(x.url).pathname;const next={url:x.url,size:0,mime_type:'image/jpeg',method:'rendered',width:x.width,height:x.height};const prev=candidates.get(key);if(!prev||quality(next)>quality(prev))candidates.set(key,next)}catch{}}

  if(!candidates.size)throw new Error('O iCloud abriu, mas nenhuma imagem do compartilhamento foi descoberta. O link pode ter expirado ou a Apple pode ter alterado o visualizador.');
  const all=Array.from(candidates.values()).sort((a,b)=>quality(b)-quality(a)),dedup=new Map<string,Candidate>();
  for(const c of all){const id=idFor(c.url);const prev=dedup.get(id);if(!prev||quality(c)>quality(prev))dedup.set(id,c)}
  const items=Array.from(dedup.entries()).slice(0,2000).map(([id,c],i)=>({id,name:`icloud-${String(i+1).padStart(4,'0')}.jpg`,url:c.url,size:c.size||null,mime_type:c.mime_type,method:c.method,width:c.width||null,height:c.height||null}));
  await media({action:'worker_register',job_id:jobId,worker_token:workerToken,items});
  const started=await media({action:'worker_ingest',job_id:jobId,worker_token:workerToken});
  return NextResponse.json({ok:true,job_id:jobId,found:items.length,processing:true,status:started.status});
 }catch(e:any){if(jobId&&workerToken){await media({action:'worker_fail',job_id:jobId,worker_token:workerToken,error:e?.message||String(e)}).catch(()=>{})}return NextResponse.json({error:e?.message||'Falha no worker do iCloud.'},{status:500})}finally{if(browser)await browser.close().catch(()=>{})}
}
