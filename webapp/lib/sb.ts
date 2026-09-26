export const SB='https://mdhlhriakqqsocopravb.supabase.co';
export const KEY='sb_publishable_OSpepV0XiSMkQWU_UW5TbQ_TLxOYi1F';
export type AdminSession={access_token:string;refresh_token?:string;expires_at?:number;[k:string]:any};
export function readSession():AdminSession|null{
  if(typeof window==='undefined')return null;
  try{return JSON.parse(localStorage.getItem('semeando_admin_session')||sessionStorage.getItem('semeando_admin_session')||'null')}catch{return null}
}
const ACCESS_CACHE_KEY='semeando_admin_access_cache';
export function clearAdminSession(){
  if(typeof window==='undefined')return;
  localStorage.removeItem('semeando_admin_session');
  sessionStorage.removeItem('semeando_admin_session');
  localStorage.removeItem(ACCESS_CACHE_KEY);
  sessionStorage.removeItem(ACCESS_CACHE_KEY);
}
export function cacheAdminAccess(data:any){
  if(typeof window==='undefined'||!data)return;
  try{localStorage.setItem(ACCESS_CACHE_KEY,JSON.stringify({saved_at:Date.now(),data}))}catch{}
}
function readCachedAdminAccess(maxAgeMs=120000){
  if(typeof window==='undefined')return null;
  try{
    const raw=localStorage.getItem(ACCESS_CACHE_KEY)||sessionStorage.getItem(ACCESS_CACHE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(!parsed?.saved_at||Date.now()-Number(parsed.saved_at)>maxAgeMs)return null;
    return parsed.data||null;
  }catch{return null}
}
export async function session():Promise<AdminSession|null>{
  let s=readSession(); if(!s?.access_token)return null;
  if((s.expires_at?Number(s.expires_at)*1000:0)>Date.now()+60000||!s.refresh_token)return s;
  try{
    const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({refresh_token:s.refresh_token})});
    if(!r.ok){
      if(r.status===400||r.status===401){clearAdminSession();return null}
      return {...s,_refresh_temporarily_unavailable:true};
    }
    s=await r.json();
    (localStorage.getItem('semeando_admin_session')?localStorage:sessionStorage).setItem('semeando_admin_session',JSON.stringify(s));
    return s;
  }catch{
    // Uma oscilação de rede não deve transformar uma sessão válida em logout.
    return {...s,_refresh_temporarily_unavailable:true};
  }
}
export async function requireActiveAdminAccess(opts:{redirect?:boolean}={redirect:true}){
  const s=await session();
  if(!s?.access_token){
    if(opts.redirect&&typeof window!=='undefined')location.href='/admin/login?reason=session';
    return null;
  }
  let lastError:any=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      const r=await fetch(`${SB}/functions/v1/admin-access`,{headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`},cache:'no-store',signal:controller.signal});
      clearTimeout(timeout);
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d?.ok){
        cacheAdminAccess(d);
        return {session:s,...d};
      }
      if(r.status===401||r.status===402||r.status===403){
        clearAdminSession();
        const reason=encodeURIComponent(String(d?.state||d?.code||'blocked'));
        const message=encodeURIComponent(String(d?.error||d?.access?.reason||'Acesso indisponível.'));
        if(opts.redirect&&typeof window!=='undefined')location.href=`/admin/login?reason=${reason}&message=${message}`;
        return null;
      }
      lastError=new Error(d?.error||`Falha temporária (${r.status}).`);
    }catch(error){lastError=error}
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
  // Em falha transitória, preserva a sessão e usa por curto período a última autorização confirmada.
  const cached=readCachedAdminAccess();
  if(cached?.ok)return {session:s,...cached,validation_degraded:true};
  console.warn('admin-access temporariamente indisponível',lastError);
  return null;
}
export async function adminHeaders(json=true){const s=await session();return {apikey:KEY,Authorization:`Bearer ${s?.access_token||''}`,...(json?{'Content-Type':'application/json'}:{})}}
export const money=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function slugify(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
export async function nativeShare(title:string,text:string,url:string){
  try{if(navigator.share){await navigator.share({title,text,url});return true}if(navigator.clipboard){await navigator.clipboard.writeText(url);return true}}
  catch(e:any){if(e?.name==='AbortError')return false}
  try{const t=document.createElement('textarea');t.value=url;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return true}catch{return false}
}
