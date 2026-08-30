'use client';
import {FormEvent,useEffect,useState} from 'react';
import {CHURCH_LOGO,LEGACY_LOGO} from '../brand';
import {SB,KEY,readSession} from '../../lib/sb';

type AccessMode='admin'|'developer';

export default function Acesso(){
 const [mode,setMode]=useState<AccessMode>('admin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 async function validateRole(token:string,selected:AccessMode){
  if(selected==='developer'){
   const r=await fetch(`${SB}/functions/v1/developer-console`,{headers:{apikey:KEY,Authorization:`Bearer ${token}`}});
   if(!r.ok)throw new Error('Esta conta não possui acesso de Desenvolvedor.');
   return '/developer';
  }
  const r=await fetch(`${SB}/functions/v1/admin-access`,{headers:{apikey:KEY,Authorization:`Bearer ${token}`}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error||'Esta conta não possui acesso administrativo ativo.');
  if(d?.profile?.role==='developer')throw new Error('Esta conta é de Desenvolvedor. Selecione “Desenvolvedor” para entrar.');
  return '/admin';
 }
 useEffect(()=>{const s=readSession();if(!s?.access_token)return;(async()=>{try{const dev=await fetch(`${SB}/functions/v1/developer-console`,{headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`}});if(dev.ok){setMode('developer');setEmail('legacysolar07@gmail.com')}}catch{}})()},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setInfo('');try{
  const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.msg||d.message||'E-mail ou senha inválidos.');
  const dest=await validateRole(d.access_token,mode);
  localStorage.removeItem('semeando_admin_session');sessionStorage.removeItem('semeando_admin_session');(remember?localStorage:sessionStorage).setItem('semeando_admin_session',JSON.stringify(d));location.replace(dest)
 }catch(err:any){setError(err.message||'Não foi possível entrar.')}finally{setBusy(false)}}
 async function createPassword(){setError('');setInfo('');const target=email.trim();if(!target){setError('Informe o e-mail da conta.');return}setBusy(true);try{const redirect=`${location.origin}/admin/primeiro-acesso`;const r=await fetch(`${SB}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:target})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d?.msg||d?.message||'Não foi possível enviar o link.')}setInfo('Enviamos um link para você criar ou redefinir sua senha. Abra o e-mail neste aparelho e conclua o acesso.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <main className="auth auth-pro"><section className="auth-brand"><img src={CHURCH_LOGO} alt="Semeando Memórias"/><span className="eyebrow">Acesso de gestão</span><h1>Semeando<br/>Memórias</h1><p>Área reservada para equipe administrativa e desenvolvedor da plataforma.</p><div className="auth-byline"><span>Desenvolvido por</span><img src={LEGACY_LOGO} alt="Legacy Solar"/><b>Legacy Solar</b></div></section><form className="panel login" onSubmit={submit}><span className="eyebrow">Acesso restrito</span><h2>Entrar na gestão</h2><p className="muted">Escolha o tipo de acesso. O sistema confirma sua permissão antes de liberar o painel.</p><div className="access-selector"><button type="button" className={mode==='admin'?'btn':'btn alt'} onClick={()=>{setMode('admin');setError('')}}>Administrador</button><button type="button" className={mode==='developer'?'btn':'btn alt'} onClick={()=>{setMode('developer');setEmail('legacysolar07@gmail.com');setError('')}}>Desenvolvedor</button></div>{error&&<p className="notice">{error}</p>}{info&&<p className="notice">{info}</p>}<label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Permanecer logado neste aparelho</label><button className="btn" disabled={busy}>{busy?'Validando...':mode==='developer'?'Entrar como Desenvolvedor':'Entrar como Administrador'}</button><button type="button" className="btn alt" disabled={busy} onClick={createPassword}>{mode==='developer'?'Criar / redefinir minha senha':'Esqueci minha senha'}</button><a className="back-site" href="/">← Voltar ao site público</a></form></main>
}
