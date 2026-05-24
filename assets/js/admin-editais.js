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
const form = document.querySelector("[data-edital-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-edital-list]");
const empty = document.querySelector("[data-edital-empty]");
const filter = document.querySelector("[data-edital-filter]");
const newButton = document.querySelector("[data-new-edital]");
const clearButton = document.querySelector("[data-clear-form]");
const fileInput = document.querySelector("[data-edital-file]");
const sourceBlocks = document.querySelectorAll("[data-document-source]");
const currentDocument = document.querySelector("[data-current-document]");

const DOCS_BUCKET = "editais-documentos";
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const CATEGORIES = ["moradia", "manutencao", "auxilio", "selecao", "geral"];

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

function text(value) {
  return value == null ? "" : String(value);
}

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

function formatFileNameFromUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const lastPart = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return lastPart || value;
  } catch (_) {
    return String(value).split("/").filter(Boolean).pop() || String(value);
  }
}

function isLikelyPdfUrl(value) {
  const url = String(value || "").toLowerCase();
  return url.includes(".pdf") || url.includes(`/${DOCS_BUCKET}/`) || url.includes(`${DOCS_BUCKET}%2f`);
}

function getDocumentSource() {
  return form?.elements.documento_origem?.value || "link";
}

function syncDocumentSource() {
  const source = getDocumentSource();
  sourceBlocks.forEach((block) => {
    block.hidden = block.dataset.documentSource !== source;
  });
}

function setRadioValue(value) {
  const input = form?.querySelector(`input[name="documento_origem"][value="${value}"]`);
  if (input) input.checked = true;
  syncDocumentSource();
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.categoria.value = "geral";
  if (form.elements.status) form.elements.status.value = "rascunho";
  if (form.elements.visivel) form.elements.visivel.checked = true;
  if (fileInput) fileInput.value = "";
  if (form.elements.pdf_label) form.elements.pdf_label.value = "";
  if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  setRadioValue("link");
  formTitle.textContent = "Novo edital";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.categoria.value = CATEGORIES.includes(item.categoria) ? item.categoria : "geral";
  form.elements.status.value = text(item.status || "rascunho");
  form.elements.numero.value = text(item.numero);
  form.elements.resumo.value = text(item.resumo);
  form.elements.descricao.value = text(item.descricao);
  form.elements.data_publicacao.value = text(item.data_publicacao);
  form.elements.data_limite.value = text(item.data_limite);
  form.elements.orgao.value = text(item.orgao);
  form.elements.link_documento.value = text(item.link_documento);
  form.elements.visivel.checked = Boolean(item.visivel);
  if (fileInput) fileInput.value = "";
  if (form.elements.pdf_label) form.elements.pdf_label.value = "";

  if (item.link_documento && isLikelyPdfUrl(item.link_documento)) {
    setRadioValue("pdf");
    if (currentDocument) currentDocument.textContent = `PDF atual: ${formatFileNameFromUrl(item.link_documento)}`;
  } else if (item.link_documento) {
    setRadioValue("link");
    if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  } else {
    setRadioValue("nenhum");
    if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  }

  formTitle.textContent = "Editar edital";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function validatePdf(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Envie apenas arquivos em PDF.");
  if (file.size > MAX_PDF_SIZE) throw new Error("O PDF deve ter no máximo 20 MB.");
}

function createUniqueSlug(title, category = "geral") {
  const base = slugify(`${title || "edital"}-${category || "geral"}`) || "edital";
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${stamp}-${random}`;
}

function getBasePayload(current = null) {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  const categoria = String(formData.get("categoria") || "geral");

  return {
    titulo,
    slug: current?.slug || createUniqueSlug(titulo, categoria),
    status,
    categoria,
    numero: String(formData.get("numero") || "").trim() || null,
    resumo: String(formData.get("resumo") || "").trim(),
    descricao: String(formData.get("descricao") || "").trim() || null,
    data_publicacao: String(formData.get("data_publicacao") || "").trim() || null,
    data_limite: String(formData.get("data_limite") || "").trim() || null,
    orgao: String(formData.get("orgao") || "").trim() || null,
    visivel: Boolean(form.elements.visivel?.checked) && status === "publicado",
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

function getDocumentPayload(current = null) {
  const source = getDocumentSource();
  const file = fileInput?.files?.[0] || null;
  const linkDocumento = String(form.elements.link_documento?.value || "").trim();

  if (source === "link") {
    return {
      source,
      file: null,
      payload: { link_documento: linkDocumento || null },
    };
  }

  if (source === "pdf") {
    return {
      source,
      file,
      payload: file ? {} : { link_documento: current?.link_documento || null },
    };
  }

  return {
    source,
    file: null,
    payload: { link_documento: null },
  };
}

async function uploadDocument(file, title) {
  validatePdf(file);
  const safeTitle = slugify(title || "edital") || "edital";
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeTitle}.pdf`;

  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    const message = error.message || "";
    if (/bucket/i.test(message)) {
      throw new Error("Bucket editais-documentos não encontrado. Rode o SQL supabase/fix-editais-documentos-storage.sql no Supabase.");
    }
    if (/row-level|permission|not authorized|violates/i.test(message)) {
      throw new Error("Upload bloqueado pelas políticas do Storage. Rode o SQL supabase/fix-editais-documentos-storage.sql no Supabase e tente novamente.");
    }
    throw error;
  }

  const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

function extractStoragePathFromPublicUrl(value) {
  if (!value) return null;
  try {
    const marker = `/storage/v1/object/public/${DOCS_BUCKET}/`;
    const url = new URL(value);
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch (_) {
    return null;
  }
}

async function removeStoredDocumentFromUrl(value) {
  const path = extractStoragePathFromPublicUrl(value);
  if (!path) return;
  try {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover o PDF antigo:", error);
  }
}

function getFilteredItems() {
  const value = filter?.value || "todos";
  if (value === "todos") return items;
  if (CATEGORIES.includes(value)) return items.filter((item) => item.categoria === value);
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
    meta.textContent = `${item.categoria || "geral"}${item.numero ? " · " + item.numero : ""}${item.data_limite ? " · prazo " + formatDate(item.data_limite) : ""}`;
    heading.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.status || "rascunho", statusClass(item.status)));
    if (item.visivel) pills.appendChild(createPill("público", "is-visible"));
    if (item.categoria) pills.appendChild(createPill(item.categoria));
    header.append(heading, pills);

    const summary = document.createElement("p");
    summary.textContent = item.resumo || "Sem resumo cadastrado.";

    const footnote = document.createElement("small");
    footnote.className = "admin-card-footnote";
    const documentInfo = item.link_documento ? ` · documento: ${formatFileNameFromUrl(item.link_documento)}` : " · sem link/PDF";
    footnote.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}${documentInfo}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-status">${item.status === "publicado" ? "Ocultar" : "Publicar"}</button>
      ${item.link_documento ? '<button type="button" data-action="open-link">Abrir link/PDF</button>' : ""}
      <button type="button" data-action="remove">Remover</button>
    `;

    card.append(header, summary, footnote, actions);
    list.appendChild(card);
  });
}

async function loadItems() {
  let query = supabase.from("editais").select("*");
  query = query.order("data_publicacao", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  items = data || [];
  renderItems();
}

async function saveItem(event) {
  event.preventDefault();

  const id = form.elements.id.value;
  const current = id ? items.find((item) => item.id === id) : null;
  let payload = getBasePayload(current);
  const documentChoice = getDocumentPayload(current);

  if (!payload.titulo || !payload.resumo) {
    setStatus("Preencha título e resumo antes de salvar.", "error");
    return;
  }

  if (documentChoice.source === "link" && !documentChoice.payload.link_documento) {
    setStatus("Informe o link oficial ou escolha PDF/Sem link.", "error");
    return;
  }

  if (documentChoice.source === "pdf" && !documentChoice.file && !documentChoice.payload.link_documento) {
    setStatus("Envie um PDF ou escolha Link externo/Sem link.", "error");
    return;
  }

  setFormLoading(true);
  setStatus("Salvando...", "info");

  try {
    payload = { ...payload, ...documentChoice.payload };

    if (documentChoice.file) {
      setStatus("Enviando PDF...", "info");
      const publicUrl = await uploadDocument(documentChoice.file, payload.titulo);
      payload.link_documento = publicUrl;
    }

    if (id) {
      const nextPayload = {
        ...payload,
        publicado_em: payload.status === "publicado" ? (current?.publicado_em || payload.publicado_em) : null,
      };
      const { error } = await supabase.from("editais").update(nextPayload).eq("id", id);
      if (error) throw error;

      if (current?.link_documento && current.link_documento !== nextPayload.link_documento) {
        await removeStoredDocumentFromUrl(current.link_documento);
      }
      setStatus("Registro atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase.from("editais").insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Registro cadastrado com sucesso.", "success");
    }

    resetForm();
    await loadItems();
  } catch (error) {
    setStatus(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
    syncDocumentSource();
  }
}

async function updateItem(id, patch, message) {
  const { error } = await supabase.from("editais").update({ ...patch, atualizado_por: currentUser?.id || null }).eq("id", id);
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
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "open-link") {
      if (item.link_documento) window.open(item.link_documento, "_blank", "noopener,noreferrer");
      return;
    }

    if (button.dataset.action === "toggle-status") {
      const nextStatus = item.status === "publicado" ? "oculto" : "publicado";
      await updateItem(id, {
        status: nextStatus,
        visivel: nextStatus === "publicado",
        publicado_em: nextStatus === "publicado" ? (item.publicado_em || new Date().toISOString()) : null,
      }, nextStatus === "publicado" ? "Publicado." : "Ocultado.");
      return;
    }

    if (button.dataset.action === "remove") {
      if (!confirm("Remover este registro?")) return;
      const { error } = await supabase.from("editais").delete().eq("id", id);
      if (error) throw error;
      await removeStoredDocumentFromUrl(item.link_documento);
      setStatus("Registro removido.", "success");
      await loadItems();
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

form?.addEventListener("change", (event) => {
  if (event.target?.name === "documento_origem") syncDocumentSource();
});
filter?.addEventListener("change", renderItems);
form?.addEventListener("submit", saveItem);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function boot() {
  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setFormLoading(true);
    return;
  }

  try {
    const access = await requireAdminAccess();
    if (!access?.isAdmin) throw new Error("Apenas administradores podem acessar este módulo.");
    currentUser = access.session.user;
    syncDocumentSource();
    await loadItems();
  } catch (error) {
    setStatus(`Acesso negado ou erro ao carregar: ${error.message}`, "error");
    setFormLoading(true);
  }
}

boot();
