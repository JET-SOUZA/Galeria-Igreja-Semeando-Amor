import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SB = (Deno.env.get("SUPABASE_URL") || "").trim();
const ANON = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
const SERVICE = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const APP = (Deno.env.get("APP_URL") || "https://semeando-memorias.vercel.app").replace(/\/$/, "");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);

async function requireDeveloper(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("UNAUTHORIZED");
  const publicClient = createClient(SB, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await publicClient.auth.getUser(token);
  if (!user) throw new Error("UNAUTHORIZED");
  const admin = createClient(SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("admin_profiles")
    .select("user_id,full_name,role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_active || profile.role !== "developer") throw new Error("FORBIDDEN");
  return { admin, user, profile };
}

async function listUsers(admin: any, organizationId?: string) {
  let memberQuery = admin.from("organization_members")
    .select("id,organization_id,user_id,role,is_active,created_at,first_access_at,invited_at,last_invite_at,invite_email");
  if (organizationId) memberQuery = memberQuery.eq("organization_id", organizationId);
  const [{ data: authUsers }, { data: profiles }, { data: memberships, error }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("admin_profiles").select("user_id,full_name,role,is_active,created_at"),
    memberQuery,
  ]);
  if (error) throw error;
  const authMap = new Map((authUsers?.users || []).map((item: any) => [item.id, item]));
  const profileMap = new Map((profiles || []).map((item: any) => [item.user_id, item]));
  return (memberships || []).map((membership: any) => {
    const auth: any = authMap.get(membership.user_id) || {};
    const profile: any = profileMap.get(membership.user_id) || {};
    return {
      membership_id: membership.id,
      organization_id: membership.organization_id,
      user_id: membership.user_id,
      email: auth.email || membership.invite_email || "",
      full_name: profile.full_name || auth.user_metadata?.full_name || "",
      profile_role: profile.role || null,
      organization_role: membership.role,
      is_active: membership.is_active && profile.is_active !== false,
      email_confirmed_at: auth.email_confirmed_at || null,
      last_sign_in_at: auth.last_sign_in_at || null,
      created_at: auth.created_at || membership.created_at,
      first_access_at: membership.first_access_at,
      invited_at: membership.invited_at,
      last_invite_at: membership.last_invite_at,
      avatar_url: auth.user_metadata?.avatar_url || "",
    };
  });
}

async function audit(admin: any, developer: any, organizationId: string, action: string, userId: string, summary: string, metadata: any = {}, severity = "info") {
  await admin.from("platform_audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: developer.user.id,
    actor_role: "developer",
    actor_name: developer.profile.full_name || null,
    actor_email: developer.user.email || null,
    action,
    entity_type: "user",
    entity_id: userId,
    summary,
    metadata,
    source: "edge:developer-users",
    severity,
  }).then(() => undefined).catch((error: unknown) => console.error("audit", error));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const developer = await requireDeveloper(req);
    const { admin } = developer;
    if (req.method === "GET") {
      const organizationId = new URL(req.url).searchParams.get("organization_id") || undefined;
      return json({ ok: true, users: await listUsers(admin, organizationId), developer_user_id: developer.user.id });
    }
    if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_user") {
      const organizationId = String(body.organization_id || "");
      const email = String(body.email || "").trim().toLowerCase();
      const emailConfirmation = String(body.email_confirmation || "").trim().toLowerCase();
      const fullName = String(body.full_name || "").trim();
      const role = String(body.role || "administrator");
      if (!organizationId || !fullName || !validEmail(email)) return json({ error: "Organização, nome e e-mail válidos são obrigatórios." }, 400);
      if (email !== emailConfirmation) return json({ error: "A confirmação do e-mail não corresponde." }, 400);
      if (body.password) return json({ error: "A senha deve ser criada pelo próprio usuário através do convite." }, 400);
      if (!["administrator", "manager", "photographer", "attendant"].includes(role)) return json({ error: "Perfil inválido." }, 400);
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP}/admin/primeiro-acesso`,
        data: { full_name: fullName, organization_id: organizationId },
      });
      if (error || !invited.user) return json({ error: error?.message || "Não foi possível enviar o convite." }, 400);
      const now = new Date().toISOString();
      try {
        const setup = await Promise.all([
          admin.from("admin_profiles").upsert({ user_id: invited.user.id, full_name: fullName, role, is_active: true }),
          admin.from("organization_members").upsert({
            organization_id: organizationId,
            user_id: invited.user.id,
            role: role === "administrator" ? "admin" : "operator",
            is_active: true,
            invite_email: email,
            invited_at: now,
            last_invite_at: now,
            first_access_at: null,
          }, { onConflict: "organization_id,user_id" }),
        ]);
        const failed = setup.find((result: any) => result.error);
        if (failed?.error) throw failed.error;
        await audit(admin, developer, organizationId, "user_invited", invited.user.id, `Convite enviado: ${fullName}`, { email, role });
        return json({ ok: true, user_id: invited.user.id, invite_sent: true, awaiting_email_confirmation: true }, 201);
      } catch (setupError) {
        await admin.auth.admin.deleteUser(invited.user.id);
        throw setupError;
      }
    }

    if (action === "update_user") {
      const userId = String(body.user_id || "");
      if (!userId) return json({ error: "Usuário obrigatório." }, 400);
      const { data: target } = await admin.from("admin_profiles")
        .select("role,full_name,is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (target?.role === "developer" && userId !== developer.user.id) return json({ error: "Conta de Desenvolvedor protegida." }, 403);
      if (body.password) return json({ error: "Use o fluxo 'Esqueci minha senha'; senhas não podem ser definidas por terceiros." }, 400);
      if (typeof body.email === "string") {
        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        if (body.email.trim().toLowerCase() !== String(authUser.user?.email || "").toLowerCase()) {
          return json({ error: "Para trocar o e-mail, desative este acesso e envie um novo convite ao endereço correto." }, 400);
        }
      }
      if (typeof body.full_name === "string") {
        await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: body.full_name.trim() } });
      }
      if (target?.role !== "developer") {
        const role = String(body.profile_role || target?.role || "attendant");
        if (!["administrator", "manager", "photographer", "attendant"].includes(role)) return json({ error: "Perfil inválido." }, 400);
        await admin.from("admin_profiles").update({
          full_name: String(body.full_name ?? target?.full_name ?? ""),
          role,
          is_active: body.is_active !== false,
        }).eq("user_id", userId);
      }
      if (body.organization_id) {
        await admin.from("organization_members").update({
          role: String(body.profile_role || target?.role) === "administrator" ? "admin" : "operator",
          is_active: body.is_active !== false,
        }).eq("organization_id", String(body.organization_id)).eq("user_id", userId);
        await audit(admin, developer, String(body.organization_id), "user_updated", userId, `Usuário atualizado: ${target?.full_name || userId}`, {
          role_before: target?.role,
          role_after: body.profile_role || target?.role,
          active_before: target?.is_active,
          active_after: body.is_active !== false,
        }, "warning");
      }
      return json({ ok: true });
    }

    if (action === "ensure_developer_all_orgs") {
      const { data: organizations } = await admin.from("organizations").select("id");
      for (const organization of organizations || []) {
        await admin.from("organization_members").upsert({
          organization_id: organization.id,
          user_id: developer.user.id,
          role: "admin",
          is_active: true,
          invite_email: developer.user.email,
          first_access_at: new Date().toISOString(),
        }, { onConflict: "organization_id,user_id" });
      }
      return json({ ok: true, count: organizations?.length || 0 });
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (error: any) {
    const message = error?.message || "Erro inesperado.";
    return json({ error: message }, message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500);
  }
});
