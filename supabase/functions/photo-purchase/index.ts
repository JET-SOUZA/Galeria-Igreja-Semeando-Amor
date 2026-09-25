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

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

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

async function financeByOrganization(admin:any,organizationId:string){
  const {data,error}=await admin
    .from('organization_finance_settings')
    .select('payment_provider,provider_wallet_id,provider_status,payment_enabled,platform_fee_percent,settlement_mode')
    .eq('organization_id',organizationId)
    .maybeSingle();
  if(error)throw error;
  return data||null;
}

function splitConfiguration(finance:any,eventId:string){
  const requiresSplit=finance?.payment_provider==='asaas'&&finance?.settlement_mode==='provider_split';
  if(!requiresSplit)return {requiresSplit:false,ready:true,split:undefined,beneficiaryPercent:0};
  const fee=Math.max(0,Math.min(100,Number(finance?.platform_fee_percent||0)));
  const beneficiaryPercent=Number((100-fee).toFixed(4));
  const ready=!!finance?.payment_enabled&&finance?.provider_status==='active'&&!!finance?.provider_wallet_id&&beneficiaryPercent>0;
  return {
    requiresSplit:true,
    ready,
    beneficiaryPercent,
    split:ready?[{
      walletId:String(finance.provider_wallet_id),
      percentualValue:beneficiaryPercent,
      externalReference:`event:${eventId}`,
      description:'Repasse automático do evento',
    }]:undefined,
  };
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
      const [{data:gateway},finance]=await Promise.all([
        admin
          .from('billing_gateway_settings')
          .select('enabled,environment,webhook_configured,last_health_status,last_health_message')
          .eq('provider','asaas')
          .maybeSingle(),
        financeByOrganization(admin,event.organization_id),
      ]);
      const rootReady=!!ASAAS&&!!gateway?.enabled&&!!gateway?.webhook_configured&&['ready','ok'].includes(String(gateway?.last_health_status||''));
      const beneficiary=splitConfiguration(finance,event.id);
      const ready=rootReady&&beneficiary.ready;
      return j({
        ok:true,
        gateway:{
          provider:'asaas',
          ready,
          environment:gateway?.environment||'sandbox',
          message:ready
            ?'Pagamento disponível.'
            :beneficiary.requiresSplit&&!beneficiary.ready
              ?'O recebedor deste evento ainda está em configuração.'
              :gateway?.last_health_message||'O pagamento está sendo configurado.',
        },
        beneficiary:{
          split_required:beneficiary.requiresSplit,
          ready:beneficiary.ready,
          percent:beneficiary.beneficiaryPercent,
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

      const [{data:gateway},finance]=await Promise.all([
        admin
          .from('billing_gateway_settings')
          .select('enabled,webhook_configured,last_health_status,last_health_message')
          .eq('provider','asaas')
          .maybeSingle(),
        financeByOrganization(admin,event.organization_id),
      ]);
      const rootReady=!!ASAAS&&!!gateway?.enabled&&!!gateway?.webhook_configured&&['ready','ok'].includes(String(gateway?.last_health_status||''));
      const beneficiary=splitConfiguration(finance,event.id);
      if(!rootReady){
        return j({
          error:'PAYMENT_GATEWAY_NOT_READY',
          message:gateway?.last_health_message||'O pagamento está sendo configurado. Suas fotos podem permanecer no carrinho.',
        },503);
      }
      if(!beneficiary.ready){
        return j({
          error:'BENEFICIARY_NOT_READY',
          message:'O recebimento deste evento ainda está sendo configurado. Nenhuma cobrança foi criada.',
        },503);
      }

      const cpf=digits(visitor.cpf);
      if(cpf.length!==11){
        return j({error:'PROFILE_REQUIRED',message:'Para pagar com segurança, complete seu CPF no cadastro.'},409);
      }

      const token=crypto.randomUUID()+crypto.randomUUID();
      const tokenHash=await hash(token);
      const sortedIds=[...ids].sort();
      const photosById=new Map((photos||[]).map((photo:any)=>[String(photo.id),photo]));
      const items=sortedIds.map(photoId=>({
        photo_id:photoId,
        name:photosById.get(photoId)?.original_filename||'Foto',
        unit_price:price,
        quantity:1,
      }));
      const checkoutFingerprint=await hash(['event_purchase',event.id,visitorId,...sortedIds].join(':'));
      const {data:reservation,error:reservationError}=await admin.rpc('reserve_photo_purchase_order',{
        p_organization_id:event.organization_id,
        p_event_id:event.id,
        p_visitor_id:visitorId,
        p_amount:amount,
        p_items:items,
        p_token_hash:tokenHash,
        p_event_slug:slug,
        p_checkout_fingerprint:checkoutFingerprint,
      });
      if(reservationError)throw reservationError;
      const order=reservation?.order;
      if(!order?.id)throw Error('ORDER_RESERVATION_FAILED');

      // Outra aba ou aparelho pode ter reservado o mesmo carrinho enquanto esta
      // requisicao estava em andamento. Nesse caso reutilizamos o pedido e nunca
      // criamos uma segunda cobranca no Asaas.
      if(reservation?.created!==true){
        let current=order;
        for(let attempt=0;attempt<12&&!current.invoice_url&&!current.provider_payment_id;attempt++){
          await wait(350);
          const {data}=await admin.from('payment_orders').select('*').eq('id',order.id).maybeSingle();
          if(data)current=data;
        }
        const preparing=!current.invoice_url&&!current.provider_payment_id;
        return j({
          ok:true,
          reused:true,
          preparing,
          order:{
            id:current.id,
            status:current.status,
            amount:Number(current.amount),
            invoice_url:current.invoice_url,
          },
          access_token:token,
          message:preparing?'O pagamento ja esta sendo preparado em outra aba ou aparelho. Aguarde alguns segundos e atualize.':'A cobranca existente foi recuperada com seguranca.',
        },preparing?202:200);
      }

      const due=new Date();
      due.setDate(due.getDate()+1);
      let payment:any;
      try{
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
        payment=await asaas('/payments',{
          method:'POST',
          body:JSON.stringify({
            customer,
            billingType:'UNDEFINED',
            value:amount,
            dueDate:due.toISOString().slice(0,10),
            description:`${sortedIds.length} foto(s) - ${event.title}`,
            externalReference:`event_purchase:${order.id}`,
            ...(beneficiary.split?{split:beneficiary.split}:{}),
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
          metadata:{
            ...(order.metadata||{}),
            beneficiary_split_required:beneficiary.requiresSplit,
            beneficiary_percent:beneficiary.beneficiaryPercent,
            beneficiary_wallet_id:finance?.provider_wallet_id||null,
          },
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
