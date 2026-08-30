import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
  const commit=(process.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,12);
  return NextResponse.json({ok:true,service:'webapp',environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'unknown',deployment_url:process.env.VERCEL_URL||null,commit:commit||null,region:process.env.VERCEL_REGION||null,checked_at:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})
}
