'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

export default function DeveloperOnboardingEnforcer(){
 const pathname=usePathname();
 useEffect(()=>{
  if(pathname!=='/developer')return;
  const onClick=(ev:MouseEvent)=>{
   const target=ev.target as HTMLElement|null;
   const button=target?.closest('button,a') as HTMLElement|null;
   if(!button)return;
   const text=(button.textContent||'').toLowerCase();
   if(text.includes('novo cliente')||text.includes('criar cliente')){
    ev.preventDefault();
    ev.stopPropagation();
    location.href='/developer/onboarding';
   }
  };
  document.addEventListener('click',onClick,true);
  return()=>document.removeEventListener('click',onClick,true);
 },[pathname]);
 return null;
}
