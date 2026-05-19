import {
  formatDateTime,
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isAdminProfile,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const loginRequired = document.querySelector("[data-student-login-required]");
const loginMessage = document.querySelector("[data-student-login-message]");
const dashboard = document.querySelector("[data-student-dashboard]");
const dashboardStatus = document.querySelector("[data-student-dashboard-status]");

const nameTarget = document.querySelector("[data-student-name]");
const emailTarget = document.querySelector("[data-student-email]");
const enrollmentTarget = document.querySelector("[data-student-enrollment]");
const initialsTarget = document.querySelector("[data-student-initials]");

const projectCountTarget = document.querySelector("[data-student-project-count]");
const projectFeedbackCountTarget = document.querySelector("[data-student-project-feedback-count]");
const reservationCountTarget = document.querySelector("[data-student-reservation-count]");

const projectList = document.querySelector("[data-student-projects-list]");
const projectEmpty = document.querySelector("[data-student-projects-empty]");
const reservationList = document.querySelector("[data-student-reservations-list]");
const reservationEmpty = document.querySelector("[data-student-reservations-empty]");
const tabButtons = document.querySelectorAll("[data-student-tab]");
const panels = document.querySelectorAll("[data-student-panel]");

const EIXOS = {
  pesquisa: "Pesquisa",
  extensao: "Extensão",
  inovacao: "Inovação",
};

const PROJECT_STATUS = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  revisao: "Precisa de ajustes",
  recusada: "Recusada",
  arquivada: "Arquivada",
};

const RESERVATION_STATUS = {
  solicitada: "Solicitada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(nameOrEmail = "") {
  const value = String(nameOrEmail || "").trim();
  if (!value) return "AL";
  const pieces = value.includes("@") ? [value.split("@")[0]] : value.split(/\s+/).filter(Boolean);
  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
  return `${pieces[0][0] || ""}${pieces[pieces.length - 1][0] || ""}`.toUpperCase();
}

function normalizeStatusClass(status = "") {
  if (["aprovada"].includes(status)) return "is-approved";
  if (["recusada", "arquivada", "cancelada"].includes(status)) return "is-rejected";
  if (["revisao"].includes(status)) return "is-review";
  return "is-pending";
}

function getStudentPanelRedirect() {
  const currentPage = `${window.location.pathname.split("/").pop() || "area-aluno.html"}${window.location.search || ""}`;
  return `admin/login.html?redirect=..%2F${encodeURIComponent(currentPage)}`;
}

function redirectToLogin() {
  window.location.href = getStudentPanelRedirect();
}

function showLogin(message) {
  if (loginRequired) {
    loginRequired.hidden = false;
    if (message && loginMessage) loginMessage.textContent = message;
  } else {
    redirectToLogin();
  }

  if (dashboard) dashboard.hidden = true;
}

function showDashboard() {
  if (loginRequired) loginRequired.hidden = true;
  if (dashboard) dashboard.hidden = false;
}

function setDashboardStatus(message, type = "info") {
  if (!dashboardStatus) return;
  dashboardStatus.textContent = message || "";
  dashboardStatus.classList.toggle("is-visible", Boolean(message));
  dashboardStatus.classList.toggle("is-error", type === "error");
  dashboardStatus.classList.toggle("is-success", type === "success");
}

function fillProfile(profile, session) {
  const name = profile?.nome || session.user.email || "Aluno";
  const email = profile?.email || session.user.email || "E-mail não informado";
  const enrollment = profile?.matricula || "não informada";

  if (nameTarget) nameTarget.textContent = name;
  if (emailTarget) emailTarget.textContent = email;
  if (enrollmentTarget) enrollmentTarget.textContent = enrollment;
  if (initialsTarget) initialsTarget.textContent = getInitials(name);
}

function activateStudentTab(target = "projetos") {
  const normalizedTarget = target === "reservas" ? "reservas" : "projetos";

  tabButtons.forEach((button) => {
    const isActive = button.dataset.studentTab === normalizedTarget;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.studentPanel === normalizedTarget;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });
}

function setupTabs() {
  const tabsWrapper = document.querySelector(".student-tabs");
  if (!tabsWrapper || !tabButtons.length || !panels.length) return;

  tabButtons.forEach((button) => {
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", button.classList.contains("is-active") ? "true" : "false");
  });

  panels.forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
  });

  tabsWrapper.addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-tab]");
    if (!button) return;

    event.preventDefault();
    activateStudentTab(button.dataset.studentTab);
  });

  const requestedTab = new URLSearchParams(window.location.search).get("aba");
  activateStudentTab(requestedTab || "projetos");
}

function renderProjects(projects = []) {
  if (!projectList || !projectEmpty) return;

  projectList.innerHTML = "";
  projectEmpty.hidden = projects.length !== 0;

  projects.forEach((item) => {
    const statusLabel = PROJECT_STATUS[item.status] || item.status || "Sem status";
    const feedback = item.feedback_admin || "Aguardando retorno da administração.";
    const evaluatedAt = item.avaliado_em ? `Retorno em ${formatDateTime(item.avaliado_em)}` : "Sem retorno registrado ainda";

    const article = document.createElement("article");
    article.className = "student-item-card";
    article.innerHTML = `
      <div class="student-item-main">
        <div class="student-item-topline">
          <span class="student-status-pill ${normalizeStatusClass(item.status)}">${escapeHTML(statusLabel)}</span>
          <small>${escapeHTML(EIXOS[item.eixo] || item.eixo || "Projeto")}</small>
        </div>
        <h4>${escapeHTML(item.titulo || "Projeto sem título")}</h4>
        <p>${escapeHTML(item.resumo || "Sem resumo informado.")}</p>
      </div>
      <div class="student-feedback-box">
        <strong>Feedback da administração</strong>
        <p>${escapeHTML(feedback)}</p>
        <small>${escapeHTML(evaluatedAt)}</small>
      </div>
    `;
    projectList.appendChild(article);
  });

  if (projectCountTarget) projectCountTarget.textContent = String(projects.length);
  if (projectFeedbackCountTarget) {
    projectFeedbackCountTarget.textContent = String(projects.filter((item) => Boolean(item.feedback_admin)).length);
  }
}

function renderReservations(reservations = []) {
  if (!reservationList || !reservationEmpty) return;

  reservationList.innerHTML = "";
  reservationEmpty.hidden = reservations.length !== 0;

  reservations.forEach((item) => {
    const statusLabel = RESERVATION_STATUS[item.status] || item.status || "Sem status";
    const date = item.data_reserva ? new Date(`${item.data_reserva}T00:00:00`) : null;
    const dateLabel = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("pt-BR").format(date)
      : "Data a definir";

    const article = document.createElement("article");
    article.className = "student-item-card compact";
    article.innerHTML = `
      <div class="student-item-main">
        <div class="student-item-topline">
          <span class="student-status-pill ${normalizeStatusClass(item.status)}">${escapeHTML(statusLabel)}</span>
          <small>${escapeHTML(item.dia_semana || "Dia a definir")}</small>
        </div>
        <h4>${escapeHTML(item.titulo || "Reserva de laboratório")}</h4>
        <p>${escapeHTML(dateLabel)} · ${escapeHTML(item.hora_inicio || "--:--")} até ${escapeHTML(item.hora_fim || "--:--")}</p>
      </div>
      <div class="student-feedback-box">
        <strong>Finalidade</strong>
        <p>${escapeHTML(item.finalidade || "Sem descrição informada.")}</p>
        <small>Atualizado em ${escapeHTML(formatDateTime(item.atualizado_em || item.criado_em))}</small>
      </div>
    `;
    reservationList.appendChild(article);
  });

  if (reservationCountTarget) reservationCountTarget.textContent = String(reservations.length);
}

async function loadProjects(userId) {
  const { data, error } = await supabase
    .from("projeto_propostas")
    .select("id, titulo, eixo, resumo, status, feedback_admin, avaliado_em, criado_em, atualizado_em")
    .eq("criado_por", userId)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  renderProjects(data || []);
}

async function loadReservations(userId) {
  const { data, error } = await supabase
    .from("laboratorio_reservas")
    .select("id, titulo, status, data_reserva, dia_semana, hora_inicio, hora_fim, finalidade, criado_em, atualizado_em")
    .eq("criado_por", userId)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  renderReservations(data || []);
}

async function initStudentPanel() {
  setupTabs();

  if (!isSupabaseConfigured || !supabase) {
    showLogin(getConfigMessage());
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    showLogin("Entre com sua conta de estudante para visualizar seu painel acadêmico.");
    return;
  }

  const profile = await getOwnProfile(session.user);

  if (isAdminProfile(profile)) {
    window.location.href = "admin/index.html";
    return;
  }

  showDashboard();
  fillProfile(profile, session);
  setDashboardStatus("Carregando suas informações...", "info");

  await Promise.all([
    loadProjects(session.user.id),
    loadReservations(session.user.id),
  ]);

  setDashboardStatus("Painel atualizado com suas informações mais recentes.", "success");
}

initStudentPanel().catch((error) => {
  console.error(error);
  showDashboard();
  setDashboardStatus(`Erro ao carregar painel do aluno: ${error.message}`, "error");
});
