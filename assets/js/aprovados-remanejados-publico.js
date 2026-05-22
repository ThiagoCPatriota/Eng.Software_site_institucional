import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const root = document.querySelector("[data-aprovados-page]");
const buckets = {
  aprovados: document.querySelector("[data-aprovados-list='aprovados']"),
  remanejamento: document.querySelector("[data-aprovados-list='remanejamento']"),
  matricula: document.querySelector("[data-aprovados-list='matricula']"),
  rematricula: document.querySelector("[data-aprovados-list='rematricula']"),
  reingresso: document.querySelector("[data-aprovados-list='reingresso']"),
  geral: document.querySelector("[data-aprovados-list='geral']"),
};
const empty = document.querySelector("[data-aprovados-empty]");

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function normalizeBucket(tipo) {
  if (tipo === "aprovados") return "aprovados";
  if (tipo === "remanejamento") return "remanejamento";
  if (tipo === "matricula" || tipo === "matricula_rematricula") return "matricula";
  if (tipo === "rematricula") return "rematricula";
  if (tipo === "reingresso") return "reingresso";
  return "geral";
}

function createResultCard(item) {
  const article = document.createElement("article");
  article.className = `result-card${item.destaque ? " is-featured" : ""}`;
  const period = item.data_inicio || item.data_fim
    ? `<small>${item.data_inicio ? formatDate(item.data_inicio) : "Início a definir"}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}</small>`
    : "";
  const isPdf = item.documento_nome || item.documento_path || String(item.link_url || "").toLowerCase().includes(".pdf");
  const linkLabel = item.link_label || (isPdf ? "Baixar PDF" : "Acessar documento");

  article.innerHTML = `
    <div class="result-card-topline"><span>${isPdf ? "PDF" : item.destaque ? "Destaque" : "Publicação"}</span>${period}</div>
    <h3>${esc(item.titulo)}</h3>
    <p>${esc(item.resumo || "")}</p>
    ${item.conteudo ? `<p class="result-card-content">${esc(item.conteudo)}</p>` : ""}
    ${item.link_url ? `<a class="btn btn-secondary" href="${esc(item.link_url)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>` : ""}
  `;
  return article;
}

async function loadResults() {
  if (!root) return;
  if (!isSupabaseConfigured || !supabase) {
    if (empty) {
      empty.textContent = getConfigMessage();
      empty.classList.add("is-visible");
    }
    return;
  }

  const { data, error } = await supabase
    .from("ingresso_informacoes_publicas")
    .select("*")
    .in("tipo", ["aprovados", "remanejamento", "aprovados_remanejamento", "matricula", "matricula_rematricula", "rematricula", "reingresso", "geral"])
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;

  const items = data || [];
  Object.values(buckets).forEach((bucket) => { if (bucket) bucket.innerHTML = ""; });

  items.forEach((item) => {
    const bucket = buckets[normalizeBucket(item.tipo)] || buckets.geral;
    bucket?.appendChild(createResultCard(item));
  });

  if (empty) empty.classList.toggle("is-visible", items.length === 0);
}

loadResults().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar chamadas: ${error.message}`;
    empty.classList.add("is-visible");
  }
});
