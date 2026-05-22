import {
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const statusBox = document.querySelector("[data-admin-status]");
const userCard = document.querySelector("[data-admin-user-card]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const statTotal = document.querySelector("[data-stat-total]");
const statPublished = document.querySelector("[data-stat-published]");
const statHome = document.querySelector("[data-stat-home]");

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function renderDenied(profile) {
  document.body.textContent = "";

  const main = document.createElement("main");
  main.className = "admin-main";

  const card = document.createElement("section");
  card.className = "admin-denied-card";

  const kicker = document.createElement("span");
  kicker.className = "admin-kicker";
  kicker.textContent = "Acesso bloqueado";

  const title = document.createElement("h1");
  title.textContent = "Este cadastro ainda não é administrador.";

  const text = document.createElement("p");
  text.append("Perfil detectado: ");
  const role = document.createElement("strong");
  role.textContent = profile?.role || "sem perfil";
  text.append(role, ". Para liberar o painel, cadastre o e-mail na tabela ");
  const table = document.createElement("strong");
  table.textContent = "site_admin_emails";
  text.append(table, " e garanta que o perfil esteja como admin ou editor.");

  const actions = document.createElement("div");
  actions.className = "admin-denied-actions";

  const back = document.createElement("a");
  back.className = "admin-secondary-action";
  back.href = "../index.html";
  back.textContent = "Voltar ao site";

  const logout = document.createElement("button");
  logout.className = "admin-submit";
  logout.type = "button";
  logout.textContent = "Sair desta conta";
  logout.addEventListener("click", signOutAndGoToLogin);

  actions.append(back, logout);
  card.append(kicker, title, text, actions);
  main.appendChild(card);
  document.body.appendChild(main);
}

function renderUser(profile, user) {
  if (!userCard) return;
  userCard.textContent = "";

  const name = document.createElement("strong");
  name.textContent = profile?.nome || user.email;

  const email = document.createElement("span");
  email.textContent = user.email;

  const role = document.createElement("small");
  role.textContent = `Perfil: ${profile?.role || "sem perfil"}`;

  userCard.append(name, email, role);
}

async function loadStats() {
  const { data, error } = await supabase
    .from("noticias_eventos")
    .select("id, status, destaque_home");

  if (error) throw error;

  const items = data || [];
  statTotal.textContent = String(items.length);
  statPublished.textContent = String(items.filter((item) => item.status === "publicado").length);
  statHome.textContent = String(items.filter((item) => item.destaque_home).length);
}

logoutButtons.forEach((button) => {
  button.addEventListener("click", signOutAndGoToLogin);
});

async function bootDashboard() {
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
    renderDenied(access.profile);
    return;
  }

  renderUser(access.profile, access.session.user);
  setStatus("Painel conectado ao Supabase. Primeira engrenagem administrativa pronta.", "success");

  try {
    await loadStats();
  } catch (error) {
    setStatus(`Painel conectado, mas não consegui ler notícias e eventos: ${error.message}`, "error");
  }
}

bootDashboard().catch((error) => {
  setStatus(`Erro ao carregar painel: ${error.message}`, "error");
});
