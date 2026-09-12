import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SB = (Deno.env.get('SUPABASE_URL') || '').trim();
const SERVICE = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});
const DDDS = new Set(['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99']);

const digits = (value: string) => value.replace(/\D/g, '');
const canonicalPhone = (value: string) => digits(value).replace(/^55(?=\d{10,11}$)/, '');
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
const validName = (value: string) => {
  const parts = value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  return parts.length >= 2 && parts.every((part) => part.length >= 2 && /^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(part));
};
const validPhone = (value: string) => {
  const normalized = canonicalPhone(value);
  if (!(normalized.length === 10 || normalized.length === 11) || !DDDS.has(normalized.slice(0, 2))) return false;
  const local = normalized.slice(2);
  return !(/^0+$/.test(local) || /^(\d)\1+$/.test(local) || (normalized.length === 11 && local[0] !== '9'));
};
const validCPF = (raw: string) => {
  const cpf = digits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date > new Date()) return false;
  const minimum = new Date();
  minimum.setUTCFullYear(minimum.getUTCFullYear() - 120);
  return date >= minimum;
};

function duplicateResponse(cpf: boolean, whatsapp: boolean) {
  if (cpf && whatsapp) return json({
    error: 'Já existe um cliente cadastrado com este CPF e este celular.',
    code: 'DUPLICATE_CPF_AND_WHATSAPP',
    fields: ['cpf', 'whatsapp'],
  }, 409);
  if (cpf) return json({ error: 'Já existe um cliente cadastrado com este CPF.', code: 'DUPLICATE_CPF', field: 'cpf' }, 409);
  return json({ error: 'Já existe um cliente cadastrado com este celular.', code: 'DUPLICATE_WHATSAPP', field: 'whatsapp' }, 409);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const body = await req.json();
    const admin = createClient(SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    let organizationId = String(body.organization_id || '');
    if (!organizationId) {
      const { data: organization } = await admin.from('organizations').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
      organizationId = organization?.id || '';
    }
    if (!organizationId) return json({ error: 'Organização não encontrada.' }, 400);

    const { data: fields, error: fieldsError } = await admin.from('registration_fields').select('*').eq('organization_id', organizationId).eq('is_enabled', true).order('sort_order');
    if (fieldsError) throw fieldsError;
    const fieldMap = new Map((fields || []).map((field: any) => [field.field_key, field]));
    const required = (key: string) => !!fieldMap.get(key)?.is_required;
    for (const field of fields || []) {
      if (field.is_required && !['privacy'].includes(field.field_key)) {
        const value = body[field.field_key] ?? body.custom_fields?.[field.field_key];
        if (value === undefined || value === null || value === '') return json({ error: `Preencha o campo obrigatório: ${field.label}.` }, 400);
      }
    }
    if (!body.privacy) return json({ error: 'Aceite a Política de Privacidade para continuar.' }, 400);

    const fullName = String(body.full_name || '').trim().replace(/\s+/g, ' ');
    const email = String(body.email || '').trim().toLowerCase();
    const whatsappRaw = String(body.whatsapp || '').trim();
    const whatsapp = canonicalPhone(whatsappRaw);
    const cpfRaw = String(body.cpf || '').trim();
    const cpf = digits(cpfRaw);
    const birthDate = String(body.birth_date || '').trim();
    if (fullName && (required('full_name') || fieldMap.has('full_name')) && !validName(fullName)) return json({ error: 'Informe nome e sobrenome válidos.' }, 400);
    if (whatsappRaw && !validPhone(whatsappRaw)) return json({ error: 'Informe um WhatsApp brasileiro válido com DDD.' }, 400);
    if (email && !validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
    if (cpfRaw && !validCPF(cpfRaw)) return json({ error: 'Informe um CPF válido.' }, 400);
    if (birthDate && !validDate(birthDate)) return json({ error: 'Informe uma data de nascimento válida.' }, 400);

    const [cpfLookup, whatsappLookup] = await Promise.all([
      cpf ? admin.from('visitors').select('id').eq('organization_id', organizationId).eq('cpf', cpf).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
      whatsapp ? admin.from('visitors').select('id').eq('organization_id', organizationId).eq('whatsapp', whatsapp).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (cpfLookup.error) throw cpfLookup.error;
    if (whatsappLookup.error) throw whatsappLookup.error;
    if (cpfLookup.data || whatsappLookup.data) return duplicateResponse(!!cpfLookup.data, !!whatsappLookup.data);

    let sourceEventId = String(body.source_event_id || body.event_id || '').trim() || null;
    if (sourceEventId) {
      const { data: event } = await admin.from('events').select('id,organization_id,title').eq('id', sourceEventId).maybeSingle();
      if (!event || event.organization_id !== organizationId) sourceEventId = null;
    }

    const known = new Set(['organization_id','full_name','housing_type','street','neighborhood','city','whatsapp','email','cpf','birth_date','has_solar','privacy','marketing_consent','custom_fields','source_type','source_label','source_event_id','event_id','source_campaign','utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer','landing_path']);
    const custom: Record<string, unknown> = { ...(body.custom_fields || {}) };
    for (const field of fields || []) if (!known.has(field.field_key) && field.field_key in body) custom[field.field_key] = body[field.field_key];

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      full_name: fullName || 'Visitante',
      housing_type: String(body.housing_type || 'other'),
      street: String(body.street || '-').trim() || '-',
      neighborhood: String(body.neighborhood || '-').trim() || '-',
      city: String(body.city || '-').trim() || '-',
      whatsapp: whatsapp || '-',
      privacy_accepted_at: new Date().toISOString(),
      marketing_consent: !!body.marketing_consent,
      custom_fields: custom,
      source_type: String(body.source_type || 'direct').slice(0, 50),
      source_label: body.source_label ? String(body.source_label).slice(0, 150) : null,
      source_event_id: sourceEventId,
      source_campaign: body.source_campaign ? String(body.source_campaign).slice(0, 150) : null,
      utm_source: body.utm_source ? String(body.utm_source).slice(0, 150) : null,
      utm_medium: body.utm_medium ? String(body.utm_medium).slice(0, 150) : null,
      utm_campaign: body.utm_campaign ? String(body.utm_campaign).slice(0, 150) : null,
      utm_content: body.utm_content ? String(body.utm_content).slice(0, 150) : null,
      utm_term: body.utm_term ? String(body.utm_term).slice(0, 150) : null,
      referrer: body.referrer ? String(body.referrer).slice(0, 500) : null,
      landing_path: body.landing_path ? String(body.landing_path).slice(0, 500) : null,
    };
    if (email) payload.email = email;
    if (cpf) payload.cpf = cpf;
    if (birthDate) payload.birth_date = birthDate;
    if (typeof body.has_solar === 'boolean') payload.has_solar = body.has_solar;

    const { data: visitor, error: insertError } = await admin.from('visitors').insert(payload).select('id,full_name,email,marketing_consent,source_type,source_label,source_event_id,utm_source,utm_campaign').single();
    if (insertError || !visitor) {
      const message = String(insertError?.message || '');
      if (message.includes('VISITOR_DUPLICATE_CPF')) return duplicateResponse(true, false);
      if (message.includes('VISITOR_DUPLICATE_WHATSAPP')) return duplicateResponse(false, true);
      throw insertError || new Error('Não foi possível concluir o cadastro.');
    }

    const userAgent = req.headers.get('user-agent') || null;
    await admin.from('consent_logs').insert([
      { visitor_id: visitor.id, consent_type: 'privacy_terms', accepted: true, policy_version: '1.2', user_agent: userAgent },
      { visitor_id: visitor.id, consent_type: 'marketing', accepted: !!body.marketing_consent, policy_version: '1.2', user_agent: userAgent },
    ]);
    return json({ ok: true, visitor });
  } catch (error: any) {
    return json({ error: error?.message || 'Erro ao realizar cadastro.' }, 500);
  }
});
