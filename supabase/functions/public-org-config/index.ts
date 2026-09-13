import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = (Deno.env.get('SUPABASE_URL') || '').trim();
const SERVICE = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey,content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=60' },
});
const serviceHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const url = new URL(request.url);
    const organizationSlug = (url.searchParams.get('org') || '').trim();
    const eventSlug = (url.searchParams.get('event') || '').trim();
    let event: any = null;
    let organizationUrl = `${SB}/rest/v1/organizations?select=id,name,slug,status&order=created_at.asc&limit=1`;

    if (eventSlug) {
      const eventResponse = await fetch(
        `${SB}/rest/v1/events?slug=eq.${encodeURIComponent(eventSlug)}&status=eq.published&select=id,slug,title,organization_id&limit=1`,
        { headers: serviceHeaders },
      );
      const events = await eventResponse.json();
      if (!eventResponse.ok || !events?.[0]) return json({ error: 'EVENT_NOT_FOUND' }, 404);
      event = events[0];
      organizationUrl = `${SB}/rest/v1/organizations?id=eq.${encodeURIComponent(event.organization_id)}&select=id,name,slug,status&limit=1`;
    } else if (organizationSlug) {
      organizationUrl = `${SB}/rest/v1/organizations?slug=eq.${encodeURIComponent(organizationSlug)}&select=id,name,slug,status&limit=1`;
    }

    const organizationResponse = await fetch(organizationUrl, { headers: serviceHeaders });
    const organizations = await organizationResponse.json();
    if (!organizationResponse.ok || !organizations?.[0]) return json({ error: 'ORGANIZATION_NOT_FOUND' }, 404);
    const organization = organizations[0];

    const [brandingResponse, fieldsResponse] = await Promise.all([
      fetch(
        `${SB}/rest/v1/organization_branding?organization_id=eq.${encodeURIComponent(organization.id)}&select=*`,
        { headers: serviceHeaders },
      ),
      fetch(
        `${SB}/rest/v1/registration_fields?organization_id=eq.${encodeURIComponent(organization.id)}&is_enabled=eq.true&select=*&order=sort_order.asc`,
        { headers: serviceHeaders },
      ),
    ]);
    const branding = (await brandingResponse.json())?.[0] || {};
    const fields = await fieldsResponse.json();
    if (!brandingResponse.ok || !fieldsResponse.ok) return json({ error: 'CONFIG_NOT_AVAILABLE' }, 500);

    return json({
      ok: true,
      organization,
      event: event ? { id: event.id, slug: event.slug, title: event.title } : null,
      branding,
      fields,
    });
  } catch (error: any) {
    return json({ error: error?.message || 'CONFIG_ERROR' }, 500);
  }
});
