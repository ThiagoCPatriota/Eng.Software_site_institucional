import {
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const DIAS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
];

const TURNOS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const TIME_SLOTS = {
  manha: [
    { start: "07:30", end: "08:15" },
    { start: "08:15", end: "09:00" },
    { start: "09:00", end: "09:15", break: true },
    { start: "09:15", end: "10:00" },
    { start: "10:00", end: "10:45" },
    { start: "10:45", end: "11:30" },
    { start: "11:30", end: "12:15" },
  ],
  tarde: [
    { start: "13:30", end: "14:15" },
    { start: "14:15", end: "15:00" },
    { start: "15:00", end: "15:10", break: true },
    { start: "15:10", end: "15:55" },
    { start: "15:55", end: "16:40" },
    { start: "16:40", end: "17:25" },
    { start: "17:25", end: "18:10" },
  ],
  noite: [
    { start: "18:30", end: "19:15" },
    { start: "19:15", end: "20:00" },
    { start: "20:00", end: "20:15", break: true },
    { start: "20:15", end: "21:00" },
    { start: "21:00", end: "21:45" },
    { start: "21:45", end: "22:30" },
  ],
};

const statusBox = document.querySelector("[data-admin-status]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");
const form = document.querySelector("[data-schedule-form]");
const formTitle = document.querySelector("[data-form-title]");
const list = document.querySelector("[data-schedule-list]");
const empty = document.querySelector("[data-schedule-empty]");
const filter = document.querySelector("[data-schedule-filter]");
const periodFilter = document.querySelector("[data-schedule-period-filter]");
const newButton = document.querySelector("[data-new-schedule]");
const clearButton = document.querySelector("[data-clear-form]");
const scheduleTabs = document.querySelectorAll("[data-schedule-tab-target]");
const schedulePanels = document.querySelectorAll("[data-schedule-panel]");
const scheduleWorkspace = document.querySelector(".admin-schedule-workspace");

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

function timeKey(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function timeLabel(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function setSchedulePanel(panelName, shouldScroll = false) {
  scheduleTabs.forEach((tab) => {
    const isActive = tab.dataset.scheduleTabTarget === panelName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  schedulePanels.forEach((panel) => {
    panel.hidden = panel.dataset.schedulePanel !== panelName;
  });

  if (shouldScroll) {
    scheduleWorkspace?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  setSchedulePanel("form", true);
}

function getFilteredSchedules() {
  const value = filter?.value || "todos";
  const periodValue = periodFilter?.value || "todos";

  return schedules.filter((item) => {
    const matchesPeriod = periodValue === "todos" || String(item.periodo) === String(periodValue);
    const matchesTurno = value === "todos" || item.turno === value;
    return matchesPeriod && matchesTurno;
  });
}

function groupKey(item) {
  return [
    item.semestre_letivo || "Sem semestre",
    item.periodo || 1,
    item.turno || "manha",
    item.turma || "",
  ].join("__");
}

function getTimeRows(items, turno) {
  const slotMap = new Map();

  (TIME_SLOTS[turno] || []).forEach((slot) => {
    slotMap.set(`${slot.start}-${slot.end}`, { ...slot });
  });

  items.forEach((item) => {
    const start = formatTime(item.hora_inicio);
    const end = formatTime(item.hora_fim);
    if (!start || !end) return;
    const key = `${start}-${end}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, { start, end, break: item.tipo === "intervalo" });
    }
  });

  return [...slotMap.values()].sort((a, b) => `${a.start}-${a.end}`.localeCompare(`${b.start}-${b.end}`, "pt-BR"));
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function createScheduleEntry(item) {
  const entry = document.createElement("div");
  entry.className = `admin-schedule-grid-entry ${item.tipo === "intervalo" ? "is-break" : ""}`.trim();
  entry.dataset.scheduleId = item.id;

  const title = document.createElement("strong");
  title.textContent = item.tipo === "intervalo" ? "Intervalo" : item.disciplina;
  entry.appendChild(title);

  const details = [item.professor, item.sala, item.observacao].filter(Boolean);
  if (details.length) {
    const meta = document.createElement("span");
    meta.textContent = details.join(" · ");
    entry.appendChild(meta);
  }

  const actions = document.createElement("div");
  actions.className = "admin-schedule-grid-actions";
  actions.innerHTML = `
    <button type="button" data-action="edit">Editar</button>
    <button type="button" data-action="delete">Remover</button>
  `;
  entry.appendChild(actions);

  return entry;
}

function renderScheduleTable(items, key) {
  const [semestre, periodo, turno, turma] = key.split("__");
  const card = document.createElement("article");
  card.className = "admin-schedule-grid-card";

  const header = document.createElement("header");
  header.className = "admin-schedule-grid-header";

  const titleBox = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = `${periodo}º período · ${TURNOS[turno] || turno}`;
  const subtitle = document.createElement("p");
  subtitle.textContent = `${semestre}${turma ? ` · Turma ${turma}` : ""}`;
  titleBox.append(title, subtitle);

  const pills = document.createElement("div");
  pills.className = "admin-pills";
  pills.appendChild(createPill(`${items.length} registro${items.length === 1 ? "" : "s"}`));
  header.append(titleBox, pills);
  card.appendChild(header);

  const wrap = document.createElement("div");
  wrap.className = "admin-schedule-table-wrap";

  const table = document.createElement("table");
  table.className = "admin-schedule-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Horário</th>
        ${DIAS.map((dia) => `<th>${dia.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  const rows = getTimeRows(items, turno);

  rows.forEach((slot) => {
    const tr = document.createElement("tr");
    if (slot.break) tr.classList.add("is-break-row");

    const timeCell = document.createElement("td");
    timeCell.className = "admin-schedule-time-cell";
    timeCell.textContent = timeLabel(slot.start, slot.end);
    tr.appendChild(timeCell);

    DIAS.forEach((dia) => {
      const td = document.createElement("td");
      const cellItems = items.filter((item) => (
        Number(item.dia_semana) === dia.value &&
        timeKey(item.hora_inicio, item.hora_fim) === `${slot.start}-${slot.end}`
      ));

      if (cellItems.length) {
        cellItems.forEach((item) => td.appendChild(createScheduleEntry(item)));
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = slot.break ? "admin-schedule-break-placeholder" : "admin-schedule-empty-slot";
        placeholder.textContent = slot.break ? "Intervalo" : "Livre";
        td.appendChild(placeholder);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

function renderSchedules() {
  if (!list || !empty) return;

  const items = getFilteredSchedules();
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  if (!items.length) return;

  const groups = new Map();
  items.forEach((item) => {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
    .forEach(([key, groupItems]) => {
      list.appendChild(renderScheduleTable(groupItems, key));
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
  setSchedulePanel("form", true);
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
    visivel: true,
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
    setSchedulePanel("list", true);
  } catch (error) {
    setStatus(`Erro ao salvar horário: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
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

  const entry = button.closest("[data-schedule-id]");
  const id = entry?.dataset.scheduleId;
  const item = schedules.find((schedule) => schedule.id === id);
  if (!item) return;

  try {
    if (button.dataset.action === "edit") {
      fillForm(item);
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
periodFilter?.addEventListener("change", renderSchedules);
scheduleTabs.forEach((tab) => {
  tab.addEventListener("click", () => setSchedulePanel(tab.dataset.scheduleTabTarget || "form", false));
});
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
  setSchedulePanel("form", false);
  setStatus("Módulo de horários conectado. A visualização semanal facilita a conferência por período e turno.", "success");
  await loadSchedules();
}

bootSchedules().catch((error) => {
  setStatus(`Erro ao carregar horários: ${error.message}`, "error");
});
