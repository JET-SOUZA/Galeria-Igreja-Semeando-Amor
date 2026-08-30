(()=>{'use strict';
const ID='SemeandoV121',q=new URLSearchParams(location.search),isOutput=q.get('view')==='output';
const $=s=>document.querySelector(s);
function payloadFor(col){col=Number(col);const clip=$(`#v100grid [data-clip="text:${col}"]`);if(!clip)return null;const label=clip.querySelector('.v100body b')?.textContent?.trim()||`Parte ${col+1}`;const body=clip.querySelector('.v100body span')?.textContent?.trim()||'';if(!body)return null;const title=$('#v100decks .v100deck.on')?.textContent?.trim()||'Louvor';return{id:`v121-${Date.now()}-${col}`,type:'song-part',title,subtitle:label,body,sort_order:col,at:Date.now()}}
function publish(col){const p=payloadFor(col);if(!p)return false;if(window.SemeandoV120?.publishText){window.SemeandoV120.publishText(p);return true}try{localStorage.setItem('sl_v120_text_live',JSON.stringify(p));new BroadcastChannel('sl-v120-text').postMessage(p);return true}catch{return false}}
function patch(){if(isOutput)return true;const a=window.SemeandoV100;if(!a?.takeColumn)return false;if(a.takeColumn.__v121)return true;const original=a.takeColumn.bind(a);const wrapped=async col=>{const r=await original(col);setTimeout(()=>publish(col),40);return r};wrapped.__v121=true;wrapped.__original=original;a.takeColumn=wrapped;window[ID]={publish,payloadFor,originalTake:original};return true}
function boot(){if(isOutput){window[ID]={publish,payloadFor};return}let n=0,t=setInterval(()=>{if(patch()||++n>240)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();