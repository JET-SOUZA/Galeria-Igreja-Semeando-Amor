'use client'

import { FormEvent,useEffect,useMemo,useState } from 'react'
import { useRouter } from 'next/navigation'
import { SB,anonKey } from '../../lib/sb'

type SolarValue=''|'yes'|'no'
const onlyDigits=(v:string)=>v.replace(/\D/g,'')
const formatCpf=(v:string)=>onlyDigits(v).slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
const formatPhone=(v:string)=>{
  const d=onlyDigits(v).replace(/^55(?=\d{10,11}$)/,'').slice(0,11)
  if(d.length<=2)return d
  if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`
  if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)
const validCpf=(raw:string)=>{
  const cpf=onlyDigits(raw)
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false
  const calc=(len:number)=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(cpf[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r}
  return calc(9)===Number(cpf[9])&&calc(10)===Number(cpf[10])
}
const validFullName=(v:string)=>{
  const parts=v.trim().replace(/\s+/g,' ').split(' ').filter(Boolean)
  return parts.length>=2&&parts.every(p=>p.length>=2&&/^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(p))
}
const validPhone=(v:string)=>{const d=onlyDigits(v).replace(/^55(?=\d{10,11}$)/,'');return d.length===10||d.length===11}
const validBirthDate=(v:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false
  const d=new Date(v+'T00:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)return false
  const now=new Date();if(d>now)return false
  const min=new Date();min.setUTCFullYear(min.getUTCFullYear()-120);return d>=min
}

export default function Cadastro(){
  const router=useRouter()
  const [form,setForm]=useState({full_name:'',email:'',cpf:'',birth_date:'',housing_type:'house',street:'',neighborhood:'',city:'Campos dos Goytacazes',whatsapp:'',has_solar:'' as SolarValue,privacy:false,marketing_consent:false})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const maxBirth=useMemo(()=>new Date().toISOString().slice(0,10),[])
  useEffect(()=>{try{const v=localStorage.getItem('semeando_visitor');if(v)router.replace('/')}catch{}},[router])
  const set=(k:string,v:any)=>setForm((s:any)=>({...s,[k]:v}))
  async function submit(e:FormEvent){
    e.preventDefault();setError('')
    if(!validFullName(form.full_name)){setError('Informe seu nome e sobrenome válidos.');return}
    if(!validEmail(form.email)){setError('Informe um e-mail válido.');return}
    if(!validCpf(form.cpf)){setError('Informe um CPF válido.');return}
    if(!validBirthDate(form.birth_date)){setError('Informe uma data de nascimento válida.');return}
    if(!validPhone(form.whatsapp)){setError('Informe um WhatsApp válido com DDD.');return}
    if(!['house','apartment','other'].includes(form.housing_type)||!form.street.trim()||!form.neighborhood.trim()||!form.city.trim()){
      setError('Preencha corretamente os dados de moradia e endereço.');return
    }
    if(!form.has_solar){setError('Informe se você possui energia solar.');return}
    if(!form.privacy){setError('Você precisa aceitar a Política de Privacidade.');return}
    setBusy(true)
    try{
      const payload={...form,full_name:form.full_name.trim().replace(/\s+/g,' '),email:form.email.trim().toLowerCase(),cpf:onlyDigits(form.cpf),whatsapp:onlyDigits(form.whatsapp),has_solar:form.has_solar==='yes'}
      const r=await fetch(`${SB}/functions/v1/visitor-register`,{method:'POST',headers:{'Content-Type':'application/json',apikey:anonKey},body:JSON.stringify(payload)})
      const j=await r.json();if(!r.ok)throw new Error(j?.error||'Não foi possível concluir o cadastro.')
      localStorage.setItem('semeando_visitor',JSON.stringify(j.visitor));router.replace('/')
    }catch(err:any){setError(err?.message||'Erro ao realizar cadastro.')}finally{setBusy(false)}
  }
  return <main className="page"><section className="card auth-card"><div className="brand-row"><div><div className="eyebrow">Igreja Semeando Amor</div><h1>Cadastro</h1><p className="muted">Preencha seus dados para acessar as suas fotos.</p></div></div>
    <form onSubmit={submit} className="form-grid" noValidate>
      <label>Nome completo<input value={form.full_name} onChange={e=>set('full_name',e.target.value)} autoComplete="name" required /></label>
      <label>E-mail<input type="email" value={form.email} onChange={e=>set('email',e.target.value)} autoComplete="email" required /></label>
      <label>CPF<input value={form.cpf} onChange={e=>set('cpf',formatCpf(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14} required /></label>
      <label>Data de nascimento<input type="date" value={form.birth_date} onChange={e=>set('birth_date',e.target.value)} max={maxBirth} required /></label>
      <label>WhatsApp<input value={form.whatsapp} onChange={e=>set('whatsapp',formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(22) 99999-9999" required /></label>
      <label>Possui energia solar?<select value={form.has_solar} onChange={e=>set('has_solar',e.target.value as SolarValue)} required><option value="">Selecione</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
      <label>Tipo de moradia<select value={form.housing_type} onChange={e=>set('housing_type',e.target.value)} required><option value="house">Casa</option><option value="apartment">Apartamento</option><option value="other">Outro</option></select></label>
      <label>Rua<input value={form.street} onChange={e=>set('street',e.target.value)} autoComplete="street-address" required /></label>
      <label>Bairro<input value={form.neighborhood} onChange={e=>set('neighborhood',e.target.value)} required /></label>
      <label>Cidade<input value={form.city} onChange={e=>set('city',e.target.value)} autoComplete="address-level2" required /></label>
      <label className="check"><input type="checkbox" checked={form.privacy} onChange={e=>set('privacy',e.target.checked)} /> <span>Li e aceito a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>
      <label className="check"><input type="checkbox" checked={form.marketing_consent} onChange={e=>set('marketing_consent',e.target.checked)} /> <span>Quero receber novidades e informações da Legacy Solar. (Opcional)</span></label>
      {error&&<div className="notice error">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy?'Validando e cadastrando...':'Cadastrar e continuar'}</button>
    </form>
  </section></main>
}
