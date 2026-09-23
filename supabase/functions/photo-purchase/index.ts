import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const SB=(Deno.env.get('SUPABASE_URL')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const ASAAS=(Deno.env.get('ASAAS_API_KEY')||'').trim();
const BASE=(Deno.env.get('ASAAS_BASE_URL')||'https://api-sandbox.asaas.com/v3').replace(/\/$/,'');
const ASAAS_MINIMUM_AMOUNT=5;
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
};

const j=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'},
});
const digits=(value:any)=>String(value||'').replace(/\D/g,'');
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value)).map(x=>x.toString(16).padStart(2,'0')).join('');

async function hash(value:string){
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}

async function asaas(path:string,init?:RequestInit){
  if(!ASAAS)throw Error('ASAAS_NOT_CONFIGURED');
  const response=await fetch(BASE+path,{
    ...init,
    headers:{'Content-Type':'application/json','access_token':ASAAS,...(init?.headers||{})},
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    throw Error(data?.errors?.map((item:any)=>item.description).join('; ')||data?.message||`Falha no Asaas (${response.status})`);
  }
  return data;
}

async function eventBySlug(admin:any,slug:string){
  const {data:event}=await admin
    .from('events')
    .select('id,organization_id,slug,title,is_paid,price_per_photo,status')
    .eq('slug',slug)
    .eq('status','published')
    .eq('is_paid',true)
    .maybeSingle();
  if(!event)throw Error('EVENT_NOT_FOUND');
  return event;
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return j({error:'METHOD_NOT_ALLOWED'},405);

  try{
    const admin=createClient(SB,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||'status');
    const slug=String(body.event_slug||'').trim();
    if(!slug)return j({error:'EVENT_REQUIRED'},400);
    const event=await eventBySlug(admin,slug);

    if(action==='status'){
      const {data:gateway}=await admin
        .from('billing_gateway_settings')
        .select('enabled,environment,webhook_configured,last_health_status,last_health_message')
        .eq('provider','asaas')
        .maybeSingle();
      const ready=!!ASAAS&&!!gateway?.enabled&&!!gateway?.webhook_configured&&['ready','ok'].includes(String(gateway?.last_health_status||''));
      return j({
        ok:true,
        gateway:{
          provider:'asaas',
          ready,
          environment:gateway?.environment||'sandbox',
          message:ready?'Pagamento disponível.':gateway?.last_health_message||'O pagamento está sendo configurado.',
        },
        price_per_photo:Number(event.price_per_photo||0),
        minimum_amount:ASAAS_MINIMUM_AMOUNT,
      });
    }

    if(action==='create_order'){
      const visitorId=String(body.visitor_id||'');
      const ids=[...new Set((Array.isArray(body.photo_ids)?body.photo_ids:[]).map((value:any)=>String(value)).filter(Boolean))];
      if(!visitorId)return j({error:'VISITOR_REQUIRED'},400);
      if(!ids.length)return j({error:'EMPTY_CART'},400);

      const {data:visitor,error:visitorError}=await admin
        .from('visitors')
        .select('id,full_name,email,cpf,whatsapp')
        .eq('id',visitorId)
        .maybeSingle();
      if(visitorError)throw visitorError;
      if(!visitor)return j({
        error:'VISITOR_SESSION_EXPIRED',
        code:'VISITOR_SESSION_EXPIRED',
        message:'Seu cadastro salvo neste navegador expirou. Confirme seus dados novamente para continuar; o carrinho será preservado.',
      },401);

      // O identificador local do visitante é validado acima. O vínculo pode ter
      // faltado em sessões antigas porque a página enviava a gravação sem
      // aguardar a resposta. O servidor repara esse estado de forma idempotente.
      const {error:eventVisitorError}=await admin
        .from('event_visitors')
        .upsert(
          {event_id:event.id,visitor_id:visitorId},
          {onConflict:'event_id,visitor_id',ignoreDuplicates:true},
        );
      if(eventVisitorError)throw eventVisitorError;

      const {data:photos}=await admin
        .from('photos')
        .select('id,original_filename')
        .eq('event_id',event.id)
        .in('id',ids)
        .eq('status','published')
        .is('deleted_at',null);
      if((photos||[]).length!==ids.length)return j({error:'INVALID_PHOTO_SELECTION'},400);

      const price=Number(event.price_per_photo||0);
      if(!(price>0))return j({error:'PRICE_NOT_CONFIGURED'},409);
      const amount=Number((price*ids.length).toFixed(2));
      if(amount<ASAAS_MINIMUM_AMOUNT){
        const missingPhotos=Math.ceil((ASAAS_MINIMUM_AMOUNT-amount)/price);
        return j({
          error:'MINIMUM_CHARGE_AMOUNT',
          message:`O pagamento mínimo no Asaas é de R$ ${ASAAS_MINIMUM_AMOUNT.toFixed(2).replace('.',',')}. Adicione mais ${missingPhotos} foto${missingPhotos>1?'s':''} ao carrinho.`,
          minimum_amount:ASAAS_MINIMUM_AMOUNT,
          current_amount:amount,
          missing_photos:missingPhotos,
        },409);
      }

      const {data:gateway}=await admin
        .from('billing_gateway_settings')
        .select('enabled,webhook_configured,last_health_status,last_health_message')
        .eq('provider','asaas')
        .maybeSingle();
      const ready=!!ASAAS&&!!gateway?.enabled&&!!gateway?.webhook_configured&&['ready','ok'].includes(String(gateway?.last_health_status||''));
      if(!ready){
        return j({
          error:'PAYMENT_GATEWAY_NOT_READY',
          message:gateway?.last_health_message||'O pagamento está sendo configurado. Suas fotos podem permanecer no carrinho.',
        },503);
      }

      const cpf=digits(visitor.cpf);
      if(cpf.length!==11){
        return j({error:'PROFILE_REQUIRED',message:'Para pagar com segurança, complete seu CPF no cadastro.'},409);
      }

      let customer='';
      const found=await asaas(`/customers?externalReference=${encodeURIComponent('visitor:'+visitorId)}&limit=1`);
      customer=found?.data?.[0]?.id||'';
      if(!customer){
        const created=await asaas('/customers',{
          method:'POST',
          body:JSON.stringify({
            name:visitor.full_name,
            cpfCnpj:cpf,
            email:visitor.email||undefined,
            mobilePhone:digits(visitor.whatsapp)||undefined,
            externalReference:'visitor:'+visitorId,
            notificationDisabled:false,
          }),
        });
        customer=created.id;
      }

      const token=crypto.randomUUID()+crypto.randomUUID();
      const tokenHash=await hash(token);
      const items=(photos||[]).map((photo:any)=>({
        photo_id:photo.id,
        name:photo.original_filename||'Foto',
        unit_price:price,
        quantity:1,
      }));
      const {data:order,error:orderError}=await admin
        .from('payment_orders')
        .insert({
          organization_id:event.organization_id,
          event_id:event.id,
          visitor_id:visitorId,
          provider:'asaas',
          status:'pending',
          amount,
          platform_fee_amount:0,
          organization_net_amount:amount,
          // Let the payer choose among the payment methods enabled in Asaas.
          // A PIX-only invoice can become unpayable when PIX is unavailable
          // for the connected account, even though the charge is created.
          payment_method:'UNDEFINED',
          items,
          purpose:'event_purchase',
          metadata:{public_token_hash:tokenHash,event_slug:slug},
        })
        .select('*')
        .single();
      if(orderError)throw orderError;

      const due=new Date();
      due.setDate(due.getDate()+1);
      let payment:any;
      try{
        payment=await asaas('/payments',{
          method:'POST',
          body:JSON.stringify({
            customer,
            billingType:'UNDEFINED',
            value:amount,
            dueDate:due.toISOString().slice(0,10),
            description:`${ids.length} foto(s) - ${event.title}`,
            externalReference:`event_purchase:${order.id}`,
          }),
        });
      }catch(error:any){
        await admin
          .from('payment_orders')
          .update({
            status:'failed',
            provider_payload:{error:String(error?.message||'Falha ao criar cobrança no Asaas').slice(0,500)},
            updated_at:new Date().toISOString(),
          })
          .eq('id',order.id);
        throw error;
      }

      const {data:updated,error:updateError}=await admin
        .from('payment_orders')
        .update({
          provider_payment_id:payment.id,
          invoice_url:payment.invoiceUrl||null,
          due_at:payment.dueDate?new Date(payment.dueDate+'T23:59:59Z').toISOString():null,
          external_reference:`event_purchase:${order.id}`,
          provider_payload:payment,
          updated_at:new Date().toISOString(),
        })
        .eq('id',order.id)
        .select('*')
        .single();
      if(updateError)throw updateError;

      return j({
        ok:true,
        order:{
          id:updated.id,
          status:updated.status,
          amount:Number(updated.amount),
          invoice_url:updated.invoice_url,
        },
        access_token:token,
      });
    }

    if(action==='order_status'){
      const orderId=String(body.order_id||'');
      const token=String(body.access_token||'');
      if(!orderId||!token)return j({error:'ORDER_TOKEN_REQUIRED'},400);
      const {data:order}=await admin
        .from('payment_orders')
        .select('id,event_id,status,amount,invoice_url,metadata,items,paid_at')
        .eq('id',orderId)
        .eq('event_id',event.id)
        .in('purpose',['event_purchase','photo_purchase'])
        .maybeSingle();
      if(!order)return j({error:'ORDER_NOT_FOUND'},404);
      const receivedHash=await hash(token);
      const allowedHashes=[String(order.metadata?.public_token_hash||''),...(Array.isArray(order.metadata?.public_token_hashes)?order.metadata.public_token_hashes.map(String):[])];
      if(!allowedHashes.includes(receivedHash))return j({error:'INVALID_ORDER_TOKEN'},403);
      return j({
        ok:true,
        order:{
          id:order.id,
          status:order.status,
          amount:Number(order.amount),
          invoice_url:order.invoice_url,
          paid_at:order.paid_at,
          items:order.items,
        },
      });
    }

    return j({error:'UNKNOWN_ACTION'},400);
  }catch(error:any){
    const message=error?.message||'Erro inesperado';
    return j({error:message},message==='EVENT_NOT_FOUND'?404:message==='ASAAS_NOT_CONFIGURED'?503:500);
  }
});
