import puppeteer from 'puppeteer-core';
import {execSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const link=process.env.ICLOUD_TEST_LINK||'';
const token=(link.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||[])[1];
if(!token) throw new Error('ICLOUD_TEST_LINK inválido');
const target=`https://www.icloud.com/photos/#${token}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,16);
const chrome=process.env.CHROME_PATH||(()=>{for(const c of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){try{return execSync(`which ${c}`,{encoding:'utf8'}).trim()}catch{}}return ''})();
if(!chrome) throw new Error('Chrome/Chromium não encontrado no runner');

function schemaOf(value,prefix='',depth=0,out=new Set()){
 if(value==null||depth>7)return out;
 if(Array.isArray(value)){out.add(`${prefix}[]`);for(const v of value.slice(0,3))schemaOf(v,`${prefix}[]`,depth+1,out);return out}
 if(typeof value!=='object')return out;
 for(const [k,v] of Object.entries(value)){
  const p=prefix?`${prefix}.${k}`:k;out.add(p);
  if(v&&typeof v==='object')schemaOf(v,p,depth+1,out);
 }
 return out;
}

let browser;
try{
 const images=[];const cloudkit=[];
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],defaultViewport:{width:1440,height:1000}});
 const page=await browser.newPage();
 await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
 page.on('response',res=>{try{
   const url=res.url(),h=res.headers(),ct=String(h['content-type']||'').toLowerCase(),u=new URL(url);
   if(/icloud-content\.com$/i.test(u.hostname)&&ct.startsWith('image/')){images.push({host:u.host,path_hash:hash(u.pathname),size:Number(h['content-length']||0),mime:ct.split(';')[0]});return}
   if(/ckdatabasews\.icloud\.com$/i.test(u.hostname)&&/\/database\/1\/com\.apple\.photos\.cloud\/production\/(?:public|shared)\/records\/(?:resolve|query|lookup)$/i.test(u.pathname)){
    res.json().then(data=>{const records=Array.isArray(data?.records)?data.records:[];const recordTypes={};const fieldPaths=new Set();for(const r of records){const t=String(r?.recordType||r?.record_type||'unknown');recordTypes[t]=(recordTypes[t]||0)+1;schemaOf(r,'record',0,fieldPaths)}cloudkit.push({endpoint:u.pathname.split('/').slice(-2).join('/'),status:res.status(),records:records.length,has_continuation:Boolean(data?.continuationMarker||data?.continuation_marker),record_types:recordTypes,field_paths:Array.from(fieldPaths).sort().slice(0,120)})}).catch(()=>{});
   }
 }catch{}});
 console.log('ICLOUD_PROBE_START');
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});
 console.log('ICLOUD_PAGE',JSON.stringify({status:response?.status()||0,title:await page.title()}));
 await sleep(2500);
 let stable=0,last=-1;
 for(let i=0;i<90&&stable<8;i++){await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(700);const n=images.length;if(n===last)stable++;else stable=0;last=n}
 await sleep(1200);
 const unique=new Map();for(const x of images){const prev=unique.get(x.path_hash);if(!prev||x.size>prev.size)unique.set(x.path_hash,x)}
 const sizes=Array.from(unique.values()).map(x=>x.size).filter(Boolean).sort((a,b)=>a-b);
 const q=p=>sizes.length?sizes[Math.min(sizes.length-1,Math.floor((sizes.length-1)*p))]:0;
 console.log('ICLOUD_CLOUDKIT_SUMMARY',JSON.stringify(cloudkit.slice(0,120)));
 console.log('ICLOUD_IMAGE_SUMMARY',JSON.stringify({responses:images.length,unique_paths:unique.size,size_bytes:{min:sizes[0]||0,p50:q(.5),p90:q(.9),max:sizes.at(-1)||0},title:await page.title(),viewer:'icloud-photos'}));
 console.log('ICLOUD_LARGEST_HASHED',JSON.stringify(Array.from(unique.values()).sort((a,b)=>b.size-a.size).slice(0,10)));
} finally {if(browser)await browser.close().catch(()=>{})}
