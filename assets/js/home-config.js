import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const fieldElements = document.querySelectorAll("[data-home-field]");
const linkElements = document.querySelectorAll("[data-home-link]");

function applyText(config, field) {
  const value = config?.[field];
  if (value == null || String(value).trim() === "") return;
  document.querySelectorAll(`[data-home-field='${field}']`).forEach((element) => {
    element.textContent = value;
  });
}

function applyLink(config, field) {
  const element = document.querySelector(`[data-home-link='${field}']`);
  if (!element) return;

  const text = config?.[`${field}_texto`];
  const url = config?.[`${field}_url`];

  if (text && String(text).trim()) element.textContent = text;
  if (url && String(url).trim()) element.href = url;
}

async function loadHomeConfig() {
  if (!fieldElements.length && !linkElements.length) return;
  if (!isSupabaseConfigured || !supabase) return;

  const { data, error } = await supabase
    .from("site_home_config")
    .select("*")
    .eq("id", "principal")
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  [
    "hero_kicker",
    "hero_titulo",
    "hero_subtitulo",
    "destaque_1_valor",
    "destaque_1_rotulo",
    "destaque_2_valor",
    "destaque_2_rotulo",
    "destaque_3_valor",
    "destaque_3_rotulo",
  ].forEach((field) => applyText(data, field));

  ["cta_primario", "cta_secundario", "cta_terciario"].forEach((field) => applyLink(data, field));
}

loadHomeConfig().catch((error) => {
  console.warn("Não foi possível carregar as informações administráveis da home:", error);
});
