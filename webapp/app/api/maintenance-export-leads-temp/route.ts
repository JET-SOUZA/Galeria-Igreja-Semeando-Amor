export const dynamic='force-dynamic';
export async function GET(req:Request){
  const u=new URL(req.url);
  if(u.searchParams.get('key')!=='x91-20260928') return new Response('forbidden',{status:403});
  const r=await fetch('https://mdhlhriakqqsocopravb.supabase.co/functions/v1/maintenance-export-leads?token=lead-export-20260928-x91',{cache:'no-store'});
  const body=await r.arrayBuffer();
  return new Response(body,{status:r.status,headers:{
    'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition':'attachment; filename="leads-congresso-2026.csv"',
    'Cache-Control':'no-store'
  }});
}