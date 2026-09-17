'use client';
import {useEffect,useState} from 'react';
import {KEY,SB} from '../../lib/sb';

function slug(){const m=location.pathname.match(/\/evento\/([^/?#]+)/);return m?.[1]?decodeURIComponent(m[1]):''}
function cleanName(v:string){return (v||'').trim()}

export default function FreeOriginalDownloadBridge(){
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const eventSlug=slug();if(!eventSlug)return;
  async function original(name:string){
   name=cleanName(name);if(!name)return;
   setBusy(true);
   try{
    const r=await fetch(`${SB}/functions/v1/photo-original-access`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({event_slug:eventSlug,original_filename:name})});
    const d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Original indisponível.');
    const a=document.createElement('a');a.href=d.url;a.download=d.filename||name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
   }catch(e:any){alert(e?.message||'Não foi possível baixar a foto original.')}finally{setBusy(false)}
  }
  const click=(e:MouseEvent)=>{
   const t=e.target as HTMLElement|null;if(!t)return;
   const viewer=t.closest('.photo-viewer');
   const viewerDownload=t.closest('.viewer-btn.primary');
   if(viewer&&viewerDownload){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const name=viewer.querySelector('.viewer-bar strong')?.textContent||'';void original(name);return}
   const card=t.closest('.free-photo-card');
   const cardDownload=t.closest('.result-action.primary');
   if(card&&cardDownload){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const name=card.querySelector('img')?.getAttribute('alt')||'';void original(name);return}
   const bulk=t.closest('.free-download-bar button');
   if(bulk){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const names=Array.from(document.querySelectorAll('.free-photo-card.is-selected img')).map(x=>x.getAttribute('alt')||'').filter(Boolean);void (async()=>{for(const name of names){await original(name);await new Promise(r=>setTimeout(r,300))}})()}
  };
  document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true)
 },[]);
 return <style jsx global>{`.photo-viewer .viewer-actions>a.viewer-btn.secondary{display:none!important}${busy?'.viewer-btn.primary,.result-action.primary,.free-download-bar button{opacity:.65;pointer-events:none}':''}`}</style>
}
