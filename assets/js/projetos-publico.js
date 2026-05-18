import {
  formatDateTime,
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isSupabaseConfigured,
  slugify,
  supabase,
} from "./supabase-client.js";

const BUCKET = "projetos-documentos";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
];

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

const publicList = document.querySelector("[data-projects-public-list]");
const publicEmpty = document.querySelector("[data-projects-public-empty]");
const publicFilter = document.querySelectorAll("[data-project-filter]");
const form = document.querySelector("[data-project-submit-form]");
const formStatus = document.querySelector("[data-project-form-status]");
const loginRequired = document.querySelector("[data-project-login-required]");
const formShell = document.querySelector("[data-project-form-shell]");
const myProjectsShell = document.querySelector("[data-my-projects-shell]");
const myProjectsList = document.querySelector("[data-my-projects-list]");
const myProjectsEmpty = document.querySelector("[data-my-projects-empty]");
const profileName = document.querySelector("[data-profile-name]");
const profileEmail = document.querySelector("[data-profile-email]");
const profileEnrollment = document.querySelector("[data-profile-enrollment]");

let currentSession = null;
let currentProfile = null;
let publicProjects = [];
let myProjects = [];
let activeFilter = "todos";

function setFormStatus(message, type = "info") {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.classList.add("is-visible");
  formStatus.classList.toggle("is-error", type === "error");
  formStatus.classList.toggle("is-success", type === "success");
}

function setFormLoading(isLoading) {
  form?.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function text(value) {
  return value == null ? "" : String(value);
}

function formatKeywords(value) {
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getStatusClass(status) {
  if (status === "aprovada") return "is-approved";
  if (status === "recusada" || status === "arquivada") return "is-rejected";
  if (status === "revisao") return "is-review";
  return "is-pending";
}

function getFilteredPublicProjects() {
  if (activeFilter === "todos") return publicProjects;
  return publicProjects.filter((item) => item.eixo === activeFilter);
}

function createProjectCard(item) {
  const article = document.createElement("article");
  article.className = "approved-project-card reveal";

  const keywords = formatKeywords(item.palavras_chave);
  const keywordHtml = keywords.length
    ? `<div class="project-keywords">${keywords.map((keyword) => `<span>${keyword}</span>`).join("")}</div>`
    : "";

  article.innerHTML = `
    <div class="approved-project-topline">
      <span>${EIXOS[item.eixo] || item.eixo}</span>
      <small>${item.aprovado_em ? `Aprovado em ${formatDateTime(item.aprovado_em).split(",")[0]}` : "Projeto aprovado"}</small>
    </div>
    <h3>${item.titulo}</h3>
    <p>${item.resumo || "Sem resumo cadastrado."}</p>
    <dl>
      <div>
        <dt>Orientação</dt>
        <dd>${item.orientador || "A definir"}</dd>
      </div>
      <div>
        <dt>Equipe</dt>
        <dd>${item.equipe || "Equipe não informada"}</dd>
      </div>
      <div>
        <dt>Público-alvo</dt>
        <dd>${item.publico_alvo || "Comunidade acadêmica"}</dd>
      </div>
    </dl>
    ${keywordHtml}
  `;

  return article;
}

function renderPublicProjects() {
  if (!publicList || !publicEmpty) return;
  const items = getFilteredPublicProjects();
  publicList.innerHTML = "";
  publicEmpty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => publicList.appendChild(createProjectCard(item)));
}

function renderMyProjects() {
  if (!myProjectsShell || !myProjectsList || !myProjectsEmpty) return;

  myProjectsShell.hidden = !currentSession;
  if (!currentSession) return;

  myProjectsList.innerHTML = "";
  myProjectsEmpty.classList.toggle("is-visible", myProjects.length === 0);

  myProjects.forEach((item) => {
    const article = document.createElement("article");
    article.className = "my-project-card";
    article.innerHTML = `
      <div>
        <span class="project-status-pill ${getStatusClass(item.status)}">${STATUS[item.status] || item.status}</span>
        <strong>${item.titulo}</strong>
        <small>${EIXOS[item.eixo] || item.eixo} · Enviado em ${formatDateTime(item.criado_em).split(",")[0]}</small>
      </div>
      <p>${item.feedback_admin || "Aguardando retorno da administração."}</p>
    `;
    myProjectsList.appendChild(article);
  });
}

async function loadPublicProjects() {
  if (!isSupabaseConfigured || !supabase) {
    if (publicEmpty) {
      publicEmpty.textContent = "Configure o Supabase para carregar os projetos aprovados.";
      publicEmpty.classList.add("is-visible");
    }
    return;
  }

  const { data, error } = await supabase
    .from("projeto_propostas")
    .select("id, titulo, slug, eixo, resumo, descricao, objetivo, orientador, equipe, palavras_chave, publico_alvo, aprovado_em, atualizado_em")
    .eq("status", "aprovada")
    .eq("visivel", true)
    .order("aprovado_em", { ascending: false, nullsFirst: false })
    .order("atualizado_em", { ascending: false });

  if (error) throw error;
  publicProjects = data || [];
  renderPublicProjects();
}

async function loadMyProjects() {
  if (!currentSession || !supabase) return;

  const { data, error } = await supabase
    .from("projeto_propostas")
    .select("id, titulo, eixo, status, feedback_admin, criado_em")
    .eq("criado_por", currentSession.user.id)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  myProjects = data || [];
  renderMyProjects();
}

function setupFilters() {
  publicFilter.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.projectFilter || "todos";
      publicFilter.forEach((item) => item.classList.toggle("is-active", item === button));
      renderPublicProjects();
    });
  });
}

function showLoginRequired() {
  loginRequired.hidden = false;
  formShell.hidden = true;
  myProjectsShell.hidden = true;
}

function showForm() {
  loginRequired.hidden = true;
  formShell.hidden = false;
  myProjectsShell.hidden = false;
}

function fillProfilePreview() {
  if (!currentProfile || !currentSession) return;

  if (profileName) profileName.textContent = currentProfile.nome || currentSession.user.email || "Aluno";
  if (profileEmail) profileEmail.textContent = currentProfile.email || currentSession.user.email || "E-mail não informado";
  if (profileEnrollment) profileEnrollment.textContent = currentProfile.matricula || "Matrícula não informada";

  form.elements.responsavel_nome.value = currentProfile.nome || "";
  form.elements.responsavel_email.value = currentProfile.email || currentSession.user.email || "";
  form.elements.responsavel_matricula.value = currentProfile.matricula || "";
}

function sanitizeFileName(fileName) {
  const pieces = String(fileName || "documento.pdf").split(".");
  const extension = pieces.length > 1 ? pieces.pop().toLowerCase() : "pdf";
  const baseName = slugify(pieces.join(".")) || "documento";
  return `${baseName}.${extension}`;
}

function validateFile(file) {
  if (!file) return "Envie a documentação do projeto em PDF, DOC, DOCX, ODT ou TXT.";
  if (file.size > MAX_FILE_SIZE) return "O documento deve ter no máximo 15 MB.";
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return "Formato não permitido. Use PDF, DOC, DOCX, ODT ou TXT.";
  return "";
}

async function uploadDocument(file) {
  const safeName = sanitizeFileName(file.name);
  const path = `${currentSession.user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;
  return path;
}

async function submitProposal(event) {
  event.preventDefault();

  if (!currentSession || !currentProfile) {
    showLoginRequired();
    return;
  }

  const formData = new FormData(form);
  const file = form.elements.documento.files[0];
  const fileError = validateFile(file);

  if (fileError) {
    setFormStatus(fileError, "error");
    return;
  }

  if (!currentProfile.matricula) {
    setFormStatus("Sua conta precisa ter matrícula para enviar uma proposta.", "error");
    return;
  }

  const titulo = String(formData.get("titulo") || "").trim();
  const resumo = String(formData.get("resumo") || "").trim();
  const descricao = String(formData.get("descricao") || "").trim();

  if (!titulo || !resumo || !descricao) {
    setFormStatus("Preencha título, resumo e descrição da proposta.", "error");
    return;
  }

  setFormLoading(true);
  setFormStatus("Enviando documentação e registrando proposta...", "info");

  try {
    const documentPath = await uploadDocument(file);
    const payload = {
      titulo,
      slug: `${slugify(titulo)}-${Date.now()}`,
      eixo: String(formData.get("eixo") || "pesquisa"),
      resumo,
      descricao,
      objetivo: String(formData.get("objetivo") || "").trim() || null,
      orientador: String(formData.get("orientador") || "").trim() || null,
      equipe: String(formData.get("equipe") || "").trim() || null,
      palavras_chave: String(formData.get("palavras_chave") || "").trim() || null,
      publico_alvo: String(formData.get("publico_alvo") || "").trim() || null,
      responsavel_nome: currentProfile.nome || currentSession.user.email,
      responsavel_email: currentProfile.email || currentSession.user.email,
      responsavel_matricula: currentProfile.matricula,
      documento_path: documentPath,
      documento_nome: file.name,
      documento_tipo: file.type || null,
      documento_tamanho: file.size,
      status: "solicitada",
      visivel: false,
      criado_por: currentSession.user.id,
      atualizado_por: currentSession.user.id,
    };

    const { error } = await supabase.from("projeto_propostas").insert(payload);
    if (error) throw error;

    form.reset();
    fillProfilePreview();
    setFormStatus("Proposta enviada. Ela ficará pendente até análise da administração.", "success");
    await loadMyProjects();
  } catch (error) {
    setFormStatus(`Erro ao enviar proposta: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function setupLoggedArea() {
  if (!form || !loginRequired || !formShell) return;

  if (!isSupabaseConfigured || !supabase) {
    showLoginRequired();
    loginRequired.querySelector("p").textContent = getConfigMessage();
    return;
  }

  currentSession = await getCurrentSession();
  if (!currentSession) {
    showLoginRequired();
    return;
  }

  currentProfile = await getOwnProfile(currentSession.user);
  showForm();
  fillProfilePreview();
  await loadMyProjects();
}

form?.addEventListener("submit", submitProposal);

async function init() {
  setupFilters();
  await loadPublicProjects();
  await setupLoggedArea();
}

init().catch((error) => {
  console.error(error);
  setFormStatus(`Erro ao iniciar projetos: ${error.message}`, "error");
});
