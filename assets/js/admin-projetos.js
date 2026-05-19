import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  slugify,
  supabase,
} from "./supabase-client.js";

const BUCKET = "projetos-documentos";

const EIXOS = {
  pesquisa: "Pesquisa",
  extensao: "Extensão",
  inovacao: "Inovação",
};

const STATUS = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  revisao: "Precisa de ajustes",
  recusada: "Recusada",
  arquivada: "Arquivada",
};

const CANDIDATE_STATUS = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

const EXPERIENCIA = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-project-form]");
const monitoriaForm = document.querySelector("[data-monitoria-form]");
const formTitle = document.querySelector("[data-form-title]");
const monitoriaFormTitle = document.querySelector("[data-monitoria-form-title]");
const list = document.querySelector("[data-project-list]");
const empty = document.querySelector("[data-project-empty]");
const filter = document.querySelector("[data-project-filter]");
const newButton = document.querySelector("[data-new-project]");
const clearButton = document.querySelector("[data-clear-form]");
const clearMonitoriaButton = document.querySelector("[data-clear-monitoria-form]");
const statPending = document.querySelector("[data-stat-pending]");
const statApproved = document.querySelector("[data-stat-approved]");
const statReview = document.querySelector("[data-stat-review]");
const tabButtons = document.querySelectorAll("[data-admin-project-tab-target]");
const tabPanels = document.querySelectorAll("[data-admin-project-panel]");
const createModeButtons = document.querySelectorAll("[data-admin-project-create-mode]");
const createPanels = document.querySelectorAll("[data-admin-create-panel]");
const candidateList = document.querySelector("[data-monitoria-candidate-list]");
const candidateEmpty = document.querySelector("[data-monitoria-candidate-empty]");
const candidateFilter = document.querySelector("[data-monitoria-candidate-filter]");

let currentUser = null;
let projects = [];
let monitoriaCandidates = [];
let monitoriaMap = new Map();

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setFormLoading(formElement, isLoading) {
  formElement?.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function setAllFormsLoading(isLoading) {
  setFormLoading(form, isLoading);
  setFormLoading(monitoriaForm, isLoading);
}

function text(value) {
  return value == null ? "" : String(value);
}

function showProjectTab(target = "projects") {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminProjectTabTarget === target);
  });
  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.adminProjectPanel !== target;
  });
}

function showCreateMode(mode = "projeto") {
  createModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminProjectCreateMode === mode);
  });
  createPanels.forEach((panel) => {
    panel.hidden = panel.dataset.adminCreatePanel !== mode;
  });
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function classForStatus(status) {
  if (status === "aprovada" || status === "aprovado" || status === "publicado") return "is-published";
  if (status === "recusada" || status === "arquivada" || status === "cancelada" || status === "oculto") return "is-hidden";
  if (status === "revisao" || status === "em_analise") return "is-review";
  return "is-draft";
}

function resetForm() {
  form?.reset();
  if (form?.elements.id) form.elements.id.value = "";
  if (form?.elements.eixo) form.elements.eixo.value = "pesquisa";
  if (form?.elements.status) form.elements.status.value = "solicitada";
  if (form?.elements.visivel) form.elements.visivel.value = "false";
  if (formTitle) formTitle.textContent = "Nova proposta";
  showProjectTab("form");
  showCreateMode("projeto");
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetMonitoriaForm() {
  monitoriaForm?.reset();
  if (monitoriaForm?.elements.id) monitoriaForm.elements.id.value = "";
  if (monitoriaForm?.elements.tipo) monitoriaForm.elements.tipo.value = "voluntaria";
  if (monitoriaForm?.elements.status) monitoriaForm.elements.status.value = "rascunho";
  if (monitoriaForm?.elements.visivel) monitoriaForm.elements.visivel.value = "true";
  if (monitoriaForm?.elements.vagas) monitoriaForm.elements.vagas.value = "1";
  if (monitoriaFormTitle) monitoriaFormTitle.textContent = "Nova monitoria";
  showProjectTab("form");
  showCreateMode("monitoria");
  monitoriaForm?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.titulo.value = text(item.titulo);
  form.elements.eixo.value = text(item.eixo || "pesquisa");
  form.elements.status.value = text(item.status || "solicitada");
  form.elements.visivel.value = String(Boolean(item.visivel));
  form.elements.resumo.value = text(item.resumo);
  form.elements.descricao.value = text(item.descricao);
  form.elements.objetivo.value = text(item.objetivo);
  form.elements.orientador.value = text(item.orientador);
  form.elements.equipe.value = text(item.equipe);
  form.elements.publico_alvo.value = text(item.publico_alvo);
  form.elements.palavras_chave.value = text(item.palavras_chave);
  form.elements.responsavel_nome.value = text(item.responsavel_nome);
  form.elements.responsavel_matricula.value = text(item.responsavel_matricula);
  form.elements.responsavel_email.value = text(item.responsavel_email);
  form.elements.feedback_admin.value = text(item.feedback_admin);
  formTitle.textContent = "Editar proposta";
  showProjectTab("form");
  showCreateMode("projeto");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "solicitada");
  const isApproved = status === "aprovada";

  return {
    titulo,
    slug: slugify(titulo),
    eixo: String(formData.get("eixo") || "pesquisa"),
    status,
    visivel: String(formData.get("visivel")) === "true" && isApproved,
    resumo: String(formData.get("resumo") || "").trim(),
    descricao: String(formData.get("descricao") || "").trim() || null,
    objetivo: String(formData.get("objetivo") || "").trim() || null,
    orientador: String(formData.get("orientador") || "").trim() || null,
    equipe: String(formData.get("equipe") || "").trim() || null,
    publico_alvo: String(formData.get("publico_alvo") || "").trim() || null,
    palavras_chave: String(formData.get("palavras_chave") || "").trim() || null,
    responsavel_nome: String(formData.get("responsavel_nome") || "").trim(),
    responsavel_matricula: String(formData.get("responsavel_matricula") || "").trim(),
    responsavel_email: String(formData.get("responsavel_email") || "").trim(),
    feedback_admin: String(formData.get("feedback_admin") || "").trim() || null,
    atualizado_por: currentUser?.id || null,
    avaliado_por: currentUser?.id || null,
    avaliado_em: new Date().toISOString(),
    aprovado_em: isApproved ? new Date().toISOString() : null,
  };
}

function getMonitoriaPayload() {
  const formData = new FormData(monitoriaForm);
  const titulo = String(formData.get("titulo") || "").trim();
  const status = String(formData.get("status") || "rascunho");
  const isPublished = status === "publicado";

  return {
    titulo,
    slug: slugify(titulo),
    disciplina: String(formData.get("disciplina") || "").trim() || null,
    tipo: String(formData.get("tipo") || "voluntaria"),
    vagas: Number(formData.get("vagas") || 0),
    carga_horaria: String(formData.get("carga_horaria") || "").trim() || null,
    professor: String(formData.get("professor") || "").trim() || null,
    inscricao_inicio: String(formData.get("inscricao_inicio") || "").trim() || null,
    inscricao_fim: String(formData.get("inscricao_fim") || "").trim() || null,
    resumo: String(formData.get("resumo") || "").trim(),
    requisitos: String(formData.get("requisitos") || "").trim() || null,
    descricao: String(formData.get("descricao") || "").trim() || null,
    link_externo: String(formData.get("link_externo") || "").trim() || null,
    status,
    visivel: String(formData.get("visivel")) === "true" && isPublished,
    publicado_em: isPublished ? new Date().toISOString() : null,
    atualizado_por: currentUser?.id || null,
  };
}

function getFilteredProjects() {
  const value = filter?.value || "todos";
  if (value === "todos") return projects;
  if (value === "visiveis") return projects.filter((item) => item.visivel);
  return projects.filter((item) => item.status === value);
}

function updateStats() {
  if (statPending) statPending.textContent = String(projects.filter((item) => ["solicitada", "em_analise"].includes(item.status)).length);
  if (statApproved) statApproved.textContent = String(projects.filter((item) => item.status === "aprovada").length);
  if (statReview) statReview.textContent = String(projects.filter((item) => item.status === "revisao").length);
}

function renderProjects() {
  if (!list || !empty) return;

  const items = getFilteredProjects();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);
  updateStats();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-project-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo;
    const meta = document.createElement("small");
    meta.textContent = `${EIXOS[item.eixo] || item.eixo} · ${item.responsavel_nome || "Sem responsável"} · Matrícula ${item.responsavel_matricula || "não informada"}`;
    headingGroup.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(EIXOS[item.eixo] || item.eixo));
    pills.appendChild(createPill(STATUS[item.status] || item.status, classForStatus(item.status)));
    pills.appendChild(createPill(item.visivel ? "mural" : "oculto", item.visivel ? "is-home" : "is-hidden"));
    header.append(headingGroup, pills);

    const summary = document.createElement("p");
    summary.textContent = item.resumo || "Sem resumo cadastrado.";

    const info = document.createElement("small");
    info.className = "admin-card-footnote";
    const docInfo = item.documento_nome ? ` · Documento: ${item.documento_nome}` : " · Sem documento vinculado";
    info.textContent = `Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}${docInfo}`;

    const feedback = document.createElement("p");
    feedback.className = "admin-feedback-preview";
    feedback.textContent = item.feedback_admin ? `Feedback: ${item.feedback_admin}` : "Sem feedback enviado ainda.";

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      ${item.documento_path ? '<button type="button" data-action="document">Abrir documento</button>' : ""}
      ${item.status !== "aprovada" ? '<button type="button" data-action="approve">Aprovar</button>' : ""}
      <button type="button" data-action="review">Pedir ajustes</button>
      <button type="button" data-action="reject">Recusar</button>
      ${item.status === "aprovada" ? `<button type="button" data-action="toggle-visible">${item.visivel ? "Ocultar do mural" : "Mostrar no mural"}</button>` : ""}
    `;

    card.append(header, summary, info, feedback, actions);
    list.appendChild(card);
  });
}

function getFilteredCandidates() {
  const value = candidateFilter?.value || "todos";
  if (value === "todos") return monitoriaCandidates;
  return monitoriaCandidates.filter((item) => item.status === value);
}

function renderMonitoriaCandidates() {
  if (!candidateList || !candidateEmpty) return;
  const items = getFilteredCandidates();
  candidateList.innerHTML = "";
  candidateEmpty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const monitoria = monitoriaMap.get(item.oportunidade_id) || {};
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-monitoria-candidate-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = monitoria.titulo || "Monitoria não encontrada";
    const meta = document.createElement("small");
    meta.textContent = `${item.responsavel_nome || "Aluno"} · Matrícula ${item.responsavel_matricula || "não informada"} · ${item.responsavel_email || "sem e-mail"}`;
    heading.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(CANDIDATE_STATUS[item.status] || item.status, classForStatus(item.status)));
    if (monitoria.tipo) pills.appendChild(createPill(monitoria.tipo));
    header.append(heading, pills);

    const summary = document.createElement("p");
    summary.textContent = item.mensagem || item.motivo || `Interesse em ${monitoria.disciplina || "monitoria"}.`;

    const details = document.createElement("dl");
    details.className = "admin-candidate-details";
    details.innerHTML = `
      <div><dt>Motivo</dt><dd>${text(item.motivo || item.mensagem || "Não informado")}</dd></div>
      <div><dt>Experiência</dt><dd>${text(EXPERIENCIA[item.experiencia_nivel] || item.experiencia_nivel || "Não informada")}</dd></div>
      <div><dt>Disponibilidade</dt><dd>${text(item.disponibilidade || "Não informada")}</dd></div>
      <div><dt>Aceita avaliação?</dt><dd>${item.aceita_avaliacao === true ? "Sim" : item.aceita_avaliacao === false ? "Não" : "Não informado"}</dd></div>
    `;

    const info = document.createElement("small");
    info.className = "admin-card-footnote";
    info.textContent = `Oportunidade: ${monitoria.disciplina || "área não informada"} · Responsável: ${monitoria.professor || "a definir"} · Enviado em ${formatDateTime(item.criado_em)}`;

    const feedback = document.createElement("p");
    feedback.className = "admin-feedback-preview";
    feedback.textContent = item.feedback_admin ? `Feedback: ${item.feedback_admin}` : "Sem feedback registrado.";

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-candidate-action="analysis">Em análise</button>
      <button type="button" data-candidate-action="approve">Aprovar</button>
      <button type="button" data-candidate-action="reject">Recusar</button>
      <button type="button" data-candidate-action="remove">Remover</button>
    `;

    card.append(header, summary, details, info, feedback, actions);
    candidateList.appendChild(card);
  });
}

async function loadProjects() {
  const { data, error } = await supabase
    .from("projeto_propostas")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  projects = data || [];
  renderProjects();
}

async function loadMonitoriaCandidates() {
  const { data, error } = await supabase
    .from("monitoria_candidaturas")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  monitoriaCandidates = data || [];

  const ids = [...new Set(monitoriaCandidates.map((item) => item.oportunidade_id).filter(Boolean))];
  monitoriaMap = new Map();
  if (ids.length) {
    const { data: oportunidades, error: oppError } = await supabase
      .from("monitorias_oportunidades")
      .select("id, titulo, disciplina, tipo, professor")
      .in("id", ids);
    if (oppError) throw oppError;
    (oportunidades || []).forEach((item) => monitoriaMap.set(item.id, item));
  }

  renderMonitoriaCandidates();
}

async function saveProject(event) {
  event.preventDefault();
  setFormLoading(form, true);
  setStatus("Salvando proposta...", "info");

  try {
    const id = form.elements.id.value;
    const payload = getPayload();

    if (!payload.titulo || !payload.resumo || !payload.responsavel_nome || !payload.responsavel_email || !payload.responsavel_matricula) {
      setStatus("Preencha título, resumo e dados do responsável antes de salvar.", "error");
      return;
    }

    if (id) {
      const current = projects.find((item) => item.id === id);
      const nextPayload = {
        ...payload,
        aprovado_em: payload.status === "aprovada" ? (current?.aprovado_em || payload.aprovado_em) : null,
      };
      const { error } = await supabase
        .from("projeto_propostas")
        .update(nextPayload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Proposta atualizada com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("projeto_propostas")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Proposta cadastrada com sucesso.", "success");
    }

    await loadProjects();
    showProjectTab("projects");
    resetForm();
    showProjectTab("projects");
  } catch (error) {
    setStatus(`Erro ao salvar proposta: ${error.message}`, "error");
  } finally {
    setFormLoading(form, false);
  }
}

async function saveMonitoria(event) {
  event.preventDefault();
  setFormLoading(monitoriaForm, true);
  setStatus("Salvando monitoria...", "info");

  try {
    const id = monitoriaForm.elements.id.value;
    const payload = getMonitoriaPayload();

    if (!payload.titulo || !payload.resumo) {
      setStatus("Preencha título e resumo da monitoria antes de salvar.", "error");
      return;
    }

    if (id) {
      const { error } = await supabase
        .from("monitorias_oportunidades")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Monitoria atualizada com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("monitorias_oportunidades")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Monitoria cadastrada com sucesso. Ela aparecerá para os alunos se estiver publicada e visível.", "success");
    }

    resetMonitoriaForm();
    showProjectTab("monitorias");
    await loadMonitoriaCandidates();
  } catch (error) {
    setStatus(`Erro ao salvar monitoria: ${error.message}`, "error");
  } finally {
    setFormLoading(monitoriaForm, false);
  }
}

async function updateProject(id, patch, successMessage) {
  setStatus("Atualizando proposta...", "info");
  const { error } = await supabase
    .from("projeto_propostas")
    .update({ ...patch, atualizado_por: currentUser?.id || null, avaliado_por: currentUser?.id || null, avaliado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadProjects();
}

async function updateCandidate(id, patch, successMessage) {
  setStatus("Atualizando candidatura de monitoria...", "info");
  const { error } = await supabase
    .from("monitoria_candidaturas")
    .update({ ...patch, atualizado_por: currentUser?.id || null, avaliado_por: currentUser?.id || null, avaliado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadMonitoriaCandidates();
}

async function openDocument(item) {
  if (!item.documento_path) {
    setStatus("Esta proposta não tem documento anexado.", "error");
    return;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(item.documento_path, 60 * 10);

  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".admin-project-card");
  const id = card?.dataset.id;
  const item = projects.find((project) => project.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "document") {
      await openDocument(item);
      return;
    }

    if (button.dataset.action === "approve") {
      await updateProject(id, { status: "aprovada", visivel: true, aprovado_em: new Date().toISOString() }, "Proposta aprovada e publicada no mural.");
      return;
    }

    if (button.dataset.action === "review") {
      await updateProject(id, { status: "revisao", visivel: false }, "Proposta marcada como precisando de ajustes.");
      return;
    }

    if (button.dataset.action === "reject") {
      await updateProject(id, { status: "recusada", visivel: false, aprovado_em: null }, "Proposta recusada e ocultada.");
      return;
    }

    if (button.dataset.action === "toggle-visible") {
      await updateProject(id, { visivel: !item.visivel }, item.visivel ? "Projeto ocultado do mural." : "Projeto exibido no mural.");
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

candidateList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-candidate-action]");
  if (!button) return;
  const card = button.closest(".admin-monitoria-candidate-card");
  const id = card?.dataset.id;
  const item = monitoriaCandidates.find((entry) => entry.id === id);
  if (!item) return;

  try {
    if (button.dataset.candidateAction === "analysis") {
      await updateCandidate(id, { status: "em_analise" }, "Candidatura colocada em análise.");
      return;
    }
    if (button.dataset.candidateAction === "approve") {
      await updateCandidate(id, { status: "aprovada", feedback_admin: item.feedback_admin || "Candidatura aprovada pela administração." }, "Candidatura aprovada.");
      return;
    }
    if (button.dataset.candidateAction === "reject") {
      const feedback = prompt("Feedback para o estudante, se quiser:", item.feedback_admin || "") || item.feedback_admin || null;
      await updateCandidate(id, { status: "recusada", feedback_admin: feedback }, "Candidatura recusada.");
      return;
    }
    if (button.dataset.candidateAction === "remove") {
      if (!confirm("Remover esta candidatura?")) return;
      const { error } = await supabase.from("monitoria_candidaturas").delete().eq("id", id);
      if (error) throw error;
      setStatus("Candidatura removida.", "success");
      await loadMonitoriaCandidates();
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

filter?.addEventListener("change", renderProjects);
candidateFilter?.addEventListener("change", renderMonitoriaCandidates);
form?.addEventListener("submit", saveProject);
monitoriaForm?.addEventListener("submit", saveMonitoria);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
clearMonitoriaButton?.addEventListener("click", resetMonitoriaForm);
tabButtons.forEach((button) => button.addEventListener("click", () => showProjectTab(button.dataset.adminProjectTabTarget)));
createModeButtons.forEach((button) => button.addEventListener("click", () => showCreateMode(button.dataset.adminProjectCreateMode)));
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function init() {
  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    setAllFormsLoading(true);
    return;
  }

  const access = await requireAdminAccess();
  if (!access.session) {
    window.location.href = "login.html";
    return;
  }

  if (!access.isAdmin) {
    setStatus("Seu usuário não tem permissão para acessar este painel.", "error");
    setAllFormsLoading(true);
    return;
  }

  currentUser = access.session.user;
  setStatus("Módulo de projetos conectado. Cadastre monitorias, aprove projetos e acompanhe candidaturas.", "success");
  await Promise.all([loadProjects(), loadMonitoriaCandidates()]);
  showProjectTab("projects");
  showCreateMode("projeto");
}

init().catch((error) => {
  setStatus(`Erro ao iniciar módulo: ${error.message}`, "error");
});
