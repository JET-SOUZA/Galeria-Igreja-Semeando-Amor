'use client';
import {useEffect,useState} from 'react';
import {KEY,SB,readSession} from '../../lib/sb';

type Ctx={id:string;name?:string};
export default function DeveloperModeSwitcher(){
 const [isDev,setIsDev]=useState(false),[open,setOpen]=useState(false),[ctx,setCtx]=useState<Ctx|null>(null);
 useEffect(()=>{
  try{const raw=localStorage.getItem('semeando_developer_admin_context');if(raw)setCtx(JSON.parse(raw))}catch{}
  const s=readSession();if(!s?.access_token)return;
  fetch(`${SB}/functions/v1/developer-console`,{headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`}}).then(r=>setIsDev(r.ok)).catch(()=>{});
  const onCtx=(e:Event)=>{const d=(e as CustomEvent).detail;setCtx(d||null)};
  window.addEventListener('semeando-developer-context',onCtx as EventListener);
  return()=>window.removeEventListener('semeando-developer-context',onCtx as EventListener);
 },[]);
 if(!isDev)return null;
 const inDeveloper=typeof location!=='undefined'&&location.pathname.startsWith('/developer');
 return <div className="dev-switch-wrap"><button className="dev-switch-trigger" onClick={()=>setOpen(x=>!x)}><span>DEV</span><b>{inDeveloper?'Developer':'Admin'}</b><i>⌄</i></button>{open&&<div className="dev-switch-menu"><strong>Alternar acesso</strong><a className={inDeveloper?'active':''} href="/developer">⌂ Painel Developer</a><a href="/developer/clientes">▦ Clientes</a>{ctx?.id&&<a href={`/developer/clientes/${ctx.id}/admin`}>◉ Admin • {ctx.name||'cliente atual'}</a>}<a href="/conta">◎ Minha conta</a></div>}<style jsx>{`
.dev-switch-wrap{position:fixed;z-index:96;left:18px;top:max(14px,env(safe-area-inset-top));font-family:system-ui,-apple-system,sans-serif}.dev-switch-trigger{height:46px;border:1px solid #444b56;background:#12161cdd;color:#fff;border-radius:14px;padding:5px 10px;display:flex;align-items:center;gap:8px;box-shadow:0 12px 32px #0008;backdrop-filter:blur(16px)}.dev-switch-trigger span{background:#ff7417;color:#fff;border-radius:9px;padding:8px 7px;font-size:9px;font-weight:950;letter-spacing:.08em}.dev-switch-trigger b{font-size:11px}.dev-switch-trigger i{font-style:normal;color:#9ca3ad}.dev-switch-menu{position:absolute;left:0;top:54px;width:245px;background:#11151bf7;border:1px solid #343b46;border-radius:16px;padding:10px;box-shadow:0 22px 60px #000b;display:grid;gap:4px}.dev-switch-menu strong{font-size:9px;color:#ff9a55;letter-spacing:.14em;text-transform:uppercase;padding:6px 9px}.dev-switch-menu a{color:#e9edf2;text-decoration:none;padding:11px 12px;border-radius:10px;font-size:11px;font-weight:800}.dev-switch-menu a.active,.dev-switch-menu a:hover{background:#222831}.dev-switch-menu a:nth-of-type(3){background:#2b1a10;color:#ffb07a;border:1px solid #6e3a1c}@media(max-width:700px){.dev-switch-wrap{left:10px}.dev-switch-trigger b,.dev-switch-trigger i{display:none}.dev-switch-trigger{padding:5px}.dev-switch-menu{width:min(270px,calc(100vw - 20px))}}
`}</style></div>
}
