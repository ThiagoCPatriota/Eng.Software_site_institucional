import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const root = document.querySelector("[data-ingresso-info]");
const buckets = {
  inscricoes: document.querySelector("[data-ingresso-list='inscricoes']"),
  matricula: document.querySelector("[data-ingresso-list='matricula']"),
};
const empty = document.querySelector("[data-ingresso-empty]");

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function normalizeTipo(tipo) {
  if (tipo === "matricula_rematricula") return "matricula";
  return tipo || "inscricoes";
}

function createCard(item) {
  const article = document.createElement("article");
  article.className = `ingresso-info-card${item.destaque ? " is-featured" : ""}`;
  const periodo = item.data_inicio || item.data_fim
    ? `<small>${item.data_inicio ? formatDate(item.data_inicio) : "Início a definir"}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}</small>`
    : "";
  const isPdf = item.documento_nome || item.documento_path || String(item.link_url || "").toLowerCase().includes(".pdf");
  const linkLabel = item.link_label || (isPdf ? "Baixar PDF" : "Acessar informação");

  article.innerHTML = `
    <div class="ingresso-info-topline"><span>${item.destaque ? "Destaque" : isPdf ? "PDF" : "Informação"}</span>${periodo}</div>
    <h3>${esc(item.titulo)}</h3>
    <p>${esc(item.resumo || "")}</p>
    ${item.conteudo ? `<p class="ingresso-info-content">${esc(item.conteudo)}</p>` : ""}
    ${item.link_url ? `<a class="text-link" href="${esc(item.link_url)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>` : ""}
  `;
  return article;
}

async function load() {
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
    .in("tipo", ["inscricoes", "matricula", "matricula_rematricula"])
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: false, nullsFirst: false });

  if (error) throw error;

  const items = data || [];
  Object.values(buckets).forEach((bucket) => { if (bucket) bucket.innerHTML = ""; });
  items.forEach((item) => {
    const bucket = buckets[normalizeTipo(item.tipo)] || buckets.inscricoes;
    bucket?.appendChild(createCard(item));
  });

  if (empty) empty.classList.toggle("is-visible", items.length === 0);
}

load().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar informações de ingresso: ${error.message}`;
    empty.classList.add("is-visible");
  }
});
