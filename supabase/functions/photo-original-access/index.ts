import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {GetObjectCommand,S3Client} from "npm:@aws-sdk/client-s3@3.883.0";
import {getSignedUrl} from "npm:@aws-sdk/s3-request-presigner@3.883.0";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const ANON=(Deno.env.get('SUPABASE_ANON_KEY')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const R2_ACCESS=(Deno.env.get('R2_ACCESS_KEY_ID')||'').trim();
const R2_SECRET=(Deno.env.get('R2_SECRET_ACCESS_KEY')||'').trim();
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
const j=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a)).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(value:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
function filename(value:any){return String(value||'foto-original').replace(/[\r\n"\\]/g,'-').slice(0,180)||'foto-original'}

async function visitorCanDownload(admin:any,input:any,photoId:string,event:any){
  const orderId=String(input.order_id||''),token=String(input.access_token||'');
  if(!orderId||!token)return false;
  const {data:o}=await admin.from('payment_orders')
    .select('id,event_id,organization_id,status,purpose,metadata,items')
    .eq('id',orderId)
    .maybeSingle();
  if(!o||o.status!=='paid'||!['event_purchase','photo_purchase'].includes(String(o.purpose||'')))return false;
  if(String(o.event_id)!==String(event.id)||String(o.organization_id)!==String(event.organization_id))return false;
  const expected=String(o.metadata?.public_token_hash||o.metadata?.access_token_hash||'');
  if(!expected||await hash(token)!==expected)return false;
  const itemIds=Array.isArray(o.items)?o.items.map((x:any)=>String(x?.photo_id||x?.id||'')):[];
  const legacyIds=Array.isArray(o.metadata?.photo_ids)?o.metadata.photo_ids.map((x:any)=>String(x)):[];
  return [...itemIds,...legacyIds].includes(photoId);
}

async function adminCanDownload(admin:any,req:Request,event:any){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)return false;
  const userClient=createClient(SB,ANON,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await userClient.auth.getUser(token);
  if(!user)return false;
  const {data:profile}=await admin.from('admin_profiles').select('role,is_active').eq('user_id',user.id).maybeSingle();
  if(!profile?.is_active)return false;
  if(profile.role==='developer')return true;
  const {data:member}=await admin.from('organization_members')
    .select('organization_id,permission_overrides')
    .eq('user_id',user.id)
    .eq('organization_id',event.organization_id)
    .eq('is_active',true)
    .maybeSingle();
  if(!member)return false;
  const {data:role}=await admin.from('access_roles').select('permissions').eq('code',profile.role).maybeSingle();
  const permissions=new Set<string>(role?.permissions||[]);
  for(const p of member.permission_overrides?.allow||[])permissions.add(String(p));
  for(const p of member.permission_overrides?.deny||[])permissions.delete(String(p));
  return permissions.has('*')||permissions.has('photos.view');
}

async function signedOriginal(admin:any,photo:any,event:any){
  const provider=String(photo.original_storage_provider||'supabase').toLowerCase();
  const key=String(photo.original_storage_path||'');
  const downloadName=filename(photo.original_filename);
  if(!key)throw Error('ORIGINAL_NOT_AVAILABLE');
  if(provider==='r2'){
    if(!R2_ACCESS||!R2_SECRET)throw Error('R2_SECRETS_MISSING');
    let backend:any=null;
    if(photo.original_storage_backend_id){
      const q=await admin.from('storage_backends').select('id,provider,endpoint,bucket_name,active,readiness_status').eq('id',photo.original_storage_backend_id).maybeSingle();
      backend=q.data;
    }
    if(!backend){
      const q=await admin.from('event_storage_spaces').select('storage_backends(id,provider,endpoint,bucket_name,active,readiness_status)').eq('event_id',event.id).maybeSingle();
      backend=q.data?.storage_backends;
    }
    if(!backend||backend.provider!=='r2'||!backend.endpoint||!backend.bucket_name||!backend.active)throw Error('R2_NOT_CONFIGURED');
    const client=new S3Client({region:'auto',endpoint:backend.endpoint,credentials:{accessKeyId:R2_ACCESS,secretAccessKey:R2_SECRET}});
    const url=await getSignedUrl(client,new GetObjectCommand({
      Bucket:photo.original_storage_bucket||backend.bucket_name,
      Key:key,
      ResponseContentDisposition:`attachment; filename="${downloadName}"`
    }),{expiresIn:120});
    return{url,expires_in:120,filename:downloadName,provider:'r2'};
  }
  const bucket=photo.original_storage_bucket||'photo-originals';
  const {data,error}=await admin.storage.from(bucket).createSignedUrl(key,120,{download:downloadName});
  if(error||!data?.signedUrl)throw Error(error?.message||'SIGNED_URL_FAILED');
  return{url:data.signedUrl,expires_in:120,filename:downloadName,provider:'supabase'};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(!['GET','POST'].includes(req.method))return j({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const input=req.method==='POST'?await req.json().catch(()=>({})):Object.fromEntries(new URL(req.url).searchParams);
    const photoId=String(input.photo_id||'');
    if(!photoId)return j({error:'photo_id obrigatório.'},400);
    const admin=createClient(SB,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:photo}=await admin.from('photos')
      .select('id,event_id,original_storage_provider,original_storage_backend_id,original_storage_bucket,original_storage_path,original_filename')
      .eq('id',photoId)
      .is('deleted_at',null)
      .maybeSingle();
    if(!photo?.original_storage_path)return j({error:'Original não disponível.'},404);
    const {data:event}=await admin.from('events').select('id,organization_id').eq('id',photo.event_id).maybeSingle();
    if(!event)return j({error:'Evento não encontrado.'},404);
    const visitorAllowed=await visitorCanDownload(admin,input,photoId,event);
    const staffAllowed=visitorAllowed?false:await adminCanDownload(admin,req,event);
    if(!visitorAllowed&&!staffAllowed)return j({error:'Compra confirmada ou acesso administrativo necessário.'},403);
    return j(await signedOriginal(admin,photo,event));
  }catch(e:any){
    const message=String(e?.message||'Erro interno.');
    const status=['ORIGINAL_NOT_AVAILABLE'].includes(message)?404:['R2_SECRETS_MISSING','R2_NOT_CONFIGURED'].includes(message)?503:500;
    console.error('photo-original-access',message);
    return j({error:message},status);
  }
});
