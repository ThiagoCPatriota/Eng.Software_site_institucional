import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const URL_PLACEHOLDER = "COLE_AQUI_A_URL_DO_SUPABASE";
const KEY_PLACEHOLDER = "COLE_AQUI_A_CHAVE_PUBLICA_DO_SUPABASE";

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes(URL_PLACEHOLDER) &&
  !SUPABASE_ANON_KEY.includes(KEY_PLACEHOLDER)
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getConfigMessage() {
  return "Configure assets/js/supabase-config.js com a URL e a chave pública do Supabase antes de usar o acesso.";
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function isAdminProfile(profile) {
  return Boolean(profile && profile.ativo && ["admin", "editor"].includes(profile.role));
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

async function createFallbackProfile(user) {
  const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "Usuário";
  const { data, error } = await supabase
    .from("site_profiles")
    .insert({
      user_id: user.id,
      email: user.email,
      nome,
      role: "aluno",
      ativo: true,
    })
    .select("user_id, email, nome, role, ativo")
    .single();

  if (error) throw error;
  return data;
}

export async function getOwnProfile(user) {
  if (!supabase || !user) return null;

  const { data, error } = await supabase
    .from("site_profiles")
    .select("user_id, email, nome, role, ativo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  return createFallbackProfile(user);
}

export async function requireAdminAccess() {
  const session = await getCurrentSession();
  if (!session) return { session: null, profile: null, isAdmin: false };

  const profile = await getOwnProfile(session.user);
  return {
    session,
    profile,
    isAdmin: isAdminProfile(profile),
  };
}

export async function signOutAndGoToLogin() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = "login.html";
}

export function formatDateTime(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
