import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";
const list = document.querySelector("[data-servicos-list]");
const empty = document.querySelector("[data-servicos-empty]");
const filters = document.querySelectorAll("[data-servico-public-filter]");
let servicos = []; let activeFilter = "todos";
const LABELS = { biblioteca: "Biblioteca", atividades_complementares: "Atividades complementares", tcc: "TCC", outro: "Outro serviço" };
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function getItems() { return activeFilter === "todos" ? servicos : servicos.filter((item) => item.tipo === activeFilter); }
function render() {
  if (!list || !empty) return;
  const items = getItems(); list.innerHTML = ""; empty.classList.toggle("is-visible", items.length === 0);
  items.forEach((item) => {
    const article = document.createElement("article"); article.className = "servico-card";
    article.innerHTML = `<span>${esc(LABELS[item.tipo] || item.tipo)}</span><h3>${esc(item.titulo)}</h3><p>${esc(item.descricao || "")}</p><a class="btn btn-primary" href="${esc(item.link_url)}" target="_blank" rel="noopener">${esc(item.link_label || "Acessar serviço")}</a>`;
    list.appendChild(article);
  });
}
async function load() {
  if (!isSupabaseConfigured || !supabase) { empty.textContent = getConfigMessage(); empty.classList.add("is-visible"); return; }
  const { data, error } = await supabase.from("outros_servicos_publicos").select("*").order("ordem", { ascending: true }).order("criado_em", { ascending: false });
  if (error) throw error; servicos = data || []; render();
}
filters.forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.servicoPublicFilter || "todos"; filters.forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
load().catch((error) => { if (empty) { empty.textContent = `Erro ao carregar serviços: ${error.message}`; empty.classList.add("is-visible"); } });
