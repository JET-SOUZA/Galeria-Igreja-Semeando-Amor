import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const SB = (Deno.env.get("SUPABASE_URL") || "").trim(),
  ANON = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim(),
  SERVICE = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const j = (b: any, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
async function ctx(req: Request) {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw Error("UNAUTHORIZED");
  const pub = createClient(SB, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }),
    {
      data: { user },
    } = await pub.auth.getUser(token);
  if (!user) throw Error("UNAUTHORIZED");
  const admin = createClient(SB, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    { data: p } = await admin
      .from("admin_profiles")
      .select("user_id,full_name,role,is_active")
      .eq("user_id", user.id)
      .maybeSingle();
  if (!p?.is_active) throw Error("FORBIDDEN");
  return { admin, user, profile: p };
}
async function scope(c: any, requested: string) {
  if (c.profile.role === "developer") {
    return requested
      ? { orgId: requested, global: false, permissions: new Set<string>(["*"]) }
      : { orgId: null, global: true, permissions: new Set<string>(["*"]) };
  }
  const { data: mm } = await c.admin
    .from("organization_members")
    .select("organization_id,permission_overrides")
    .eq("user_id", c.user.id)
    .eq("is_active", true);
  if (!mm?.length || mm.length !== 1) throw Error("NO_ORGANIZATION");
  const m = mm[0],
    { data: r } = await c.admin
      .from("access_roles")
      .select("permissions")
      .eq("code", c.profile.role)
      .maybeSingle(),
    p = new Set<string>(r?.permissions || []);
  for (const x of m.permission_overrides?.allow || []) p.add(String(x));
  for (const x of m.permission_overrides?.deny || []) p.delete(String(x));
  return { orgId: m.organization_id, global: false, permissions: p };
}
const can = (p: Set<string>, x: string) => p.has("*") || p.has(x);
const days = (d: string | null) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
async function emit(admin: any, row: any) {
  await admin
    .from("organization_notifications")
    .upsert(row, {
      onConflict: "organization_id,dedupe_key",
      ignoreDuplicates: true,
    });
}
async function dispatch() {
  try {
    await fetch(`${SB}/functions/v1/notification-dispatch`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 50 }),
    });
  } catch {}
}
async function generate(c: any, orgId: string) {
  const { data: org } = await c.admin
    .from("organizations")
    .select("id,name,plan_id,status,access_blocked_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return;
  const { data: plan } = org.plan_id
    ? await c.admin
        .from("platform_plans")
        .select("id,name,photo_limit,storage_gb,event_limit")
        .eq("id", org.plan_id)
        .maybeSingle()
    : { data: null };
  const { data: events } = await c.admin
      .from("events")
      .select("id,title,slug,status,gallery_access,face_search_enabled")
      .eq("organization_id", orgId),
    ids = (events || []).map((x: any) => x.id);
  let photos: any[] = [];
  if (ids.length) {
    const { data } = await c.admin
      .from("photos")
      .select("id,event_id,face_index_status,original_bytes,bytes,deleted_at")
      .in("event_id", ids)
      .is("deleted_at", null);
    photos = data || [];
  }
  const byEvent = new Map<
    string,
    { photos: number; failed: number; pending: number }
  >();
  for (const e of events || [])
    byEvent.set(e.id, { photos: 0, failed: 0, pending: 0 });
  let storage = 0;
  for (const p of photos) {
    const m = byEvent.get(p.event_id);
    if (m) {
      m.photos++;
      if (p.face_index_status === "failed") m.failed++;
      else if (p.face_index_status !== "indexed") m.pending++;
    }
    storage += Number(p.original_bytes || p.bytes || 0);
  }
  for (const e of events || []) {
    const m = byEvent.get(e.id)!;
    if (e.status === "published" && m.photos === 0)
      await emit(c.admin, {
        organization_id: orgId,
        event_id: e.id,
        type: "event_without_photos",
        severity: "warning",
        title: "Evento publicado sem fotos",
        message: `${e.title} está público, mas ainda não possui fotos.`,
        action_url: `/admin/evento/${e.slug}/fotos`,
        dedupe_key: `event-no-photos:${e.id}`,
      });
    if (e.gallery_access === "face_only" && m.failed > 0)
      await emit(c.admin, {
        organization_id: orgId,
        event_id: e.id,
        type: "face_failures",
        severity: "critical",
        title: "Fotos com falha no reconhecimento",
        message: `${e.title} possui ${m.failed} foto(s) com falha de indexação.`,
        action_url: `/admin/evento/${e.slug}/fotos`,
        dedupe_key: `face-fail:${e.id}:${m.failed}`,
        metadata: { failed: m.failed },
      });
  }
  await c.admin
    .from("organization_notifications")
    .update({ resolved_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("type", "face_processing")
    .is("resolved_at", null);
  const photoLimit = Number(plan?.photo_limit || 0),
    storageLimit = Number(plan?.storage_gb || 0) * 1073741824,
    eventLimit = Number(plan?.event_limit || 0);
  if (photoLimit > 0) {
    const pct = photos.length / photoLimit;
    if (pct >= 0.8)
      await emit(c.admin, {
        organization_id: orgId,
        type: "photo_limit",
        severity: pct >= 0.95 ? "critical" : "warning",
        title: "Limite de fotos próximo",
        message: `Você já utilizou ${Math.round(pct * 100)}% do limite de fotos do plano ${plan?.name || ""}.`,
        action_url: "/admin",
        dedupe_key: `photo-limit:${Math.floor(pct * 10)}`,
        metadata: { used: photos.length, limit: photoLimit, pct },
      });
  }
  if (storageLimit > 0) {
    const pct = storage / storageLimit;
    if (pct >= 0.8)
      await emit(c.admin, {
        organization_id: orgId,
        type: "storage_limit",
        severity: pct >= 0.95 ? "critical" : "warning",
        title: "Armazenamento próximo do limite",
        message: `O armazenamento está em ${Math.round(pct * 100)}% do limite contratado.`,
        action_url: "/admin",
        dedupe_key: `storage-limit:${Math.floor(pct * 10)}`,
        metadata: { used: storage, limit: storageLimit, pct },
      });
  }
  if (eventLimit > 0) {
    const pct = (events || []).length / eventLimit;
    if (pct >= 0.8)
      await emit(c.admin, {
        organization_id: orgId,
        type: "event_limit",
        severity: pct >= 1 ? "critical" : "warning",
        title: "Limite de eventos próximo",
        message: `Você está utilizando ${(events || []).length} de ${eventLimit} eventos permitidos.`,
        action_url: "/admin",
        dedupe_key: `event-limit:${(events || []).length}:${eventLimit}`,
        metadata: { used: (events || []).length, limit: eventLimit },
      });
  }
  const { data: sub } = await c.admin
    .from("organization_subscriptions")
    .select("status,next_billing_at,trial_ends_at,grace_ends_at,overdue_since")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub) {
    const due = days(sub.next_billing_at),
      trial = days(sub.trial_ends_at),
      grace = days(sub.grace_ends_at);
    if (due !== null && due >= 0 && due <= 7)
      await emit(c.admin, {
        organization_id: orgId,
        type: "billing_due",
        severity: due <= 2 ? "warning" : "info",
        title: "Próxima cobrança se aproxima",
        message: `A próxima cobrança vence em ${due} dia(s).`,
        action_url: "/conta",
        dedupe_key: `billing-due:${sub.next_billing_at}`,
      });
    if (trial !== null && trial >= 0 && trial <= 5)
      await emit(c.admin, {
        organization_id: orgId,
        type: "trial_ending",
        severity: "warning",
        title: "Período de teste terminando",
        message: `O período de teste termina em ${trial} dia(s).`,
        action_url: "/conta",
        dedupe_key: `trial-ending:${sub.trial_ends_at}`,
      });
    if (sub.overdue_since)
      await emit(c.admin, {
        organization_id: orgId,
        type: "billing_overdue",
        severity: "critical",
        title: "Pagamento em atraso",
        message:
          grace !== null && grace >= 0
            ? `Existe pagamento em atraso. O período de tolerância termina em ${grace} dia(s).`
            : "Existe pagamento em atraso e o acesso pode ser afetado.",
        action_url: "/conta",
        dedupe_key: `billing-overdue:${sub.overdue_since}`,
      });
  }
  if (org.access_blocked_at)
    await emit(c.admin, {
      organization_id: orgId,
      type: "access_blocked",
      severity: "critical",
      title: "Acesso da organização bloqueado",
      message: "O acesso desta organização está bloqueado no momento.",
      action_url: "/conta",
      dedupe_key: `access-blocked:${org.access_blocked_at}`,
    });
}
async function stateList(
  c: any,
  orgIds: string[],
  orgNames: Map<string, string>,
) {
  if (!orgIds.length) return { list: [], unread: 0 };
  let q = c.admin
    .from("organization_notifications")
    .select(
      "id,organization_id,event_id,type,severity,title,message,action_url,metadata,created_at,expires_at,resolved_at",
    )
    .in("organization_id", orgIds)
    .is("resolved_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(250);
  const { data: ns } = await q,
    ids = (ns || []).map((n: any) => n.id);
  let states: any[] = [];
  if (ids.length) {
    const { data } = await c.admin
      .from("notification_user_state")
      .select("notification_id,read_at,dismissed_at")
      .eq("user_id", c.user.id)
      .in("notification_id", ids);
    states = data || [];
  }
  const sm = new Map(states.map((x: any) => [x.notification_id, x]));
  const list = (ns || [])
    .map((n: any) => ({
      ...n,
      organization_name: orgNames.get(n.organization_id) || "Cliente",
      read_at: sm.get(n.id)?.read_at || null,
      dismissed_at: sm.get(n.id)?.dismissed_at || null,
    }))
    .filter((n: any) => !n.dismissed_at);
  return { list, unread: list.filter((n: any) => !n.read_at).length };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await ctx(req),
      u = new URL(req.url),
      body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const s = await scope(
      c,
      String(
        body.organization_id || u.searchParams.get("organization_id") || "",
      ),
    );
    if (!can(s.permissions, "notifications.view"))
      return j({ error: "Sem permissão para notificações." }, 403);
    if (req.method === "POST") {
      const orgId = String(body.organization_id || "");
      if (!orgId)
        return j({ error: "Organização obrigatória para esta ação." }, 400);
      if (c.profile.role !== "developer" && orgId !== s.orgId)
        return j({ error: "Organização inválida." }, 403);
      const action = String(body.action || "");
      if (action === "read" || action === "dismiss") {
        const id = String(body.notification_id || "");
        if (!id) return j({ error: "Notificação obrigatória." }, 400);
        const { data: n } = await c.admin
          .from("organization_notifications")
          .select("id")
          .eq("id", id)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (!n) return j({ error: "Notificação não encontrada." }, 404);
        const row: any = { notification_id: id, user_id: c.user.id };
        if (action === "read") row.read_at = new Date().toISOString();
        else row.dismissed_at = new Date().toISOString();
        await c.admin
          .from("notification_user_state")
          .upsert(row, { onConflict: "notification_id,user_id" });
        return j({ ok: true });
      }
      if (action === "read_all") {
        const { data: ns } = await c.admin
          .from("organization_notifications")
          .select("id")
          .eq("organization_id", orgId)
          .is("resolved_at", null);
        if (ns?.length)
          await c.admin.from("notification_user_state").upsert(
            ns.map((n: any) => ({
              notification_id: n.id,
              user_id: c.user.id,
              read_at: new Date().toISOString(),
            })),
            { onConflict: "notification_id,user_id" },
          );
        return j({ ok: true, count: ns?.length || 0 });
      }
      return j({ error: "Ação inválida." }, 400);
    }
    if (s.global) {
      const { data: orgs } = await c.admin
        .from("organizations")
        .select("id,name")
        .order("name");
      const all = orgs || [];
      await Promise.all(all.map((o: any) => generate(c, o.id)));
      await dispatch();
      const names = new Map(all.map((o: any) => [o.id, o.name])),
        r = await stateList(
          c,
          all.map((o: any) => o.id),
          names,
        );
      return j({
        ok: true,
        global: true,
        organizations: all,
        unread: r.unread,
        notifications: r.list,
      });
    }
    await generate(c, s.orgId);
    await dispatch();
    const { data: o } = await c.admin
        .from("organizations")
        .select("id,name")
        .eq("id", s.orgId)
        .maybeSingle(),
      names = new Map([[s.orgId, o?.name || "Cliente"]]),
      r = await stateList(c, [s.orgId], names);
    return j({
      ok: true,
      global: false,
      organization_id: s.orgId,
      organization: o,
      unread: r.unread,
      notifications: r.list,
    });
  } catch (e: any) {
    const m = e?.message || "Erro inesperado";
    return j(
      { error: m },
      m === "UNAUTHORIZED"
        ? 401
        : ["FORBIDDEN", "NO_ORGANIZATION"].includes(m)
          ? 403
          : 500,
    );
  }
});
