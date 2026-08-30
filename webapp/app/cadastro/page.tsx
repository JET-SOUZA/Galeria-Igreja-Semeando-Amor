'use client';
import {FormEvent,useEffect,useMemo,useState} from 'react';
import {CHURCH_LOGO,LEGACY_LOGO} from '../brand';
import {SB,KEY} from '../../lib/sb';

type SolarValue=''|'yes'|'no';

function onlyDigits(v:string){return v.replace(/\D/g,'')}
function formatCpf(v:string){
 const d=onlyDigits(v).slice(0,11);
 return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
}
function formatPhone(v:string){
 const d=onlyDigits(v).replace(/^55(?=\d{10,11}$)/,'').slice(0,11);
 if(d.length<=2)return d?`(${d}`:'';
 if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`;
 if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
 return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)}
function validCpf(raw:string){
 const cpf=onlyDigits(raw);
 if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
 const calc=(len:number)=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(cpf[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r};
 return calc(9)===Number(cpf[9])&&calc(10)===Number(cpf[10]);
}
function validFullName(v:string){const parts=v.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);return parts.length>=2&&parts.every(p=>p.length>=2&&/^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(p))}
function validPhone(v:string){const d=onlyDigits(v).replace(/^55(?=\d{10,11}$)/,'');return d.length===10||d.length===11}
function validBirthDate(v:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v||d>new Date())return false;const min=new Date();min.setUTCFullYear(min.getUTCFullYear()-120);return d>=min}

export default function Cadastro(){
 const [form,setForm]=useState({full_name:'',email:'',cpf:'',birth_date:'',has_solar:'' as SolarValue,housing_type:'house',street:'',neighborhood:'',city:'Campos dos Goytacazes',whatsapp:'',privacy:false,marketing_consent:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const next=typeof window!=='undefined'?new URLSearchParams(location.search).get('next')||'/':'';
 const maxBirth=useMemo(()=>new Date().toISOString().slice(0,10),[]);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('semeando_visitor')||'null');if(v?.id){const n=next.startsWith('/')?next:'/';location.replace(n)}}catch{}},[]);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  const fullName=form.full_name.trim().replace(/\s+/g,' ');
  if(!validFullName(fullName)){setError('Informe nome e sobrenome válidos.');return}
  if(!validEmail(form.email.trim())){setError('Informe um e-mail válido.');return}
  if(!validCpf(form.cpf)){setError('Informe um CPF válido.');return}
  if(!validBirthDate(form.birth_date)){setError('Informe uma data de nascimento válida.');return}
  if(!validPhone(form.whatsapp)){setError('Informe um WhatsApp válido com DDD.');return}
  if(form.has_solar===''){setError('Informe se você possui energia solar.');return}
  if(!form.privacy){setError('Aceite a Política de Privacidade para continuar.');return}
  setBusy(true);
  try{
   const payload={...form,full_name:fullName,email:form.email.trim().toLowerCase(),cpf:onlyDigits(form.cpf),whatsapp:onlyDigits(form.whatsapp),has_solar:form.has_solar==='yes'};
   const r=await fetch(`${SB}/functions/v1/visitor-register`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir o cadastro.');
   const v=d.visitor;localStorage.setItem('semeando_visitor',JSON.stringify({id:v.id,full_name:v.full_name,registered_at:new Date().toISOString(),marketing_consent:v.marketing_consent}));location.href=next.startsWith('/')?next:'/';
  }catch(err:any){setError(err.message||'Erro inesperado.')}finally{setBusy(false)}
 }
 return <main className="register-page"><div className="register-shell"><section className="register-brand"><a className="brand-lockup" href="/"><img src={CHURCH_LOGO} alt="Logo Igreja Semeando Amor"/><div><strong>Semeando Memórias</strong><span>Igreja Semeando Amor</span></div></a><div className="register-copy"><span className="hero-kicker">Acesso às galerias</span><h1>Antes de entrar,<br/><em>queremos conhecer você.</em></h1><p>Seu cadastro é gratuito e libera o acesso às fotos dos eventos da Igreja Semeando Amor.</p><div className="register-benefits"><span>✓ Acesso às galerias publicadas</span><span>✓ Busca facial por selfie</span><span>✓ Cadastro feito uma única vez neste aparelho</span></div></div><div className="register-developer"><span>Tecnologia e desenvolvimento</span><img src={LEGACY_LOGO} alt="Legacy Solar"/><strong>Legacy Solar</strong></div></section>
 <form className="register-card" onSubmit={submit} noValidate><div><span className="eyebrow">Cadastro de visitante</span><h2>Libere seu acesso</h2><p className="muted">Preencha seus dados corretamente para acessar as galerias.</p></div>{error&&<p className="notice">{error}</p>}
 <label>Nome completo<input autoComplete="name" required placeholder="Nome e sobrenome" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label>
 <div className="form-row"><label>CPF<input inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" maxLength={14} value={form.cpf} onChange={e=>setForm({...form,cpf:formatCpf(e.target.value)})}/></label><label>Data de nascimento<input type="date" required max={maxBirth} value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label></div>
 <label>E-mail<input type="email" inputMode="email" autoComplete="email" required placeholder="voce@exemplo.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label>WhatsApp<input inputMode="tel" autoComplete="tel" required placeholder="(22) 99999-9999" maxLength={15} value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:formatPhone(e.target.value)})}/></label>
 <label>Possui energia solar?<select required value={form.has_solar} onChange={e=>setForm({...form,has_solar:e.target.value as SolarValue})}><option value="">Selecione</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
 <label>Tipo de moradia<select required value={form.housing_type} onChange={e=>setForm({...form,housing_type:e.target.value})}><option value="house">Casa</option><option value="apartment">Apartamento</option><option value="other">Outro</option></select></label>
 <label>Rua<input autoComplete="street-address" required placeholder="Nome da rua" value={form.street} onChange={e=>setForm({...form,street:e.target.value})}/></label>
 <div className="form-row"><label>Bairro<input required value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})}/></label><label>Cidade<input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label></div>
 <label className="consent-box"><input type="checkbox" checked={form.privacy} onChange={e=>setForm({...form,privacy:e.target.checked})}/><span>Li e aceito a <a href="/privacidade" target="_blank">Política de Privacidade</a> e autorizo o tratamento dos meus dados para controle de acesso às galerias.</span></label>
 <label className="consent-box optional"><input type="checkbox" checked={form.marketing_consent} onChange={e=>setForm({...form,marketing_consent:e.target.checked})}/><span>Quero receber contato da <b>Legacy Solar</b> sobre economia de energia, energia solar e oportunidades relacionadas. <em>Opcional.</em></span></label>
 <button className="btn register-submit" disabled={busy}>{busy?'Validando e cadastrando...':'Continuar para as fotos'}</button><p className="form-footnote">Seus dados não são públicos. O consentimento comercial é opcional e pode ser revogado.</p></form></div></main>
}
