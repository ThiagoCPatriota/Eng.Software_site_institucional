import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const list = document.querySelector("[data-monitorias-list]");
const empty = document.querySelector("[data-monitorias-empty]");
const filters = document.querySelectorAll("[data-monitoria-public-filter]");
let monitorias = [];
let activeFilter = "todos";

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function formatDate(value) {
  if (!value) return "Data a definir";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
function getItems() {
  if (activeFilter === "todos") return monitorias;
  return monitorias.filter((item) => item.tipo === activeFilter);
}
function render() {
  if (!list || !empty) return;
  const items = getItems();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "monitoria-card";
    const periodo = item.inscricao_inicio || item.inscricao_fim ? `${formatDate(item.inscricao_inicio)} até ${formatDate(item.inscricao_fim)}` : "Inscrições a definir";
    article.innerHTML = `
      <div class="monitoria-topline"><span>${esc(item.tipo || "monitoria")}</span><small>${esc(periodo)}</small></div>
      <h3>${esc(item.titulo)}</h3>
      <p>${esc(item.resumo || "Sem resumo cadastrado.")}</p>
      <dl>
        <div><dt>Disciplina/área</dt><dd>${esc(item.disciplina || "A definir")}</dd></div>
        <div><dt>Responsável</dt><dd>${esc(item.professor || "A definir")}</dd></div>
        <div><dt>Vagas</dt><dd>${Number(item.vagas || 0) || "A definir"}</dd></div>
        <div><dt>Carga horária</dt><dd>${esc(item.carga_horaria || "A definir")}</dd></div>
      </dl>
      ${item.requisitos ? `<div class="monitoria-requisitos"><strong>Requisitos</strong><p>${esc(item.requisitos)}</p></div>` : ""}
      ${item.link_externo ? `<a class="text-link" href="${esc(item.link_externo)}" target="_blank" rel="noopener">Acessar edital ou orientação</a>` : ""}
    `;
    list.appendChild(article);
  });
}
async function loadMonitorias() {
  if (!isSupabaseConfigured || !supabase) {
    empty.textContent = getConfigMessage();
    empty.classList.add("is-visible");
    return;
  }
  const { data, error } = await supabase.from("monitorias_publicas").select("*").order("inscricao_fim", { ascending: true, nullsFirst: false }).order("criado_em", { ascending: false });
  if (error) throw error;
  monitorias = data || [];
  render();
}
filters.forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.monitoriaPublicFilter || "todos";
  filters.forEach((item) => item.classList.toggle("is-active", item === button));
  render();
}));
loadMonitorias().catch((error) => {
  if (empty) { empty.textContent = `Erro ao carregar monitorias: ${error.message}`; empty.classList.add("is-visible"); }
});
