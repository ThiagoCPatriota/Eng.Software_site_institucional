import {
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isSupabaseConfigured,
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

const labFilter = document.querySelector("[data-lab-filter]");
const dayFilter = document.querySelector("[data-lab-day-filter]");
const dateFilter = document.querySelector("[data-lab-date-filter]");
const labStrip = document.querySelector("[data-lab-strip]");
const board = document.querySelector("[data-lab-board]");
const statusBox = document.querySelector("[data-lab-status]");
const requestForm = document.querySelector("[data-lab-request-form]");
const requestSelect = document.querySelector("[data-lab-request-select]");
const requestStatus = document.querySelector("[data-lab-request-status]");
const authGate = document.querySelector("[data-lab-auth-gate]");
const identityCard = document.querySelector("[data-lab-identity-card]");

let labs = [];
let reservations = [];
let currentSession = null;
let currentProfile = null;
let activeLabIndex = 0;

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setAuthGate(message, type = "info") {
  if (!authGate) return;
  authGate.innerHTML = message;
  authGate.classList.toggle("is-error", type === "error");
  authGate.classList.toggle("is-success", type === "success");
  authGate.classList.toggle("is-warning", type === "warning");
}

function setRequestStatus(message, type = "info") {
  if (!requestStatus) return;
  requestStatus.textContent = message;
  requestStatus.classList.toggle("is-error", type === "error");
  requestStatus.classList.toggle("is-success", type === "success");
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
  return lab ? lab.nome : "Laboratório";
}

function labCode(id) {
  const lab = labs.find((item) => item.id === id);
  return lab?.codigo || "LAB";
}

function setupDragScroll() {
  document.querySelectorAll("[data-drag-scroll]").forEach((scroller) => {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    scroller.addEventListener("pointerdown", (event) => {
      isDown = true;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      scroller.classList.add("is-grabbing");
      scroller.setPointerCapture?.(event.pointerId);
    });

    scroller.addEventListener("pointermove", (event) => {
      if (!isDown) return;
      scroller.scrollLeft = startScroll - (event.clientX - startX);
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

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function getLoginUrl() {
  return `admin/login.html?redirect=${encodeURIComponent("../laboratorios.html#solicitar-reserva")}`;
}

function setRequestFormEnabled(isEnabled) {
  if (!requestForm) return;
  requestForm.querySelectorAll("input, textarea, select, button").forEach((field) => {
    field.disabled = !isEnabled;
  });
}

function renderIdentityCard({ name = "Aluno não conectado", email = "", matricula = "" } = {}) {
  if (!identityCard) return;

  identityCard.innerHTML = `
    <span>Responsável da solicitação</span>
    <strong>${name}</strong>
    <small>${email || "Entre para vincular seu e-mail."}</small>
    <div>
      <b>Matrícula</b>
      <em>${matricula || "Será informada no formulário"}</em>
    </div>
  `;
}

function fillStudentIdentity() {
  if (!requestForm || !currentSession) return;
  const nameField = requestForm.querySelector("[name='responsavel_nome']");
  const emailField = requestForm.querySelector("[name='responsavel_email']");
  const matriculaField = requestForm.querySelector("[name='responsavel_matricula']");

  const name = currentProfile?.nome || currentSession.user.user_metadata?.nome || currentSession.user.email?.split("@")[0] || "Aluno";
  const email = currentSession.user.email || "";
  const matricula = currentProfile?.matricula || currentSession.user.user_metadata?.matricula || "";

  if (nameField) nameField.value = name;
  if (emailField) emailField.value = email;
  if (matriculaField) {
    matriculaField.value = matricula;
    matriculaField.readOnly = Boolean(matricula);
    matriculaField.placeholder = matricula ? "Matrícula vinculada ao perfil" : "Informe sua matrícula";
  }

  renderIdentityCard({ name, email, matricula });
}

async function setupRequestAccess() {
  renderIdentityCard();

  if (!requestForm) return;

  if (!isSupabaseConfigured || !supabase) {
    setAuthGate(getConfigMessage(), "error");
    setRequestFormEnabled(false);
    return;
  }

  try {
    currentSession = await getCurrentSession();
    if (!currentSession) {
      setAuthGate(`
        <strong>Entre para solicitar uma reserva.</strong>
        <span>A consulta dos horários continua aberta, mas a solicitação precisa ficar vinculada a uma conta de estudante.</span>
        <a class="btn btn-primary" href="${getLoginUrl()}">Entrar ou criar conta</a>
      `, "warning");
      setRequestFormEnabled(false);
      return;
    }

    currentProfile = await getOwnProfile(currentSession.user);
    fillStudentIdentity();
    setRequestFormEnabled(true);

    if (currentProfile?.matricula || currentSession.user.user_metadata?.matricula) {
      setAuthGate("", "info");
      return;
    }

    setAuthGate(`
      <strong>Matrícula necessária.</strong>
      <span>Informe sua matrícula no formulário para concluir a solicitação. Ela será salva no seu perfil e vinculada à reserva.</span>
    `, "warning");
  } catch (error) {
    setAuthGate(`Não foi possível validar seu acesso: ${error.message}`, "error");
    setRequestFormEnabled(false);
  }
}

function fillFilters() {
  if (labFilter) {
    const currentValue = labFilter.value || "todos";
    labFilter.innerHTML = "";
    labFilter.appendChild(option("todos", "Todos"));
    labs.forEach((lab) => labFilter.appendChild(option(lab.id, `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}`)));
    labFilter.value = [...labFilter.options].some((item) => item.value === currentValue) ? currentValue : "todos";
  }

  if (requestSelect) {
    requestSelect.innerHTML = "";
    labs.forEach((lab) => requestSelect.appendChild(option(lab.id, `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}`)));
  }
}

function renderLabStrip() {
  if (!labStrip) return;
  labStrip.innerHTML = "";

  if (!labs.length) {
    const empty = document.createElement("div");
    empty.className = "lab-empty-state";
    empty.textContent = "Nenhum laboratório cadastrado para exibir.";
    labStrip.appendChild(empty);
    return;
  }

  const selectedLab = labFilter?.value || "todos";

  labs.forEach((lab) => {
    const count = reservations.filter((item) => item.laboratorio_id === lab.id).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "lab-card-mini";
    card.classList.toggle("is-active", selectedLab === lab.id);
    card.setAttribute("aria-label", `Filtrar por ${lab.nome}`);
    card.innerHTML = `
      <span>${lab.codigo || "LAB"}</span>
      <strong>${lab.nome}</strong>
      <small>${lab.localizacao || "Localização a definir"}</small>
      <p>${lab.capacidade ? `${lab.capacidade} lugares · ` : ""}${count} horário${count === 1 ? "" : "s"} ocupado${count === 1 ? "" : "s"}</p>
    `;
    card.addEventListener("click", () => {
      if (!labFilter) return;
      labFilter.value = lab.id;
      activeLabIndex = 0;
      renderLabStrip();
      renderBoard();
    });
    labStrip.appendChild(card);
  });
}

function getFilteredItems() {
  const labValue = labFilter?.value || "todos";
  const dayValue = dayFilter?.value || "todos";
  const dateValue = dateFilter?.value || "";
  const dayFromDate = getDayFromDate(dateValue);

  return reservations.filter((item) => {
    if (labValue !== "todos" && item.laboratorio_id !== labValue) return false;

    if (dateValue) {
      if (!dayFromDate) return false;
      const matchesExactDate = item.data_reserva === dateValue;
      const matchesRecurringDay = !item.data_reserva && Number(item.dia_semana) === Number(dayFromDate);
      if (!matchesExactDate && !matchesRecurringDay) return false;
      return true;
    }

    if (dayValue !== "todos" && Number(item.dia_semana) !== Number(dayValue)) return false;
    return true;
  });
}

function getVisibleDays() {
  const dateValue = dateFilter?.value || "";
  const dayFromDate = getDayFromDate(dateValue);
  if (dateValue) return dayFromDate ? DIAS.filter((dia) => dia.value === dayFromDate) : [];

  const value = dayFilter?.value || "todos";
  if (value === "todos") return DIAS;
  return DIAS.filter((dia) => String(dia.value) === String(value));
}

function getLabIdsForBoard(items) {
  const selectedLab = labFilter?.value || "todos";
  if (selectedLab !== "todos") return labs.some((lab) => lab.id === selectedLab) ? [selectedLab] : [];
  return labs.length ? labs.map((lab) => lab.id) : [...new Set(items.map((item) => item.laboratorio_id))];
}

function createLabScheduleEntry(item) {
  const entry = document.createElement("div");
  entry.className = `lab-schedule-entry is-${item.tipo || "reserva"}`;
  entry.innerHTML = `
    <strong>${item.titulo || "Horário indisponível"}</strong>
    <span>${formatTime(item.hora_inicio)}-${formatTime(item.hora_fim)} · ${TIPOS[item.tipo] || item.tipo}</span>
    <small>${item.responsavel_nome ? `Responsável: ${item.responsavel_nome}` : "Responsável a confirmar"}</small>
    ${item.finalidade ? `<p>${item.finalidade}</p>` : ""}
  `;
  return entry;
}

function renderLabCalendar(labId, items) {
  const lab = labs.find((item) => item.id === labId);
  const visibleDays = getVisibleDays();
  const card = document.createElement("article");
  card.className = "lab-calendar-card";

  const title = `${labName(labId)}${labCode(labId) !== "LAB" ? ` · ${labCode(labId)}` : ""}`;
  card.innerHTML = `
    <header class="lab-calendar-header">
      <div>
        <span>${labCode(labId)}</span>
        <h3>${title}</h3>
        <p>${lab?.localizacao || "Localização a definir"}${lab?.capacidade ? ` · ${lab.capacidade} lugares` : ""}</p>
      </div>
      <strong>${items.length} horário${items.length === 1 ? "" : "s"} ocupado${items.length === 1 ? "" : "s"}</strong>
    </header>
  `;

  const wrap = document.createElement("div");
  wrap.className = "lab-calendar-wrap";

  const table = document.createElement("table");
  table.className = "lab-calendar-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Horário</th>
        ${visibleDays.map((dia) => `<th>${dia.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  TIME_SLOTS.forEach((slot) => {
    const tr = document.createElement("tr");
    if (slot.break) tr.classList.add("is-break-row");

    const timeCell = document.createElement("td");
    timeCell.className = "lab-calendar-time";
    timeCell.textContent = timeLabel(slot.start, slot.end);
    tr.appendChild(timeCell);

    visibleDays.forEach((dia) => {
      const td = document.createElement("td");
      const cellItems = items.filter((item) => Number(item.dia_semana) === dia.value && overlaps(slot, item));

      if (cellItems.length) {
        cellItems
          .sort((a, b) => `${a.hora_inicio}${a.hora_fim}`.localeCompare(`${b.hora_inicio}${b.hora_fim}`))
          .forEach((item) => td.appendChild(createLabScheduleEntry(item)));
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = slot.break ? "lab-break-cell" : "lab-empty-cell";
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

function renderBoard() {
  if (!board) return;
  const items = getFilteredItems();
  board.innerHTML = "";

  if ((dateFilter?.value || "") && !getDayFromDate(dateFilter.value)) {
    const empty = document.createElement("div");
    empty.className = "lab-empty-state";
    empty.textContent = "Escolha uma data entre segunda e sexta-feira para consultar a grade dos laboratórios.";
    board.appendChild(empty);
    return;
  }

  const labIds = getLabIdsForBoard(items)
    .sort((a, b) => labName(a).localeCompare(labName(b), "pt-BR", { numeric: true }));

  if (!labs.length || !labIds.length) {
    const empty = document.createElement("div");
    empty.className = "lab-empty-state";
    empty.textContent = "Nenhum laboratório disponível para os filtros selecionados.";
    board.appendChild(empty);
    return;
  }

  if (activeLabIndex >= labIds.length) activeLabIndex = labIds.length - 1;
  if (activeLabIndex < 0) activeLabIndex = 0;

  const activeLabId = labIds[activeLabIndex];
  const labItems = items.filter((item) => item.laboratorio_id === activeLabId);

  const carousel = document.createElement("section");
  carousel.className = "lab-calendar-carousel";
  carousel.setAttribute("aria-label", "Navegação entre laboratórios");

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "lab-calendar-nav";
  previous.innerHTML = "‹";
  previous.setAttribute("aria-label", "Laboratório anterior");
  previous.disabled = labIds.length <= 1;
  previous.addEventListener("click", () => {
    activeLabIndex = (activeLabIndex - 1 + labIds.length) % labIds.length;
    renderBoard();
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "lab-calendar-nav";
  next.innerHTML = "›";
  next.setAttribute("aria-label", "Próximo laboratório");
  next.disabled = labIds.length <= 1;
  next.addEventListener("click", () => {
    activeLabIndex = (activeLabIndex + 1) % labIds.length;
    renderBoard();
  });

  const viewport = document.createElement("div");
  viewport.className = "lab-calendar-viewport";
  viewport.appendChild(renderLabCalendar(activeLabId, labItems));

  carousel.appendChild(previous);
  carousel.appendChild(viewport);
  carousel.appendChild(next);
  board.appendChild(carousel);

  if (labIds.length > 1) {
    const rail = document.createElement("div");
    rail.className = "lab-carousel-rail";
    rail.setAttribute("aria-label", "Selecionar laboratório");

    labIds.forEach((labId, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "lab-period-chip";
      chip.classList.toggle("is-active", index === activeLabIndex);
      chip.textContent = `${labCode(labId)} · ${labName(labId)}`;
      chip.addEventListener("click", () => {
        activeLabIndex = index;
        renderBoard();
      });
      rail.appendChild(chip);
    });

    board.appendChild(rail);
  }
}

async function loadData() {
  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const [{ data: labData, error: labError }, { data: reservationData, error: reservationError }] = await Promise.all([
    supabase.from("laboratorios").select("*").eq("ativo", true).order("nome", { ascending: true }),
    supabase
      .from("laboratorio_reservas_publicas")
      .select("*")
      .eq("visivel", true)
      .eq("status", "aprovada")
      .order("data_reserva", { ascending: true, nullsFirst: false })
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true }),
  ]);

  if (labError) throw labError;
  if (reservationError) throw reservationError;

  labs = labData || [];
  reservations = reservationData || [];
  fillFilters();
  activeLabIndex = 0;
  renderLabStrip();
  renderBoard();
  setupDragScroll();
  setStatus(labs.length ? "Laboratórios carregados. Use as setas laterais para alternar entre as grades disponíveis." : "Nenhum laboratório cadastrado ainda.", labs.length ? "success" : "info");
}

function getDayFromDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return day;
}

async function submitRequest(event) {
  event.preventDefault();

  if (!isSupabaseConfigured || !supabase) {
    setRequestStatus(getConfigMessage(), "error");
    return;
  }

  if (!currentSession) {
    setRequestStatus("Entre ou crie sua conta antes de solicitar uma reserva.", "error");
    setAuthGate(`
      <strong>Acesso necessário.</strong>
      <span>Faça login para que a solicitação fique vinculada ao seu perfil.</span>
      <a class="btn btn-primary" href="${getLoginUrl()}">Entrar ou criar conta</a>
    `, "warning");
    return;
  }

  const formData = new FormData(requestForm);
  const dataReserva = String(formData.get("data_reserva") || "");
  const diaSemana = getDayFromDate(dataReserva);
  const horaInicio = String(formData.get("hora_inicio") || "13:30");
  const horaFim = String(formData.get("hora_fim") || "15:00");
  const responsavelMatricula = String(formData.get("responsavel_matricula") || currentProfile?.matricula || currentSession.user.user_metadata?.matricula || "").trim();

  if (!responsavelMatricula) {
    setRequestStatus("Informe sua matrícula para solicitar a reserva do laboratório.", "error");
    return;
  }

  if (!diaSemana) {
    setRequestStatus("Escolha uma data entre segunda e sexta-feira.", "error");
    return;
  }

  if (horaFim <= horaInicio) {
    setRequestStatus("O horário final precisa ser maior que o horário inicial.", "error");
    return;
  }

  const payload = {
    laboratorio_id: String(formData.get("laboratorio_id") || ""),
    tipo: "reserva",
    status: "solicitada",
    origem: "aluno",
    visivel: false,
    data_reserva: dataReserva,
    dia_semana: diaSemana,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    titulo: String(formData.get("titulo") || "").trim(),
    responsavel_nome: currentProfile?.nome || currentSession.user.user_metadata?.nome || currentSession.user.email?.split("@")[0] || "Aluno",
    responsavel_email: currentSession.user.email || String(formData.get("responsavel_email") || "").trim(),
    responsavel_matricula: responsavelMatricula,
    finalidade: String(formData.get("finalidade") || "").trim(),
    criado_por: currentSession.user.id,
  };

  setRequestStatus("Enviando solicitação...", "info");
  requestForm.querySelectorAll("input, textarea, select, button").forEach((field) => field.disabled = true);

  try {
    if (!currentProfile?.matricula) {
      const { error: profileError } = await supabase
        .from("site_profiles")
        .update({ matricula: responsavelMatricula })
        .eq("user_id", currentSession.user.id);

      if (profileError) throw profileError;
      currentProfile = { ...(currentProfile || {}), matricula: responsavelMatricula };
      fillStudentIdentity();
    }

    const { error } = await supabase.from("laboratorio_reservas").insert(payload);
    if (error) throw error;
    requestForm.reset();
    fillStudentIdentity();
    setRequestStatus("Solicitação enviada com matrícula vinculada. Ela ficará pendente até a administração aprovar.", "success");
  } catch (error) {
    setRequestStatus(`Erro ao enviar solicitação: ${error.message}`, "error");
  } finally {
    requestForm.querySelectorAll("input, textarea, select, button").forEach((field) => field.disabled = false);
  }
}

function handleFilterChange() {
  activeLabIndex = 0;
  renderLabStrip();
  renderBoard();
}

[labFilter, dayFilter, dateFilter].forEach((field) => field?.addEventListener("change", handleFilterChange));
requestForm?.addEventListener("submit", submitRequest);

setupRequestAccess();

loadData().catch((error) => {
  setStatus(`Erro ao carregar laboratórios: ${error.message}`, "error");
});
