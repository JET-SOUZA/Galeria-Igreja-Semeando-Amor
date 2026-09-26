export async function GET(){
  const src='https://res.cloudinary.com/to3hnwdl/video/upload/v1790389017/tutorial-audio-natural.mp3';
  const r=await fetch(src,{cache:'no-store'});
  if(!r.ok)return new Response('audio unavailable',{status:502});
  const body=await r.arrayBuffer();
  return new Response(body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
}
