import {
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const list = document.querySelector("[data-monitorias-list]");
const empty = document.querySelector("[data-monitorias-empty]");
const filters = document.querySelectorAll("[data-monitoria-public-filter]");
const applyStatus = document.querySelector("[data-monitoria-apply-status]");
const applicationShell = document.querySelector("[data-monitoria-application-shell]");
const applicationForm = document.querySelector("[data-monitoria-application-form]");
const applicationTitle = document.querySelector("[data-monitoria-application-title]");
const applicationClose = document.querySelector("[data-monitoria-application-close]");
const applicationCancel = document.querySelector("[data-monitoria-application-cancel]");

const STATUS = {
  solicitada: "Candidatura enviada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

let monitorias = [];
let candidaturas = [];
let currentSession = null;
let currentProfile = null;
let activeFilter = "todos";

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function setApplyStatus(message, type = "info") {
  if (!applyStatus) return;
  applyStatus.textContent = message;
  applyStatus.classList.add("is-visible");
  applyStatus.classList.toggle("is-error", type === "error");
  applyStatus.classList.toggle("is-success", type === "success");
}

function setFormLoading(isLoading) {
  applicationForm?.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function formatDate(value) {
  if (!value) return "Data a definir";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getItems() {
  if (activeFilter === "todos") return monitorias;
  return monitorias.filter((item) => item.tipo === activeFilter);
}

function getCandidatura(oportunidadeId) {
  return candidaturas.find((item) => item.oportunidade_id === oportunidadeId);
}

function getApplyButton(item) {
  const candidatura = getCandidatura(item.id);
  if (candidatura) {
    return `<button class="btn btn-secondary monitoria-apply-button" type="button" disabled>${esc(STATUS[candidatura.status] || "Candidatura enviada")}</button>`;
  }

  return `<button class="btn btn-primary monitoria-apply-button" type="button" data-monitoria-apply="${esc(item.id)}">Voluntariar-se</button>`;
}

function render() {
  if (!list || !empty) return;
  const items = getItems();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "monitoria-card";
    article.dataset.id = item.id;
    const periodo = item.inscricao_inicio || item.inscricao_fim ? `${formatDate(item.inscricao_inicio)} até ${formatDate(item.inscricao_fim)}` : "Inscrições a definir";
    article.innerHTML = `
      <div class="monitoria-topline"><span>${esc(item.tipo || "monitoria")}</span><small>${esc(periodo)}</small></div>
      <h3>${esc(item.titulo)}</h3>
      <p>${esc(item.resumo || "Sem resumo cadastrado.")}</p>
      <dl>
        <div><dt>Disciplina/área</dt><dd>${esc(item.disciplina || "A definir")}</dd></div>
        <div><dt>Responsável</dt><dd>${esc(item.professor || "A definir")}</dd></div>
        <div><dt>Vagas</dt><dd>${Number(item.vagas || 0) || "A definir"}</dd></div>
        <div><dt>Carga horária</dt><dd>${esc(item.carga_horaria || "A definir")}</dd></div>
      </dl>
      ${item.requisitos ? `<div class="monitoria-requisitos"><strong>Requisitos</strong><p>${esc(item.requisitos)}</p></div>` : ""}
      <div class="monitoria-actions">
        ${getApplyButton(item)}
        ${item.link_externo ? `<a class="text-link" href="${esc(item.link_externo)}" target="_blank" rel="noopener">Acessar edital ou orientação</a>` : ""}
      </div>
    `;
    list.appendChild(article);
  });
}

async function loadAuth() {
  currentSession = await getCurrentSession();
  if (!currentSession) return;
  currentProfile = await getOwnProfile(currentSession.user);

  const { data, error } = await supabase
    .from("monitoria_candidaturas")
    .select("id, oportunidade_id, status, feedback_admin, criado_em")
    .eq("criado_por", currentSession.user.id);

  if (error) throw error;
  candidaturas = data || [];
}

async function loadMonitorias() {
  if (!isSupabaseConfigured || !supabase) {
    empty.textContent = getConfigMessage();
    empty.classList.add("is-visible");
    return;
  }

  await loadAuth();

  const { data, error } = await supabase
    .from("monitorias_publicas")
    .select("*")
    .order("inscricao_fim", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  monitorias = data || [];
  render();
}

function closeApplicationForm() {
  if (!applicationShell || !applicationForm) return;
  applicationShell.hidden = true;
  applicationForm.reset();
}

function openApplicationForm(oportunidadeId) {
  if (!currentSession || !currentProfile) {
    window.location.href = "admin/login.html?redirect=..%2Fprojetos.html%23monitorias";
    return;
  }

  if (!currentProfile.matricula) {
    setApplyStatus("Sua conta precisa ter matrícula para se voluntariar em uma monitoria.", "error");
    return;
  }

  const monitoria = monitorias.find((item) => item.id === oportunidadeId);
  if (!monitoria || !applicationShell || !applicationForm) return;

  applicationForm.reset();
  applicationForm.elements.oportunidade_id.value = oportunidadeId;
  applicationForm.elements.responsavel_nome.value = currentProfile.nome || currentSession.user.email || "Aluno";
  applicationForm.elements.responsavel_email.value = currentProfile.email || currentSession.user.email;
  applicationForm.elements.responsavel_matricula.value = currentProfile.matricula;
  if (applicationTitle) applicationTitle.textContent = `Candidatura para ${monitoria.titulo}`;
  applicationShell.hidden = false;
  applicationShell.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitApplication(event) {
  event.preventDefault();
  if (!currentSession || !currentProfile) {
    window.location.href = "admin/login.html?redirect=..%2Fprojetos.html%23monitorias";
    return;
  }

  const formData = new FormData(applicationForm);
  const oportunidadeId = String(formData.get("oportunidade_id") || "").trim();
  const monitoria = monitorias.find((item) => item.id === oportunidadeId);
  if (!monitoria) return;

  const motivo = String(formData.get("motivo") || "").trim();
  const experiencia = String(formData.get("experiencia_nivel") || "").trim();
  const disponibilidade = String(formData.get("disponibilidade") || "").trim();
  const aceitaAvaliacao = String(formData.get("aceita_avaliacao") || "");
  const mensagem = String(formData.get("mensagem") || "").trim();

  if (!motivo || !experiencia || !disponibilidade || !aceitaAvaliacao) {
    setApplyStatus("Preencha o questionário de candidatura antes de enviar.", "error");
    return;
  }

  setFormLoading(true);
  setApplyStatus("Enviando candidatura de monitoria...", "info");

  const payload = {
    oportunidade_id: oportunidadeId,
    responsavel_nome: currentProfile.nome || currentSession.user.email || "Aluno",
    responsavel_email: currentProfile.email || currentSession.user.email,
    responsavel_matricula: currentProfile.matricula,
    motivo,
    experiencia_nivel: experiencia,
    disponibilidade,
    aceita_avaliacao: aceitaAvaliacao === "true",
    mensagem: mensagem || `Candidatura enviada para a oportunidade: ${monitoria.titulo}`,
    status: "solicitada",
    criado_por: currentSession.user.id,
  };

  const { error } = await supabase.from("monitoria_candidaturas").insert(payload);

  setFormLoading(false);

  if (error) {
    const message = String(error.message || "").toLowerCase().includes("duplicate")
      ? "Você já se voluntariou para essa monitoria."
      : `Erro ao enviar candidatura: ${error.message}`;
    setApplyStatus(message, "error");
    return;
  }

  setApplyStatus("Candidatura enviada. A administração poderá avaliar suas respostas.", "success");
  closeApplicationForm();
  await loadAuth();
  render();
}

filters.forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.monitoriaPublicFilter || "todos";
  filters.forEach((item) => item.classList.toggle("is-active", item === button));
  render();
}));

list?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-monitoria-apply]");
  if (!button) return;
  openApplicationForm(button.dataset.monitoriaApply);
});

applicationForm?.addEventListener("submit", submitApplication);
applicationClose?.addEventListener("click", closeApplicationForm);
applicationCancel?.addEventListener("click", closeApplicationForm);

loadMonitorias().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar monitorias: ${error.message}`;
    empty.classList.add("is-visible");
  }
});
