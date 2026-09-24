'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {CHURCH_LOGO,DEVELOPER_LOGO,DEVELOPER_NAME} from '../brand';
import {SB,KEY} from '../../lib/sb';
import styles from './cadastro.module.css';

type AccessMode='recover'|'register';

const onlyDigits=(value:string)=>value.replace(/\D/g,'');
const formatCpf=(value:string)=>onlyDigits(value).slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
const formatPhone=(value:string)=>{
 const digits=onlyDigits(value).replace(/^55(?=\d{10,11}$)/,'').slice(0,11);
 if(digits.length<=2)return digits;
 if(digits.length<=6)return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
 if(digits.length<=10)return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
 return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
};
const defaults:any[]=[
 {field_key:'full_name',label:'Nome completo',field_type:'text',is_required:true,sort_order:10,width:'full'},
 {field_key:'birth_date',label:'Data de nascimento',field_type:'date',is_required:true,sort_order:20,width:'half'},
 {field_key:'cpf',label:'CPF',field_type:'cpf',is_required:true,sort_order:30,width:'half'},
 {field_key:'whatsapp',label:'WhatsApp',field_type:'tel',is_required:true,sort_order:40,width:'half'},
 {field_key:'email',label:'E-mail',field_type:'email',is_required:true,sort_order:50,width:'half'},
 {field_key:'housing_type',label:'Tipo de moradia',field_type:'select',is_required:true,sort_order:60,width:'full',options:[{value:'house',label:'Casa'},{value:'apartment',label:'Apartamento'},{value:'other',label:'Outro'}]},
 {field_key:'street',label:'Rua',field_type:'text',is_required:true,sort_order:70,width:'full'},
 {field_key:'neighborhood',label:'Bairro',field_type:'text',is_required:true,sort_order:80,width:'half'},
 {field_key:'city',label:'Cidade',field_type:'text',is_required:true,sort_order:90,width:'half'},
 {field_key:'has_solar',label:'Possui energia solar?',field_type:'select',is_required:true,sort_order:100,width:'full',options:[{value:'yes',label:'Sim'},{value:'no',label:'Não'}]},
 {field_key:'average_energy_bill',label:'Qual valor médio você paga na conta de luz atualmente?',field_type:'number',placeholder:'Ex.: 350',help_text:'Informe o valor aproximado em reais.',is_required:true,sort_order:105,width:'full'},
 {field_key:'privacy',label:'Política de Privacidade',field_type:'checkbox',is_required:true,sort_order:110,width:'full'},
 {field_key:'marketing_consent',label:'Consentimento de marketing',field_type:'checkbox',is_required:false,sort_order:120,width:'full'},
];

export default function Cadastro(){
 const [config,setConfig]=useState<any>(null);
 const [values,setValues]=useState<any>({});
 const [recovery,setRecovery]=useState({cpf:'',birth_date:'',whatsapp:''});
 const [mode,setMode]=useState<AccessMode>('register');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const params=typeof window!=='undefined'?new URLSearchParams(location.search):null;
 const next=params?.get('next')||'/';
 const orgSlug=params?.get('org')||'';
 const reason=params?.get('reason')||'';
 const eventMatch=next.match(/^\/evento\/([^/?#]+)/);
 const eventSlug=eventMatch?.[1]?decodeURIComponent(eventMatch[1]):'';

 useEffect(()=>{
  if(reason==='session'){
   localStorage.removeItem('semeando_visitor');
   setMode('recover');
   setError('Seu acesso neste aparelho expirou. Entre novamente abaixo; o carrinho continua salvo.');
  }else{
   try{
    const visitor=JSON.parse(localStorage.getItem('semeando_visitor')||'null');
    if(visitor?.id){
     location.replace(next.startsWith('/')?next:'/');
     return;
    }
   }catch{}
  }
  (async()=>{
   try{
    const query=eventSlug?`?event=${encodeURIComponent(eventSlug)}`:orgSlug?`?org=${encodeURIComponent(orgSlug)}`:'';
    const response=await fetch(`${SB}/functions/v1/public-org-config${query}`,{headers:{apikey:KEY}});
    const data=await response.json();
    if(response.ok){
     setConfig(data);
     const branding=data.branding||{};
     const root=document.documentElement;
     root.style.setProperty('--orange',branding.primary_color||'#ff7417');
     root.style.setProperty('--bg',branding.background_color||'#070709');
     root.style.setProperty('--card',branding.surface_color||'#131317');
     root.style.setProperty('--text',branding.text_color||'#f7f7f9');
     root.style.setProperty('--muted',branding.muted_color||'#9b9ba6');
     root.style.setProperty('--brand-button-radius',`${branding.button_radius||13}px`);
     root.style.setProperty('--brand-card-radius',`${branding.card_radius||21}px`);
    }
   }catch{}
  })();
 },[]);

 const configuredFields=(config?.fields?.length?config.fields:defaults).filter((field:any)=>field.is_enabled!==false);
 const fields=[...configuredFields];
 if(!fields.some((field:any)=>field.field_key==='average_energy_bill')){
  fields.push(defaults.find(field=>field.field_key==='average_energy_bill'));
 }
 fields.sort((a:any,b:any)=>a.sort_order-b.sort_order);
 const branding=config?.branding||{};
 const org=config?.organization;
 const groups=useMemo(()=>{
  const output:any[]=[];
  for(let index=0;index<fields.length;index+=1){
   const field=fields[index];
   if(field.width==='half'&&fields[index+1]?.width==='half')output.push([field,fields[++index]]);
   else output.push([field]);
  }
  return output;
 },[config]);

 function destination(){return next.startsWith('/')?next:'/'}
 function storeVisitor(visitor:any,purchases:any[]=[]){
  localStorage.setItem('semeando_visitor',JSON.stringify({
   id:visitor.id,
   full_name:visitor.full_name,
   organization_id:visitor.organization_id||org?.id,
   registered_at:new Date().toISOString(),
   marketing_consent:!!visitor.marketing_consent,
  }));
  if(eventSlug&&purchases.length){
   localStorage.setItem(`semeando_paid_orders:${eventSlug}`,JSON.stringify(purchases));
   localStorage.setItem(`semeando_paid_order:${eventSlug}`,JSON.stringify(purchases[0]));
  }
 }
 function changeMode(nextMode:AccessMode){
  setMode(nextMode);
  setError('');
 }
 function setValue(key:string,value:any){setValues((current:any)=>({...current,[key]:value}))}
 function setRecoveryValue(key:keyof typeof recovery,value:string){setRecovery(current=>({...current,[key]:value}))}

 function renderField(field:any){
  if(field.field_key==='privacy')return <label className="consent-box" key={field.field_key}><input type="checkbox" checked={!!values.privacy} onChange={event=>setValue('privacy',event.target.checked)}/><span>Li e aceito a <a href="/privacidade" target="_blank">Política de Privacidade</a> e autorizo o tratamento dos meus dados para acesso às galerias.</span></label>;
  if(field.field_key==='marketing_consent')return <label className="consent-box optional" key={field.field_key}><input type="checkbox" checked={!!values.marketing_consent} onChange={event=>setValue('marketing_consent',event.target.checked)}/><span>{field.help_text||'Quero receber comunicações e novidades desta organização.'} <em>Opcional.</em></span></label>;
  const common={required:!!field.is_required,value:values[field.field_key]??'',placeholder:field.placeholder||'',onChange:(event:any)=>setValue(field.field_key,event.target.value)} as any;
  let input:any;
  if(field.field_type==='select')input=<select {...common}><option value="">Selecione</option>{(field.options||[]).map((option:any)=><option value={option.value} key={option.value}>{option.label}</option>)}</select>;
  else if(field.field_type==='textarea')input=<textarea {...common}/>;
  else if(field.field_type==='checkbox')input=<input type="checkbox" checked={!!values[field.field_key]} onChange={event=>setValue(field.field_key,event.target.checked)}/>;
  else if(field.field_type==='date')input=<input type="date" {...common}/>;
  else if(field.field_type==='cpf')input=<input inputMode="numeric" {...common} value={values[field.field_key]??''} onChange={event=>setValue(field.field_key,formatCpf(event.target.value))}/>;
  else if(field.field_type==='tel')input=<input inputMode="tel" {...common} value={values[field.field_key]??''} onChange={event=>setValue(field.field_key,formatPhone(event.target.value))}/>;
  else input=<input type={field.field_type==='email'?'email':field.field_type==='number'?'number':'text'} {...common}/>;
  return <label key={field.field_key}>{field.label}{input}{field.help_text&&<small className="muted" style={{fontWeight:500}}>{field.help_text}</small>}</label>;
 }

 async function submitRecovery(event:FormEvent){
  event.preventDefault();
  setError('');
  if(!recovery.cpf||!recovery.birth_date||!recovery.whatsapp){
   setError('Preencha CPF, data de nascimento e WhatsApp para entrar.');
   return;
  }
  setBusy(true);
  try{
   const response=await fetch(`${SB}/functions/v1/visitor-register`,{
    method:'POST',
    headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({action:'recover_access',organization_id:org?.id,event_slug:eventSlug||undefined,source_event_id:config?.event?.id||undefined,cpf:onlyDigits(recovery.cpf),birth_date:recovery.birth_date,whatsapp:onlyDigits(recovery.whatsapp)}),
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Não foi possível recuperar o acesso.');
   storeVisitor(data.visitor,data.purchases||[]);
   location.replace(destination());
  }catch(caught:any){
   setError(caught.message||'Não foi possível recuperar o acesso.');
  }finally{
   setBusy(false);
  }
 }

 async function submitRegistration(event:FormEvent){
  event.preventDefault();
  setError('');
  for(const field of fields){
   if(field.is_required&&field.field_key!=='privacy'){
    const value=values[field.field_key];
    if(value===undefined||value===null||value===''){
     setError(`Preencha o campo obrigatório: ${field.label}.`);
     return;
    }
   }
  }
  if(!values.privacy){
   setError('Aceite a Política de Privacidade para continuar.');
   return;
  }
  setBusy(true);
  try{
   const payload:any={organization_id:org?.id,event_slug:eventSlug||undefined,source_event_id:config?.event?.id||undefined,privacy:!!values.privacy,marketing_consent:!!values.marketing_consent,custom_fields:{}};
   const known=new Set(['full_name','email','cpf','birth_date','housing_type','street','neighborhood','city','whatsapp','has_solar','average_energy_bill']);
   for(const [key,value] of Object.entries(values)){
    if(['privacy','marketing_consent'].includes(key))continue;
    if(known.has(key))payload[key]=key==='cpf'||key==='whatsapp'?onlyDigits(String(value)):key==='has_solar'?value==='yes':key==='average_energy_bill'?Number(value):value;
    else payload.custom_fields[key]=value;
   }
   const response=await fetch(`${SB}/functions/v1/visitor-register`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok){
    const duplicate=String(data.code||'').startsWith('DUPLICATE_');
    throw new Error(`${data.error||'Não foi possível concluir o cadastro.'}${duplicate?' Use “Já sou cadastrado” para entrar.':''}`);
   }
   storeVisitor(data.visitor,data.purchases||[]);
   location.replace(destination());
  }catch(caught:any){
   setError(caught.message||'Erro inesperado.');
  }finally{
   setBusy(false);
  }
 }

 const logo=branding.logo_url||CHURCH_LOGO;
 const name=branding.platform_name||'Legacy Semeando Memórias';
 const display=branding.organization_display_name||org?.name||'Igreja Semeando Amor';
 return <main className="register-page" style={{backgroundColor:branding.background_color||undefined,color:branding.text_color||undefined}}>
  <div className="register-shell" style={{borderRadius:branding.card_radius||undefined}}>
   <section className="register-brand" style={branding.cover_url?{backgroundImage:`linear-gradient(160deg,#000b,#0007),url(${branding.cover_url})`,backgroundSize:'cover',backgroundPosition:'center'}:{}}>
    <a className="brand-lockup" href="/"><img src={logo} alt="Logo"/><div><strong>{name}</strong><span>{display}</span></div></a>
    <div className="register-copy"><span className="hero-kicker">Acesso às galerias</span><h1>{branding.welcome_title||<>Antes de entrar,<br/><em>queremos conhecer você.</em></>}</h1><p>{branding.welcome_subtitle||`Faça seu primeiro cadastro ou entre novamente com os mesmos dados para acessar as fotos de ${display}.`}</p><div className="register-benefits"><span>✓ Acesso às galerias autorizadas</span><span>✓ Busca facial quando disponível</span><span>✓ Acesse novamente em outro aparelho</span></div></div>
    {branding.show_developer_signature!==false&&<div className="register-developer"><span>Tecnologia e desenvolvimento</span><img src={DEVELOPER_LOGO} alt={DEVELOPER_NAME}/><strong>{DEVELOPER_NAME}</strong></div>}
   </section>
   <form className="register-card" onSubmit={mode==='recover'?submitRecovery:submitRegistration} style={{borderRadius:branding.card_radius||undefined}}>
    <div className={styles.tabs} role="group" aria-label="Escolha como acessar">
     <button type="button" className={mode==='register'?styles.active:''} aria-pressed={mode==='register'} onClick={()=>changeMode('register')}>Primeiro acesso</button>
     <button type="button" className={mode==='recover'?styles.active:''} aria-pressed={mode==='recover'} onClick={()=>changeMode('recover')}>Já sou cadastrado</button>
    </div>
    <div><span className="eyebrow">{mode==='recover'?'Acesso do cliente':'Primeiro acesso'}</span><h2>{mode==='recover'?'Entrar no meu cadastro':branding.registration_title||'Realizar meu cadastro'}</h2><p className="muted">{mode==='recover'?'Informe somente os três dados abaixo. Não é necessário preencher todo o cadastro novamente.':branding.registration_subtitle||'Preencha seus dados uma única vez para acessar as fotos.'}</p></div>
    {error&&<p className="notice" role="alert">{error}</p>}
    {mode==='recover'?<div className={styles.recoveryFields}><label>CPF<input required inputMode="numeric" autoComplete="off" value={recovery.cpf} onChange={event=>setRecoveryValue('cpf',formatCpf(event.target.value))}/></label><label>Data de nascimento<input required type="date" autoComplete="bday" value={recovery.birth_date} onChange={event=>setRecoveryValue('birth_date',event.target.value)}/></label><label>WhatsApp<input required inputMode="tel" autoComplete="tel" value={recovery.whatsapp} onChange={event=>setRecoveryValue('whatsapp',formatPhone(event.target.value))}/></label></div>:groups.map((group:any[],index:number)=>group.length===2?<div className="form-row" key={index}>{group.map(renderField)}</div>:renderField(group[0]))}
    <button className="btn register-submit" disabled={busy} style={{borderRadius:branding.button_radius||undefined}}>{busy?'Validando...':mode==='recover'?'Entrar e acessar as fotos':'Realizar cadastro e continuar'}</button>
    <p className="form-footnote">{mode==='recover'?'Use o mesmo CPF, data de nascimento e WhatsApp informados no primeiro cadastro.':'Seus dados não são públicos. Campos opcionais podem ser deixados em branco.'}</p>
   </form>
  </div>
 </main>;
}
