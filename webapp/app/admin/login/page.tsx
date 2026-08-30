'use client';
import {useEffect} from 'react';
export default function Login(){useEffect(()=>{location.replace('/acesso'+location.search)},[]);return <main className="auth auth-pro"><section className="panel login"><span className="eyebrow">Acesso de gestão</span><h2>Redirecionando...</h2><p className="muted">O acesso administrativo e de desenvolvedor agora fica em uma área reservada.</p><a className="btn" href="/acesso">Ir para o acesso</a></section></main>}
