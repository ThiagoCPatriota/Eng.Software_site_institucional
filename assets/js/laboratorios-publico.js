import {
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isSupabaseConfigured,
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

let labs = [];
let reservations = [];
let currentSession = null;
let currentProfile = null;

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

function formatDate(value) {
  if (!value) return "Sem data fixa";
  const [year, month, day] = String(value).split("-");
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

function fillStudentIdentity() {
  if (!requestForm || !currentSession) return;
  const nameField = requestForm.querySelector("[name='responsavel_nome']");
  const emailField = requestForm.querySelector("[name='responsavel_email']");
  const name = currentProfile?.nome || currentSession.user.user_metadata?.nome || currentSession.user.email?.split("@")[0] || "Aluno";
  const email = currentSession.user.email || "";

  if (nameField) nameField.value = name;
  if (emailField) emailField.value = email;
}

async function setupRequestAccess() {
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
    setAuthGate(`
      <strong>Solicitação vinculada ao seu perfil.</strong>
      <span>Você está usando a conta ${currentSession.user.email}. A reserva ficará registrada em seu nome.</span>
    `, "success");
  } catch (error) {
    setAuthGate(`Não foi possível validar seu acesso: ${error.message}`, "error");
    setRequestFormEnabled(false);
  }
}

function fillFilters() {
  if (labFilter) {
    labFilter.innerHTML = "";
    labFilter.appendChild(option("todos", "Todos"));
    labs.forEach((lab) => labFilter.appendChild(option(lab.id, `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}`)));
  }

  if (requestSelect) {
    requestSelect.innerHTML = "";
    labs.forEach((lab) => requestSelect.appendChild(option(lab.id, `${lab.nome}${lab.codigo ? ` · ${lab.codigo}` : ""}`)));
  }
}

function renderLabStrip() {
  if (!labStrip) return;
  labStrip.innerHTML = "";

  labs.forEach((lab) => {
    const count = reservations.filter((item) => item.laboratorio_id === lab.id).length;
    const card = document.createElement("article");
    card.className = "lab-card-mini";
    card.innerHTML = `
      <span>${lab.codigo || "LAB"}</span>
      <strong>${lab.nome}</strong>
      <small>${lab.localizacao || "Localização a definir"}</small>
      <p>${lab.capacidade ? `${lab.capacidade} lugares · ` : ""}${count} horário${count === 1 ? "" : "s"} ocupado${count === 1 ? "" : "s"}</p>
    `;
    labStrip.appendChild(card);
  });
}

function getFilteredItems() {
  const labValue = labFilter?.value || "todos";
  const dayValue = dayFilter?.value || "todos";
  const dateValue = dateFilter?.value || "";

  return reservations.filter((item) => {
    if (labValue !== "todos" && item.laboratorio_id !== labValue) return false;
    if (dayValue !== "todos" && Number(item.dia_semana) !== Number(dayValue)) return false;
    if (dateValue && item.data_reserva !== dateValue) return false;
    return true;
  });
}

function buildReservationCard(item) {
  const card = document.createElement("article");
  card.className = `lab-reservation-card is-${item.tipo || "reserva"}`;
  card.innerHTML = `
    <div class="lab-reservation-topline">
      <span>${TIPOS[item.tipo] || item.tipo}</span>
      <strong>${formatTime(item.hora_inicio)} - ${formatTime(item.hora_fim)}</strong>
    </div>
    <h3>${item.titulo || "Horário indisponível"}</h3>
    <p>${item.finalidade || "Sem observação informada."}</p>
    <footer>
      <span>${formatDate(item.data_reserva)} · ${DIAS[item.dia_semana] || "Dia"}</span>
      <strong>${item.responsavel_nome ? `Responsável: ${item.responsavel_nome}` : "Responsável a confirmar"}</strong>
    </footer>
  `;
  return card;
}

function renderBoard() {
  if (!board) return;
  const items = getFilteredItems();
  board.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "lab-empty-state";
    empty.textContent = "Nenhum horário ocupado para os filtros selecionados. Consulte a coordenação antes de considerar o laboratório livre.";
    board.appendChild(empty);
    return;
  }

  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.laboratorio_id)) groups.set(item.laboratorio_id, []);
    groups.get(item.laboratorio_id).push(item);
  });

  [...groups.entries()].forEach(([labId, groupItems]) => {
    const section = document.createElement("article");
    section.className = "lab-group-card";
    section.innerHTML = `
      <header>
        <span>${labCode(labId)}</span>
        <div>
          <h3>${labName(labId)}</h3>
          <p>${groupItems.length} horário${groupItems.length === 1 ? "" : "s"} indisponível${groupItems.length === 1 ? "" : "is"}</p>
        </div>
      </header>
    `;

    const rail = document.createElement("div");
    rail.className = "lab-reservation-rail";
    rail.setAttribute("data-drag-scroll", "");
    groupItems
      .sort((a, b) => `${a.data_reserva || "9999"}${a.dia_semana}${a.hora_inicio}`.localeCompare(`${b.data_reserva || "9999"}${b.dia_semana}${b.hora_inicio}`))
      .forEach((item) => rail.appendChild(buildReservationCard(item)));

    section.appendChild(rail);
    board.appendChild(section);
  });

  setupDragScroll();
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
  renderLabStrip();
  renderBoard();
  setupDragScroll();
  setStatus(labs.length ? "Laboratórios carregados. Horários listados são indisponíveis/reservados." : "Nenhum laboratório cadastrado ainda.", labs.length ? "success" : "info");
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
    finalidade: String(formData.get("finalidade") || "").trim(),
    criado_por: currentSession.user.id,
  };

  setRequestStatus("Enviando solicitação...", "info");
  requestForm.querySelectorAll("input, textarea, select, button").forEach((field) => field.disabled = true);

  try {
    const { error } = await supabase.from("laboratorio_reservas").insert(payload);
    if (error) throw error;
    requestForm.reset();
    fillStudentIdentity();
    setRequestStatus("Solicitação enviada. Ela ficará pendente até a administração aprovar.", "success");
  } catch (error) {
    setRequestStatus(`Erro ao enviar solicitação: ${error.message}`, "error");
  } finally {
    requestForm.querySelectorAll("input, textarea, select, button").forEach((field) => field.disabled = false);
  }
}

[labFilter, dayFilter, dateFilter].forEach((field) => field?.addEventListener("change", renderBoard));
requestForm?.addEventListener("submit", submitRequest);

setupRequestAccess();

loadData().catch((error) => {
  setStatus(`Erro ao carregar laboratórios: ${error.message}`, "error");
});
