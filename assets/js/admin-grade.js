import {
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const PERIOD_TITLES = {
  1: "Fundamentos e entrada na computação",
  2: "Estruturas, cálculo e arquitetura de computadores",
  3: "Requisitos, dados e orientação a objetos",
  4: "Web, banco de dados e interação humano-computador",
  5: "Arquitetura, gestão e desenvolvimento mobile",
  6: "Projeto integrador, qualidade e validação",
  7: "Segurança, jogos, IA e tópicos avançados I",
  8: "Tópicos avançados e fechamento da matriz",
};

const TYPE_LABELS = {
  obrigatorio: "Obrigatório",
  optativo: "Optativo",
  eletivo: "Eletivo",
  atividade: "Atividade",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-grade-form]");
const formTitle = document.querySelector("[data-form-title]");
const clearButton = document.querySelector("[data-clear-form]");
const panelButtons = document.querySelectorAll("[data-grade-panel-target]");
const panels = document.querySelectorAll("[data-grade-panel]");
const list = document.querySelector("[data-grade-list]");
const empty = document.querySelector("[data-grade-empty]");
const filter = document.querySelector("[data-grade-filter]");
const statTotal = document.querySelector("[data-stat-total]");
const statHours = document.querySelector("[data-stat-hours]");
const statCredits = document.querySelector("[data-stat-credits]");
const ppcForm = document.querySelector("[data-ppc-form]");
const ppcFileInput = document.querySelector("[data-ppc-file]");
const ppcUrlInput = document.querySelector("[data-ppc-url]");
const ppcCurrent = document.querySelector("[data-ppc-current]");

const PPC_BUCKET = "ppc-documentos";
const MAX_PPC_SIZE = 20 * 1024 * 1024;

let currentUser = null;
let components = [];
let ppcDocument = null;

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

function setPpcFormLoading(isLoading) {
  ppcForm?.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function text(value) {
  return value == null ? "" : String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setGradePanel(panelName, shouldScroll = false) {
  const allowedPanels = new Set(["form", "list", "ppc"]);
  const target = allowedPanels.has(panelName) ? panelName : "form";

  panelButtons.forEach((button) => {
    const isActive = button.dataset.gradePanelTarget === target;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.gradePanel !== target;
  });

  if (shouldScroll) {
    const activePanel = document.querySelector(`[data-grade-panel="${target}"]`);
    activePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function nextOrderForPeriod(periodo) {
  const samePeriod = components.filter((item) => Number(item.periodo) === Number(periodo));
  if (!samePeriod.length) return 1;
  return Math.max(...samePeriod.map((item) => numberValue(item.ordem, 0))) + 1;
}

function resetForm(shouldScroll = true) {
  form.reset();
  form.elements.id.value = "";
  form.elements.ordem.value = "";
  form.elements.periodo.value = "1";
  form.elements.tipo.value = "obrigatorio";
  form.elements.carga_horaria.value = "60";
  form.elements.creditos.value = "4";
  formTitle.textContent = "Novo componente";
  setGradePanel("form", shouldScroll);
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.ordem.value = text(item.ordem);
  form.elements.periodo.value = text(item.periodo || 1);
  form.elements.codigo.value = text(item.codigo);
  form.elements.tipo.value = text(item.tipo || "obrigatorio");
  form.elements.nome.value = text(item.nome);
  form.elements.carga_horaria.value = text(item.carga_horaria ?? 0);
  form.elements.creditos.value = text(item.creditos ?? 0);
  form.elements.pre_requisitos.value = text(item.pre_requisitos);
  form.elements.descricao.value = text(item.descricao);
  formTitle.textContent = "Editar componente";
  setGradePanel("form", true);
}

function getPayload() {
  const formData = new FormData(form);
  const periodo = numberValue(formData.get("periodo"), 1);
  const existingOrder = numberValue(formData.get("ordem"), 0);

  return {
    periodo,
    ordem: existingOrder || nextOrderForPeriod(periodo),
    codigo: String(formData.get("codigo") || "").trim(),
    nome: String(formData.get("nome") || "").trim(),
    carga_horaria: numberValue(formData.get("carga_horaria"), 0),
    creditos: numberValue(formData.get("creditos"), 0),
    pre_requisitos: String(formData.get("pre_requisitos") || "").trim() || null,
    tipo: String(formData.get("tipo") || "obrigatorio"),
    descricao: String(formData.get("descricao") || "").trim() || null,
    visivel: true,
    atualizado_por: currentUser?.id || null,
  };
}


function slugify(value) {
  return String(value || "ppc")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ppc";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function validatePpcFile(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Envie o PPC em formato PDF.");
  if (file.size > MAX_PPC_SIZE) throw new Error("O arquivo do PPC deve ter no máximo 20 MB.");
}

function groupByPeriod(items) {
  return items.reduce((groups, item) => {
    const periodo = Number(item.periodo) || 1;
    if (!groups[periodo]) groups[periodo] = [];
    groups[periodo].push(item);
    return groups;
  }, {});
}

function getFilteredComponents() {
  const value = filter?.value || "todos";
  if (value === "todos") return [...components];
  return components.filter((item) => String(item.periodo) === String(value));
}

function createComponentCard(item) {
  const card = document.createElement("article");
  card.className = "admin-grade-component-card";
  card.dataset.componentId = item.id;

  const prereq = item.pre_requisitos ? `Pré: ${item.pre_requisitos}` : "Sem pré-requisito";

  card.innerHTML = `
    <div class="admin-grade-component-head">
      <span>${text(item.codigo) || "Sem código"}</span>
      <span>${numberValue(item.carga_horaria)}h · ${numberValue(item.creditos)} cr.</span>
    </div>
    <h3>${text(item.nome)}</h3>
    <p>${prereq}</p>
    <small>${TYPE_LABELS[item.tipo] || "Componente"}</small>
    <div class="admin-grade-component-actions">
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="delete">Excluir</button>
    </div>
  `;

  return card;
}

function renderStats() {
  const total = components.length;
  const hours = components.reduce((sum, item) => sum + numberValue(item.carga_horaria), 0);
  const credits = components.reduce((sum, item) => sum + numberValue(item.creditos), 0);

  if (statTotal) statTotal.textContent = String(total);
  if (statHours) statHours.textContent = `${hours}h`;
  if (statCredits) statCredits.textContent = String(credits);
}

function renderComponents() {
  if (!list || !empty) return;
  const filtered = getFilteredComponents();
  list.innerHTML = "";
  empty.hidden = filtered.length > 0;

  const groups = groupByPeriod(filtered);
  Object.entries(groups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([periodo, items]) => {
      const hours = items.reduce((sum, item) => sum + numberValue(item.carga_horaria), 0);
      const credits = items.reduce((sum, item) => sum + numberValue(item.creditos), 0);

      const section = document.createElement("section");
      section.className = "admin-grade-period-card";
      section.innerHTML = `
        <header class="admin-grade-period-header">
          <div>
            <span>${periodo}º período</span>
            <h2>${PERIOD_TITLES[periodo] || "Componentes curriculares"}</h2>
          </div>
          <div class="admin-grade-period-stats" aria-label="Resumo do ${periodo}º período">
            <span class="admin-grade-stat-chip"><strong>${items.length}</strong><small>componentes</small></span>
            <span class="admin-grade-stat-chip"><strong>${hours}h</strong><small>carga horária</small></span>
            <span class="admin-grade-stat-chip"><strong>${credits}</strong><small>créditos</small></span>
          </div>
        </header>
        <div class="admin-grade-component-grid"></div>
      `;

      const grid = section.querySelector(".admin-grade-component-grid");
      items
        .sort((a, b) => numberValue(a.ordem) - numberValue(b.ordem) || text(a.nome).localeCompare(text(b.nome), "pt-BR"))
        .forEach((item) => grid.appendChild(createComponentCard(item)));

      list.appendChild(section);
    });

  renderStats();
}

async function loadComponents() {
  const { data, error } = await supabase
    .from("componentes_curriculares")
    .select("*")
    .order("periodo", { ascending: true })
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw error;
  components = data || [];
  renderComponents();
}

async function saveComponent(event) {
  event.preventDefault();
  if (!supabase) return;

  const id = form.elements.id.value;
  const payload = getPayload();

  if (!payload.codigo || !payload.nome) {
    setStatus("Informe pelo menos código e nome do componente.", "error");
    return;
  }

  setFormLoading(true);
  try {
    if (id) {
      const { error } = await supabase
        .from("componentes_curriculares")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Componente atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("componentes_curriculares")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Componente cadastrado com sucesso.", "success");
    }

    resetForm(false);
    await loadComponents();
    setGradePanel("list", true);
  } catch (error) {
    console.error(error);
    const message = error?.message?.includes("duplicate")
      ? "Já existe um componente com esse código. Use outro código ou edite o componente existente."
      : error.message || "Não foi possível salvar o componente.";
    setStatus(message, "error");
  } finally {
    setFormLoading(false);
  }
}

async function deleteComponent(id) {
  if (!id) return;
  const item = components.find((component) => component.id === id);
  const ok = window.confirm(`Excluir o componente "${item?.nome || "selecionado"}"?`);
  if (!ok) return;

  try {
    const { error } = await supabase.from("componentes_curriculares").delete().eq("id", id);
    if (error) throw error;
    setStatus("Componente excluído.", "success");
    await loadComponents();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Não foi possível excluir o componente.", "error");
  }
}

function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-component-id]");
  const id = card?.dataset.componentId;
  const item = components.find((component) => component.id === id);
  if (!item) return;

  if (button.dataset.action === "edit") {
    fillForm(item);
    return;
  }

  if (button.dataset.action === "delete") {
    deleteComponent(id);
  }
}


function renderPpcDocument() {
  if (!ppcCurrent) return;

  if (!ppcDocument) {
    ppcCurrent.innerHTML = `
      <span class="admin-kicker">PPC atual</span>
      <h2>Nenhum PPC publicado</h2>
      <p>Quando um PDF ou link oficial for salvo, a página pública Grade curricular / PPC exibirá o botão de acesso automaticamente.</p>
    `;
    if (ppcForm) {
      ppcForm.elements.titulo.value = "Projeto Pedagógico do Curso";
      ppcForm.elements.descricao.value = "";
      ppcForm.elements.arquivo_url.value = "";
      if (ppcFileInput) ppcFileInput.value = "";
    }
    return;
  }

  if (ppcForm) {
    ppcForm.elements.titulo.value = text(ppcDocument.titulo || "Projeto Pedagógico do Curso");
    ppcForm.elements.descricao.value = text(ppcDocument.descricao);
    ppcForm.elements.arquivo_url.value = text(ppcDocument.arquivo_path ? "" : ppcDocument.arquivo_url);
    if (ppcFileInput) ppcFileInput.value = "";
  }

  const updated = formatDate(ppcDocument.atualizado_em || ppcDocument.criado_em);
  const size = formatFileSize(ppcDocument.arquivo_tamanho);

  ppcCurrent.innerHTML = `
    <span class="admin-kicker">PPC atual</span>
    <h2>${text(ppcDocument.titulo || "Projeto Pedagógico do Curso")}</h2>
    <p>${text(ppcDocument.descricao || "Documento oficial publicado para consulta pública.")}</p>
    <div class="admin-ppc-meta">
      ${updated ? `<span>Atualizado em ${updated}</span>` : ""}
      ${ppcDocument.arquivo_nome ? `<span>${text(ppcDocument.arquivo_nome)}</span>` : ""}
      ${size ? `<span>${size}</span>` : ""}
    </div>
    <a class="admin-secondary-action" href="${text(ppcDocument.arquivo_url)}" target="_blank" rel="noopener">Abrir PPC publicado</a>
  `;
}

async function loadPpcDocument() {
  try {
    const { data, error } = await supabase
      .from("ppc_documentos")
      .select("*")
      .eq("ativo", true)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    ppcDocument = data || null;
    renderPpcDocument();
  } catch (error) {
    console.error(error);
    ppcDocument = null;
    renderPpcDocument();
    setStatus("A área do PPC precisa do SQL atualizado de grade para funcionar.", "error");
  }
}

async function uploadPpcFile(file, title) {
  validatePpcFile(file);
  const safeTitle = slugify(title || "ppc-engenharia-software");
  const path = `${currentUser?.id || "admin"}/${Date.now()}-${safeTitle}.pdf`;

  const { error } = await supabase.storage
    .from(PPC_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(PPC_BUCKET).getPublicUrl(path);
  return {
    arquivo_path: path,
    arquivo_url: data?.publicUrl || null,
    arquivo_nome: file.name,
    arquivo_tamanho: file.size,
  };
}

async function removeStoredPpc(path) {
  if (!path) return;
  try {
    await supabase.storage.from(PPC_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Não foi possível remover o PPC antigo:", error);
  }
}

async function savePpcDocument(event) {
  event.preventDefault();
  if (!supabase || !ppcForm) return;

  const formData = new FormData(ppcForm);
  const title = String(formData.get("titulo") || "Projeto Pedagógico do Curso").trim();
  const description = String(formData.get("descricao") || "").trim() || null;
  const externalUrl = String(formData.get("arquivo_url") || "").trim();
  const newFile = ppcFileInput?.files?.[0] || null;

  if (!title) {
    setStatus("Informe o título do documento do PPC.", "error");
    return;
  }

  if (!newFile && !externalUrl && !ppcDocument?.arquivo_url) {
    setStatus("Envie um PDF ou informe um link oficial do PPC.", "error");
    return;
  }

  setPpcFormLoading(true);
  setStatus(newFile ? "Enviando PDF do PPC..." : "Salvando informações do PPC...", "info");

  const oldPath = ppcDocument?.arquivo_path || null;

  try {
    let filePayload = {};

    if (newFile) {
      filePayload = await uploadPpcFile(newFile, title);
    } else if (externalUrl) {
      filePayload = {
        arquivo_url: externalUrl,
        arquivo_path: null,
        arquivo_nome: null,
        arquivo_tamanho: null,
      };
    } else {
      filePayload = {
        arquivo_url: ppcDocument.arquivo_url,
        arquivo_path: ppcDocument.arquivo_path,
        arquivo_nome: ppcDocument.arquivo_nome,
        arquivo_tamanho: ppcDocument.arquivo_tamanho,
      };
    }

    const payload = {
      titulo: title,
      descricao: description,
      ativo: true,
      atualizado_por: currentUser?.id || null,
      ...filePayload,
    };

    if (ppcDocument?.id) {
      const { error } = await supabase.from("ppc_documentos").update(payload).eq("id", ppcDocument.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ppc_documentos")
        .insert({ ...payload, criado_por: currentUser?.id || null });
      if (error) throw error;
    }

    if ((newFile || externalUrl) && oldPath && oldPath !== filePayload.arquivo_path) {
      await removeStoredPpc(oldPath);
    }

    setStatus("PPC publicado/atualizado com sucesso.", "success");
    await loadPpcDocument();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Não foi possível salvar o PPC.", "error");
  } finally {
    setPpcFormLoading(false);
  }
}

async function init() {
  logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));
  panelButtons.forEach((button) => {
    button.addEventListener("click", () => setGradePanel(button.dataset.gradePanelTarget, true));
  });
  clearButton?.addEventListener("click", () => resetForm(true));
  form?.addEventListener("submit", saveComponent);
  ppcForm?.addEventListener("submit", savePpcDocument);
  list?.addEventListener("click", handleListClick);
  filter?.addEventListener("change", renderComponents);

  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setFormLoading(true);
    setPpcFormLoading(true);
    return;
  }

  try {
    const access = await requireAdminAccess();
    if (!access.session) {
      window.location.href = "login.html";
      return;
    }

    if (!access.isAdmin) {
      setStatus("Acesso restrito a administradores.", "error");
      setFormLoading(true);
      setPpcFormLoading(true);
      return;
    }

    currentUser = access.session.user;
    setStatus("Módulo de PPC conectado. Edite a matriz curricular por período e atualize o documento oficial.", "success");
    await loadComponents();
    await loadPpcDocument();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Não foi possível carregar os componentes curriculares.", "error");
  }
}

init();
