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

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-project-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-project-list]");
const empty = document.querySelector("[data-project-empty]");
const filter = document.querySelector("[data-project-filter]");
const newButton = document.querySelector("[data-new-project]");
const clearButton = document.querySelector("[data-clear-form]");
const statPending = document.querySelector("[data-stat-pending]");
const statApproved = document.querySelector("[data-stat-approved]");
const statReview = document.querySelector("[data-stat-review]");

let currentUser = null;
let projects = [];

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

function classForStatus(status) {
  if (status === "aprovada") return "is-visible";
  if (status === "recusada" || status === "arquivada") return "is-hidden";
  if (status === "revisao") return "is-review";
  return "is-pending";
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.eixo.value = "pesquisa";
  form.elements.status.value = "solicitada";
  form.elements.visivel.value = "false";
  formTitle.textContent = "Nova proposta";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
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

async function loadProjects() {
  const { data, error } = await supabase
    .from("projeto_propostas")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  projects = data || [];
  renderProjects();
}

async function saveProject(event) {
  event.preventDefault();
  setFormLoading(true);
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

    resetForm();
    await loadProjects();
  } catch (error) {
    setStatus(`Erro ao salvar proposta: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
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

filter?.addEventListener("change", renderProjects);
form?.addEventListener("submit", saveProject);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function init() {
  if (!isSupabaseConfigured || !supabase) {
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
    setStatus("Seu usuário não tem permissão para acessar este painel.", "error");
    setFormLoading(true);
    return;
  }

  currentUser = access.session.user;
  setStatus("Módulo de projetos conectado. Aprove propostas e publique somente os projetos validados.", "success");
  await loadProjects();
  resetForm();
}

init().catch((error) => {
  setStatus(`Erro ao iniciar módulo: ${error.message}`, "error");
});
