import type {Metadata} from 'next';
import type {ReactNode} from 'react';

const SB='https://mdhlhriakqqsocopravb.supabase.co';
const KEY='sb_publishable_OSpepV0XiSMkQWU_UW5TbQ_TLxOYi1F';
const SITE='https://semeando-memorias.vercel.app';

function socialImage(url?:string|null){
  if(!url)return `${SITE}/icon.png`;
  if(/res\.cloudinary\.com\//.test(url)){
    return url.replace('/upload/','/upload/c_fill,w_1200,h_630,f_jpg,q_auto/')
  }
  return url
}

async function eventBySlug(slug:string){
  try{
    const r=await fetch(`${SB}/functions/v1/public-gallery?slug=${encodeURIComponent(slug)}`,{
      headers:{apikey:KEY},
      next:{revalidate:60}
    });
    if(!r.ok)return null;
    const d=await r.json();
    return d?.event||null;
  }catch{return null}
}

export async function generateMetadata({params}:{params:{slug:string}}):Promise<Metadata>{
  const event=await eventBySlug(params.slug);
  const url=`${SITE}/evento/${params.slug}`;
  if(!event){
    return {
      title:'Legacy Semeando Memórias',
      description:'Fotos que contam histórias.',
      alternates:{canonical:url}
    }
  }

  const title=`${event.title} | Legacy Semeando Memórias`;
  const description=[event.location,'Galeria oficial do evento'].filter(Boolean).join(' • ');
  const image=socialImage(event.cover_url);

  return {
    title,
    description,
    alternates:{canonical:url},
    openGraph:{
      type:'website',
      url,
      siteName:'Legacy Semeando Memórias',
      title,
      description,
      images:[{url:image,width:1200,height:630,alt:`Capa do evento ${event.title}`}]
    },
    twitter:{
      card:'summary_large_image',
      title,
      description,
      images:[image]
    }
  }
}

export default function EventLayout({children}:{children:ReactNode}){return children}
