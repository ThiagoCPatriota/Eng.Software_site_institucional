import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const DIAS = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
};

const TIPOS = {
  reserva: "Reserva",
  indisponivel: "Indisponível",
  aula: "Aula",
  manutencao: "Manutenção",
  projeto: "Projeto",
  apresentacao: "Apresentação",
};

const STATUS = {
  solicitada: "Solicitada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-lab-form]");
const formTitle = document.querySelector("[data-form-title]");
const laboratoryForm = document.querySelector("[data-laboratory-form]");
const laboratoryFormTitle = document.querySelector("[data-laboratory-form-title]");
const editorModeButtons = document.querySelectorAll("[data-editor-mode]");
const editorPanes = document.querySelectorAll("[data-editor-pane]");
const list = document.querySelector("[data-lab-list]");
const empty = document.querySelector("[data-lab-empty]");
const filter = document.querySelector("[data-lab-filter]");
const newButton = document.querySelector("[data-new-lab-slot]");
const clearButton = document.querySelector("[data-clear-form]");
const clearLaboratoryButton = document.querySelector("[data-clear-laboratory-form]");
const labSelect = document.querySelector("[data-lab-select]");
const labSummary = document.querySelector("[data-lab-summary]");

let currentUser = null;
let labs = [];
let reservations = [];

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setFormLoading(targetForm, isLoading) {
  targetForm?.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function text(value) {
  return value == null ? "" : String(value);
}

function formatTime(value) {
  return text(value).slice(0, 5);
}

function formatDate(value) {
  if (!value) return "Sem data fixa";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function labName(id) {
  const lab = labs.find((item) => item.id === id);
  return lab ? `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}` : "Laboratório";
}

function setupDragScroll() {
  document.querySelectorAll("[data-drag-scroll]").forEach((scroller) => {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    scroller.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      isDown = true;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      scroller.classList.add("is-grabbing");
      scroller.setPointerCapture?.(event.pointerId);
    });

    scroller.addEventListener("pointermove", (event) => {
      if (!isDown) return;
      const walk = event.clientX - startX;
      scroller.scrollLeft = startScroll - walk;
    });

    const stop = () => {
      isDown = false;
      scroller.classList.remove("is-grabbing");
    };

    scroller.addEventListener("pointerup", stop);
    scroller.addEventListener("pointercancel", stop);
    scroller.addEventListener("pointerleave", stop);
  });
}

function setEditorMode(mode) {
  editorModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.editorMode === mode);
  });

  editorPanes.forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.editorPane === mode);
  });
}

function fillLabSelects() {
  if (!labSelect) return;
  labSelect.innerHTML = "";

  if (!labs.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Cadastre um laboratório primeiro";
    labSelect.appendChild(option);
    return;
  }

  labs.forEach((lab) => {
    const option = document.createElement("option");
    option.value = lab.id;
    option.textContent = `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}${lab.ativo ? "" : " · inativo"}`;
    labSelect.appendChild(option);
  });
}

function renderLabSummary() {
  if (!labSummary) return;
  labSummary.innerHTML = "";

  labs.forEach((lab) => {
    const card = document.createElement("article");
    card.className = "admin-lab-summary-card";
    card.dataset.labId = lab.id;

    const total = reservations.filter((item) => item.laboratorio_id === lab.id).length;
    const pending = reservations.filter((item) => item.laboratorio_id === lab.id && item.status === "solicitada").length;

    card.innerHTML = `
      <div class="admin-lab-summary-head">
        <span>${lab.codigo || "LAB"}</span>
        <em class="${lab.ativo ? "is-active" : "is-inactive"}">${lab.ativo ? "ativo" : "inativo"}</em>
      </div>
      <strong>${lab.nome}</strong>
      <small>${lab.localizacao || "Localização a definir"}</small>
      <p>${total} registro${total === 1 ? "" : "s"} · ${pending} pendente${pending === 1 ? "" : "s"}</p>
      <div class="admin-lab-summary-actions">
        <button type="button" data-lab-action="edit-lab">Editar</button>
        <button type="button" data-lab-action="toggle-active">${lab.ativo ? "Desativar" : "Ativar"}</button>
      </div>
    `;
    labSummary.appendChild(card);
  });
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  if (labs[0]) form.elements.laboratorio_id.value = labs[0].id;
  form.elements.tipo.value = "reserva";
  form.elements.status.value = "aprovada";
  form.elements.dia_semana.value = "1";
  form.elements.visivel.value = "true";
  form.elements.hora_inicio.value = "13:30";
  form.elements.hora_fim.value = "15:00";
  formTitle.textContent = "Nova reserva/bloqueio";
  setEditorMode("reservation");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetLaboratoryForm() {
  laboratoryForm.reset();
  laboratoryForm.elements.id.value = "";
  laboratoryForm.elements.ativo.checked = true;
  laboratoryFormTitle.textContent = "Novo laboratório";
  setEditorMode("laboratory");
  laboratoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFilteredReservations() {
  const value = filter?.value || "todos";
  if (value === "todos") return reservations;
  if (value === "visiveis") return reservations.filter((item) => item.visivel);
  if (value === "ocultas") return reservations.filter((item) => !item.visivel);
  return reservations.filter((item) => item.status === value);
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function renderReservations() {
  if (!list || !empty) return;

  const items = getFilteredReservations();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-lab-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.titulo || TIPOS[item.tipo] || "Reserva";
    const meta = document.createElement("small");
    meta.textContent = `${labName(item.laboratorio_id)} · ${formatDate(item.data_reserva)} · ${DIAS[item.dia_semana] || "Dia"} · ${formatTime(item.hora_inicio)}-${formatTime(item.hora_fim)}`;
    headingGroup.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(TIPOS[item.tipo] || item.tipo));
    pills.appendChild(createPill(STATUS[item.status] || item.status, item.status === "aprovada" ? "is-visible" : item.status === "solicitada" ? "is-pending" : "is-hidden"));
    pills.appendChild(createPill(item.visivel ? "visível" : "oculto", item.visivel ? "is-visible" : "is-hidden"));
    header.append(headingGroup, pills);

    const summary = document.createElement("p");
    const responsible = item.responsavel_nome ? `Responsável: ${item.responsavel_nome}` : "Sem responsável informado";
    const enrollment = item.responsavel_matricula ? ` · Matrícula: ${item.responsavel_matricula}` : "";
    const purpose = item.finalidade ? ` · ${item.finalidade}` : "";
    summary.textContent = `${responsible}${enrollment}${purpose}`;

    const footer = document.createElement("small");
    footer.className = "admin-card-footnote";
    footer.textContent = `Origem: ${item.origem === "aluno" ? "solicitação do aluno" : "administração"} · Atualizado em ${formatDateTime(item.atualizado_em || item.criado_em)}`;

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      ${item.status !== "aprovada" ? '<button type="button" data-action="approve">Aprovar</button>' : ''}
      <button type="button" data-action="toggle-visible">${item.visivel ? "Ocultar" : "Mostrar"}</button>
      <button type="button" data-action="delete">Remover</button>
    `;

    card.append(header, summary, footer, actions);
    list.appendChild(card);
  });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.laboratorio_id.value = text(item.laboratorio_id);
  form.elements.tipo.value = text(item.tipo || "reserva");
  form.elements.status.value = text(item.status || "aprovada");
  form.elements.data_reserva.value = text(item.data_reserva);
  form.elements.dia_semana.value = text(item.dia_semana || 1);
  form.elements.visivel.value = String(Boolean(item.visivel));
  form.elements.hora_inicio.value = formatTime(item.hora_inicio);
  form.elements.hora_fim.value = formatTime(item.hora_fim);
  form.elements.titulo.value = text(item.titulo);
  form.elements.responsavel_nome.value = text(item.responsavel_nome);
  form.elements.responsavel_matricula.value = text(item.responsavel_matricula);
  form.elements.responsavel_email.value = text(item.responsavel_email);
  form.elements.finalidade.value = text(item.finalidade);
  formTitle.textContent = "Editar horário de laboratório";
  setEditorMode("reservation");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillLaboratoryForm(lab) {
  laboratoryForm.elements.id.value = text(lab.id);
  laboratoryForm.elements.nome.value = text(lab.nome);
  laboratoryForm.elements.codigo.value = text(lab.codigo);
  laboratoryForm.elements.localizacao.value = text(lab.localizacao);
  laboratoryForm.elements.capacidade.value = text(lab.capacidade);
  laboratoryForm.elements.ativo.checked = Boolean(lab.ativo);
  laboratoryForm.elements.descricao.value = text(lab.descricao);
  laboratoryFormTitle.textContent = "Editar laboratório";
  setEditorMode("laboratory");
  laboratoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const dataReserva = String(formData.get("data_reserva") || "").trim();

  return {
    laboratorio_id: String(formData.get("laboratorio_id") || ""),
    tipo: String(formData.get("tipo") || "reserva"),
    status: String(formData.get("status") || "aprovada"),
    data_reserva: dataReserva || null,
    dia_semana: Number(formData.get("dia_semana") || 1),
    hora_inicio: String(formData.get("hora_inicio") || "13:30"),
    hora_fim: String(formData.get("hora_fim") || "15:00"),
    titulo: String(formData.get("titulo") || "").trim() || "Reserva de laboratório",
    responsavel_nome: String(formData.get("responsavel_nome") || "").trim() || null,
    responsavel_matricula: String(formData.get("responsavel_matricula") || "").trim() || null,
    responsavel_email: String(formData.get("responsavel_email") || "").trim() || null,
    finalidade: String(formData.get("finalidade") || "").trim() || null,
    visivel: String(formData.get("visivel")) === "true",
    atualizado_por: currentUser?.id || null,
  };
}

function getLaboratoryPayload() {
  const formData = new FormData(laboratoryForm);
  const capacidade = Number(formData.get("capacidade") || 0);

  return {
    nome: String(formData.get("nome") || "").trim(),
    codigo: String(formData.get("codigo") || "").trim() || null,
    localizacao: String(formData.get("localizacao") || "").trim() || null,
    capacidade: capacidade > 0 ? capacidade : null,
    descricao: String(formData.get("descricao") || "").trim() || null,
    ativo: Boolean(formData.get("ativo")),
  };
}

async function loadLabs() {
  const { data, error } = await supabase
    .from("laboratorios")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) throw error;
  labs = data || [];
  fillLabSelects();
  renderLabSummary();
}

async function loadReservations() {
  const { data, error } = await supabase
    .from("laboratorio_reservas")
    .select("*")
    .order("status", { ascending: false })
    .order("data_reserva", { ascending: true, nullsFirst: false })
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) throw error;
  reservations = data || [];
  renderLabSummary();
  renderReservations();
}

async function saveReservation(event) {
  event.preventDefault();

  const id = form.elements.id.value;
  const payload = getPayload();

  if (!payload.laboratorio_id) {
    setStatus("Cadastre ou selecione um laboratório antes de salvar o horário.", "error");
    return;
  }

  setFormLoading(form, true);
  setStatus("Salvando horário de laboratório...", "info");

  try {
    if (id) {
      const { error } = await supabase
        .from("laboratorio_reservas")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Horário de laboratório atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("laboratorio_reservas")
        .insert({ ...payload, origem: "admin", criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Horário de laboratório cadastrado com sucesso.", "success");
    }

    resetForm();
    await loadReservations();
  } catch (error) {
    setStatus(`Erro ao salvar horário: ${error.message}`, "error");
  } finally {
    setFormLoading(form, false);
  }
}

async function saveLaboratory(event) {
  event.preventDefault();

  const id = laboratoryForm.elements.id.value;
  const payload = getLaboratoryPayload();

  if (!payload.nome) {
    setStatus("Informe o nome do laboratório antes de salvar.", "error");
    return;
  }

  setFormLoading(laboratoryForm, true);
  setStatus("Salvando laboratório...", "info");

  try {
    if (id) {
      const { error } = await supabase
        .from("laboratorios")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Laboratório atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("laboratorios")
        .insert(payload);
      if (error) throw error;
      setStatus("Laboratório cadastrado com sucesso.", "success");
    }

    resetLaboratoryForm();
    await loadLabs();
    await loadReservations();
  } catch (error) {
    setStatus(`Erro ao salvar laboratório: ${error.message}`, "error");
  } finally {
    setFormLoading(laboratoryForm, false);
  }
}

async function updateReservation(id, patch, successMessage) {
  setStatus("Atualizando horário de laboratório...", "info");
  const { error } = await supabase
    .from("laboratorio_reservas")
    .update({ ...patch, atualizado_por: currentUser?.id || null })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadReservations();
}

async function updateLaboratory(id, patch, successMessage) {
  setStatus("Atualizando laboratório...", "info");
  const { error } = await supabase
    .from("laboratorios")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadLabs();
  await loadReservations();
}

async function deleteReservation(id) {
  const ok = window.confirm("Remover este horário de laboratório? Essa ação apaga o registro do banco.");
  if (!ok) return;

  setStatus("Removendo horário de laboratório...", "info");
  const { error } = await supabase
    .from("laboratorio_reservas")
    .delete()
    .eq("id", id);

  if (error) throw error;
  setStatus("Horário de laboratório removido.", "success");
  await loadReservations();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".admin-lab-card");
  const id = card?.dataset.id;
  const item = reservations.find((reservation) => reservation.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "approve") {
      await updateReservation(id, { status: "aprovada", visivel: true }, "Reserva aprovada e publicada.");
      return;
    }

    if (button.dataset.action === "toggle-visible") {
      await updateReservation(id, { visivel: !item.visivel }, item.visivel ? "Reserva ocultada." : "Reserva publicada.");
      return;
    }

    if (button.dataset.action === "delete") {
      await deleteReservation(id);
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

labSummary?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-lab-action]");
  if (!button) return;

  const card = button.closest("[data-lab-id]");
  const id = card?.dataset.labId;
  const lab = labs.find((item) => item.id === id);
  if (!lab) return;

  try {
    if (button.dataset.labAction === "edit-lab") {
      fillLaboratoryForm(lab);
      return;
    }

    if (button.dataset.labAction === "toggle-active") {
      await updateLaboratory(id, { ativo: !lab.ativo }, lab.ativo ? "Laboratório desativado. Ele não aparecerá para novos estudantes." : "Laboratório ativado e disponível para reservas.");
    }
  } catch (error) {
    setStatus(`Erro ao atualizar laboratório: ${error.message}`, "error");
  }
});

editorModeButtons.forEach((button) => {
  button.addEventListener("click", () => setEditorMode(button.dataset.editorMode));
});

filter?.addEventListener("change", renderReservations);
form?.addEventListener("submit", saveReservation);
laboratoryForm?.addEventListener("submit", saveLaboratory);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
clearLaboratoryButton?.addEventListener("click", resetLaboratoryForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function init() {
  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const access = await requireAdminAccess();
  if (!access.session) {
    window.location.href = "login.html";
    return;
  }

  if (!access.isAdmin) {
    setStatus("Seu usuário não tem permissão para acessar este painel.", "error");
    return;
  }

  currentUser = access.session.user;
  await loadLabs();
  await loadReservations();
  resetForm();
  setupDragScroll();
  setStatus("Módulo de laboratórios conectado. Cadastre bloqueios, aprove solicitações ou registre novos laboratórios.", "success");
}

init().catch((error) => {
  setStatus(`Erro ao iniciar módulo: ${error.message}`, "error");
});
