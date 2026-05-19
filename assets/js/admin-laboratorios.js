import {
  formatDateTime,
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

const DIAS_LABEL = DIAS.reduce((acc, dia) => ({ ...acc, [dia.value]: dia.label }), {});

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

const TIME_SLOTS = [
  { start: "07:30", end: "08:15" },
  { start: "08:15", end: "09:00" },
  { start: "09:00", end: "09:15", break: true },
  { start: "09:15", end: "10:00" },
  { start: "10:00", end: "10:45" },
  { start: "10:45", end: "11:30" },
  { start: "11:30", end: "12:15" },
  { start: "13:30", end: "14:15" },
  { start: "14:15", end: "15:00" },
  { start: "15:00", end: "15:10", break: true },
  { start: "15:10", end: "15:55" },
  { start: "15:55", end: "16:40" },
  { start: "16:40", end: "17:25" },
  { start: "17:25", end: "18:10" },
  { start: "18:30", end: "19:15" },
  { start: "19:15", end: "20:00" },
  { start: "20:00", end: "20:15", break: true },
  { start: "20:15", end: "21:00" },
  { start: "21:00", end: "21:45" },
  { start: "21:45", end: "22:00" },
];

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
const requestsList = document.querySelector("[data-lab-requests-list]");
const requestsEmpty = document.querySelector("[data-lab-requests-empty]");
const filter = document.querySelector("[data-lab-filter]");
const labCalendarFilter = document.querySelector("[data-lab-calendar-filter]");
const newButton = document.querySelector("[data-new-lab-slot]");
const clearButton = document.querySelector("[data-clear-form]");
const clearLaboratoryButton = document.querySelector("[data-clear-laboratory-form]");
const labSelect = document.querySelector("[data-lab-select]");
const labSummary = document.querySelector("[data-lab-summary]");
const labTabs = document.querySelectorAll("[data-lab-tab-target]");
const labPanels = document.querySelectorAll("[data-lab-panel]");
const labWorkspace = document.querySelector(".admin-lab-workspace");

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

function timeLabel(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function timeToMinutes(value) {
  const [hours = 0, minutes = 0] = formatTime(value).split(":").map(Number);
  return (hours * 60) + minutes;
}

function overlaps(slot, item) {
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);
  const itemStart = timeToMinutes(item.hora_inicio);
  const itemEnd = timeToMinutes(item.hora_fim);
  return itemStart < slotEnd && itemEnd > slotStart;
}

function formatDate(value) {
  if (!value) return "Sem data fixa";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "Sem data fixa";
  return `${day}/${month}/${year}`;
}

function labName(id) {
  const lab = labs.find((item) => item.id === id);
  return lab ? `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}` : "Laboratório";
}

function labCode(id) {
  const lab = labs.find((item) => item.id === id);
  return lab?.codigo || "LAB";
}

function setLabPanel(panelName, shouldScroll = false) {
  labTabs.forEach((tab) => {
    const isActive = tab.dataset.labTabTarget === panelName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  labPanels.forEach((panel) => {
    panel.hidden = panel.dataset.labPanel !== panelName;
  });

  if (shouldScroll) {
    labWorkspace?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  if (labSelect) {
    labSelect.innerHTML = "";

    if (!labs.length) {
      const item = document.createElement("option");
      item.value = "";
      item.textContent = "Cadastre um laboratório primeiro";
      labSelect.appendChild(item);
    } else {
      labs.forEach((lab) => {
        const item = document.createElement("option");
        item.value = lab.id;
        item.textContent = `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}${lab.ativo ? "" : " · inativo"}`;
        labSelect.appendChild(item);
      });
    }
  }

  if (labCalendarFilter) {
    const currentValue = labCalendarFilter.value || "todos";
    labCalendarFilter.innerHTML = '<option value="todos">Todos os laboratórios</option>';
    labs.forEach((lab) => {
      const item = document.createElement("option");
      item.value = lab.id;
      item.textContent = `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}`;
      labCalendarFilter.appendChild(item);
    });
    labCalendarFilter.value = [...labCalendarFilter.options].some((item) => item.value === currentValue) ? currentValue : "todos";
  }
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
  setLabPanel("form", true);
}

function resetLaboratoryForm() {
  laboratoryForm.reset();
  laboratoryForm.elements.id.value = "";
  laboratoryForm.elements.ativo.checked = true;
  laboratoryFormTitle.textContent = "Novo laboratório";
  setEditorMode("laboratory");
  setLabPanel("form", true);
}

function getFilteredReservations() {
  const statusValue = filter?.value || "todos";
  const labValue = labCalendarFilter?.value || "todos";

  return reservations.filter((item) => {
    const matchesLab = labValue === "todos" || item.laboratorio_id === labValue;
    const matchesStatus = statusValue === "todos"
      || (statusValue === "visiveis" && item.visivel)
      || (statusValue === "ocultas" && !item.visivel)
      || item.status === statusValue;

    return matchesLab && matchesStatus;
  });
}

function createPill(label, className = "") {
  const span = document.createElement("span");
  span.className = `admin-pill ${className}`.trim();
  span.textContent = label;
  return span;
}

function createReservationEntry(item) {
  const entry = document.createElement("div");
  entry.className = `admin-lab-calendar-entry is-${item.status || "solicitada"} is-${item.tipo || "reserva"}`;
  entry.dataset.reservationId = item.id;

  const title = document.createElement("strong");
  title.textContent = item.titulo || TIPOS[item.tipo] || "Reserva";
  entry.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = [
    `${formatTime(item.hora_inicio)}-${formatTime(item.hora_fim)}`,
    TIPOS[item.tipo] || item.tipo,
    STATUS[item.status] || item.status,
  ].filter(Boolean).join(" · ");
  entry.appendChild(meta);

  const responsible = document.createElement("small");
  const responsibleName = item.responsavel_nome || "Responsável a confirmar";
  const enrollment = item.responsavel_matricula ? ` · ${item.responsavel_matricula}` : "";
  responsible.textContent = `${responsibleName}${enrollment}`;
  entry.appendChild(responsible);

  const actions = document.createElement("div");
  actions.className = "admin-lab-calendar-actions";
  actions.innerHTML = `
    <button type="button" data-action="edit">Editar</button>
    ${item.status !== "aprovada" ? '<button type="button" data-action="approve">Aprovar</button>' : ""}
    <button type="button" data-action="toggle-visible">${item.visivel ? "Ocultar" : "Mostrar"}</button>
    <button type="button" data-action="delete">Remover</button>
  `;
  entry.appendChild(actions);

  return entry;
}

function createPendingRequestCard(item) {
  const card = document.createElement("article");
  card.className = "admin-lab-request-card";
  card.dataset.reservationId = item.id;

  const responsibleName = item.responsavel_nome || "Aluno sem nome informado";
  const enrollment = item.responsavel_matricula || "Matrícula não informada";
  const contact = item.responsavel_email || "Contato não informado";

  card.innerHTML = `
    <div class="admin-lab-request-top">
      <span>${TIPOS[item.tipo] || "Reserva"}</span>
      <em>${STATUS[item.status] || "Solicitada"}</em>
    </div>
    <strong>${item.titulo || "Reserva de laboratório"}</strong>
    <p>${labName(item.laboratorio_id)} · ${formatDate(item.data_reserva)} · ${DIAS_LABEL[item.dia_semana] || "Dia"} · ${timeLabel(item.hora_inicio, item.hora_fim)}</p>
    <dl>
      <div><dt>Aluno</dt><dd>${responsibleName}</dd></div>
      <div><dt>Matrícula</dt><dd>${enrollment}</dd></div>
      <div><dt>Contato</dt><dd>${contact}</dd></div>
    </dl>
    ${item.finalidade ? `<small>${item.finalidade}</small>` : ""}
    <div class="admin-lab-request-actions">
      <button type="button" data-action="approve">Aprovar</button>
      <button type="button" data-action="edit">Editar</button>
      <button type="button" data-action="delete">Remover</button>
    </div>
  `;

  return card;
}

function renderPendingRequests() {
  if (!requestsList || !requestsEmpty) return;

  const pending = reservations
    .filter((item) => item.status === "solicitada")
    .sort((a, b) => `${a.data_reserva || "9999-99-99"}${a.dia_semana}${a.hora_inicio}`.localeCompare(`${b.data_reserva || "9999-99-99"}${b.dia_semana}${b.hora_inicio}`));

  requestsList.innerHTML = "";
  requestsEmpty.classList.toggle("is-visible", pending.length === 0);

  pending.slice(0, 6).forEach((item) => {
    requestsList.appendChild(createPendingRequestCard(item));
  });

  if (pending.length > 6) {
    const note = document.createElement("p");
    note.className = "admin-lab-request-more";
    note.textContent = `+ ${pending.length - 6} solicitação${pending.length - 6 === 1 ? "" : "es"} pendente${pending.length - 6 === 1 ? "" : "s"} no calendário.`;
    requestsList.appendChild(note);
  }
}

function getLabIdsForCalendar(items) {
  const selectedLab = labCalendarFilter?.value || "todos";
  if (selectedLab !== "todos") return [selectedLab];
  return [...new Set(items.map((item) => item.laboratorio_id))];
}

function renderLabCalendarTable(labId, items) {
  const lab = labs.find((item) => item.id === labId);
  const card = document.createElement("article");
  card.className = "admin-lab-calendar-card";

  const header = document.createElement("header");
  header.className = "admin-schedule-grid-header admin-lab-calendar-header";

  const titleBox = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = labName(labId);
  const subtitle = document.createElement("p");
  subtitle.textContent = lab?.localizacao || "Localização a definir";
  titleBox.append(title, subtitle);

  const pills = document.createElement("div");
  pills.className = "admin-pills";
  pills.appendChild(createPill(`${items.length} registro${items.length === 1 ? "" : "s"}`));
  if (lab?.capacidade) pills.appendChild(createPill(`${lab.capacidade} lugares`));
  header.append(titleBox, pills);
  card.appendChild(header);

  const wrap = document.createElement("div");
  wrap.className = "admin-schedule-table-wrap admin-lab-calendar-wrap";

  const table = document.createElement("table");
  table.className = "admin-schedule-table admin-lab-calendar-table";
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

  TIME_SLOTS.forEach((slot) => {
    const tr = document.createElement("tr");
    if (slot.break) tr.classList.add("is-break-row");

    const timeCell = document.createElement("td");
    timeCell.className = "admin-schedule-time-cell";
    timeCell.textContent = timeLabel(slot.start, slot.end);
    tr.appendChild(timeCell);

    DIAS.forEach((dia) => {
      const td = document.createElement("td");
      const cellItems = items.filter((item) => (
        Number(item.dia_semana) === dia.value && overlaps(slot, item)
      ));

      if (cellItems.length) {
        cellItems
          .sort((a, b) => `${a.hora_inicio}${a.hora_fim}`.localeCompare(`${b.hora_inicio}${b.hora_fim}`))
          .forEach((item) => td.appendChild(createReservationEntry(item)));
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

function renderReservations() {
  if (!list || !empty) return;

  const items = getFilteredReservations();
  const labIds = getLabIdsForCalendar(items);
  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);

  if (!items.length) return;

  labIds
    .sort((a, b) => labName(a).localeCompare(labName(b), "pt-BR", { numeric: true }))
    .forEach((labId) => {
      const groupItems = items.filter((item) => item.laboratorio_id === labId);
      if (groupItems.length) list.appendChild(renderLabCalendarTable(labId, groupItems));
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
  setLabPanel("form", true);
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
  setLabPanel("form", true);
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
  renderPendingRequests();
}

async function saveReservation(event) {
  event.preventDefault();

  const id = form.elements.id.value;
  const payload = getPayload();

  if (!payload.laboratorio_id) {
    setStatus("Cadastre ou selecione um laboratório antes de salvar o horário.", "error");
    return;
  }

  if (payload.hora_fim <= payload.hora_inicio) {
    setStatus("O horário final precisa ser maior que o horário inicial.", "error");
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
    setLabPanel("calendar", true);
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

async function handleReservationAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const entry = button.closest("[data-reservation-id]");
  const id = entry?.dataset.reservationId;
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
}

list?.addEventListener("click", handleReservationAction);
requestsList?.addEventListener("click", handleReservationAction);

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

labTabs.forEach((button) => {
  button.addEventListener("click", () => setLabPanel(button.dataset.labTabTarget, true));
});

filter?.addEventListener("change", renderReservations);
labCalendarFilter?.addEventListener("change", renderReservations);
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
  setStatus("Módulo de laboratórios conectado. Cadastre laboratórios, registre horários ou acompanhe reservas no calendário.", "success");
}

init().catch((error) => {
  setStatus(`Erro ao iniciar módulo: ${error.message}`, "error");
});
