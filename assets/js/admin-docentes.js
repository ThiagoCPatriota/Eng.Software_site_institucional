import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  slugify,
  supabase,
} from "./supabase-client.js";

const DOCENTES_BUCKET = "docentes-fotos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const FUNCOES = {
  docente: "Docente",
  coordenacao: "Coordenação",
  docente_coordenacao: "Docente e coordenação",
  apoio_academico: "Apoio acadêmico",
};

const CONTATOS = {
  email: "E-mail",
  telefone: "Telefone",
  ambos: "E-mail e telefone",
  nenhum: "Contato oculto",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-docente-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-docente-list]");
const empty = document.querySelector("[data-docente-empty]");
const filter = document.querySelector("[data-docente-filter]");
const newButton = document.querySelector("[data-new-docente]");
const panelButtons = document.querySelectorAll("[data-docente-panel-target]");
const panels = document.querySelectorAll("[data-docente-panel]");
const clearButton = document.querySelector("[data-clear-form]");
const photoInput = document.querySelector("[data-docente-photo-input]");
const photoPreview = document.querySelector("[data-docente-photo-preview]");
const previewFrame = document.querySelector("[data-docente-preview-frame]");
const clearPhotoButton = document.querySelector("[data-clear-docente-photo]");
const statTotal = document.querySelector("[data-stat-total]");
const statActive = document.querySelector("[data-stat-active]");
const statHighlight = document.querySelector("[data-stat-highlight]");

let currentUser = null;
let docentes = [];
let removeCurrentPhoto = false;
let lastPreviewUrl = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const parts = String(name || "D")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "D";
}

function revokePreviewUrl() {
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }
}

function getImageUrl(item) {
  if (item?.imagem_url) return item.imagem_url;
  if (item?.imagem_path && isSupabaseConfigured) {
    const { data } = supabase.storage.from(DOCENTES_BUCKET).getPublicUrl(item.imagem_path);
    return data?.publicUrl || "";
  }
  return "";
}

function updatePhotoPreview(imageUrl = "", label = "Sem foto") {
  if (!previewFrame || !photoPreview) return;
  previewFrame.innerHTML = "";
  previewFrame.classList.toggle("has-image", Boolean(imageUrl));

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "Prévia da foto institucional";
    previewFrame.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = label;
    previewFrame.appendChild(span);
  }
}

function resetPhotoState() {
  revokePreviewUrl();
  removeCurrentPhoto = false;
  if (photoInput) photoInput.value = "";
  if (form?.elements.imagem_url) form.elements.imagem_url.value = "";
  if (form?.elements.imagem_path) form.elements.imagem_path.value = "";
  updatePhotoPreview("", "Sem foto");
}

function setDocentePanel(panelName, shouldScroll = false) {
  const target = panelName === "list" ? "list" : "form";

  panelButtons.forEach((button) => {
    const isActive = button.dataset.docentePanelTarget === target;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.docentePanel !== target;
  });

  if (shouldScroll) {
    const activePanel = document.querySelector(`[data-docente-panel="${target}"]`);
    activePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetForm(shouldScroll = true) {
  form.reset();
  form.elements.id.value = "";
  form.elements.funcao.value = "docente";
  form.elements.contato_preferencial.value = "email";
  form.elements.ativo.value = "true";
  form.elements.destaque.value = "false";
  resetPhotoState();
  formTitle.textContent = "Novo docente";
  setDocentePanel("form", shouldScroll);
}

function fillForm(item) {
  revokePreviewUrl();
  removeCurrentPhoto = false;
  if (photoInput) photoInput.value = "";

  form.elements.id.value = text(item.id);
  form.elements.nome.value = text(item.nome);
  form.elements.funcao.value = text(item.funcao || "docente");
  form.elements.formacao.value = text(item.formacao);
  form.elements.area_atuacao.value = text(item.area_atuacao);
  form.elements.historico.value = text(item.historico);
  form.elements.projetos_interesses.value = text(item.projetos_interesses);
  form.elements.email.value = text(item.email);
  form.elements.telefone.value = text(item.telefone);
  form.elements.contato_preferencial.value = text(item.contato_preferencial || "email");
  form.elements.lattes_url.value = text(item.lattes_url);
  form.elements.imagem_url.value = text(item.imagem_url);
  if (form.elements.imagem_path) form.elements.imagem_path.value = text(item.imagem_path);
  form.elements.ativo.value = String(Boolean(item.ativo));
  form.elements.destaque.value = String(Boolean(item.destaque));
  updatePhotoPreview(getImageUrl(item), item.nome ? initials(item.nome) : "Sem foto");
  formTitle.textContent = "Editar docente";
  setDocentePanel("form", true);
}

function validatePhotoFile(file) {
  if (!file) return;
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error("Envie uma foto em JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_PHOTO_SIZE) {
    throw new Error("A foto deve ter no máximo 5 MB.");
  }
}

function getPayload() {
  const formData = new FormData(form);
  const nome = String(formData.get("nome") || "").trim();

  return {
    nome,
    slug: slugify(nome),
    funcao: String(formData.get("funcao") || "docente"),
    formacao: String(formData.get("formacao") || "").trim() || null,
    area_atuacao: String(formData.get("area_atuacao") || "").trim() || null,
    historico: String(formData.get("historico") || "").trim() || null,
    projetos_interesses: String(formData.get("projetos_interesses") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    telefone: String(formData.get("telefone") || "").trim() || null,
    contato_preferencial: String(formData.get("contato_preferencial") || "email"),
    lattes_url: String(formData.get("lattes_url") || "").trim() || null,
    imagem_url: removeCurrentPhoto ? null : String(formData.get("imagem_url") || "").trim() || null,
    imagem_path: removeCurrentPhoto ? null : String(formData.get("imagem_path") || "").trim() || null,
    ativo: String(formData.get("ativo")) === "true",
    destaque: String(formData.get("destaque")) === "true",
    ordem: Number(formData.get("ordem") || 0),
    atualizado_por: currentUser?.id || null,
  };
}

function getFilteredDocentes() {
  const value = filter?.value || "todos";
  if (value === "ativos") return docentes.filter((item) => item.ativo);
  if (value === "inativos") return docentes.filter((item) => !item.ativo);
  if (value === "destaques") return docentes.filter((item) => item.destaque);
  if (value === "coordenacao") return docentes.filter((item) => ["coordenacao", "docente_coordenacao"].includes(item.funcao));
  return docentes;
}

function updateStats() {
  if (statTotal) statTotal.textContent = String(docentes.length);
  if (statActive) statActive.textContent = String(docentes.filter((item) => item.ativo).length);
  if (statHighlight) statHighlight.textContent = String(docentes.filter((item) => item.destaque).length);
}

function renderDocentes() {
  if (!list || !empty) return;

  const items = getFilteredDocentes();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);
  updateStats();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-docente-card";
    card.dataset.id = item.id;

    const safeName = escapeHtml(item.nome);
    const imageUrl = getImageUrl(item);
    const photo = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="Foto de ${safeName}" loading="lazy" />`
      : `<span>${escapeHtml(initials(item.nome))}</span>`;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    headingGroup.className = "admin-docente-title";
    headingGroup.innerHTML = `
      <div class="admin-docente-avatar">${photo}</div>
      <div>
        <h2>${safeName}</h2>
        <small>${escapeHtml(FUNCOES[item.funcao] || item.funcao)} · ${escapeHtml(item.area_atuacao || "Área a definir")}</small>
      </div>
    `;

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.ativo ? "visível" : "oculto", item.ativo ? "is-visible" : "is-hidden"));
    if (item.destaque) pills.appendChild(createPill("destaque", "is-home"));
    pills.appendChild(createPill(imageUrl ? "foto salva" : "sem foto"));
    pills.appendChild(createPill(CONTATOS[item.contato_preferencial] || "Contato"));
    header.append(headingGroup, pills);

    const summary = document.createElement("p");
    summary.textContent = item.historico || item.formacao || "Sem histórico cadastrado.";

    const info = document.createElement("small");
    info.className = "admin-card-footnote";
    const email = item.email ? ` · ${item.email}` : "";
    const phone = item.telefone ? ` · ${item.telefone}` : "";
    info.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}${email}${phone}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-active">${item.ativo ? "Ocultar" : "Mostrar"}</button>
      <button type="button" data-action="toggle-highlight">${item.destaque ? "Remover destaque" : "Destacar"}</button>
      <button type="button" data-action="delete">Excluir</button>
    `;

    card.append(header, summary, info, actions);
    list.appendChild(card);
  });
}

async function loadDocentes() {
  const { data, error } = await supabase
    .from("docentes")
    .select("*")
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw error;
  docentes = data || [];
  renderDocentes();
}

async function uploadDocentePhoto(file, docenteName) {
  validatePhotoFile(file);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = slugify(docenteName || "docente") || "docente";
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeName}.${extension}`;

  const { error } = await supabase.storage
    .from(DOCENTES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(DOCENTES_BUCKET).getPublicUrl(path);
  return {
    imagem_path: path,
    imagem_url: data?.publicUrl || null,
  };
}

async function removeStoredPhoto(path) {
  if (!path) return;
  try {
    await supabase.storage.from(DOCENTES_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover a foto antiga:", error);
  }
}

async function saveDocente(event) {
  event.preventDefault();

  const payload = getPayload();
  const id = form.elements.id.value;
  const currentItem = id ? docentes.find((item) => item.id === id) : null;
  const oldPhotoPath = currentItem?.imagem_path || null;
  const newPhotoFile = photoInput?.files?.[0] || null;

  if (!payload.nome) {
    setStatus("Informe o nome do docente antes de salvar.", "error");
    return;
  }

  setFormLoading(true);
  setStatus(newPhotoFile ? "Enviando foto e salvando docente..." : "Salvando docente...", "info");

  try {
    if (newPhotoFile) {
      const uploadedPhoto = await uploadDocentePhoto(newPhotoFile, payload.nome);
      payload.imagem_url = uploadedPhoto.imagem_url;
      payload.imagem_path = uploadedPhoto.imagem_path;
    }

    if (id) {
      const { error } = await supabase
        .from("docentes")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      if ((newPhotoFile || removeCurrentPhoto) && oldPhotoPath && oldPhotoPath !== payload.imagem_path) {
        await removeStoredPhoto(oldPhotoPath);
      }
      setStatus("Docente atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("docentes")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Docente cadastrado com sucesso.", "success");
    }

    resetForm(false);
    await loadDocentes();
    setDocentePanel("list", true);
  } catch (error) {
    setStatus(`Erro ao salvar docente: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function updateDocente(id, payload, successMessage) {
  setStatus("Atualizando docente...", "info");
  try {
    const { error } = await supabase
      .from("docentes")
      .update({ ...payload, atualizado_por: currentUser?.id || null })
      .eq("id", id);
    if (error) throw error;
    setStatus(successMessage, "success");
    await loadDocentes();
  } catch (error) {
    setStatus(`Erro ao atualizar docente: ${error.message}`, "error");
  }
}

async function deleteDocente(id) {
  const item = docentes.find((docente) => docente.id === id);
  const confirmed = window.confirm(`Deseja excluir ${item?.nome || "este docente"}?`);
  if (!confirmed) return;

  setStatus("Excluindo docente...", "info");
  try {
    const { error } = await supabase.from("docentes").delete().eq("id", id);
    if (error) throw error;
    await removeStoredPhoto(item?.imagem_path || null);
    setStatus("Docente excluído com sucesso.", "success");
    await loadDocentes();
  } catch (error) {
    setStatus(`Erro ao excluir docente: ${error.message}`, "error");
  }
}

function setupEvents() {
  logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));
  form?.addEventListener("submit", saveDocente);
  newButton?.addEventListener("click", () => resetForm(true));
  clearButton?.addEventListener("click", () => resetForm(true));
  filter?.addEventListener("change", renderDocentes);

  panelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.docentePanelTarget || "form";
      if (target === "form") {
        resetForm(true);
        return;
      }
      setDocentePanel(target, true);
    });
  });

  photoInput?.addEventListener("change", () => {
    revokePreviewUrl();
    removeCurrentPhoto = false;
    const file = photoInput.files?.[0];
    if (!file) {
      const currentImageUrl = form?.elements.imagem_url?.value || "";
      updatePhotoPreview(currentImageUrl, "Sem foto");
      return;
    }

    try {
      validatePhotoFile(file);
      lastPreviewUrl = URL.createObjectURL(file);
      updatePhotoPreview(lastPreviewUrl);
    } catch (error) {
      photoInput.value = "";
      updatePhotoPreview(form?.elements.imagem_url?.value || "", "Sem foto");
      setStatus(error.message, "error");
    }
  });

  clearPhotoButton?.addEventListener("click", () => {
    revokePreviewUrl();
    removeCurrentPhoto = true;
    if (photoInput) photoInput.value = "";
    if (form?.elements.imagem_url) form.elements.imagem_url.value = "";
    if (form?.elements.imagem_path) form.elements.imagem_path.value = "";
    updatePhotoPreview("", "Foto removida");
  });

  list?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    const card = event.target.closest("[data-id]");
    if (!button || !card) return;

    const item = docentes.find((docente) => docente.id === card.dataset.id);
    if (!item) return;

    if (button.dataset.action === "edit") fillForm(item);
    if (button.dataset.action === "toggle-active") {
      await updateDocente(item.id, { ativo: !item.ativo }, item.ativo ? "Docente ocultado da página pública." : "Docente exibido na página pública.");
    }
    if (button.dataset.action === "toggle-highlight") {
      await updateDocente(item.id, { destaque: !item.destaque }, item.destaque ? "Destaque removido." : "Docente destacado.");
    }
    if (button.dataset.action === "delete") await deleteDocente(item.id);
  });
}

async function boot() {
  setupEvents();
  setDocentePanel("form", false);

  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  try {
    const access = await requireAdminAccess();
    if (!access.session) {
      window.location.href = "login.html";
      return;
    }
    if (!access.isAdmin) {
      setStatus("Este painel é restrito a administradores.", "error");
      return;
    }
    currentUser = access.session.user;
    await loadDocentes();
    setStatus("Equipe docente carregada.", "success");
  } catch (error) {
    setStatus(`Erro ao carregar docentes: ${error.message}`, "error");
  }
}

boot();
