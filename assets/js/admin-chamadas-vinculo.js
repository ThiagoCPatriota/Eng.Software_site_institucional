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
const form = document.querySelector("[data-chamada-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-chamada-list]");
const empty = document.querySelector("[data-chamada-empty]");
const filter = document.querySelector("[data-chamada-filter]");
const newButton = document.querySelector("[data-new-chamada]");
const clearButton = document.querySelector("[data-clear-form]");
const fileInput = document.querySelector("[data-chamada-file]");
const sourceBlocks = document.querySelectorAll("[data-document-source]");
const currentDocument = document.querySelector("[data-current-document]");

const TABLE_NAME = "ingresso_informacoes";
const DOCS_BUCKET = "ingresso-documentos";
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const CHAMADA_TYPES = ["aprovados", "remanejamento", "matricula", "rematricula", "reingresso", "geral"];
const TYPE_LABELS = {
  aprovados: "Lista de aprovados",
  remanejamento: "Remanejamento",
  matricula: "Matrícula inicial",
  rematricula: "Rematrícula",
  reingresso: "Reingresso",
  geral: "Comunicado geral",
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

function text(value) {
  return value == null ? "" : String(value);
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

function setRadioValue(value) {
  const input = form?.querySelector(`input[name="documento_origem"][value="${value}"]`);
  if (input) input.checked = true;
  syncDocumentSource();
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.tipo.value = "aprovados";
  form.elements.ordem.value = "0";
  form.elements.destaque.checked = false;
  form.elements.visivel.checked = true;
  form.elements.status.value = "rascunho";
  form.elements.documento_path.value = "";
  form.elements.documento_nome.value = "";
  form.elements.documento_tamanho.value = "";
  form.elements.documento_tipo.value = "";
  if (fileInput) fileInput.value = "";
  if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  setRadioValue("link");
  formTitle.textContent = "Nova publicação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.tipo.value = CHAMADA_TYPES.includes(item.tipo) ? item.tipo : "geral";
  form.elements.status.value = text(item.status || "rascunho");
  form.elements.ordem.value = text(item.ordem ?? 0);
  form.elements.resumo.value = text(item.resumo);
  form.elements.conteudo.value = text(item.conteudo);
  form.elements.data_inicio.value = text(item.data_inicio);
  form.elements.data_fim.value = text(item.data_fim);
  form.elements.link_url.value = text(item.link_url);
  form.elements.link_label.value = text(item.link_label);
  form.elements.pdf_label.value = text(item.link_label || "Baixar PDF");
  form.elements.documento_path.value = text(item.documento_path);
  form.elements.documento_nome.value = text(item.documento_nome);
  form.elements.documento_tamanho.value = text(item.documento_tamanho);
  form.elements.documento_tipo.value = text(item.documento_tipo);
  form.elements.visivel.checked = Boolean(item.visivel);
  form.elements.destaque.checked = Boolean(item.destaque);
  if (fileInput) fileInput.value = "";
  if (item.documento_path || item.documento_nome) {
    setRadioValue("pdf");
    if (currentDocument) currentDocument.textContent = `PDF atual: ${item.documento_nome || item.documento_path}`;
  } else if (item.link_url) {
    setRadioValue("link");
    if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  } else {
    setRadioValue("nenhum");
    if (currentDocument) currentDocument.textContent = "Nenhum PDF selecionado.";
  }
  formTitle.textContent = "Editar publicação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function validatePdf(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Envie apenas arquivos em PDF.");
  if (file.size > MAX_PDF_SIZE) throw new Error("O PDF deve ter no máximo 20 MB.");
}

function createUniqueSlug(title, type = "geral") {
  const base = slugify(`${title || "chamada"}-${type || "geral"}`) || "chamada-vinculo";
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${stamp}-${random}`;
}

function getBasePayload(current = null) {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  const tipo = String(formData.get("tipo") || "geral");
  return {
    titulo,
    slug: current?.slug || createUniqueSlug(titulo, tipo),
    status,
    tipo,
    ordem: Number(formData.get("ordem") || 0),
    resumo: String(formData.get("resumo") || "").trim(),
    conteudo: String(formData.get("conteudo") || "").trim() || null,
    data_inicio: String(formData.get("data_inicio") || "").trim() || null,
    data_fim: String(formData.get("data_fim") || "").trim() || null,
    destaque: Boolean(form.elements.destaque?.checked),
    visivel: Boolean(form.elements.visivel?.checked) && status === "publicado",
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

async function uploadDocument(file, title) {
  validatePdf(file);
  const safeTitle = slugify(title || "chamadas-vinculo");
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeTitle}.pdf`;

  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    if (/bucket/i.test(error.message || "")) {
      throw new Error("Bucket ingresso-documentos não encontrado. Rode o SQL supabase/fix-chamadas-vinculo-storage.sql no Supabase.");
    }
    throw error;
  }

  const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path);
  return {
    link_url: data?.publicUrl || null,
    link_label: form.elements.pdf_label.value.trim() || form.elements.link_label.value.trim() || "Baixar PDF",
    documento_path: path,
    documento_nome: file.name,
    documento_tamanho: file.size,
    documento_tipo: "pdf",
  };
}

async function removeStoredDocument(path) {
  if (!path) return;
  try {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover o documento antigo:", error);
  }
}

function getDocumentPayload(current) {
  const source = getDocumentSource();
  const file = fileInput?.files?.[0] || null;
  const linkUrl = String(form.elements.link_url.value || "").trim();

  if (source === "link") {
    return {
      source,
      file: null,
      payload: {
        link_url: linkUrl || null,
        link_label: String(form.elements.link_label.value || "").trim() || (linkUrl ? "Acessar documento" : ""),
        documento_path: null,
        documento_nome: null,
        documento_tamanho: null,
        documento_tipo: null,
      },
    };
  }

  if (source === "pdf") {
    return {
      source,
      file,
      payload: file
        ? {}
        : {
            link_url: current?.link_url || null,
            link_label: String(form.elements.pdf_label.value || "").trim() || current?.link_label || "Baixar PDF",
            documento_path: current?.documento_path || null,
            documento_nome: current?.documento_nome || null,
            documento_tamanho: current?.documento_tamanho || null,
            documento_tipo: current?.documento_tipo || null,
          },
    };
  }

  return {
    source,
    file: null,
    payload: {
      link_url: null,
      link_label: "",
      documento_path: null,
      documento_nome: null,
      documento_tamanho: null,
      documento_tipo: null,
    },
  };
}

function getFilteredItems() {
  const value = filter?.value || "todos";
  if (value === "todos") return items;
  if (CHAMADA_TYPES.includes(value)) return items.filter((item) => item.tipo === value);
  return items.filter((item) => item.status === value);
}

function renderItems() {
  if (!list || !empty) return;
  const visibleItems = getFilteredItems();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", visibleItems.length === 0);

  visibleItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo;
    const meta = document.createElement("small");
    const dates = item.data_inicio || item.data_fim ? ` · ${item.data_inicio ? formatDate(item.data_inicio) : "Início a definir"}${item.data_fim ? " até " + formatDate(item.data_fim) : ""}` : "";
    meta.textContent = `${TYPE_LABELS[item.tipo] || item.tipo || "Publicação"}${dates}`;
    heading.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.status || "rascunho", statusClass(item.status)));
    if (item.visivel) pills.appendChild(createPill("público", "is-visible"));
    if (item.tipo) pills.appendChild(createPill(TYPE_LABELS[item.tipo] || item.tipo));
    if (item.destaque) pills.appendChild(createPill("destaque", "is-home"));
    if (item.documento_nome || item.documento_path) pills.appendChild(createPill("PDF", "is-visible"));
    else if (item.link_url) pills.appendChild(createPill("link", "is-visible"));
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
      ${item.link_url ? '<button type="button" data-action="open-link">Abrir link/PDF</button>' : ""}
      <button type="button" data-action="remove">Remover</button>
    `;

    card.append(header, summary, footnote, actions);
    list.appendChild(card);
  });
}

async function loadItems() {
  let query = supabase.from(TABLE_NAME).select("*").in("tipo", CHAMADA_TYPES);
  query = query.order("ordem", { ascending: true }).order("data_inicio", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false });
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

  if (documentChoice.source === "link" && !documentChoice.payload.link_url) {
    setStatus("Informe o link oficial ou escolha PDF/Sem link.", "error");
    return;
  }

  if (documentChoice.source === "pdf" && !documentChoice.file && !documentChoice.payload.documento_path) {
    setStatus("Envie um PDF ou escolha Link externo/Sem link.", "error");
    return;
  }

  setFormLoading(true);
  setStatus("Salvando...", "info");

  try {
    payload = { ...payload, ...documentChoice.payload };

    if (documentChoice.file) {
      setStatus("Enviando PDF...", "info");
      const filePayload = await uploadDocument(documentChoice.file, payload.titulo);
      payload = { ...payload, ...filePayload };
    }

    if (id) {
      const nextPayload = {
        ...payload,
        publicado_em: payload.status === "publicado" ? (current?.publicado_em || payload.publicado_em) : null,
      };
      const { error } = await supabase.from(TABLE_NAME).update(nextPayload).eq("id", id);
      if (error) throw error;

      const replacedDocument = current?.documento_path && current.documento_path !== nextPayload.documento_path;
      if (replacedDocument) await removeStoredDocument(current.documento_path);
      setStatus("Card atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase.from(TABLE_NAME).insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) {
        if (/slug/i.test(error.message || "") || /duplicate key/i.test(error.message || "")) {
          throw new Error("Já existia um identificador interno igual. Atualize a página e tente salvar novamente; o sistema agora gera slugs únicos automaticamente.");
        }
        throw error;
      }
      setStatus("Card cadastrado com sucesso.", "success");
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
  const { error } = await supabase.from(TABLE_NAME).update({ ...patch, atualizado_por: currentUser?.id || null }).eq("id", id);
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
      if (item.link_url) window.open(item.link_url, "_blank", "noopener,noreferrer");
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
      if (!confirm("Remover este card?")) return;
      const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
      if (error) throw error;
      await removeStoredDocument(item.documento_path);
      setStatus("Card removido.", "success");
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
