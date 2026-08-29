export const SB='https://mdhlhriakqqsocopravb.supabase.co';
export const KEY='sb_publishable_OSpepV0XiSMkQWU_UW5TbQ_TLxOYi1F';
export type AdminSession={access_token:string;refresh_token?:string;expires_at?:number;[k:string]:any};
export function readSession():AdminSession|null{
  if(typeof window==='undefined')return null;
  try{return JSON.parse(localStorage.getItem('semeando_admin_session')||sessionStorage.getItem('semeando_admin_session')||'null')}catch{return null}
}
export async function session():Promise<AdminSession|null>{
  let s=readSession(); if(!s?.access_token)return null;
  if((s.expires_at?Number(s.expires_at)*1000:0)>Date.now()+60000||!s.refresh_token)return s;
  const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({refresh_token:s.refresh_token})});
  if(!r.ok)return null; s=await r.json();
  (localStorage.getItem('semeando_admin_session')?localStorage:sessionStorage).setItem('semeando_admin_session',JSON.stringify(s)); return s;
}
export async function adminHeaders(json=true){const s=await session();return {apikey:KEY,Authorization:`Bearer ${s?.access_token||''}`,...(json?{'Content-Type':'application/json'}:{})}}
export const money=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function slugify(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
export async function nativeShare(title:string,text:string,url:string){
  try{if(navigator.share){await navigator.share({title,text,url});return true}if(navigator.clipboard){await navigator.clipboard.writeText(url);return true}}
  catch(e:any){if(e?.name==='AbortError')return false}
  try{const t=document.createElement('textarea');t.value=url;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return true}catch{return false}
}
