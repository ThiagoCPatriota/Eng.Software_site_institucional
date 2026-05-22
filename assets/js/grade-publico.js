import { isSupabaseConfigured, supabase } from "./supabase-client.js";

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

const FALLBACK_COMPONENTS = [
  {
    "periodo": 1,
    "ordem": 1,
    "codigo": "CBBJ.10",
    "nome": "Comunicação e Expressão",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 2,
    "codigo": "CBBJ.6",
    "nome": "Ética, Normas e Postura Profissional",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 3,
    "codigo": "CBBJ.11",
    "nome": "Introdução à Engenharia de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 4,
    "codigo": "CBBJ.9",
    "nome": "Introdução à Programação",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 5,
    "codigo": "CBBJ.1",
    "nome": "Língua Inglesa I",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 6,
    "codigo": "CBBJ.7",
    "nome": "Matemática Discreta",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 1,
    "ordem": 7,
    "codigo": "CBBJ.8",
    "nome": "Sistemas Digitais",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 1,
    "codigo": "CBBJ.14",
    "nome": "Algoritmos e Estrutura de Dados",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.9",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 2,
    "codigo": "CBBJ.13",
    "nome": "Cálculo Aplicado à Informática",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.7",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 3,
    "codigo": "CBBJ.16",
    "nome": "Introdução à Geometria Analítica e Álgebra Linear",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.7",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 4,
    "codigo": "CBBJ.12",
    "nome": "Língua Inglesa II",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "CBBJ.1",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 5,
    "codigo": "CBBJ.17",
    "nome": "Organização e Arquitetura de Computadores",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.8",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 2,
    "ordem": 6,
    "codigo": "CBBJ.15",
    "nome": "Processo de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.11",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 1,
    "codigo": "CBBJ.22",
    "nome": "Banco de Dados I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.7",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 2,
    "codigo": "CBBJ.23",
    "nome": "Engenharia de Requisitos",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.15",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 3,
    "codigo": "CBBJ.20",
    "nome": "Estatística e Probabilidade Aplicada",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.13",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 4,
    "codigo": "CBBJ.18",
    "nome": "Língua Inglesa III",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "CBBJ.12",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 5,
    "codigo": "CBBJ.24",
    "nome": "Metodologia Científica",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 6,
    "codigo": "CBBJ.19",
    "nome": "Programação Orientada à Objetos",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.14",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 3,
    "ordem": 7,
    "codigo": "CBBJ.21",
    "nome": "Sistemas Operacionais",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.17",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 1,
    "codigo": "CBBJ.31",
    "nome": "Banco de Dados II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.22",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 2,
    "codigo": "CBBJ.27",
    "nome": "Desenvolvimento Web",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.14",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 3,
    "codigo": "CBBJ.28",
    "nome": "Economia para Engenharia de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.23",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 4,
    "codigo": "CBBJ.30",
    "nome": "Interação Humano Computador",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.10",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 5,
    "codigo": "CBBJ.25",
    "nome": "Língua Inglesa IV",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "CBBJ.18",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 6,
    "codigo": "CBBJ.29",
    "nome": "Projeto de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.15",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 4,
    "ordem": 7,
    "codigo": "CBBJ.26",
    "nome": "Redes de Computadores I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.21",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 1,
    "codigo": "CBBJ.36",
    "nome": "Arquitetura de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.29",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 2,
    "codigo": "CBBJ.34",
    "nome": "Gerência de Projetos de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.29",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 3,
    "codigo": "CBBJ.32",
    "nome": "Língua Inglesa V",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "CBBJ.25",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 4,
    "codigo": "CBBJ.35",
    "nome": "Modelagem de Processos de Negócios",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.28",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 5,
    "codigo": "CBBJ.37",
    "nome": "Padrões de Projetos de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.29",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 6,
    "codigo": "CBBJ.33",
    "nome": "Programação para Dispositivos Móveis",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.19",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 7,
    "codigo": "CBBJ.38",
    "nome": "Redes de Computadores II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.26",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 5,
    "ordem": 8,
    "codigo": "CBBJ.41",
    "nome": "Gerência de Configuração e Mudanças",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.34",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 1,
    "codigo": "CBBJ.39",
    "nome": "Língua Inglesa VI",
    "carga_horaria": 30,
    "creditos": 2,
    "pre_requisitos": "CBBJ.32",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 2,
    "codigo": "CBBJ.42",
    "nome": "Projeto Integrador",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.29",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 3,
    "codigo": "CBBJ.43",
    "nome": "Qualidade de Software",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.34",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 4,
    "codigo": "CBBJ.44",
    "nome": "Sistemas Paralelos e Distribuídos",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.29",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 5,
    "codigo": "CBBJ.40",
    "nome": "Verificação e Validação de Software",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.34",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 6,
    "codigo": "CBBJ.46",
    "nome": "Empreendedorismo e Inovação",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 7,
    "codigo": "CBBJ.48",
    "nome": "Engenharia de Software Educacional",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.11",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 8,
    "codigo": "CBBJ.52",
    "nome": "Libras",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 6,
    "ordem": 9,
    "codigo": "CBBJ.45",
    "nome": "Metodologia da Pesquisa I",
    "carga_horaria": 90,
    "creditos": 6,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 1,
    "codigo": "CBBJ.47",
    "nome": "Segurança e Auditoria de Sistemas",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.44",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 2,
    "codigo": "CBBJ.55",
    "nome": "Tópicos Avançados em Banco de Dados I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 3,
    "codigo": "CBBJ.59",
    "nome": "Tópicos Avançados em TIC I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 4,
    "codigo": "CBBJ.53",
    "nome": "Tópicos Avançados em Programação I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 5,
    "codigo": "CBBJ.57",
    "nome": "Tópicos Avançados em Redes de Computadores I",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 6,
    "codigo": "CBBJ.50",
    "nome": "Eng. de Software para Desenvolvimento de Jogos",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.11",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 7,
    "codigo": "CBBJ.51",
    "nome": "Introdução aos Sistemas Inteligentes",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 7,
    "ordem": 8,
    "codigo": "CBBJ.49",
    "nome": "Metodologia da Pesquisa II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.45",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 8,
    "ordem": 1,
    "codigo": "CBBJ.56",
    "nome": "Tópicos Avançados em Banco de Dados II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 8,
    "ordem": 2,
    "codigo": "CBBJ.60",
    "nome": "Tópicos Avançados em TIC II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 8,
    "ordem": 3,
    "codigo": "CBBJ.54",
    "nome": "Tópicos Avançados em Programação II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  },
  {
    "periodo": 8,
    "ordem": 4,
    "codigo": "CBBJ.58",
    "nome": "Tópicos Avançados em Redes de Computadores II",
    "carga_horaria": 60,
    "creditos": 4,
    "pre_requisitos": "CBBJ.42",
    "tipo": "obrigatorio",
    "visivel": true
  }
];

const tabsContainer = document.querySelector("[data-curriculum-tabs]");
const panelsContainer = document.querySelector("[data-curriculum-panels]");
const empty = document.querySelector("[data-curriculum-empty]");
const ppcCard = document.querySelector("[data-ppc-card]");
const ppcStatus = document.querySelector("[data-ppc-status]");
const ppcTitle = document.querySelector("[data-ppc-title]");
const ppcDescription = document.querySelector("[data-ppc-description]");
const ppcUpdated = document.querySelector("[data-ppc-updated]");
const ppcLink = document.querySelector("[data-ppc-link]");

let components = [];

function text(value) {
  return value == null ? "" : String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function renderPpcDocument(documento) {
  if (!ppcCard) return;

  const hasDocument = Boolean(documento?.arquivo_url);
  ppcCard.classList.toggle("has-document", hasDocument);

  if (!hasDocument) {
    if (ppcStatus) ppcStatus.textContent = "PPC a publicar";
    if (ppcTitle) ppcTitle.textContent = "Documento do PPC ainda não publicado";
    if (ppcDescription) {
      ppcDescription.textContent = "Assim que a coordenação enviar ou vincular o PDF oficial pelo painel administrativo, o acesso ficará disponível aqui sem depender de arquivo fixo no HTML.";
    }
    if (ppcUpdated) ppcUpdated.textContent = "";
    if (ppcLink) ppcLink.hidden = true;
    return;
  }

  if (ppcStatus) ppcStatus.textContent = "PPC disponível";
  if (ppcTitle) ppcTitle.textContent = documento.titulo || "Projeto Pedagógico do Curso";
  if (ppcDescription) {
    ppcDescription.textContent = documento.descricao || "Documento oficial do curso disponível para consulta pública.";
  }

  const updated = formatDate(documento.atualizado_em || documento.criado_em);
  const size = formatFileSize(documento.arquivo_tamanho);
  if (ppcUpdated) {
    ppcUpdated.textContent = [updated ? `Atualizado em ${updated}` : "", size ? `Arquivo: ${size}` : ""]
      .filter(Boolean)
      .join(" • ");
  }

  if (ppcLink) {
    ppcLink.href = documento.arquivo_url;
    ppcLink.hidden = false;
    ppcLink.textContent = documento.arquivo_nome ? "Abrir PPC em PDF" : "Abrir PPC";
  }
}

async function loadPpcDocument() {
  if (!isSupabaseConfigured) {
    renderPpcDocument(null);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("ppc_documento_publico")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    renderPpcDocument(data || null);
  } catch (error) {
    console.warn("Não foi possível carregar o PPC publicado:", error);
    renderPpcDocument(null);
  }
}

function groupByPeriod(items) {
  return items.reduce((groups, item) => {
    const periodo = Number(item.periodo) || 1;
    if (!groups[periodo]) groups[periodo] = [];
    groups[periodo].push(item);
    return groups;
  }, {});
}

function createTab(periodo, isActive) {
  const button = document.createElement("button");
  button.className = `period-tab ${isActive ? "active" : ""}`.trim();
  button.type = "button";
  button.role = "tab";
  button.dataset.period = `periodo-${periodo}`;
  button.setAttribute("aria-selected", String(isActive));
  button.setAttribute("aria-controls", `periodo-${periodo}`);
  button.textContent = `${periodo}º`;
  return button;
}

function createCourseCard(item) {
  const card = document.createElement("article");
  card.className = "course-card";

  const prereq = item.pre_requisitos
    ? `<span class="course-prereq">Pré: <strong>${text(item.pre_requisitos)}</strong></span>`
    : `<span class="course-prereq no-prereq">Sem pré-requisito</span>`;

  card.innerHTML = `
    <div class="course-card-header">
      <span class="course-code">${text(item.codigo) || "Sem código"}</span>
      <span class="course-hours">${numberValue(item.carga_horaria)}h • ${numberValue(item.creditos)} cr.</span>
    </div>
    <h4>${text(item.nome)}</h4>
    <span class="course-type">${TYPE_LABELS[item.tipo] || "Componente"}</span>
    ${prereq}
  `;

  if (item.descricao) {
    const description = document.createElement("p");
    description.className = "course-description";
    description.textContent = item.descricao;
    card.appendChild(description);
  }

  return card;
}

function createPanel(periodo, items, isActive) {
  const panel = document.createElement("article");
  panel.className = `period-panel ${isActive ? "active" : ""}`.trim();
  panel.id = `periodo-${periodo}`;
  panel.role = "tabpanel";
  panel.hidden = !isActive;

  const orderedItems = [...items].sort((a, b) =>
    numberValue(a.ordem) - numberValue(b.ordem) || text(a.nome).localeCompare(text(b.nome), "pt-BR")
  );
  const totalHours = orderedItems.reduce((sum, item) => sum + numberValue(item.carga_horaria), 0);
  const totalCredits = orderedItems.reduce((sum, item) => sum + numberValue(item.creditos), 0);

  panel.innerHTML = `
    <div class="period-panel-heading">
      <div>
        <span class="period-label">${periodo}º período</span>
        <h3>${PERIOD_TITLES[periodo] || "Componentes curriculares"}</h3>
      </div>
      <div class="period-summary" aria-label="Resumo do ${periodo}º período">
        <span class="curriculum-stat-chip"><small>Componentes</small><strong>${orderedItems.length}</strong></span>
        <span class="curriculum-stat-chip"><small>Carga horária</small><strong>${totalHours}h</strong></span>
        <span class="curriculum-stat-chip"><small>Créditos</small><strong>${totalCredits}</strong></span>
      </div>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "course-card-grid";

  if (orderedItems.length) {
    orderedItems.forEach((item) => grid.appendChild(createCourseCard(item)));
  } else {
    const message = document.createElement("p");
    message.className = "curriculum-empty-inline";
    message.textContent = "Nenhum componente cadastrado para este período.";
    grid.appendChild(message);
  }

  panel.appendChild(grid);
  return panel;
}

function activatePeriod(periodId) {
  document.querySelectorAll(".period-tab").forEach((tab) => {
    const active = tab.dataset.period === periodId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".period-panel").forEach((panel) => {
    const active = panel.id === periodId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function renderCurriculum() {
  if (!tabsContainer || !panelsContainer) return;

  tabsContainer.innerHTML = "";
  panelsContainer.innerHTML = "";

  const groups = groupByPeriod(components);
  const hasItems = components.length > 0;
  if (empty) empty.hidden = hasItems;

  const periods = Array.from({ length: 8 }, (_, index) => index + 1);
  const firstPeriodWithContent = periods.find((periodo) => groups[periodo]?.length) || 1;

  periods.forEach((periodo) => {
    const isActive = periodo === firstPeriodWithContent;
    tabsContainer.appendChild(createTab(periodo, isActive));
    panelsContainer.appendChild(createPanel(periodo, groups[periodo] || [], isActive));
  });

  tabsContainer.addEventListener("click", (event) => {
    const button = event.target.closest(".period-tab");
    if (!button) return;
    activatePeriod(button.dataset.period);
  });
}

async function loadCurriculum() {
  if (!isSupabaseConfigured) {
    components = FALLBACK_COMPONENTS;
    renderCurriculum();
    return;
  }

  try {
    const { data, error } = await supabase
      .from("componentes_curriculares_publicos")
      .select("*")
      .order("periodo", { ascending: true })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) throw error;
    components = data || [];
  } catch (error) {
    console.error(error);
    components = FALLBACK_COMPONENTS;
  }

  renderCurriculum();
}

loadPpcDocument();
loadCurriculum();
