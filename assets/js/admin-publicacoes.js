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
const form = document.querySelector("[data-publication-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-publication-list]");
const empty = document.querySelector("[data-publication-empty]");
const filter = document.querySelector("[data-publication-filter]");
const newButton = document.querySelector("[data-new-publication]");
const clearButton = document.querySelector("[data-clear-form]");

let currentUser = null;
let publications = [];

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

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.status.value = "rascunho";
  form.elements.visivel.checked = true;
  form.elements.destaque_home.checked = false;
  form.elements.ordem.value = "0";
  formTitle.textContent = "Nova publicação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFilteredPublications() {
  const value = filter?.value || "todos";
  if (value === "todos") return publications;
  if (value === "home") return publications.filter((item) => item.destaque_home);
  return publications.filter((item) => item.status === value);
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function renderPublications() {
  if (!list || !empty) return;

  const items = getFilteredPublications();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo;
    const meta = document.createElement("small");
    meta.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}`;
    headingGroup.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.categoria || "sem categoria"));
    pills.appendChild(createPill(item.status || "rascunho", item.status === "publicado" ? "is-published" : item.status === "oculto" ? "is-hidden" : "is-draft"));
    if (item.visivel) pills.appendChild(createPill("visível", "is-visible"));
    if (item.destaque_home) pills.appendChild(createPill("home", "is-home"));
    header.append(headingGroup, pills);

    const summary = document.createElement("p");
    summary.textContent = item.resumo || "Sem resumo cadastrado.";

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-status">${item.status === "publicado" ? "Ocultar" : "Publicar"}</button>
      <button type="button" data-action="toggle-home">${item.destaque_home ? "Remover da home" : "Destacar na home"}</button>
    `;

    card.append(header, summary, actions);
    list.appendChild(card);
  });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.slug.value = text(item.slug);
  form.elements.categoria.value = text(item.categoria || "projeto");
  form.elements.resumo.value = text(item.resumo);
  form.elements.conteudo.value = text(item.conteudo);
  form.elements.imagem_url.value = text(item.imagem_url);
  form.elements.link_externo.value = text(item.link_externo);
  form.elements.status.value = text(item.status || "rascunho");
  form.elements.ordem.value = text(item.ordem ?? 0);
  form.elements.visivel.checked = Boolean(item.visivel);
  form.elements.destaque_home.checked = Boolean(item.destaque_home);
  formTitle.textContent = "Editar publicação";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const slug = String(formData.get("slug") || "").trim() || slugify(titulo);
  const status = String(formData.get("status") || "rascunho");

  return {
    titulo,
    slug,
    categoria: String(formData.get("categoria") || "projeto"),
    resumo: String(formData.get("resumo") || "").trim(),
    conteudo: String(formData.get("conteudo") || "").trim() || null,
    imagem_url: String(formData.get("imagem_url") || "").trim() || null,
    link_externo: String(formData.get("link_externo") || "").trim() || null,
    status,
    visivel: form.elements.visivel.checked,
    destaque_home: form.elements.destaque_home.checked,
    ordem: Number(formData.get("ordem") || 0),
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

async function loadPublications() {
  const { data, error } = await supabase
    .from("publicacoes")
    .select("*")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  publications = data || [];
  renderPublications();
}

async function savePublication(event) {
  event.preventDefault();
  setFormLoading(true);
  setStatus("Salvando publicação...", "info");

  try {
    const id = form.elements.id.value;
    const payload = getPayload();

    if (id) {
      const { error } = await supabase
        .from("publicacoes")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Publicação atualizada com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("publicacoes")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Publicação cadastrada com sucesso.", "success");
    }

    resetForm();
    await loadPublications();
  } catch (error) {
    setStatus(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function updatePublication(id, patch, successMessage) {
  setStatus("Atualizando publicação...", "info");
  const { error } = await supabase
    .from("publicacoes")
    .update({ ...patch, atualizado_por: currentUser?.id || null })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadPublications();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".admin-publication-card");
  const id = card?.dataset.id;
  const item = publications.find((publication) => publication.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "toggle-status") {
      const nextStatus = item.status === "publicado" ? "oculto" : "publicado";
      await updatePublication(
        id,
        {
          status: nextStatus,
          visivel: nextStatus === "publicado",
          publicado_em: nextStatus === "publicado" ? new Date().toISOString() : item.publicado_em,
        },
        nextStatus === "publicado" ? "Publicação marcada como publicada." : "Publicação ocultada."
      );
      return;
    }

    if (button.dataset.action === "toggle-home") {
      await updatePublication(
        id,
        { destaque_home: !item.destaque_home },
        item.destaque_home ? "Removida dos destaques da home." : "Marcada como destaque da home."
      );
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

filter?.addEventListener("change", renderPublications);
form?.addEventListener("submit", savePublication);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function bootPublications() {
  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setFormLoading(true);
    return;
  }

  const access = await requireAdminAccess();
  if (!access.session) {
    window.location.href = "login.html";
    return;
  }

  if (!access.isAdmin) {
    window.location.href = "index.html";
    return;
  }

  currentUser = access.session.user;
  setStatus("Módulo conectado. Cadastre os primeiros conteúdos do site.", "success");
  await loadPublications();
}

bootPublications().catch((error) => {
  setStatus(`Erro ao carregar publicações: ${error.message}`, "error");
});
