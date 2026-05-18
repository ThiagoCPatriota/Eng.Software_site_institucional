import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";
const list = document.querySelector("[data-editais-list]");
const empty = document.querySelector("[data-editais-empty]");
const filters = document.querySelectorAll("[data-edital-public-filter]");
let editais = [];
let activeFilter = "todos";
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function formatDate(value) { if (!value) return ""; const [y,m,d]=String(value).split("-"); return y&&m&&d ? `${d}/${m}/${y}` : value; }
function getItems() { return activeFilter === "todos" ? editais : editais.filter((item) => item.categoria === activeFilter); }
function render() {
  if (!list || !empty) return;
  const items = getItems(); list.innerHTML = ""; empty.classList.toggle("is-visible", items.length === 0);
  items.forEach((item) => {
    const article = document.createElement("article"); article.className = "edital-card";
    article.innerHTML = `
      <div class="edital-topline"><span>${esc(item.categoria || "edital")}</span><small>${item.numero ? esc(item.numero) : "Sem número"}</small></div>
      <h3>${esc(item.titulo)}</h3><p>${esc(item.resumo || "Sem resumo cadastrado.")}</p>
      <div class="edital-meta">
        ${item.data_publicacao ? `<span>Publicado: ${formatDate(item.data_publicacao)}</span>` : ""}
        ${item.data_limite ? `<span>Prazo: ${formatDate(item.data_limite)}</span>` : ""}
        ${item.orgao ? `<span>${esc(item.orgao)}</span>` : ""}
      </div>
      ${item.descricao ? `<p class="edital-description">${esc(item.descricao)}</p>` : ""}
      ${item.link_documento ? `<a class="btn btn-secondary" href="${esc(item.link_documento)}" target="_blank" rel="noopener">Abrir edital</a>` : ""}
    `;
    list.appendChild(article);
  });
}
async function load() {
  if (!isSupabaseConfigured || !supabase) { empty.textContent = getConfigMessage(); empty.classList.add("is-visible"); return; }
  const { data, error } = await supabase.from("editais_publicos").select("*").order("data_publicacao", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false });
  if (error) throw error; editais = data || []; render();
}
filters.forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.editalPublicFilter || "todos"; filters.forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
load().catch((error) => { if (empty) { empty.textContent = `Erro ao carregar editais: ${error.message}`; empty.classList.add("is-visible"); } });
