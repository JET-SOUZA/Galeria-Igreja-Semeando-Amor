import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const ANON=(Deno.env.get('SUPABASE_ANON_KEY')||'').trim();
const CLOUD='to3hnwdl',PRESET='semeando_memorias';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const B62='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function parseLink(input:string){
  const s=String(input||'').trim();
  const modern=s.match(/(?:share\.)?icloud\.com\/photos\/([A-Za-z0-9_-]+)/i)||s.match(/icloud\.com\/photos\/#([A-Za-z0-9_-]+)/i);
  if(modern)return {kind:'photos-link' as const,token:modern[1]};
  const classic=s.match(/icloud\.com\/(?:sharedalbum(?:\/[a-z-]+)?\/)?#([A-Za-z0-9_-]+)/i);
  if(classic)return {kind:'shared-album' as const,token:classic[1]};
  if(/^[A-Za-z0-9_-]{8,}$/.test(s))return {kind:'shared-album' as const,token:s};
  return null;
}
function b62(input:string){return Array.from(input).reduce((n,c)=>n*62+Math.max(0,B62.indexOf(c)),0)}
function partition(token:string){const n=token[0]==='A'?b62(token[1]||'0'):b62(token.substring(1,3));return String(n).padStart(2,'0')}
function baseUrl(token:string){return `https://p${partition(token)}-sharedstreams.icloud.com/${token}/sharedstreams/`}
async function postApple(url:string,payload:any){return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain','Accept':'application/json','Cache-Control':'no-cache','User-Agent':'Photos/5.0 (Macintosh; OS X 10.15.4) AppleWebKit/605.1.15'},body:JSON.stringify(payload),redirect:'manual'})}
async function streamFor(token:string){let base=baseUrl(token),r=await postApple(base+'webstream',{streamCtag:null});if(r.status===330){const d=await r.json().catch(()=>({}));const host=d?.['X-Apple-MMe-Host']||r.headers.get('x-apple-mme-host');if(host){base=`https://${host}/${token}/sharedstreams/`;r=await postApple(base+'webstream',{streamCtag:null})}}if(!r.ok)throw new Error(`iCloud Shared Album respondeu ${r.status}. Confirme se o álbum é público e ainda válido.`);return {base,data:await r.json()}}
function best(photo:any){const a=Object.values(photo?.derivatives||{}) as any[];return a.sort((x,y)=>Number(y.fileSize||0)-Number(x.fileSize||0)||Number(y.width||0)*Number(y.height||0)-Number(x.width||0)*Number(x.height||0))[0]||null}
async function assetMap(base:string,guids:string[]){const out=new Map<string,string>();for(let i=0;i<guids.length;i+=25){const r=await postApple(base+'webasseturls',{photoGuids:guids.slice(i,i+25)});if(!r.ok)throw new Error(`Não foi possível obter as imagens do iCloud (${r.status}).`);const d=await r.json();for(const [checksum,item] of Object.entries<any>(d.items||{}))if(item?.url_location&&item?.url_path)out.set(checksum,`https://${item.url_location}${item.url_path}`)}return out}
async function requireAdmin(req:Request){const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))throw new Error('Sessão administrativa necessária.');const ur=await fetch(`${SB}/auth/v1/user`,{headers:{apikey:ANON,Authorization:auth}}),u=await ur.json();if(!ur.ok||!u?.id)throw new Error('Sessão inválida ou expirada.');const pr=await fetch(`${SB}/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(u.id)}&is_active=eq.true&select=role`,{headers:{apikey:ANON,Authorization:auth}}),p=await pr.json();if(!pr.ok||!p?.length)throw new Error('Usuário sem permissão administrativa.');return auth}
async function uploadRemote(url:string,folder:string){const fd=new FormData();fd.append('file',url);fd.append('upload_preset',PRESET);fd.append('folder',folder);const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,{method:'POST',body:fd}),d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'Falha ao enviar imagem ao Cloudinary.');return d}
function nameFor(p:any,i:number){const cap=String(p?.caption||'').trim().replace(/[\\/:*?"<>|]+/g,'-').slice(0,80);return cap||`icloud-${String(i+1).padStart(4,'0')}-${p.photoGuid}.jpg`}
function browserRequired(){return json({error:'Este link é do iCloud Fotos moderno (share.icloud.com/photos). A Apple entrega esse compartilhamento por uma aplicação JavaScript e ele precisa do worker de navegador headless do Semeando Memórias.',requires_browser_worker:true,kind:'photos-link'},422)}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(req.method==='GET'){
   const u=new URL(req.url),parsed=parseLink(u.searchParams.get('link')||'');
   if(!parsed)return json({error:'Link do iCloud inválido.'},400);
   if(parsed.kind==='photos-link')return browserRequired();
   const {base,data}=await streamFor(parsed.token),photos=(data.photos||[]).filter((p:any)=>p.mediaAssetType!=='video'),urls=await assetMap(base,photos.map((p:any)=>p.photoGuid));
   const files=photos.map((p:any,i:number)=>{const d=best(p);return{id:p.photoGuid,name:nameFor(p,i),size:Number(d?.fileSize||0)||null,width:Number(d?.width||p.width||0)||null,height:Number(d?.height||p.height||0)||null,thumbnail_url:d?.checksum?urls.get(d.checksum)||null:null}});
   return json({ok:true,kind:'shared-album',album_name:data.streamName||'iCloud Shared Album',count:files.length,files});
  }
  if(req.method==='POST'){
   const auth=await requireAdmin(req),b=await req.json(),parsed=parseLink(b.link||''),eventId=String(b.event_id||''),selected=Array.isArray(b.photo_guids)?b.photo_guids.map(String).slice(0,25):[];
   if(!parsed||!eventId||!selected.length)return json({error:'Evento, link e fotos são obrigatórios.'},400);
   if(parsed.kind==='photos-link')return browserRequired();
   const er=await fetch(`${SB}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=id,slug,title`,{headers:{apikey:ANON,Authorization:auth}}),evs=await er.json();if(!er.ok||!evs?.[0])return json({error:'Evento não encontrado.'},404);
   const ev=evs[0],{base,data}=await streamFor(parsed.token),all=(data.photos||[]).filter((p:any)=>p.mediaAssetType!=='video'&&selected.includes(String(p.photoGuid))),urls=await assetMap(base,all.map((p:any)=>p.photoGuid));let imported=0,skipped=0,failed=0,next=0;
   async function one(p:any,i:number){const guid=String(p.photoGuid);try{const ex=await fetch(`${SB}/rest/v1/photos?event_id=eq.${encodeURIComponent(eventId)}&source_file_id=eq.${encodeURIComponent(guid)}&deleted_at=is.null&select=id`,{headers:{apikey:ANON,Authorization:auth}}),existing=await ex.json();if(ex.ok&&existing?.length){skipped++;return}const d=best(p),url=d?.checksum?urls.get(d.checksum):null;if(!url)throw new Error('URL da imagem não encontrada.');const c=await uploadRemote(url,`semeando-memorias/eventos/${ev.slug}`),row={event_id:eventId,cloudinary_asset_id:c.asset_id,public_id:c.public_id,secure_url:c.secure_url,width:c.width||null,height:c.height||null,bytes:c.bytes||null,format:c.format||null,original_filename:nameFor(p,i),status:'published',source_type:'icloud',source_file_id:guid,source_folder_id:parsed.token,source_original_url:`https://www.icloud.com/sharedalbum/#${parsed.token}`};const sr=await fetch(`${SB}/rest/v1/photos`,{method:'POST',headers:{apikey:ANON,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(row)});if(sr.status===409){skipped++;return}if(!sr.ok)throw new Error('Falha ao registrar foto.');imported++}catch(e){console.error('icloud photo failed',guid,e);failed++}}
   async function worker(){while(true){const i=next++;if(i>=all.length)return;await one(all[i],i)}}
   await Promise.all(Array.from({length:Math.min(5,all.length)},()=>worker()));
   return json({ok:true,requested:all.length,imported,skipped,failed});
  }
  return json({error:'Método não suportado.'},405);
 }catch(e:any){console.error(e);return json({error:e?.message||'Erro inesperado.'},500)}
});
