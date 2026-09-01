import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'apikey,content-type',
  'Access-Control-Allow-Methods':'GET,OPTIONS'
};

function svc(){
  return {apikey:SERVICE,Authorization:`Bearer ${SERVICE}`};
}

function watermarked(url:string){
  const tx='c_pad,w_900,h_900,b_rgb:080a0d/f_auto,q_auto:good/l_text:Arial_58_bold:SEMEANDO%20MEMORIAS,co_white,o_55/fl_layer_apply,g_center';
  return url.includes('/upload/') ? url.replace('/upload/',`/upload/${tx}/`) : url;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='GET') return new Response('Método não suportado',{status:405,headers:cors});
  try{
    const u=new URL(req.url);
    const id=u.searchParams.get('id')||'';
    if(!id) return new Response('Foto não informada',{status:400,headers:cors});

    const pr=await fetch(`${SB}/rest/v1/photos?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&status=eq.published&select=id,event_id,secure_url`,{headers:svc()});
    const ps=await pr.json();
    if(!pr.ok||!ps?.[0]) return new Response('Foto não encontrada',{status:404,headers:cors});
    const p=ps[0];

    const er=await fetch(`${SB}/rest/v1/events?id=eq.${encodeURIComponent(p.event_id)}&status=eq.published&is_paid=eq.true&select=id`,{headers:svc()});
    const es=await er.json();
    if(!er.ok||!es?.[0]) return new Response('Prévia indisponível',{status:404,headers:cors});

    const ir=await fetch(watermarked(p.secure_url));
    if(!ir.ok) return new Response('Não foi possível gerar a prévia',{status:502,headers:cors});

    const h=new Headers(cors);
    h.set('Content-Type',ir.headers.get('content-type')||'image/jpeg');
    h.set('Cache-Control','public, max-age=300, s-maxage=300');
    h.set('Content-Disposition','inline');
    return new Response(ir.body,{status:200,headers:h});
  }catch(e){
    console.error(e);
    return new Response('Erro ao carregar prévia',{status:500,headers:cors});
  }
});
