import puppeteer from 'puppeteer-core';
import {execSync} from 'node:child_process';

const link=process.env.ICLOUD_TEST_LINK||'';
const token=(link.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||[])[1];
if(!token) throw new Error('ICLOUD_TEST_LINK inválido');
const target=`https://www.icloud.com/photos/#${token}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.CHROME_PATH||(()=>{for(const c of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){try{return execSync(`which ${c}`,{encoding:'utf8'}).trim()}catch{}}return ''})();
if(!chrome) throw new Error('Chrome/Chromium não encontrado no runner');
let browser;
try{
 const images=[]; const jsonMeta=[];
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],defaultViewport:{width:1440,height:1000}});
 const page=await browser.newPage();
 await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
 page.on('response',async res=>{try{
   const url=res.url(), h=res.headers(), ct=String(h['content-type']||'').toLowerCase(), u=new URL(url);
   if(/icloud-content\.com/i.test(url)&&ct.startsWith('image/')){images.push({host:u.host,path:u.pathname,size:Number(h['content-length']||0),mime:ct.split(';')[0]});return}
   if(/icloud\.com|icloud-content\.com/i.test(url)&&(ct.includes('json')||ct.includes('text/plain'))){
     const txt=await res.text().catch(()=> ''); if(!txt||txt.length>2000000)return;
     let parsed; try{parsed=JSON.parse(txt)}catch{return}
     const keys=parsed&&typeof parsed==='object'?Object.keys(parsed).slice(0,30):[];
     const arrays={};
     if(parsed&&typeof parsed==='object')for(const [k,v] of Object.entries(parsed)){if(Array.isArray(v))arrays[k]=v.length;else if(v&&typeof v==='object')for(const [k2,v2] of Object.entries(v)){if(Array.isArray(v2))arrays[`${k}.${k2}`]=v2.length}}
     jsonMeta.push({host:u.host,path:u.pathname,status:res.status(),keys,arrays});
   }
 }catch{}});
 console.log('ICLOUD_PROBE_START');
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});
 console.log('ICLOUD_PAGE',JSON.stringify({status:response?.status()||0,title:await page.title()}));
 await sleep(2500);
 let stable=0,last=-1;
 for(let i=0;i<90&&stable<8;i++){await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(700);const n=images.length;if(n===last)stable++;else stable=0;last=n}
 await sleep(1000);
 const unique=new Map(); for(const x of images){const prev=unique.get(x.path);if(!prev||x.size>prev.size)unique.set(x.path,x)}
 const groups={}; for(const x of unique.values()){const parts=x.path.split('/').filter(Boolean);const key=parts.slice(0,Math.max(1,parts.length-1)).join('/');groups[key]=(groups[key]||0)+1}
 console.log('ICLOUD_JSON_META',JSON.stringify(jsonMeta.slice(0,80)));
 console.log('ICLOUD_IMAGE_SUMMARY',JSON.stringify({responses:images.length,unique_paths:unique.size,path_groups:Object.entries(groups).slice(0,30),final_url:page.url(),title:await page.title()}));
 console.log('ICLOUD_LARGEST',JSON.stringify(Array.from(unique.values()).sort((a,b)=>b.size-a.size).slice(0,10).map(x=>({size:x.size,mime:x.mime,host:x.host,path:x.path}))));
} finally {if(browser)await browser.close().catch(()=>{})}
