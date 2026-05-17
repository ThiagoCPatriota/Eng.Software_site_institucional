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

const TURNOS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-schedule-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-schedule-list]");
const empty = document.querySelector("[data-schedule-empty]");
const filter = document.querySelector("[data-schedule-filter]");
const newButton = document.querySelector("[data-new-schedule]");
const clearButton = document.querySelector("[data-clear-form]");

let currentUser = null;
let schedules = [];

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

function formatTime(value) {
  return text(value).slice(0, 5);
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.semestre_letivo.value = "2026.1";
  form.elements.periodo.value = "1";
  form.elements.turno.value = "manha";
  form.elements.dia_semana.value = "1";
  form.elements.tipo.value = "aula";
  form.elements.hora_inicio.value = "07:30";
  form.elements.hora_fim.value = "08:15";
  formTitle.textContent = "Nova aula";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFilteredSchedules() {
  const value = filter?.value || "todos";
  if (value === "todos") return schedules;
  if (value === "ocultos") return schedules.filter((item) => !item.visivel);
  return schedules.filter((item) => item.turno === value && item.visivel);
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function renderSchedules() {
  if (!list || !empty) return;

  const items = getFilteredSchedules();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-publication-card admin-schedule-card";
    card.dataset.id = item.id;

    const header = document.createElement("header");
    const headingGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.tipo === "intervalo" ? "Intervalo" : item.disciplina;
    const meta = document.createElement("small");
    meta.textContent = `${item.periodo}º período · ${TURNOS[item.turno] || item.turno} · ${DIAS[item.dia_semana] || "Dia"} · ${formatTime(item.hora_inicio)}-${formatTime(item.hora_fim)}`;
    headingGroup.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "admin-pills";
    pills.appendChild(createPill(item.semestre_letivo));
    if (item.turma) pills.appendChild(createPill(`Turma ${item.turma}`));
    pills.appendChild(createPill(item.visivel ? "visível" : "oculto", item.visivel ? "is-visible" : "is-hidden"));
    header.append(headingGroup, pills);

    const summary = document.createElement("p");
    summary.textContent = [item.professor, item.sala, item.observacao].filter(Boolean).join(" · ") || "Sem professor/sala informados.";

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.innerHTML = `
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="toggle-visible">${item.visivel ? "Ocultar" : "Mostrar"}</button>
      <button type="button" data-action="delete">Remover</button>
    `;

    card.append(header, summary, actions);
    list.appendChild(card);
  });
}

function fillForm(item) {
  form.elements.id.value = text(item.id);
  form.elements.semestre_letivo.value = text(item.semestre_letivo);
  form.elements.turma.value = text(item.turma);
  form.elements.periodo.value = text(item.periodo || 1);
  form.elements.turno.value = text(item.turno || "manha");
  form.elements.dia_semana.value = text(item.dia_semana || 1);
  form.elements.tipo.value = text(item.tipo || "aula");
  form.elements.hora_inicio.value = formatTime(item.hora_inicio);
  form.elements.hora_fim.value = formatTime(item.hora_fim);
  form.elements.disciplina.value = text(item.disciplina);
  form.elements.professor.value = text(item.professor);
  form.elements.sala.value = text(item.sala);
  form.elements.observacao.value = text(item.observacao);
  formTitle.textContent = "Editar horário";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPayload() {
  const formData = new FormData(form);
  const tipo = String(formData.get("tipo") || "aula");
  const disciplina = String(formData.get("disciplina") || "").trim() || (tipo === "intervalo" ? "Intervalo" : "Aula");

  return {
    semestre_letivo: String(formData.get("semestre_letivo") || "").trim(),
    turma: String(formData.get("turma") || "").trim() || null,
    periodo: Number(formData.get("periodo") || 1),
    turno: String(formData.get("turno") || "manha"),
    dia_semana: Number(formData.get("dia_semana") || 1),
    tipo,
    hora_inicio: String(formData.get("hora_inicio") || "07:30"),
    hora_fim: String(formData.get("hora_fim") || "08:15"),
    disciplina,
    professor: String(formData.get("professor") || "").trim() || null,
    sala: String(formData.get("sala") || "").trim() || null,
    observacao: String(formData.get("observacao") || "").trim() || null,
    atualizado_por: currentUser?.id || null,
  };
}

async function loadSchedules() {
  const { data, error } = await supabase
    .from("horarios_aulas")
    .select("*")
    .order("semestre_letivo", { ascending: false })
    .order("periodo", { ascending: true })
    .order("turno", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .order("dia_semana", { ascending: true });

  if (error) throw error;
  schedules = data || [];
  renderSchedules();
}

async function saveSchedule(event) {
  event.preventDefault();

  const id = form.elements.id.value;
  const payload = getPayload();

  setFormLoading(true);
  setStatus("Salvando horário...", "info");

  try {

    if (id) {
      const { error } = await supabase
        .from("horarios_aulas")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      setStatus("Horário atualizado com sucesso.", "success");
    } else {
      const { error } = await supabase
        .from("horarios_aulas")
        .insert({ ...payload, visivel: true, criado_por: currentUser?.id || null });
      if (error) throw error;
      setStatus("Horário cadastrado com sucesso.", "success");
    }

    resetForm();
    await loadSchedules();
  } catch (error) {
    setStatus(`Erro ao salvar horário: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

async function updateSchedule(id, patch, successMessage) {
  setStatus("Atualizando horário...", "info");
  const { error } = await supabase
    .from("horarios_aulas")
    .update({ ...patch, atualizado_por: currentUser?.id || null })
    .eq("id", id);

  if (error) throw error;
  setStatus(successMessage, "success");
  await loadSchedules();
}

async function deleteSchedule(id) {
  const ok = window.confirm("Remover este horário? Essa ação apaga o registro do banco.");
  if (!ok) return;

  setStatus("Removendo horário...", "info");
  const { error } = await supabase
    .from("horarios_aulas")
    .delete()
    .eq("id", id);

  if (error) throw error;
  setStatus("Horário removido.", "success");
  await loadSchedules();
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".admin-schedule-card");
  const id = card?.dataset.id;
  const item = schedules.find((schedule) => schedule.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
      return;
    }

    if (button.dataset.action === "toggle-visible") {
      await updateSchedule(
        id,
        { visivel: !item.visivel },
        item.visivel ? "Horário ocultado da página pública." : "Horário liberado na página pública."
      );
      return;
    }

    if (button.dataset.action === "delete") {
      await deleteSchedule(id);
    }
  } catch (error) {
    setStatus(`Erro na ação: ${error.message}`, "error");
  }
});

filter?.addEventListener("change", renderSchedules);
form?.addEventListener("submit", saveSchedule);
newButton?.addEventListener("click", resetForm);
clearButton?.addEventListener("click", resetForm);
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function bootSchedules() {
  if (!isSupabaseConfigured) {
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
    window.location.href = "index.html";
    return;
  }

  currentUser = access.session.user;
  setStatus("Módulo de horários conectado. Cadastre as primeiras aulas do semestre.", "success");
  await loadSchedules();
}

bootSchedules().catch((error) => {
  setStatus(`Erro ao carregar horários: ${error.message}`, "error");
});
