import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SB = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP = (Deno.env.get("APP_URL") || "https://semeando-memorias.vercel.app").replace(/\/$/, "");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const roles = ["administrator", "manager", "photographer", "attendant", "finance", "viewer"];
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);

async function context(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const publicClient = createClient(SB, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await publicClient.auth.getUser(token);
  if (!user) throw new Error("UNAUTHORIZED");
  const admin = createClient(SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("admin_profiles")
    .select("user_id,full_name,role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_active) throw new Error("FORBIDDEN");
  if (profile.role === "developer") {
    return { admin, user, profile, isDeveloper: true, organizationId: null, permissions: new Set(["*"]) };
  }
  const { data: memberships } = await admin.from("organization_members")
    .select("organization_id,role,is_active,permission_overrides")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (!memberships?.length || memberships.length !== 1) throw new Error("NO_ORGANIZATION");
  const membership = memberships[0];
  const { data: role } = await admin.from("access_roles")
    .select("permissions")
    .eq("code", profile.role)
    .maybeSingle();
  const permissions = new Set<string>(role?.permissions || []);
  for (const permission of membership.permission_overrides?.allow || []) permissions.add(String(permission));
  for (const permission of membership.permission_overrides?.deny || []) permissions.delete(String(permission));
  return { admin, user, profile, isDeveloper: false, organizationId: membership.organization_id, permissions };
}

const can = (ctx: any, permission: string) => ctx.isDeveloper || ctx.permissions.has("*") || ctx.permissions.has(permission);

async function targetOrganization(req: Request, ctx: any, body: any = {}) {
  if (!ctx.isDeveloper) return ctx.organizationId;
  return String(body.organization_id || new URL(req.url).searchParams.get("organization_id") || "") || null;
}

async function membership(admin: any, organizationId: string, userId: string) {
  const { data } = await admin.from("organization_members")
    .select("id,permission_overrides")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function audit(ctx: any, organizationId: string, action: string, userId: string, summary: string, metadata: any = {}, severity = "info") {
  try {
    await ctx.admin.from("platform_audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: ctx.user.id,
      actor_role: ctx.profile.role,
      actor_name: ctx.profile.full_name || null,
      actor_email: ctx.user.email || null,
      action,
      entity_type: "user",
      entity_id: userId,
      summary,
      metadata,
      source: "edge:admin-users",
      severity,
    });
  } catch (error) {
    console.error("audit", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const ctx = await context(req);
    const { admin, user, profile } = ctx;
    if (req.method === "GET") {
      if (!can(ctx, "users.view")) return json({ error: "Sem permissão para visualizar usuários." }, 403);
      const organizationId = await targetOrganization(req, ctx);
      if (!organizationId && !ctx.isDeveloper) return json({ error: "Organização obrigatória." }, 400);
      let memberRows: any[] = [];
      if (organizationId) {
        const { data } = await admin.from("organization_members")
          .select("user_id,permission_overrides,invited_at,first_access_at,last_invite_at")
          .eq("organization_id", organizationId)
          .eq("is_active", true);
        memberRows = data || [];
      }
      let query = admin.from("admin_profiles")
        .select("user_id,full_name,role,is_active,created_at")
        .order("created_at");
      if (organizationId) {
        query = memberRows.length
          ? query.in("user_id", memberRows.map((item) => item.user_id))
          : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }
      const { data: profiles, error } = await query;
      if (error) throw error;
      const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authMap = new Map((authUsers?.users || []).map((item: any) => [item.id, item]));
      const memberMap = new Map(memberRows.map((item) => [item.user_id, item]));
      const { data: definitions } = await admin.from("access_roles")
        .select("code,label,description,permissions,sort_order")
        .order("sort_order");
      return json({
        users: (profiles || [])
          .filter((item: any) => ctx.isDeveloper || item.role !== "developer")
          .map((item: any) => {
            const auth: any = authMap.get(item.user_id) || {};
            const member: any = memberMap.get(item.user_id) || {};
            return {
              ...item,
              email: auth.email || "",
              email_confirmed_at: auth.email_confirmed_at || null,
              last_sign_in_at: auth.last_sign_in_at || null,
              first_access_at: member.first_access_at || null,
              invited_at: member.invited_at || null,
              last_invite_at: member.last_invite_at || null,
              permission_overrides: member.permission_overrides || { allow: [], deny: [] },
            };
          }),
        roles: definitions || [],
        current_role: profile.role,
        organization_id: organizationId,
      });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = await targetOrganization(req, ctx, body);

    if (req.method === "POST") {
      if (!can(ctx, "users.create")) return json({ error: "Sem permissão para criar usuários." }, 403);
      const role = String(body.role || "viewer");
      if (!roles.includes(role)) return json({ error: "Perfil inválido." }, 400);
      if (!ctx.isDeveloper && profile.role !== "administrator" && ["administrator", "manager", "finance"].includes(role)) {
        return json({ error: "Seu perfil não pode conceder este nível de acesso." }, 403);
      }
      if (!organizationId) return json({ error: "Organização obrigatória." }, 400);
      const fullName = String(body.full_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const confirmation = String(body.email_confirmation || "").trim().toLowerCase();
      if (!fullName || !validEmail(email)) return json({ error: "Nome e e-mail válidos são obrigatórios." }, 400);
      if (email !== confirmation) return json({ error: "A confirmação do e-mail não corresponde." }, 400);
      if (body.password) return json({ error: "A senha deve ser criada pelo próprio usuário através do convite." }, 400);

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP}/admin/primeiro-acesso`,
        data: { full_name: fullName, organization_id: organizationId },
      });
      if (inviteError || !invited.user) return json({ error: inviteError?.message || "Falha ao enviar convite." }, 400);
      const invitedAt = new Date().toISOString();
      try {
        await admin.from("admin_profiles").upsert({ user_id: invited.user.id, full_name: fullName, role, is_active: true });
        await admin.from("organization_members").upsert({
          organization_id: organizationId,
          user_id: invited.user.id,
          role: role === "administrator" ? "admin" : "operator",
          is_active: true,
          invite_email: email,
          invited_at: invitedAt,
          last_invite_at: invitedAt,
          first_access_at: null,
          permission_overrides: { allow: [], deny: [] },
        }, { onConflict: "organization_id,user_id" });
        await audit(ctx, organizationId, "user_invited", invited.user.id, `Convite enviado: ${fullName}`, { email, role });
        return json({ ok: true, invite_sent: true, awaiting_email_confirmation: true }, 201);
      } catch (error) {
        await admin.auth.admin.deleteUser(invited.user.id);
        throw error;
      }
    }

    if (req.method === "PATCH") {
      if (!can(ctx, "users.edit")) return json({ error: "Sem permissão para editar usuários." }, 403);
      const userId = String(body.user_id || "");
      if (!userId || !organizationId) return json({ error: "Usuário/organização obrigatórios." }, 400);
      if (!(await membership(admin, organizationId, userId))) return json({ error: "Usuário não pertence a este cliente." }, 403);
      const { data: target } = await admin.from("admin_profiles")
        .select("role,full_name,is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (target?.role === "developer") return json({ error: "A conta Developer Mestre não pode ser alterada por este fluxo." }, 403);
      if (body.password) return json({ error: "Use o fluxo 'Esqueci minha senha'; senhas não podem ser definidas por terceiros." }, 400);
      if (typeof body.email === "string") {
        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        if (body.email.trim().toLowerCase() !== String(authUser.user?.email || "").toLowerCase()) {
          return json({ error: "Para trocar o e-mail, desative este acesso e envie um novo convite ao endereço correto." }, 400);
        }
      }
      const patch: Record<string, unknown> = {};
      if (typeof body.full_name === "string") patch.full_name = body.full_name.trim();
      if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
      if (typeof body.role === "string") {
        if (!roles.includes(body.role)) return json({ error: "Perfil inválido." }, 400);
        if (!ctx.isDeveloper && profile.role !== "administrator") return json({ error: "Somente Administrador pode alterar o perfil de acesso." }, 403);
        patch.role = body.role;
      }
      if (Object.keys(patch).length) await admin.from("admin_profiles").update(patch).eq("user_id", userId);
      if (typeof body.full_name === "string") {
        await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: body.full_name.trim() } });
      }
      let permissionChanged = false;
      let cleanOverrides: any = null;
      if (typeof body.permission_overrides === "object") {
        if (!ctx.isDeveloper && profile.role !== "administrator") return json({ error: "Somente Administrador pode personalizar permissões." }, 403);
        cleanOverrides = {
          allow: Array.isArray(body.permission_overrides.allow) ? body.permission_overrides.allow.map(String) : [],
          deny: Array.isArray(body.permission_overrides.deny) ? body.permission_overrides.deny.map(String) : [],
        };
        await admin.from("organization_members").update({ permission_overrides: cleanOverrides })
          .eq("organization_id", organizationId)
          .eq("user_id", userId);
        permissionChanged = true;
      }
      const action = permissionChanged ? "permissions_changed" : "user_updated";
      await audit(ctx, organizationId, action, userId, permissionChanged ? `Permissões alteradas: ${target?.full_name || userId}` : `Usuário atualizado: ${target?.full_name || userId}`, {
        role_before: target?.role,
        role_after: patch.role || target?.role,
        active_before: target?.is_active,
        active_after: typeof patch.is_active === "boolean" ? patch.is_active : target?.is_active,
        permission_overrides: permissionChanged ? cleanOverrides : undefined,
      }, permissionChanged ? "warning" : "info");
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (!can(ctx, "users.delete")) return json({ error: "Sem permissão para excluir usuários." }, 403);
      const userId = String(body.user_id || "");
      if (userId === user.id) return json({ error: "Você não pode excluir sua própria conta." }, 400);
      if (!organizationId || !(await membership(admin, organizationId, userId))) return json({ error: "Usuário não pertence ao cliente." }, 403);
      const { data: target } = await admin.from("admin_profiles").select("role,full_name").eq("user_id", userId).maybeSingle();
      if (target?.role === "developer") return json({ error: "Developer Mestre não pode ser excluído." }, 403);
      await admin.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", userId);
      const { count } = await admin.from("organization_members").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (!(count || 0)) await admin.auth.admin.deleteUser(userId);
      await audit(ctx, organizationId, "user_deleted", userId, `Usuário removido: ${target?.full_name || userId}`, { role: target?.role }, "warning");
      return json({ ok: true });
    }
    return json({ error: "Método não permitido." }, 405);
  } catch (error: any) {
    const message = error?.message || "Erro";
    return json({ error: message }, message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" || message === "NO_ORGANIZATION" ? 403 : 500);
  }
});
