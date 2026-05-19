import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";
const root = document.querySelector("[data-ingresso-info]");
const buckets = {
  inscricoes: document.querySelector("[data-ingresso-list='inscricoes']"),
  aprovados_remanejamento: document.querySelector("[data-ingresso-list='aprovados_remanejamento']"),
  matricula_rematricula: document.querySelector("[data-ingresso-list='matricula_rematricula']"),
};
const empty = document.querySelector("[data-ingresso-empty]");
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function formatDate(value) { if (!value) return ""; const [y,m,d]=String(value).split("-"); return y&&m&&d ? `${d}/${m}/${y}` : value; }
function createCard(item) {
  const article = document.createElement("article"); article.className = `ingresso-info-card${item.destaque ? " is-featured" : ""}`;
  const periodo = item.data_inicio || item.data_fim ? `<small>${item.data_inicio ? formatDate(item.data_inicio) : "Início a definir"}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}</small>` : "";
  article.innerHTML = `<div class="ingresso-info-topline"><span>${item.destaque ? "Destaque" : "Informação"}</span>${periodo}</div><h3>${esc(item.titulo)}</h3><p>${esc(item.resumo || "")}</p>${item.conteudo ? `<p class="ingresso-info-content">${esc(item.conteudo)}</p>` : ""}${item.link_url ? `<a class="text-link" href="${esc(item.link_url)}" target="_blank" rel="noopener">${esc(item.link_label || "Acessar informação")}</a>` : ""}`;
  return article;
}
async function load() {
  if (!root) return;
  if (!isSupabaseConfigured || !supabase) { empty.textContent = getConfigMessage(); empty.classList.add("is-visible"); return; }
  const { data, error } = await supabase.from("ingresso_informacoes_publicas").select("*").order("ordem", { ascending: true }).order("data_inicio", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const items = data || [];
  Object.values(buckets).forEach((bucket) => { if (bucket) bucket.innerHTML = ""; });
  items.forEach((item) => { const bucket = buckets[item.tipo] || buckets.inscricoes; bucket?.appendChild(createCard(item)); });
  const hasAny = items.length > 0;
  empty.classList.toggle("is-visible", !hasAny);
}
load().catch((error) => { if (empty) { empty.textContent = `Erro ao carregar informações de ingresso: ${error.message}`; empty.classList.add("is-visible"); } });
