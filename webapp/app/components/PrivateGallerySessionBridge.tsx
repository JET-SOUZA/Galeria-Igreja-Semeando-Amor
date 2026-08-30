'use client';
import {useEffect} from 'react';
import {SB} from '../../lib/sb';
const KEY='semeando_private_gallery_access';
export default function PrivateGallerySessionBridge(){useEffect(()=>{const w=window as any;if(w.__semeandoPrivateFetchInstalled)return;w.__semeandoPrivateFetchInstalled=true;const original=window.fetch.bind(window);window.fetch=(input:RequestInfo|URL,init:RequestInit={})=>{try{const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;if(url.startsWith(`${SB}/functions/v1/public-gallery`)||url.startsWith(`${SB}/functions/v1/face-search`)){const stored=JSON.parse(localStorage.getItem(KEY)||'null');if(stored?.token){const headers=new Headers(init.headers||((typeof Request!=='undefined'&&input instanceof Request)?input.headers:undefined));headers.set('x-gallery-share',String(stored.token));init={...init,headers}}}}catch{}return original(input as any,init)};return()=>{}},[]);return null}
