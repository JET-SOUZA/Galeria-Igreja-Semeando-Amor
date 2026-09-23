import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const ANON=(Deno.env.get('SUPABASE_ANON_KEY')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const STALE_MINUTES=20;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const j=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value)).map(byte=>byte.toString(16).padStart(2,'0')).join('');

async function uploadFingerprint(eventId:string,fileName:string,sizeBytes:number){
  const value=`${eventId}:${fileName}:${Math.max(0,sizeBytes)}`;
  return`upload:${hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}`;
}

async function actor(req:Request){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)throw Error('UNAUTHORIZED');
  const pub=createClient(SB,ANON,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await pub.auth.getUser(token);
  if(!user)throw Error('UNAUTHORIZED');
  const admin=createClient(SB,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile}=await admin.from('admin_profiles').select('role,is_active,full_name').eq('user_id',user.id).maybeSingle();
  if(!profile?.is_active)throw Error('FORBIDDEN');
  return{admin,user,profile};
}

async function eventScope(c:any,eventId:string,write=true){
  const {data:event}=await c.admin.from('events').select('id,title,slug,organization_id,gallery_access,face_search_enabled,status').eq('id',eventId).maybeSingle();
  if(!event)throw Error('EVENT_NOT_FOUND');
  if(c.profile.role==='developer')return event;
  const {data:members}=await c.admin.from('organization_members').select('organization_id,permission_overrides').eq('user_id',c.user.id).eq('is_active',true);
  if(!members?.length||members.length!==1||members[0].organization_id!==event.organization_id)throw Error('FORBIDDEN');
  const {data:role}=await c.admin.from('access_roles').select('permissions').eq('code',c.profile.role).maybeSingle();
  const permissions=new Set<string>(role?.permissions||[]);
  for(const value of members[0].permission_overrides?.allow||[])permissions.add(String(value));
  for(const value of members[0].permission_overrides?.deny||[])permissions.delete(String(value));
  if(!(permissions.has('*')||permissions.has(write?'photos.upload':'photos.view')))throw Error('FORBIDDEN');
  return event;
}

async function batchScope(c:any,batchId:string,write=true){
  const {data:batch}=await c.admin.from('upload_batches').select('*').eq('id',batchId).maybeSingle();
  if(!batch)throw Error('BATCH_NOT_FOUND');
  await eventScope(c,batch.event_id,write);
  return batch;
}

async function storageFor(c:any,eventId:string){
  const {data:space}=await c.admin.from('event_storage_spaces').select('*,storage_backends(*)').eq('event_id',eventId).maybeSingle();
  if(!space)throw Error('STORAGE_SPACE_NOT_FOUND');
  return space;
}

function storageReadiness(space:any,totalBytes=0){
  const backend=space?.storage_backends||{};
  const capacity=Number(backend.capacity_bytes||0);
  const reserve=Math.max(0,Math.min(90,Number(backend.reserve_percent||0)))/100;
  const usable=capacity>0?Math.floor(capacity*(1-reserve)):null;
  return{provider:backend.provider,backend_code:backend.code,label:backend.label,bucket_name:backend.bucket_name,active:!!backend.active,status:backend.readiness_status||'ready',message:backend.readiness_message||null,max_file_bytes:Number(backend.max_file_bytes||0)||null,capacity_bytes:capacity||null,reserve_percent:Number(backend.reserve_percent||0),usable_capacity_bytes:usable,requested_bytes:totalBytes};
}

async function usedForBackend(admin:any,backendId:string){
  const {data,error}=await admin.rpc('storage_backend_usage',{p_backend_id:backendId});
  if(error)throw error;
  return Number(data?.bytes||0);
}

async function recalc(admin:any,batchId:string){
  await admin.rpc('recompute_upload_batch',{p_batch:batchId});
  const {data:batch}=await admin.from('upload_batches').select('*').eq('id',batchId).maybeSingle();
  return batch;
}

async function refreshStorage(admin:any,eventId:string){
  const {data:space,error:spaceError}=await admin.from('event_storage_spaces').select('backend_id').eq('event_id',eventId).maybeSingle();
  if(spaceError)throw spaceError;
  if(!space?.backend_id)throw Error('STORAGE_SPACE_NOT_FOUND');
  const {data,error}=await admin.rpc('event_storage_backend_usage',{p_event_id:eventId,p_backend_id:space.backend_id});
  if(error)throw error;
  const bytes=Number(data?.bytes||0),objects=Number(data?.objects||0);
  await admin.from('event_storage_spaces').update({bytes_used:bytes,object_count:objects,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('event_id',eventId);
  return{bytes,objects};
}

async function startFace(eventId:string){
  try{
    await fetch(`${SB}/functions/v1/face-auto-index`,{method:'POST',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'},body:JSON.stringify({event_id:eventId,background:true})});
    return true;
  }catch(error){console.error('[mass-upload] face index start failed',{eventId,error:String(error)});return false}
}

async function maybeStartFace(admin:any,eventId:string,force=false){
  const {data:collection}=await admin.from('face_collections').select('status,updated_at').eq('event_id',eventId).maybeSingle();
  const stale=!collection?.updated_at||new Date(collection.updated_at).getTime()<Date.now()-5*60_000;
  if(!force&&collection?.status==='indexing'&&!stale)return false;
  return startFace(eventId);
}

async function findExistingPhoto(admin:any,eventId:string,fileName:string,sizeBytes:number){
  const fingerprint=await uploadFingerprint(eventId,fileName,sizeBytes);
  const {data:byFingerprint}=await admin.from('photos').select('id,original_storage_path').eq('event_id',eventId).eq('source_file_id',fingerprint).is('deleted_at',null).limit(1).maybeSingle();
  if(byFingerprint)return byFingerprint;
  const {data:legacy}=await admin.from('photos').select('id,original_storage_path').eq('event_id',eventId).eq('original_filename',fileName).eq('original_bytes',sizeBytes).is('deleted_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
  return legacy||null;
}

async function reconcileStale(admin:any,eventId:string){
  const cutoff=new Date(Date.now()-STALE_MINUTES*60_000).toISOString();
  const {data:stale}=await admin.from('upload_batch_items').select('id,batch_id').eq('event_id',eventId).eq('status','uploading').lt('updated_at',cutoff);
  if(!stale?.length)return{reconciled:0,batches:[]};
  const ids=stale.map((row:any)=>row.id);
  await admin.from('upload_batch_items').update({status:'failed',error_message:'Envio interrompido. Selecione novamente este arquivo para retomar.',updated_at:new Date().toISOString()}).in('id',ids);
  const batchIds=[...new Set(stale.map((row:any)=>String(row.batch_id)))];
  for(const batchId of batchIds){
    const batch=await recalc(admin,batchId);
    const done=Number(batch?.completed_files||0),failed=Number(batch?.failed_files||0),total=Number(batch?.total_files||0);
    const status=done===0&&failed>0?'failed':done<total||failed>0?'partial':'completed';
    await admin.from('upload_batches').update({status,last_activity_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batchId);
  }
  if(stale.length)await maybeStartFace(admin,eventId,true);
  return{reconciled:stale.length,batches:batchIds};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const c=await actor(req);
    const url=new URL(req.url);
    if(req.method==='GET'){
      const eventId=String(url.searchParams.get('event_id')||'');
      if(!eventId)return j({error:'event_id obrigatório.'},400);
      const event=await eventScope(c,eventId,false);
      const shouldReconcile=url.searchParams.get('reconcile')==='1';
      const reconciled=shouldReconcile?await reconcileStale(c.admin,eventId):{reconciled:0,batches:[]};
      let maintenance={pending_face:0,face_started:false,storage_refreshed:null as null|{bytes:number,objects:number}};
      if(shouldReconcile){
        const [{count:pendingFace},storageRefreshed]=await Promise.all([
          c.admin.from('photos').select('id',{count:'exact',head:true}).eq('event_id',eventId).eq('face_index_status','pending').is('deleted_at',null),
          refreshStorage(c.admin,eventId),
        ]);
        maintenance={
          pending_face:Number(pendingFace||0),
          face_started:Number(pendingFace||0)>0&&event.face_search_enabled?await maybeStartFace(c.admin,eventId):false,
          storage_refreshed:storageRefreshed,
        };
      }
      const space=await storageFor(c,eventId);
      const {data:batches}=await c.admin.from('upload_batches').select('*').eq('event_id',eventId).order('created_at',{ascending:false}).limit(10);
      let items:any[]=[];
      const batchId=String(url.searchParams.get('batch_id')||batches?.[0]?.id||'');
      if(batchId){
        const batch=(batches||[]).find((row:any)=>row.id===batchId)||await batchScope(c,batchId,false);
        if(batch.event_id!==eventId)throw Error('FORBIDDEN');
        const {data}=await c.admin.from('upload_batch_items').select('id,client_key,file_name,relative_path,size_bytes,mime_type,last_modified,status,attempts,progress_bytes,storage_path,photo_id,error_message,started_at,completed_at,updated_at').eq('batch_id',batchId).order('created_at').limit(10000);
        items=data||[];
      }
      const used=await usedForBackend(c.admin,space.backend_id),ready=storageReadiness(space);
      return j({ok:true,event,storage:{...space,backend:ready,backend_used_bytes:used,backend_available_bytes:ready.usable_capacity_bytes==null?null:Math.max(0,ready.usable_capacity_bytes-used)},batches:batches||[],batch_id:batchId||null,items,reconciled,maintenance});
    }

    if(req.method!=='POST')return j({error:'Método não suportado.'},405);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'');

    if(action==='create'){
      const eventId=String(body.event_id||''),event=await eventScope(c,eventId,true);
      const totalFiles=Math.max(0,Number(body.total_files||0)),totalBytes=Math.max(0,Number(body.total_bytes||0));
      if(totalFiles>10000)return j({error:'Um lote pode ter no máximo 10.000 arquivos.'},400);
      const space=await storageFor(c,eventId),backend=space.storage_backends||{},ready=storageReadiness(space,totalBytes);
      const used=await usedForBackend(c.admin,space.backend_id),available=ready.usable_capacity_bytes==null?null:Math.max(0,ready.usable_capacity_bytes-used);
      if(!backend.active||['blocked','configuration_required'].includes(String(backend.readiness_status||'')))return j({error:backend.readiness_message||'Backend de armazenamento indisponível.',code:'STORAGE_BACKEND_NOT_READY',storage:{...ready,backend_used_bytes:used,backend_available_bytes:available}},409);
      if(available!==null&&totalBytes>available)return j({error:'O lote ultrapassa a capacidade segura disponível neste storage.',code:'STORAGE_CAPACITY_INSUFFICIENT',storage:{...ready,backend_used_bytes:used,backend_available_bytes:available}},409);
      const {data:row,error}=await c.admin.from('upload_batches').insert({event_id:eventId,organization_id:event.organization_id,created_by:c.user.id,source_type:String(body.source_type||'local'),status:'preparing',total_files:totalFiles,total_bytes:totalBytes,metadata:body.metadata&&typeof body.metadata==='object'?body.metadata:{}}).select('*').single();
      if(error)throw error;
      return j({ok:true,batch:row,storage:{...ready,backend_used_bytes:used,backend_available_bytes:available}});
    }

    if(action==='add_items'){
      const batch=await batchScope(c,String(body.batch_id||''),true),space=await storageFor(c,batch.event_id);
      const maxFile=Number(space.storage_backends?.max_file_bytes||0),items=Array.isArray(body.items)?body.items:[];
      if(!items.length||items.length>500)return j({error:'Envie de 1 a 500 itens por vez.'},400);
      const tooLarge=maxFile?items.find((item:any)=>Number(item.size_bytes||0)>maxFile):null;
      if(tooLarge)return j({error:`${tooLarge.file_name||'Arquivo'} excede o limite atual.`,code:'FILE_TOO_LARGE',max_file_bytes:maxFile},409);
      const rows=items.map((item:any)=>({batch_id:batch.id,event_id:batch.event_id,organization_id:batch.organization_id,client_key:String(item.client_key||''),file_name:String(item.file_name||'arquivo'),relative_path:item.relative_path?String(item.relative_path):null,size_bytes:Math.max(0,Number(item.size_bytes||0)),mime_type:item.mime_type?String(item.mime_type):null,last_modified:item.last_modified==null?null:Number(item.last_modified),status:'queued'})).filter((item:any)=>item.client_key);
      const {error}=await c.admin.from('upload_batch_items').upsert(rows,{onConflict:'batch_id,client_key',ignoreDuplicates:true});
      if(error)throw error;
      await c.admin.from('upload_batches').update({status:'uploading',started_at:batch.started_at||new Date().toISOString(),last_activity_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batch.id);
      return j({ok:true,accepted:rows.length});
    }

    if(action==='item_prepare'){
      const batch=await batchScope(c,String(body.batch_id||''),true),key=String(body.client_key||'');
      const {data:item}=await c.admin.from('upload_batch_items').select('*').eq('batch_id',batch.id).eq('client_key',key).maybeSingle();
      if(!item)return j({error:'Item não encontrado.'},404);
      if(['registered','skipped'].includes(item.status))return j({ok:true,done:true,status:item.status,photo_id:item.photo_id,storage_path:item.storage_path});
      const existing=await findExistingPhoto(c.admin,batch.event_id,item.file_name,Number(item.size_bytes||0));
      if(existing){
        await c.admin.from('upload_batch_items').update({status:'skipped',photo_id:existing.id,storage_path:existing.original_storage_path||item.storage_path||null,progress_bytes:item.size_bytes,completed_at:new Date().toISOString(),error_message:null,updated_at:new Date().toISOString()}).eq('id',item.id);
        await recalc(c.admin,batch.id);
        return j({ok:true,done:true,status:'skipped',photo_id:existing.id,storage_path:existing.original_storage_path||null});
      }
      const now=new Date().toISOString();
      await c.admin.from('upload_batch_items').update({status:'uploading',started_at:item.started_at||now,attempts:Number(item.attempts||0)+1,error_message:null,updated_at:now}).eq('id',item.id);
      return j({ok:true,done:false,storage_path:item.storage_path||null,attempts:Number(item.attempts||0)+1});
    }

    if(action==='item_checkpoint'){
      const batch=await batchScope(c,String(body.batch_id||''),true),key=String(body.client_key||'');
      const {error}=await c.admin.from('upload_batch_items').update({storage_path:String(body.storage_path||''),progress_bytes:Math.max(0,Number(body.size_bytes||0)),updated_at:new Date().toISOString()}).eq('batch_id',batch.id).eq('client_key',key);
      if(error)throw error;
      return j({ok:true});
    }

    // Compatibilidade com abas abertas na versão anterior durante a publicação.
    if(['item_start','item_done','item_cancel'].includes(action)){
      const batch=await batchScope(c,String(body.batch_id||''),true),key=String(body.client_key||''),now=new Date().toISOString();
      if(!key)return j({error:'client_key obrigatório.'},400);
      const patch:any={updated_at:now};
      if(action==='item_start'){
        const {data:item}=await c.admin.from('upload_batch_items').select('attempts').eq('batch_id',batch.id).eq('client_key',key).maybeSingle();
        patch.status='uploading';patch.started_at=now;patch.error_message=null;patch.attempts=Number(item?.attempts||0)+1;
      }else if(action==='item_done'){
        patch.status='registered';patch.completed_at=now;patch.progress_bytes=Math.max(0,Number(body.size_bytes||0));patch.storage_path=body.storage_path?String(body.storage_path):null;patch.photo_id=body.photo_id||null;patch.error_message=null;
      }else{
        patch.status='cancelled';patch.error_message='Cancelado pelo usuário';
      }
      const {error}=await c.admin.from('upload_batch_items').update(patch).eq('batch_id',batch.id).eq('client_key',key);
      if(error)throw error;
      const updated=await recalc(c.admin,batch.id);
      if(action==='item_done')await maybeStartFace(c.admin,batch.event_id);
      return j({ok:true,batch:updated});
    }

    if(action==='register_photo'){
      const batch=await batchScope(c,String(body.batch_id||''),true),key=String(body.client_key||''),photo=body.photo||{};
      const {data:item}=await c.admin.from('upload_batch_items').select('*').eq('batch_id',batch.id).eq('client_key',key).maybeSingle();
      if(!item)return j({error:'Item não encontrado.'},404);
      if(['registered','skipped'].includes(item.status))return j({ok:true,done:true,status:item.status,photo_id:item.photo_id});
      const existing=await findExistingPhoto(c.admin,batch.event_id,item.file_name,Number(item.size_bytes||0));
      if(existing){
        await c.admin.from('upload_batch_items').update({status:'skipped',photo_id:existing.id,storage_path:existing.original_storage_path||item.storage_path||null,progress_bytes:item.size_bytes,completed_at:new Date().toISOString(),error_message:null,updated_at:new Date().toISOString()}).eq('id',item.id);
        const updated=await recalc(c.admin,batch.id);
        return j({ok:true,done:true,status:'skipped',photo_id:existing.id,batch:updated});
      }
      if(!photo.public_id||!photo.secure_url)return j({error:'Prévia JPEG não foi confirmada.'},400);
      const fingerprint=await uploadFingerprint(batch.event_id,item.file_name,Number(item.size_bytes||0));
      const row={event_id:batch.event_id,cloudinary_asset_id:photo.cloudinary_asset_id||null,public_id:String(photo.public_id),secure_url:String(photo.secure_url),width:photo.width||null,height:photo.height||null,bytes:photo.bytes||null,format:photo.format||'jpg',original_filename:item.file_name,status:'published',source_type:'upload',source_file_id:fingerprint,original_storage_provider:photo.original_storage_provider||'supabase',original_storage_backend_id:photo.original_storage_backend_id||null,original_storage_bucket:photo.original_storage_bucket||'photo-originals',original_storage_path:photo.original_storage_path||item.storage_path||null,original_bytes:Number(item.size_bytes||0),original_mime:photo.original_mime||item.mime_type||null,face_index_status:'pending'};
      const {data:created,error}=await c.admin.from('photos').insert(row).select('id').single();
      if(error){
        // Duas filas podem concluir o mesmo arquivo quase ao mesmo tempo. O
        // indice unico por source_file_id escolhe um vencedor; a outra fila
        // passa a apontar para a foto ja registrada, sem criar duplicata.
        if(error.code==='23505'){
          const concurrent=await findExistingPhoto(c.admin,batch.event_id,item.file_name,Number(item.size_bytes||0));
          if(concurrent){
            const now=new Date().toISOString();
            await c.admin.from('upload_batch_items').update({status:'skipped',photo_id:concurrent.id,storage_path:concurrent.original_storage_path||item.storage_path||null,progress_bytes:item.size_bytes,completed_at:now,error_message:null,updated_at:now}).eq('id',item.id);
            const updated=await recalc(c.admin,batch.id);
            return j({ok:true,done:true,status:'skipped',photo_id:concurrent.id,batch:updated,concurrent_duplicate:true});
          }
        }
        throw error;
      }
      const now=new Date().toISOString();
      await c.admin.from('upload_batch_items').update({status:'registered',photo_id:created.id,storage_path:row.original_storage_path,progress_bytes:item.size_bytes,completed_at:now,error_message:null,updated_at:now}).eq('id',item.id);
      const updated=await recalc(c.admin,batch.id);
      await maybeStartFace(c.admin,batch.event_id);
      return j({ok:true,done:true,status:'registered',photo_id:created.id,batch:updated});
    }

    if(action==='item_fail'){
      const batch=await batchScope(c,String(body.batch_id||''),true),key=String(body.client_key||''),now=new Date().toISOString();
      const {error}=await c.admin.from('upload_batch_items').update({status:'failed',error_message:String(body.error_message||'Falha no upload').slice(0,1500),updated_at:now}).eq('batch_id',batch.id).eq('client_key',key);
      if(error)throw error;
      return j({ok:true,batch:await recalc(c.admin,batch.id)});
    }

    if(action==='finish'||action==='reconcile'){
      const batch=await batchScope(c,String(body.batch_id||''),true);
      if(action==='reconcile')await reconcileStale(c.admin,batch.event_id);
      const updated=await recalc(c.admin,batch.id),total=Number(updated?.total_files||0),done=Number(updated?.completed_files||0),failed=Number(updated?.failed_files||0);
      const status=done===0&&failed>0?'failed':done<total||failed>0?'partial':'completed',now=new Date().toISOString();
      await c.admin.from('upload_batches').update({status,completed_at:status==='completed'?now:null,last_activity_at:now,updated_at:now,face_index_requested_at:done>0?now:updated?.face_index_requested_at||null}).eq('id',batch.id);
      const storage=await refreshStorage(c.admin,batch.event_id),faceStarted=done>0?await maybeStartFace(c.admin,batch.event_id,true):false;
      return j({ok:true,status,completed_files:done,failed_files:failed,total_files:total,storage,face_started:faceStarted});
    }

    if(action==='cancel'){
      const batch=await batchScope(c,String(body.batch_id||''),true),now=new Date().toISOString();
      await c.admin.from('upload_batches').update({status:'cancelled',completed_at:now,last_activity_at:now,updated_at:now}).eq('id',batch.id);
      await c.admin.from('upload_batch_items').update({status:'cancelled',updated_at:now}).eq('batch_id',batch.id).in('status',['queued','uploading']);
      return j({ok:true});
    }

    return j({error:'Ação inválida.'},400);
  }catch(error:any){
    console.error('[mass-upload]',{error:String(error?.message||error),stack:error?.stack});
    const message=error?.message||'Erro inesperado';
    const status=message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:['EVENT_NOT_FOUND','BATCH_NOT_FOUND','STORAGE_SPACE_NOT_FOUND'].includes(message)?404:500;
    return j({error:message},status);
  }
});
