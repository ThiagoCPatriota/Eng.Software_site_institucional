import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  slugify,
  supabase,
} from "./supabase-client.js";

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-ingresso-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-ingresso-list]");
const empty = document.querySelector("[data-ingresso-empty]");
const filter = document.querySelector("[data-ingresso-filter]");
const newButton = document.querySelector("[data-new-ingresso]");
const clearButton = document.querySelector("[data-clear-form]");

let currentUser = null;
let items = [];

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setFormLoading(isLoading) {
  form?.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function text(value) { return value == null ? "" : String(value); }

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function statusClass(status) {
  if (status === "publicado") return "is-published";
  if (status === "oculto") return "is-hidden";
  return "is-draft";
}

function formatDate(value) {
  if (!value) return "Sem data";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.tipo.value = "inscricoes"; form.elements.ordem.value = "0"; form.elements.destaque.checked = false;
  if (form.elements.status) form.elements.status.value = "rascunho";
  if (form.elements.visivel) form.elements.visivel.checked = true;
  formTitle.textContent = "Nova informação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.tipo.value = text(item.tipo || "inscricoes");
  form.elements.status.value = text(item.status || "rascunho");
  form.elements.ordem.value = text(item.ordem ?? 0);
  form.elements.resumo.value = text(item.resumo);
  form.elements.conteudo.value = text(item.conteudo);
  form.elements.data_inicio.value = text(item.data_inicio);
  form.elements.data_fim.value = text(item.data_fim);
  form.elements.link_url.value = text(item.link_url);
  form.elements.link_label.value = text(item.link_label);
  form.elements.visivel.checked = Boolean(item.visivel);
  form.elements.destaque.checked = Boolean(item.destaque);
  formTitle.textContent = "Editar informação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  return {
    titulo,
    slug: slugify(titulo),
    status,
    tipo: String(formData.get("tipo") || "geral"),
    ordem: Number(formData.get("ordem") || 0),
    resumo: String(formData.get("resumo") || "").trim(),
    conteudo: String(formData.get("conteudo") || "").trim() || null,
    data_inicio: String(formData.get("data_inicio") || "").trim() || null,
    data_fim: String(formData.get("data_fim") || "").trim() || null,
    link_url: String(formData.get("link_url") || "").trim() || null,
    link_label: String(formData.get("link_label") || "").trim() || "Acessar informação",
    destaque: Boolean(form.elements.destaque?.checked),
    visivel: Boolean(form.elements.visivel?.checked) && status === "publicado",
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

function getFilteredItems() {
  const value = filter?.value || "todos";
  if (value === "todos") return items;
  if (["inscricoes", "aprovados_remanejamento", "matricula_rematricula", "geral"].includes(value)) return items.filter((item) => item.tipo === value);
  return items.filter((item) => item.status === value);
}

function updateStats() {
  
}

function renderItems() {
  if (!list || !empty) return;
  const visibleItems = getFilteredItems();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", visibleItems.length === 0);
  updateStats();
  visibleItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo;
    const meta = document.createElement("small");
    meta.textContent = `${item.tipo || "informação"}${item.data_inicio ? " · " + formatDate(item.data_inicio) : ""}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}`;
    heading.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.status || "rascunho", statusClass(item.status)));
    if (item.visivel) pills.appendChild(createPill("público", "is-visible"));
    if (item.tipo) pills.appendChild(createPill(item.tipo)); if (item.destaque) pills.appendChild(createPill("destaque", "is-home"));
    header.append(heading, pills);

    const summary = document.createElement("p");
    summary.textContent = item.resumo || "Sem resumo cadastrado.";
    const footnote = document.createElement("small");
    footnote.className = "admin-card-footnote";
    footnote.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-status">${item.status === "publicado" ? "Ocultar" : "Publicar"}</button>
      <button type="button" data-action="remove">Remover</button>
      ${item.link_externo || item.link_url || item.link_documento ? '<button type="button" data-action="open-link">Abrir link</button>' : ""}
    `;
    card.append(header, summary, footnote, actions);
    list.appendChild(card);
  });
}

async function loadItems() {
  let query = supabase.from("ingresso_informacoes").select("*");
  query = query.order("ordem", { ascending: true }).order("data_inicio", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  items = data || [];
  renderItems();
}

async function saveItem(event) {
  event.preventDefault();
  setFormLoading(true);
  setStatus("Salvando...", "info");
  try {
    const id = form.elements.id.value;
    const payload = getPayload();
    if (!payload.titulo || !payload.resumo) {
      setStatus("Preencha os campos obrigatórios antes de salvar.", "error");
      return;
    }
    if (id) {
      const current = items.find((item) => item.id === id);
      const nextPayload = {
        ...payload,
        publicado_em: payload.status === "publicado" ? (current?.publicado_em || payload.publicado_em) : null,
      };
      const { error } = await supabase.from("ingresso_informacoes").update(nextPayload).eq("id", id);
      if (error) throw error;
      setStatus("Registro atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase.from("ingresso_informacoes").insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Registro cadastrado com sucesso.", "success");
    }
    resetForm();
    await loadItems();
  } catch (error) {
    setStatus(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function updateItem(id, patch, message) {
  const { error } = await supabase.from("ingresso_informacoes").update({ ...patch, atualizado_por: currentUser?.id || null }).eq("id", id);
  if (error) throw error;
  setStatus(message, "success");
  await loadItems();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".admin-publication-card");
  const id = card?.dataset.id;
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  try {
    if (button.dataset.action === "edit") { fillForm(item); return; }
    if (button.dataset.action === "open-link") {
      const url = item.link_externo || item.link_url || item.link_documento;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (button.dataset.action === "toggle-status") {
      const nextStatus = item.status === "publicado" ? "oculto" : "publicado";
      await updateItem(id, { status: nextStatus, visivel: nextStatus === "publicado", publicado_em: nextStatus === "publicado" ? (item.publicado_em || new Date().toISOString()) : null }, nextStatus === "publicado" ? "Publicado." : "Ocultado.");
      return;
    }
    if (button.dataset.action === "remove") {
      if (!confirm("Remover este registro?")) return;
      const { error } = await supabase.from("ingresso_informacoes").delete().eq("id", id);
      if (error) throw error;
      setStatus("Registro removido.", "success");
      await loadItems();
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

filter?.addEventListener("change", renderItems);
form?.addEventListener("submit", saveItem);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function boot() {
  if (!isSupabaseConfigured) { setStatus(getConfigMessage(), "error"); setFormLoading(true); return; }
  try {
    const access = await requireAdminAccess();
    if (!access?.isAdmin) throw new Error("Apenas administradores podem acessar este módulo.");
    currentUser = access.session.user;
    await loadItems();
  } catch (error) {
    setStatus(`Acesso negado ou erro ao carregar: ${error.message}`, "error");
    setFormLoading(true);
  }
}

boot();
