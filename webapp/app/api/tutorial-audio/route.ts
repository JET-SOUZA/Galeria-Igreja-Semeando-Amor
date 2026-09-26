export const dynamic='force-dynamic';

export async function GET(){
  const src='https://res.cloudinary.com/to3hnwdl/video/upload/v1790412352/tutorial-pago-narracao-final.mp3';
  const r=await fetch(src,{cache:'no-store'});
  if(!r.ok)return new Response('audio unavailable',{status:502});
  const body=await r.arrayBuffer();
  return new Response(body,{headers:{
    'Content-Type':'audio/mpeg',
    'Content-Disposition':'inline; filename="narracao-tutorial-pago.mp3"',
    'Cache-Control':'public, max-age=3600'
  }});
}