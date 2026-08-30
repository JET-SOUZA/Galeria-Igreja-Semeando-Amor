'use client';
import {FormEvent,useEffect,useState} from 'react';
import {CHURCH_LOGO,LEGACY_LOGO} from '../../brand';
import {SB,KEY,readSession} from '../../../lib/sb';

export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function routeByRole(accessToken:string){
  const dev=await fetch(`${SB}/functions/v1/developer-console`,{headers:{apikey:KEY,Authorization:`Bearer ${accessToken}`}});
  if(dev.ok){location.replace('/developer');return true}
  const admin=await fetch(`${SB}/functions/v1/admin-access`,{headers:{apikey:KEY,Authorization:`Bearer ${accessToken}`}});
  const info=await admin.json().catch(()=>({}));
  if(admin.ok){location.replace('/admin');return true}
  if(admin.status===402&&info?.code==='ORGANIZATION_ACCESS_BLOCKED')throw new Error(info.error||'O acesso desta organização está temporariamente indisponível.');
  if(info?.error)throw new Error(info.error);
  return false
 }
 useEffect(()=>{const s=readSession();if(s?.access_token)routeByRole(s.access_token).then(ok=>{if(!ok){localStorage.removeItem('semeando_admin_session');sessionStorage.removeItem('semeando_admin_session')}}).catch(err=>{setError(err.message||'Acesso indisponível.');localStorage.removeItem('semeando_admin_session');sessionStorage.removeItem('semeando_admin_session')})},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.msg||d.message||'E-mail ou senha inválidos.');
  localStorage.removeItem('semeando_admin_session');sessionStorage.removeItem('semeando_admin_session');
  (remember?localStorage:sessionStorage).setItem('semeando_admin_session',JSON.stringify(d));
  const ok=await routeByRole(d.access_token);if(!ok){localStorage.removeItem('semeando_admin_session');sessionStorage.removeItem('semeando_admin_session');throw new Error('Esta conta não possui acesso administrativo ativo.');}
 }catch(err:any){setError(err.message||'Não foi possível entrar.')}finally{setBusy(false)}}
 return <main className="auth auth-pro"><section className="auth-brand"><img src={CHURCH_LOGO} alt="Igreja Semeando Amor"/><span className="eyebrow">Igreja Semeando Amor</span><h1>Semeando<br/>Memórias</h1><p>Painel de gestão das galerias, usuários, leads e reconhecimento facial.</p><div className="auth-byline"><span>Desenvolvido por</span><img src={LEGACY_LOGO} alt="Legacy Solar"/><b>Legacy Solar</b></div></section><form className="panel login" onSubmit={submit}><span className="eyebrow">Acesso restrito</span><h2>Área administrativa</h2><p className="muted">Entre com seu e-mail e senha. O sistema abrirá automaticamente o painel correspondente ao seu perfil.</p>{error&&<p className="notice">{error}</p>}<label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Permanecer logado neste aparelho</label><button className="btn" disabled={busy}>{busy?'Entrando...':'Entrar'}</button><a className="back-site" href="/">← Voltar ao site</a></form></main>
}
