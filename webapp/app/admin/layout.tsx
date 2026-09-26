'use client';
import {ReactNode,useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {requireActiveAdminAccess,readSession} from '../../lib/sb';
import AccountMenu from '../components/AccountMenu';
import DeveloperModeSwitcher from '../components/DeveloperModeSwitcher';

export default function AdminLayout({children}:{children:ReactNode}){
 const pathname=usePathname();
 const publicAdminRoute=pathname==='/admin/login'||pathname==='/admin/primeiro-acesso';
 const [checking,setChecking]=useState(!publicAdminRoute);
 useEffect(()=>{
  if(publicAdminRoute){setChecking(false);return}
  let active=true;
  const check=async(initial=false)=>{
   const result=await requireActiveAdminAccess({redirect:initial});
   if(!active)return;
   if(result){setChecking(false);return}
   // Se a sessão ainda existe, foi uma falha transitória: mantém a tela aberta e tenta de novo depois.
   if(readSession()){setChecking(false);return}
   location.href='/admin/login?reason=session';
  };
  check(true);
  const timer=window.setInterval(()=>check(false),120000);
  const onFocus=()=>check(false);
  const onVisibility=()=>{if(document.visibilityState==='visible')check(false)};
  const onStorage=(e:StorageEvent)=>{if(e.key==='semeando_admin_session'&&!readSession())location.href='/admin/login?reason=session'};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('storage',onStorage);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('storage',onStorage)};
 },[publicAdminRoute]);
 if(checking&&!publicAdminRoute)return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b0d10',color:'#f5f7fa',fontFamily:'system-ui'}}><div style={{textAlign:'center'}}><div style={{width:34,height:34,border:'3px solid #30353d',borderTopColor:'#ff7417',borderRadius:'50%',margin:'0 auto 14px',animation:'spin .8s linear infinite'}}/><b>Validando acesso...</b><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></div></main>;
 return <>{!publicAdminRoute&&<><DeveloperModeSwitcher/><AccountMenu/></>}{children}</>;
}
