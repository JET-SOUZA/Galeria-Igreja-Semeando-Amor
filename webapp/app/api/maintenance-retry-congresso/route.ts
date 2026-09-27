export const dynamic='force-dynamic';

export async function GET(){
  const url='https://mdhlhriakqqsocopravb.supabase.co/functions/v1/maintenance-retry-face-index?token=retry-8f77d6b9-20260927';
  const r=await fetch(url,{cache:'no-store'});
  const body=await r.text();
  return new Response(body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}