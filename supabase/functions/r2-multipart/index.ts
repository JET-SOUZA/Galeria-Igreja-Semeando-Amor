import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand,
} from "npm:@aws-sdk/client-s3@3.883.0";
import {getSignedUrl} from "npm:@aws-sdk/s3-request-presigner@3.883.0";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const ANON=(Deno.env.get('SUPABASE_ANON_KEY')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const AK=(Deno.env.get('R2_ACCESS_KEY_ID')||'').trim();
const SK=(Deno.env.get('R2_SECRET_ACCESS_KEY')||'').trim();
const PART_SIZE=8*1024*1024;
const MAX_PARTS=10000;
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const j=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

async function actor(req:Request){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)throw Error('UNAUTHORIZED');
  const pub=createClient(SB,ANON,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await pub.auth.getUser(token);
  if(!user)throw Error('UNAUTHORIZED');
  const admin=createClient(SB,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:p}=await admin.from('admin_profiles').select('role,is_active').eq('user_id',user.id).maybeSingle();
  if(!p?.is_active)throw Error('FORBIDDEN');
  return{admin,user,profile:p};
}

async function eventScope(c:any,eventId:string){
  const {data:e}=await c.admin.from('events').select('id,organization_id,title').eq('id',eventId).maybeSingle();
  if(!e)throw Error('EVENT_NOT_FOUND');
  if(c.profile.role==='developer')return e;
  const {data:mm}=await c.admin.from('organization_members').select('organization_id,permission_overrides').eq('user_id',c.user.id).eq('is_active',true);
  if(!mm?.length||mm.length!==1||mm[0].organization_id!==e.organization_id)throw Error('FORBIDDEN');
  const {data:r}=await c.admin.from('access_roles').select('permissions').eq('code',c.profile.role).maybeSingle();
  const p=new Set<string>(r?.permissions||[]);
  for(const x of mm[0].permission_overrides?.allow||[])p.add(String(x));
  for(const x of mm[0].permission_overrides?.deny||[])p.delete(String(x));
  if(!(p.has('*')||p.has('photos.upload')))throw Error('FORBIDDEN');
  return e;
}

async function sessionScope(c:any,id:string){
  const {data:s}=await c.admin.from('storage_upload_sessions').select('*').eq('id',id).maybeSingle();
  if(!s)throw Error('SESSION_NOT_FOUND');
  await eventScope(c,s.event_id);
  if(c.profile.role!=='developer'&&s.user_id&&s.user_id!==c.user.id)throw Error('FORBIDDEN');
  if(s.provider!=='r2')throw Error('SESSION_PROVIDER_INVALID');
  return s;
}

function s3(row:any){
  if(!AK||!SK)throw Error('R2_SECRETS_MISSING');
  if(!row?.endpoint||!row?.bucket_name)throw Error('R2_NOT_CONFIGURED');
  return new S3Client({region:'auto',endpoint:row.endpoint,credentials:{accessKeyId:AK,secretAccessKey:SK}});
}

async function backendFor(c:any,backendId:string){
  const {data:b}=await c.admin.from('storage_backends').select('*').eq('id',backendId).maybeSingle();
  if(!b)throw Error('R2_NOT_CONFIGURED');
  return b;
}

async function listParts(cli:S3Client,sess:any){
  const parts:any[]=[];
  let marker:number|undefined=undefined;
  for(let page=0;page<100;page++){
    const out=await cli.send(new ListPartsCommand({
      Bucket:sess.bucket_name,
      Key:sess.object_key,
      UploadId:sess.provider_upload_id,
      PartNumberMarker:marker,
      MaxParts:1000,
    }));
    for(const p of out.Parts||[]){
      if(p.PartNumber&&p.ETag)parts.push({part_number:Number(p.PartNumber),etag:String(p.ETag),size:Number(p.Size||0)});
    }
    if(!out.IsTruncated)break;
    marker=out.NextPartNumberMarker;
    if(!marker)break;
  }
  parts.sort((a,b)=>a.part_number-b.part_number);
  return parts;
}

async function reusableSession(c:any,eventId:string,clientKey:string,size:number){
  const now=new Date().toISOString();
  const {data:rows}=await c.admin.from('storage_upload_sessions')
    .select('*')
    .eq('event_id',eventId)
    .eq('provider','r2')
    .eq('client_key',clientKey)
    .eq('user_id',c.user.id)
    .in('status',['initiated','uploading'])
    .gt('expires_at',now)
    .order('created_at',{ascending:false})
    .limit(3);
  return (rows||[]).find((x:any)=>Number(x.size_bytes||0)===size)||null;
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return j({error:'Método não suportado.'},405);
  try{
    const c=await actor(req);
    const b=await req.json().catch(()=>({}));
    const action=String(b.action||'');

    if(action==='init'){
      const eventId=String(b.event_id||'');
      const e=await eventScope(c,eventId);
      const size=Math.max(0,Number(b.size_bytes||0));
      const name=String(b.file_name||'arquivo');
      const mime=String(b.mime_type||'application/octet-stream');
      const clientKey=b.client_key?String(b.client_key):'';
      if(!size)return j({error:'Arquivo vazio ou tamanho inválido.'},400);

      const {data:space}=await c.admin.from('event_storage_spaces').select('*,storage_backends(*)').eq('event_id',eventId).maybeSingle();
      const backend=space?.storage_backends;
      if(!space||!backend||backend.provider!=='r2'||!backend.active||backend.readiness_status!=='ready')return j({error:'Este evento ainda não está apontando para um R2 ativo.',code:'R2_EVENT_NOT_READY'},409);
      if(Number(backend.max_file_bytes||0)>0&&size>Number(backend.max_file_bytes))return j({error:'Arquivo excede o limite configurado deste backend.',code:'FILE_TOO_LARGE',max_file_bytes:Number(backend.max_file_bytes)},409);
      if(Math.ceil(size/PART_SIZE)>MAX_PARTS)return j({error:'Arquivo exigiria partes demais para multipart upload.',code:'TOO_MANY_PARTS'},409);

      const cli=s3(backend);
      if(clientKey){
        const existing=await reusableSession(c,eventId,clientKey,size);
        if(existing){
          try{
            const uploaded=await listParts(cli,existing);
            await c.admin.from('storage_upload_sessions').update({status:'uploading',updated_at:new Date().toISOString()}).eq('id',existing.id);
            return j({ok:true,resumed:true,session_id:existing.id,upload_id:existing.provider_upload_id,object_key:existing.object_key,bucket_name:existing.bucket_name,part_size:PART_SIZE,uploaded_parts:uploaded});
          }catch(err:any){
            const m=String(err?.name||err?.message||'');
            if(!/NoSuchUpload|InvalidArgument|NotFound/i.test(m))throw err;
            await c.admin.from('storage_upload_sessions').update({status:'expired',updated_at:new Date().toISOString()}).eq('id',existing.id);
          }
        }
      }

      const safe=name.replace(/[^a-zA-Z0-9._-]+/g,'-');
      const key=`${space.object_prefix}/originals/${crypto.randomUUID()}-${safe}`;
      const out=await cli.send(new CreateMultipartUploadCommand({Bucket:backend.bucket_name,Key:key,ContentType:mime,Metadata:{event_id:eventId,organization_id:e.organization_id}}));
      if(!out.UploadId)throw Error('R2_INIT_FAILED');
      const {data:sess,error}=await c.admin.from('storage_upload_sessions').insert({event_id:eventId,organization_id:e.organization_id,backend_id:backend.id,user_id:c.user.id,provider:'r2',bucket_name:backend.bucket_name,object_key:key,provider_upload_id:out.UploadId,file_name:name,size_bytes:size,mime_type:mime,client_key:clientKey||null,status:'uploading'}).select('*').single();
      if(error)throw error;
      return j({ok:true,resumed:false,session_id:sess.id,upload_id:out.UploadId,object_key:key,bucket_name:backend.bucket_name,part_size:PART_SIZE,uploaded_parts:[]});
    }

    if(action==='status'||action==='list_parts'){
      const sess=await sessionScope(c,String(b.session_id||''));
      if(sess.status==='completed')return j({ok:true,status:'completed',session_id:sess.id,object_key:sess.object_key,bucket_name:sess.bucket_name,part_size:PART_SIZE,uploaded_parts:[]});
      const backend=await backendFor(c,sess.backend_id);
      const uploaded=await listParts(s3(backend),sess);
      return j({ok:true,status:sess.status,session_id:sess.id,object_key:sess.object_key,bucket_name:sess.bucket_name,part_size:PART_SIZE,uploaded_parts:uploaded});
    }

    if(action==='sign_part'){
      const sess=await sessionScope(c,String(b.session_id||''));
      if(!['initiated','uploading'].includes(sess.status))return j({error:'Sessão não está disponível para envio.',code:'SESSION_NOT_UPLOADABLE'},409);
      const part=Math.max(1,Number(b.part_number||0));
      const expected=Math.ceil(Number(sess.size_bytes||0)/PART_SIZE);
      if(part>MAX_PARTS||part>expected)return j({error:'Número de parte inválido.'},400);
      const backend=await backendFor(c,sess.backend_id);
      const url=await getSignedUrl(s3(backend),new UploadPartCommand({Bucket:sess.bucket_name,Key:sess.object_key,UploadId:sess.provider_upload_id,PartNumber:part}),{expiresIn:1200});
      await c.admin.from('storage_upload_sessions').update({status:'uploading',updated_at:new Date().toISOString()}).eq('id',sess.id);
      return j({ok:true,url,part_number:part,expires_in:1200});
    }

    if(action==='complete'){
      const sess=await sessionScope(c,String(b.session_id||''));
      if(sess.status==='completed')return j({ok:true,already_completed:true,object_key:sess.object_key,bucket_name:sess.bucket_name});
      const backend=await backendFor(c,sess.backend_id);
      const cli=s3(backend);
      const parts=await listParts(cli,sess);
      const expectedParts=Math.ceil(Number(sess.size_bytes||0)/PART_SIZE);
      const uploadedBytes=parts.reduce((a:number,p:any)=>a+Number(p.size||0),0);
      const ordered=parts.length===expectedParts&&parts.every((p:any,i:number)=>p.part_number===i+1);
      if(!ordered||uploadedBytes!==Number(sess.size_bytes||0))return j({error:'Upload multipart ainda está incompleto.',code:'MULTIPART_INCOMPLETE',expected_parts:expectedParts,uploaded_parts:parts.length,expected_bytes:Number(sess.size_bytes||0),uploaded_bytes:uploadedBytes},409);
      const normalized=parts.map((p:any)=>({PartNumber:p.part_number,ETag:p.etag}));
      const out=await cli.send(new CompleteMultipartUploadCommand({Bucket:sess.bucket_name,Key:sess.object_key,UploadId:sess.provider_upload_id,MultipartUpload:{Parts:normalized}}));
      const head=await cli.send(new HeadObjectCommand({Bucket:sess.bucket_name,Key:sess.object_key}));
      if(Number(head.ContentLength||0)!==Number(sess.size_bytes||0)){
        await c.admin.from('storage_upload_sessions').update({status:'verification_failed',updated_at:new Date().toISOString()}).eq('id',sess.id);
        return j({error:'O objeto foi concluído, mas a verificação de tamanho falhou.',code:'OBJECT_SIZE_MISMATCH',expected_bytes:Number(sess.size_bytes||0),stored_bytes:Number(head.ContentLength||0)},502);
      }
      await c.admin.from('storage_upload_sessions').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',sess.id);
      return j({ok:true,object_key:sess.object_key,bucket_name:sess.bucket_name,etag:out.ETag||head.ETag||null,stored_bytes:Number(head.ContentLength||0),verified:true});
    }

    if(action==='abort'){
      const sess=await sessionScope(c,String(b.session_id||''));
      if(sess.status==='completed')return j({ok:true,already_completed:true});
      const backend=await backendFor(c,sess.backend_id);
      await s3(backend).send(new AbortMultipartUploadCommand({Bucket:sess.bucket_name,Key:sess.object_key,UploadId:sess.provider_upload_id})).catch(()=>{});
      await c.admin.from('storage_upload_sessions').update({status:'aborted',updated_at:new Date().toISOString()}).eq('id',sess.id);
      return j({ok:true});
    }

    return j({error:'Ação inválida.'},400);
  }catch(e:any){
    const m=e?.message||'Erro inesperado';
    const code=m==='UNAUTHORIZED'?401:m==='FORBIDDEN'?403:['EVENT_NOT_FOUND','SESSION_NOT_FOUND'].includes(m)?404:['R2_SECRETS_MISSING','R2_NOT_CONFIGURED','SESSION_PROVIDER_INVALID'].includes(m)?409:500;
    return j({error:m,code:m},code);
  }
});