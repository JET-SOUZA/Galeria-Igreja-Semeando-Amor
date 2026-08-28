(()=>{'use strict';
function load(src,id){return new Promise((resolve,reject)=>{if(document.getElementById(id))return resolve();const s=document.createElement('script');s.id=id;s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
function brand(){const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.nodeValue&&n.nodeValue.includes('V5.9 · REPERTÓRIO E SETLIST'))n.nodeValue=n.nodeValue.replaceAll('V5.9 · REPERTÓRIO E SETLIST','V6.0 · FLUXO AO VIVO')}}
async function boot(){try{await load('./v59-setlist-core.js?v=5903','v59core');await load('./v60-liveflow.js?v=6001','v60live');brand();setTimeout(brand,1200)}catch(e){console.error('Semeando Live V6.0 bootstrap',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();