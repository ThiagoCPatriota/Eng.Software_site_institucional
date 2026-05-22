import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const list = document.querySelector("[data-pages-list]");
const empty = document.querySelector("[data-pages-empty]");
const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");

let pages = [];
let currentUser = null;

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function renderPages() {
  if (!list || !empty) return;
  list.innerHTML = "";
  empty.classList.toggle("is-visible", pages.length === 0);

  pages.forEach((page) => {
    const card = document.createElement("article");
    card.className = `admin-publication-card admin-page-visibility-card${page.visivel ? "" : " is-page-hidden"}`;
    card.dataset.slug = page.slug;

    const header = document.createElement("header");
    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = page.titulo;
    const meta = document.createElement("small");
    meta.textContent = `${page.grupo || "Geral"} · ${page.url}`;
    titleWrap.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.append(createPill(page.visivel ? "visível" : "oculta", page.visivel ? "is-visible" : "is-hidden"));
    header.append(titleWrap, pills);

    const text = document.createElement("p");
    text.textContent = page.observacao || "Controle se a página aparece no menu e se pode ser acessada publicamente.";

    const footnote = document.createElement("small");
    footnote.className = "admin-card-footnote";
    footnote.textContent = `Atualizado em ${formatDateTime(page.atualizado_em || page.criado_em)}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="toggle">${page.visivel ? "Ocultar página" : "Mostrar página"}</button>
      <button type="button" data-action="open">Abrir página</button>
    `;

    card.append(header, text, footnote, actions);
    list.appendChild(card);
  });
}

async function loadPages() {
  const { data, error } = await supabase
    .from("site_paginas_visibilidade")
    .select("*")
    .order("ordem", { ascending: true })
    .order("titulo", { ascending: true });

  if (error) throw error;
  pages = data || [];
  renderPages();
}

async function togglePage(slug) {
  const page = pages.find((item) => item.slug === slug);
  if (!page) return;
  const nextVisible = !page.visivel;

  const { error } = await supabase
    .from("site_paginas_visibilidade")
    .update({ visivel: nextVisible, atualizado_por: currentUser?.id || null })
    .eq("slug", slug);

  if (error) throw error;
  setStatus(nextVisible ? "Página ativada no site." : "Página ocultada no site.", "success");
  await loadPages();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-slug]");
  const slug = card?.dataset.slug;
  const page = pages.find((item) => item.slug === slug);
  if (!page) return;

  try {
    if (button.dataset.action === "open") {
      window.open(`../${page.url}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (button.dataset.action === "toggle") {
      await togglePage(slug);
    }
  } catch (error) {
    setStatus(`Erro ao atualizar página: ${error.message}`, "error");
  }
});

logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function boot() {
  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const access = await requireAdminAccess();
  if (!access.session) {
    window.location.href = "login.html";
    return;
  }
  if (!access.isAdmin) {
    setStatus("Apenas administradores podem ocultar páginas.", "error");
    return;
  }

  currentUser = access.session.user;
  await loadPages();
  setStatus("Controle de páginas carregado.", "success");
}

boot().catch((error) => {
  setStatus(`Erro ao carregar páginas: ${error.message}`, "error");
});
