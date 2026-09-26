export const dynamic='force-dynamic';

const VIDEO='https://res.cloudinary.com/to3hnwdl/video/upload/v1790414384/tutorial-pago-natural-final.mp4';

export async function GET(){
  const r=await fetch(VIDEO,{cache:'no-store'});
  if(!r.ok)return new Response('video unavailable',{status:502});
  const body=await r.arrayBuffer();
  return new Response(body,{headers:{
    'Content-Type':'video/mp4',
    'Content-Disposition':'attachment; filename="Tutorial_Legacy_Semeando_Memorias_Evento_Pago_Final.mp4"',
    'Content-Length':String(body.byteLength),
    'Cache-Control':'public, max-age=3600'
  }});
}