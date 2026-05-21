import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  slugify,
  supabase,
} from "./supabase-client.js";

const CAMPUS_IMAGES_BUCKET = "noticias-eventos-imagens";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const TIPOS = {
  evento: "Evento",
  noticia: "Notícia",
  aviso: "Aviso",
  beneficio: "Benefício",
};

const STATUS = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  oculto: "Oculto",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-campus-post-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-campus-post-list]");
const empty = document.querySelector("[data-campus-post-empty]");
const filter = document.querySelector("[data-campus-post-filter]");
const newButton = document.querySelector("[data-new-campus-post]");
const clearButton = document.querySelector("[data-clear-form]");
const statPublished = document.querySelector("[data-stat-published]");
const statEvents = document.querySelector("[data-stat-events]");
const statHome = document.querySelector("[data-stat-home]");
const tabButtons = document.querySelectorAll("[data-campus-tab]");
const tabPanels = document.querySelectorAll("[data-campus-panel]");
const imageInput = document.querySelector("[data-campus-image-input]");
const imagePreview = document.querySelector("[data-campus-image-preview]");
const previewFrame = document.querySelector("[data-campus-preview-frame]");
const clearImageButton = document.querySelector("[data-clear-campus-image]");

let currentUser = null;
let campusPosts = [];
let removeCurrentImage = false;
let lastPreviewUrl = null;

function setActiveTab(name) {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.campusTab === name);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.campusPanel === name);
  });
}

function countHomeHighlights(exceptId = "") {
  return campusPosts.filter((item) => item.destaque_home && item.id !== exceptId).length;
}

function canHighlightHome(exceptId = "") {
  return countHomeHighlights(exceptId) < 3;
}

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

function revokePreviewUrl() {
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }
}

function getImageUrl(item) {
  if (item?.imagem_url) return item.imagem_url;
  if (item?.imagem_path && isSupabaseConfigured) {
    const { data } = supabase.storage.from(CAMPUS_IMAGES_BUCKET).getPublicUrl(item.imagem_path);
    return data?.publicUrl || "";
  }
  return "";
}

function updateImagePreview(imageUrl = "", label = "Sem imagem") {
  if (!previewFrame || !imagePreview) return;
  previewFrame.innerHTML = "";
  previewFrame.classList.toggle("has-image", Boolean(imageUrl));

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "Prévia da imagem da notícia ou evento";
    previewFrame.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = label;
    previewFrame.appendChild(span);
  }
}

function resetImageState() {
  revokePreviewUrl();
  removeCurrentImage = false;
  if (imageInput) imageInput.value = "";
  if (form?.elements.imagem_url) form.elements.imagem_url.value = "";
  if (form?.elements.imagem_path) form.elements.imagem_path.value = "";
  updateImagePreview("", "Sem imagem");
}

function validateImageFile(file) {
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Envie uma imagem em JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.tipo.value = "evento";
  form.elements.status.value = "rascunho";
  form.elements.ordem.value = "0";
  form.elements.visivel.checked = true;
  form.elements.destaque_home.checked = false;
  resetImageState();
  formTitle.textContent = "Novo conteúdo";
  setActiveTab("editor");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(item) {
  revokePreviewUrl();
  removeCurrentImage = false;
  if (imageInput) imageInput.value = "";

  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.tipo.value = text(item.tipo || "evento");
  form.elements.status.value = text(item.status || "rascunho");
  form.elements.ordem.value = text(item.ordem ?? 0);
  form.elements.resumo.value = text(item.resumo);
  form.elements.conteudo.value = text(item.conteudo);
  form.elements.data_inicio.value = text(item.data_inicio);
  form.elements.hora_inicio.value = text(item.hora_inicio);
  form.elements.data_fim.value = text(item.data_fim);
  form.elements.local.value = text(item.local);
  form.elements.organizador.value = text(item.organizador);
  form.elements.imagem_url.value = text(item.imagem_url);
  if (form.elements.imagem_path) form.elements.imagem_path.value = text(item.imagem_path);
  updateImagePreview(getImageUrl(item));
  form.elements.link_externo.value = text(item.link_externo);
  if (form.elements.email_contato) form.elements.email_contato.value = text(item.email_contato);
  form.elements.visivel.checked = Boolean(item.visivel);
  form.elements.destaque_home.checked = Boolean(item.destaque_home);
  formTitle.textContent = "Editar conteúdo";
  setActiveTab("editor");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  const dataInicio = String(formData.get("data_inicio") || "").trim() || null;
  const dataFim = String(formData.get("data_fim") || "").trim() || null;

  return {
    titulo,
    slug: slugify(titulo),
    tipo: String(formData.get("tipo") || "evento"),
    status,
    visivel: form.elements.visivel.checked && status === "publicado",
    destaque_home: form.elements.destaque_home.checked && status === "publicado",
    ordem: Number(formData.get("ordem") || 0),
    resumo: String(formData.get("resumo") || "").trim(),
    conteudo: String(formData.get("conteudo") || "").trim() || null,
    data_inicio: dataInicio,
    data_fim: dataFim,
    hora_inicio: String(formData.get("hora_inicio") || "").trim() || null,
    local: String(formData.get("local") || "").trim() || null,
    organizador: String(formData.get("organizador") || "").trim() || null,
    imagem_url: removeCurrentImage ? null : String(formData.get("imagem_url") || "").trim() || null,
    imagem_path: removeCurrentImage ? null : String(formData.get("imagem_path") || "").trim() || null,
    link_externo: String(formData.get("link_externo") || "").trim() || null,
    email_contato: String(formData.get("email_contato") || "").trim() || null,
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

function getFilteredPosts() {
  const value = filter?.value || "todos";
  if (value === "todos") return campusPosts;
  if (value === "home") return campusPosts.filter((item) => item.destaque_home);
  if (["evento", "noticia", "aviso", "beneficio"].includes(value)) return campusPosts.filter((item) => item.tipo === value);
  return campusPosts.filter((item) => item.status === value);
}

function updateStats() {
  if (statPublished) statPublished.textContent = String(campusPosts.filter((item) => item.status === "publicado" && item.visivel).length);
  if (statEvents) statEvents.textContent = String(campusPosts.filter((item) => item.tipo === "evento").length);
  if (statHome) statHome.textContent = String(campusPosts.filter((item) => item.destaque_home).length);
}

function renderPosts() {
  if (!list || !empty) return;

  const items = getFilteredPosts();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);
  updateStats();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-campus-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo;
    const meta = document.createElement("small");
    const date = item.data_inicio ? ` · ${formatBrazilianDate(item.data_inicio)}` : "";
    const place = item.local ? ` · ${item.local}` : "";
    const contact = item.email_contato ? ` · ${item.email_contato}` : "";
    meta.textContent = `${TIPOS[item.tipo] || item.tipo}${date}${place}${contact}`;
    headingGroup.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(TIPOS[item.tipo] || item.tipo));
    pills.appendChild(createPill(STATUS[item.status] || item.status, statusClass(item.status)));
    if (item.visivel) pills.appendChild(createPill("público", "is-visible"));
    if (item.destaque_home) pills.appendChild(createPill("home", "is-home"));
    if (getImageUrl(item)) pills.appendChild(createPill("imagem", "is-visible"));
    header.append(headingGroup, pills);

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
      <button type="button" data-action="toggle-home">${item.destaque_home ? "Remover da home" : "Destacar na home"}</button>
      ${item.link_externo ? '<button type="button" data-action="open-link">Abrir link</button>' : ""}
    `;

    card.append(header, summary, footnote, actions);
    list.appendChild(card);
  });
}

function formatBrazilianDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

async function uploadCampusImage(file, title) {
  validateImageFile(file);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeTitle = slugify(title || "noticia-evento") || "noticia-evento";
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeTitle}.${extension}`;

  const { error } = await supabase.storage
    .from(CAMPUS_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(CAMPUS_IMAGES_BUCKET).getPublicUrl(path);
  return {
    imagem_path: path,
    imagem_url: data?.publicUrl || null,
  };
}

async function removeStoredImage(path) {
  if (!path) return;
  try {
    await supabase.storage.from(CAMPUS_IMAGES_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover a imagem antiga:", error);
  }
}

async function loadPosts() {
  const { data, error } = await supabase
    .from("noticias_eventos")
    .select("*")
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  campusPosts = data || [];
  renderPosts();
}

async function savePost(event) {
  event.preventDefault();

  try {
    const id = form.elements.id.value;
    const payload = getPayload();
    const currentItem = id ? campusPosts.find((item) => item.id === id) : null;
    const oldImagePath = currentItem?.imagem_path || null;
    const newImageFile = imageInput?.files?.[0] || null;
    setFormLoading(true);
    setStatus(newImageFile ? "Enviando imagem e salvando conteúdo..." : "Salvando conteúdo...", "info");

    if (!payload.titulo || !payload.resumo) {
      setStatus("Preencha título e resumo antes de salvar.", "error");
      return;
    }

    if (payload.destaque_home && !canHighlightHome(id)) {
      setStatus("A home pode ter no máximo 3 destaques. Remova outro destaque antes de adicionar este.", "error");
      return;
    }

    if (newImageFile) {
      const uploadedImage = await uploadCampusImage(newImageFile, payload.titulo);
      payload.imagem_url = uploadedImage.imagem_url;
      payload.imagem_path = uploadedImage.imagem_path;
    }

    if (id) {
      const current = campusPosts.find((item) => item.id === id);
      const nextPayload = {
        ...payload,
        publicado_em: payload.status === "publicado" ? (current?.publicado_em || payload.publicado_em) : null,
      };
      const { error } = await supabase
        .from("noticias_eventos")
        .update(nextPayload)
        .eq("id", id);
      if (error) throw error;
      if ((newImageFile || removeCurrentImage) && oldImagePath && oldImagePath !== payload.imagem_path) {
        await removeStoredImage(oldImagePath);
      }
      setStatus("Conteúdo atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("noticias_eventos")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Conteúdo cadastrado com sucesso.", "success");
    }

    resetForm();
    await loadPosts();
    setActiveTab("lista");
  } catch (error) {
    setStatus(`Erro ao salvar conteúdo: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function updatePost(id, patch, successMessage) {
  setStatus("Atualizando conteúdo...", "info");
  const { error } = await supabase
    .from("noticias_eventos")
    .update({ ...patch, atualizado_por: currentUser?.id || null })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadPosts();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".admin-campus-card");
  const id = card?.dataset.id;
  const item = campusPosts.find((post) => post.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "open-link" && item.link_externo) {
      window.open(item.link_externo, "_blank", "noopener,noreferrer");
      return;
    }

    if (button.dataset.action === "toggle-status") {
      const nextStatus = item.status === "publicado" ? "oculto" : "publicado";
      await updatePost(
        id,
        {
          status: nextStatus,
          visivel: nextStatus === "publicado",
          destaque_home: nextStatus === "publicado" ? item.destaque_home : false,
          publicado_em: nextStatus === "publicado" ? (item.publicado_em || new Date().toISOString()) : null,
        },
        nextStatus === "publicado" ? "Conteúdo publicado." : "Conteúdo ocultado."
      );
      return;
    }

    if (button.dataset.action === "toggle-home") {
      const nextHome = !item.destaque_home;
      if (nextHome && !canHighlightHome(id)) {
        setStatus("A home pode ter no máximo 3 destaques. Remova outro destaque antes de adicionar este.", "error");
        return;
      }
      await updatePost(
        id,
        {
          destaque_home: nextHome,
          status: nextHome ? "publicado" : item.status,
          visivel: nextHome ? true : item.visivel,
          publicado_em: nextHome ? (item.publicado_em || new Date().toISOString()) : item.publicado_em,
        },
        nextHome ? "Conteúdo destacado na home." : "Conteúdo removido da home."
      );
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

imageInput?.addEventListener("change", () => {
  revokePreviewUrl();
  removeCurrentImage = false;
  const file = imageInput.files?.[0];
  if (!file) {
    updateImagePreview(form?.elements.imagem_url?.value || "", "Sem imagem");
    return;
  }

  try {
    validateImageFile(file);
    lastPreviewUrl = URL.createObjectURL(file);
    updateImagePreview(lastPreviewUrl);
  } catch (error) {
    imageInput.value = "";
    updateImagePreview(form?.elements.imagem_url?.value || "", "Sem imagem");
    setStatus(error.message, "error");
  }
});

clearImageButton?.addEventListener("click", () => {
  revokePreviewUrl();
  removeCurrentImage = true;
  if (imageInput) imageInput.value = "";
  if (form?.elements.imagem_url) form.elements.imagem_url.value = "";
  if (form?.elements.imagem_path) form.elements.imagem_path.value = "";
  updateImagePreview("", "Imagem removida");
});

filter?.addEventListener("change", renderPosts);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.campusTab || "editor"));
});
form?.addEventListener("submit", savePost);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function bootCampusPosts() {
  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setFormLoading(true);
    return;
  }

  try {
    const { user } = await requireAdminAccess();
    currentUser = user;
    await loadPosts();
  } catch (error) {
    setStatus(`Acesso negado ou erro ao carregar: ${error.message}`, "error");
    setFormLoading(true);
  }
}

bootCampusPosts();
