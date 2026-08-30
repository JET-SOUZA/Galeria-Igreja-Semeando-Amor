export const SB='https://mdhlhriakqqsocopravb.supabase.co';
export const KEY='sb_publishable_OSpepV0XiSMkQWU_UW5TbQ_TLxOYi1F';
export type AdminSession={access_token:string;refresh_token?:string;expires_at?:number;[k:string]:any};
export function readSession():AdminSession|null{
  if(typeof window==='undefined')return null;
  try{return JSON.parse(localStorage.getItem('semeando_admin_session')||sessionStorage.getItem('semeando_admin_session')||'null')}catch{return null}
}
export function clearAdminSession(){
  if(typeof window==='undefined')return;
  localStorage.removeItem('semeando_admin_session');
  sessionStorage.removeItem('semeando_admin_session');
}
export async function session():Promise<AdminSession|null>{
  let s=readSession(); if(!s?.access_token)return null;
  if((s.expires_at?Number(s.expires_at)*1000:0)>Date.now()+60000||!s.refresh_token)return s;
  const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({refresh_token:s.refresh_token})});
  if(!r.ok){clearAdminSession();return null} s=await r.json();
  (localStorage.getItem('semeando_admin_session')?localStorage:sessionStorage).setItem('semeando_admin_session',JSON.stringify(s)); return s;
}
export async function requireActiveAdminAccess(opts:{redirect?:boolean}={redirect:true}){
  const s=await session();
  if(!s?.access_token){
    if(opts.redirect&&typeof window!=='undefined')location.href='/admin/login?reason=session';
    return null;
  }
  try{
    const r=await fetch(`${SB}/functions/v1/admin-access`,{headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`},cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d?.ok)return {session:s,...d};
    if(r.status===401||r.status===402||r.status===403){
      clearAdminSession();
      const reason=encodeURIComponent(String(d?.state||d?.code||'blocked'));
      const message=encodeURIComponent(String(d?.error||d?.access?.reason||'Acesso indisponível.'));
      if(opts.redirect&&typeof window!=='undefined')location.href=`/admin/login?reason=${reason}&message=${message}`;
      return null;
    }
    throw new Error(d?.error||'Não foi possível validar o acesso.');
  }catch(e){
    // Em falha transitória de rede, preserva a sessão; as RLS continuam protegendo os dados.
    return {session:s,accessCheckUnavailable:true,error:e};
  }
}
export async function adminHeaders(json=true){const s=await session();return {apikey:KEY,Authorization:`Bearer ${s?.access_token||''}`,...(json?{'Content-Type':'application/json'}:{})}}
export const money=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function slugify(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
export async function nativeShare(title:string,text:string,url:string){
  try{if(navigator.share){await navigator.share({title,text,url});return true}if(navigator.clipboard){await navigator.clipboard.writeText(url);return true}}
  catch(e:any){if(e?.name==='AbortError')return false}
  try{const t=document.createElement('textarea');t.value=url;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return true}catch{return false}
}
