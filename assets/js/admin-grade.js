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

let currentUser = null;
let components = [];

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

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setGradePanel(panelName, shouldScroll = false) {
  const target = panelName === "list" ? "list" : "form";

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

async function init() {
  logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));
  panelButtons.forEach((button) => {
    button.addEventListener("click", () => setGradePanel(button.dataset.gradePanelTarget, true));
  });
  clearButton?.addEventListener("click", () => resetForm(true));
  form?.addEventListener("submit", saveComponent);
  list?.addEventListener("click", handleListClick);
  filter?.addEventListener("change", renderComponents);

  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setFormLoading(true);
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
      return;
    }

    currentUser = access.session.user;
    setStatus("Módulo de PPC conectado. Edite a matriz curricular por período.", "success");
    await loadComponents();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Não foi possível carregar os componentes curriculares.", "error");
  }
}

init();
