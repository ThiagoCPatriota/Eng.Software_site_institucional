import {
  getConfigMessage,
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

const TURNOS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const board = document.querySelector("[data-schedule-board]");
const statusBox = document.querySelector("[data-schedule-status]");
const semesterSelect = document.querySelector("[data-schedule-semester]");
const periodSelect = document.querySelector("[data-schedule-period]");
const shiftSelect = document.querySelector("[data-schedule-shift]");

let horarios = [];

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.toggle("is-error", type === "error");
}

function normalize(value) {
  return value == null ? "" : String(value);
}

function formatTime(value) {
  return normalize(value).slice(0, 5);
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function uniqueSorted(values, fallback) {
  const items = [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
  return items.length ? items : fallback;
}

function fillFilters() {
  const semesters = uniqueSorted(horarios.map((item) => item.semestre_letivo), ["2026.1"]);
  const periods = uniqueSorted(horarios.map((item) => item.periodo), [1, 2, 3, 4, 5, 6, 7, 8]);
  const shifts = uniqueSorted(horarios.map((item) => item.turno), ["manha", "tarde", "noite"]);

  semesterSelect.innerHTML = "";
  semesters.forEach((semester) => semesterSelect.appendChild(option(semester, semester)));

  periodSelect.innerHTML = "";
  periodSelect.appendChild(option("todos", "Todos os períodos"));
  periods.forEach((period) => periodSelect.appendChild(option(period, `${period}º período`)));

  shiftSelect.innerHTML = "";
  shiftSelect.appendChild(option("todos", "Todos os turnos"));
  shifts.forEach((shift) => shiftSelect.appendChild(option(shift, TURNOS[shift] || shift)));
}

function getFilteredItems() {
  const semester = semesterSelect.value;
  const period = periodSelect.value;
  const shift = shiftSelect.value;

  return horarios.filter((item) => {
    const matchesSemester = !semester || item.semestre_letivo === semester;
    const matchesPeriod = period === "todos" || String(item.periodo) === String(period);
    const matchesShift = shift === "todos" || item.turno === shift;
    return matchesSemester && matchesPeriod && matchesShift;
  });
}

function groupKey(item) {
  return `${item.semestre_letivo}__${item.periodo}__${item.turno}__${item.turma || ""}`;
}

function buildClassCard(item) {
  const card = document.createElement("div");
  card.className = `schedule-class-card ${item.tipo === "intervalo" ? "is-break" : ""}`.trim();

  const title = document.createElement("strong");
  title.textContent = item.tipo === "intervalo" ? "Intervalo" : item.disciplina;
  card.appendChild(title);

  if (item.tipo !== "intervalo" && item.professor) {
    const teacher = document.createElement("span");
    teacher.textContent = item.professor;
    card.appendChild(teacher);
  }

  if (item.sala) {
    const room = document.createElement("small");
    room.textContent = item.sala;
    card.appendChild(room);
  }

  if (item.observacao) {
    const note = document.createElement("small");
    note.textContent = item.observacao;
    card.appendChild(note);
  }

  return card;
}

function renderGroup(items, key) {
  const [semestre, periodo, turno, turma] = key.split("__");
  const card = document.createElement("article");
  card.className = "schedule-table-card";

  const header = document.createElement("header");
  header.className = "schedule-table-header";
  header.innerHTML = `
    <div>
      <span class="eyebrow">${TURNOS[turno] || turno}</span>
      <h3>${periodo}º período${turma ? ` · Turma ${turma}` : ""}</h3>
      <p>Semestre ${semestre}. Aulas organizadas por dia e horário.</p>
    </div>
    <span class="status-badge">${items.length} registro${items.length === 1 ? "" : "s"}</span>
  `;
  card.appendChild(header);

  const times = [...new Set(items.map((item) => `${formatTime(item.hora_inicio)} - ${formatTime(item.hora_fim)}`))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const wrap = document.createElement("div");
  wrap.className = "schedule-table-wrap";

  const table = document.createElement("table");
  table.className = "schedule-table";
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
  times.forEach((time) => {
    const tr = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.className = "schedule-time-cell";
    timeCell.textContent = time;
    tr.appendChild(timeCell);

    DIAS.forEach((dia) => {
      const td = document.createElement("td");
      const cell = document.createElement("div");
      cell.className = "schedule-class-cell";
      const dayItems = items.filter((item) => item.dia_semana === dia.value && `${formatTime(item.hora_inicio)} - ${formatTime(item.hora_fim)}` === time);

      if (dayItems.length) {
        dayItems.forEach((item) => cell.appendChild(buildClassCard(item)));
      } else {
        const empty = document.createElement("span");
        empty.className = "schedule-empty-cell";
        empty.textContent = "—";
        cell.appendChild(empty);
      }

      td.appendChild(cell);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

function renderSchedule() {
  if (!board) return;
  const items = getFilteredItems();
  board.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "schedule-empty-state";
    empty.textContent = "Nenhum horário encontrado para os filtros selecionados.";
    board.appendChild(empty);
    return;
  }

  const groups = new Map();
  items.forEach((item) => {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
    .forEach(([key, groupItems]) => {
      board.appendChild(renderGroup(groupItems, key));
    });
}

async function loadSchedule() {
  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const { data, error } = await supabase
    .from("horarios_aulas")
    .select("*")
    .eq("visivel", true)
    .order("semestre_letivo", { ascending: false })
    .order("periodo", { ascending: true })
    .order("turno", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .order("dia_semana", { ascending: true });

  if (error) throw error;
  horarios = data || [];

  fillFilters();
  renderSchedule();
  setStatus(horarios.length ? "Horários carregados com sucesso." : "Nenhum horário cadastrado ainda. Peça à administração para preencher o módulo.", horarios.length ? "success" : "info");
}

[semesterSelect, periodSelect, shiftSelect].forEach((select) => {
  select?.addEventListener("change", renderSchedule);
});

loadSchedule().catch((error) => {
  setStatus(`Erro ao carregar horários: ${error.message}`, "error");
});
