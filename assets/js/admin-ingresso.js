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
const fileInput = document.querySelector("[data-ingresso-file]");

const INGRESSO_DOCS_BUCKET = "ingresso-documentos";
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const TYPE_LABELS = {
  inscricoes: "Inscrições",
  aprovados: "Aprovados",
  remanejamento: "Remanejamento",
  matricula: "Matrícula inicial",
  rematricula: "Rematrícula",
  reingresso: "Reingresso",
  geral: "Informação geral",
  aprovados_remanejamento: "Aprovados/remanejamento",
  matricula_rematricula: "Matrícula/rematrícula",
};

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

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.tipo.value = "inscricoes";
  form.elements.ordem.value = "0";
  form.elements.destaque.checked = false;
  if (fileInput) fileInput.value = "";
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
  if (fileInput) fileInput.value = "";
  formTitle.textContent = "Editar informação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  const linkUrl = String(formData.get("link_url") || "").trim();

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
    link_url: linkUrl || null,
    link_label: String(formData.get("link_label") || "").trim() || (linkUrl ? "Acessar informação" : "Baixar PDF"),
    destaque: Boolean(form.elements.destaque?.checked),
    visivel: Boolean(form.elements.visivel?.checked) && status === "publicado",
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

function validatePdf(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Envie apenas arquivos em PDF.");
  if (file.size > MAX_PDF_SIZE) throw new Error("O PDF deve ter no máximo 20 MB.");
}

async function uploadDocument(file, title) {
  validatePdf(file);
  const safeTitle = slugify(title || "ingresso-documento");
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeTitle}.pdf`;

  const { error } = await supabase.storage
    .from(INGRESSO_DOCS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(INGRESSO_DOCS_BUCKET).getPublicUrl(path);
  return {
    link_url: data?.publicUrl || null,
    link_label: form.elements.link_label.value.trim() || "Baixar PDF",
    documento_path: path,
    documento_nome: file.name,
    documento_tamanho: file.size,
    documento_tipo: "pdf",
  };
}

async function removeStoredDocument(path) {
  if (!path) return;
  try {
    await supabase.storage.from(INGRESSO_DOCS_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover o documento antigo:", error);
  }
}

function getFilteredItems() {
  const value = filter?.value || "todos";
  if (value === "todos") return items;
  const types = ["inscricoes", "aprovados", "remanejamento", "matricula", "rematricula", "reingresso", "geral"];
  if (types.includes(value)) return items.filter((item) => item.tipo === value);
  return items.filter((item) => item.status === value);
}

function updateStats() {}

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
    meta.textContent = `${TYPE_LABELS[item.tipo] || item.tipo || "informação"}${item.data_inicio ? " · " + formatDate(item.data_inicio) : ""}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}`;
    heading.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.status || "rascunho", statusClass(item.status)));
    if (item.visivel) pills.appendChild(createPill("público", "is-visible"));
    if (item.tipo) pills.appendChild(createPill(TYPE_LABELS[item.tipo] || item.tipo));
    if (item.destaque) pills.appendChild(createPill("destaque", "is-home"));
    if (item.documento_nome || item.documento_path) pills.appendChild(createPill("PDF", "is-visible"));
    header.append(heading, pills);

    const summary = document.createElement("p");
    summary.textContent = item.resumo || "Sem resumo cadastrado.";
    const footnote = document.createElement("small");
    footnote.className = "admin-card-footnote";
    const fileInfo = item.documento_nome ? ` · ${item.documento_nome}${item.documento_tamanho ? " · " + formatFileSize(item.documento_tamanho) : ""}` : "";
    footnote.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}${fileInfo}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-status">${item.status === "publicado" ? "Ocultar" : "Publicar"}</button>
      <button type="button" data-action="remove">Remover</button>
      ${item.link_url ? '<button type="button" data-action="open-link">Abrir link/PDF</button>' : ""}
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
    const current = id ? items.find((item) => item.id === id) : null;
    let payload = getPayload();
    const file = fileInput?.files?.[0] || null;

    if (!payload.titulo || !payload.resumo) {
      setStatus("Preencha os campos obrigatórios antes de salvar.", "error");
      return;
    }

    if (file) {
      setStatus("Enviando PDF...", "info");
      const filePayload = await uploadDocument(file, payload.titulo);
      payload = { ...payload, ...filePayload };
    } else if (payload.link_url && current?.documento_path) {
      payload = { ...payload, documento_path: null, documento_nome: null, documento_tamanho: null, documento_tipo: null };
    }

    if (id) {
      const nextPayload = {
        ...payload,
        publicado_em: payload.status === "publicado" ? (current?.publicado_em || payload.publicado_em) : null,
      };
      const { error } = await supabase.from("ingresso_informacoes").update(nextPayload).eq("id", id);
      if (error) throw error;
      if ((file || (payload.link_url && !payload.documento_path)) && current?.documento_path && current.documento_path !== payload.documento_path) {
        await removeStoredDocument(current.documento_path);
      }
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
      if (item.link_url) window.open(item.link_url, "_blank", "noopener,noreferrer");
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
      await removeStoredDocument(item.documento_path);
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
