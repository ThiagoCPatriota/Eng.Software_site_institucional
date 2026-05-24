import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const list = document.querySelector("[data-docentes-list]");
const empty = document.querySelector("[data-docentes-empty]");
const searchInput = document.querySelector("[data-docentes-search]");
const filterButtons = document.querySelectorAll("[data-docente-filter]");
const stats = {
  total: document.querySelector("[data-docentes-total]"),
  areas: document.querySelector("[data-docentes-areas]"),
  coordenacao: document.querySelector("[data-docentes-coordenacao]"),
};

const DOCENTES_BUCKET = "docentes-fotos";

const FUNCOES = {
  docente: "Docente",
  coordenacao: "Coordenação",
  docente_coordenacao: "Docente e coordenação",
  apoio_academico: "Apoio acadêmico",
};

let docentes = [];
let activeFilter = "todos";
let searchTerm = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getImageUrl(item) {
  if (item?.imagem_url) return item.imagem_url;
  if (item?.imagem_path && isSupabaseConfigured) {
    const { data } = supabase.storage.from(DOCENTES_BUCKET).getPublicUrl(item.imagem_path);
    return data?.publicUrl || "";
  }
  return "";
}

function initials(name) {
  const parts = String(name || "D")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "D";
}

function shouldShowEmail(item) {
  return item.email && ["email", "ambos"].includes(item.contato_preferencial);
}

function shouldShowPhone(item) {
  return item.telefone && ["telefone", "ambos"].includes(item.contato_preferencial);
}

function createContactLinks(item) {
  const links = [];
  if (shouldShowEmail(item)) {
    links.push(`<a class="text-link" href="mailto:${escapeHtml(item.email)}">E-mail</a>`);
  }
  if (shouldShowPhone(item)) {
    links.push(`<a class="text-link" href="tel:${String(item.telefone).replace(/\D/g, "")}">Telefone</a>`);
  }
  if (item.lattes_url) {
    links.push(`<a class="text-link" href="${escapeHtml(item.lattes_url)}" target="_blank" rel="noopener">Currículo / página pública</a>`);
  }
  return links.length ? links.join("") : "<span>Contato não exibido publicamente.</span>";
}

function updateStats(items) {
  if (stats.total) stats.total.textContent = String(items.length).padStart(2, "0");

  const uniqueAreas = new Set(items.map((item) => item.area_atuacao).filter(Boolean));
  if (stats.areas) stats.areas.textContent = String(uniqueAreas.size).padStart(2, "0");

  const hasCoordination = items.some((item) => ["coordenacao", "docente_coordenacao"].includes(item.funcao));
  if (stats.coordenacao) stats.coordenacao.textContent = hasCoordination ? "Sim" : "—";
}

function resetEmptyState() {
  if (!empty) return;
  empty.innerHTML = `
    <span>Equipe docente em atualização</span>
    <h3>Nenhum docente ativo foi encontrado no momento.</h3>
    <p>Assim que a administração cadastrar e ativar os docentes, os cards aparecerão automaticamente nesta área.</p>
  `;
}

function setNoResultsState() {
  if (!empty) return;
  empty.innerHTML = `
    <span>Nenhum resultado</span>
    <h3>Nenhum docente encontrado para este filtro ou busca.</h3>
    <p>Tente limpar a busca ou selecionar outro filtro para visualizar mais profissionais cadastrados.</p>
  `;
}

function matchesFilter(item) {
  if (activeFilter === "todos") return true;
  if (activeFilter === "docente") return ["docente", "docente_coordenacao"].includes(item.funcao);
  if (activeFilter === "coordenacao") return ["coordenacao", "docente_coordenacao"].includes(item.funcao);
  return item.funcao === activeFilter;
}

function matchesSearch(item) {
  if (!searchTerm) return true;
  const searchable = [
    item.nome,
    FUNCOES[item.funcao],
    item.formacao,
    item.area_atuacao,
    item.materias_ministradas,
    item.historico,
    item.projetos_interesses,
  ].join(" ");
  return normalize(searchable).includes(searchTerm);
}

function getFilteredDocentes() {
  return docentes.filter((item) => matchesFilter(item) && matchesSearch(item));
}

function renderDocentes(items) {
  if (!list || !empty) return;
  list.innerHTML = "";

  if (!items.length) {
    empty.hidden = false;
    if (docentes.length) setNoResultsState();
    return;
  }

  resetEmptyState();
  empty.hidden = true;

  items.forEach((item) => {
    const card = document.createElement("article");
    const safeName = escapeHtml(item.nome);
    card.className = `docent-card${item.destaque ? " is-highlighted" : ""}`;

    const imageUrl = getImageUrl(item);
    const photo = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="Foto de ${safeName}" loading="lazy" />`
      : `<span>${escapeHtml(initials(item.nome))}</span><figcaption>Foto institucional futura</figcaption>`;

    card.innerHTML = `
      <figure class="docent-photo-frame${imageUrl ? " has-image" : ""}" aria-label="Foto ou identificação de ${safeName}">
        ${photo}
      </figure>
      <div class="docent-card-body">
        <span class="docent-tag">${escapeHtml(FUNCOES[item.funcao] || "Docente")}${item.destaque ? " · destaque" : ""}</span>
        <h3>${safeName}</h3>
        <ul class="docent-meta">
          ${item.formacao ? `<li><strong>Formação:</strong> ${escapeHtml(item.formacao)}</li>` : ""}
          ${item.area_atuacao ? `<li><strong>Área de atuação:</strong> ${escapeHtml(item.area_atuacao)}</li>` : ""}
          ${item.materias_ministradas ? `<li><strong>Componentes:</strong> ${escapeHtml(item.materias_ministradas)}</li>` : ""}
          ${item.historico ? `<li><strong>Histórico:</strong> ${escapeHtml(item.historico)}</li>` : ""}
          ${item.projetos_interesses ? `<li><strong>Projetos e interesses:</strong> ${escapeHtml(item.projetos_interesses)}</li>` : ""}
        </ul>
        <div class="docent-contact-links">${createContactLinks(item)}</div>
      </div>
    `;

    list.appendChild(card);
  });
}

function applyFilters() {
  updateStats(docentes);
  renderDocentes(getFilteredDocentes());
}

function setupInteractions() {
  searchInput?.addEventListener("input", (event) => {
    searchTerm = normalize(event.target.value);
    applyFilters();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.docenteFilter || "todos";
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      applyFilters();
    });
  });
}

async function loadDocentes() {
  if (!list) return;

  if (!isSupabaseConfigured) {
    docentes = [];
    updateStats(docentes);
    resetEmptyState();
    empty.hidden = false;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("docentes")
      .select("nome, funcao, formacao, area_atuacao, materias_ministradas, historico, projetos_interesses, email, telefone, contato_preferencial, lattes_url, imagem_url, imagem_path, destaque, ordem")
      .eq("ativo", true)
      .order("destaque", { ascending: false })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) throw error;
    docentes = data || [];
    applyFilters();
  } catch (error) {
    docentes = [];
    updateStats(docentes);
    empty.hidden = false;
    empty.innerHTML = `
      <span>Erro de carregamento</span>
      <h3>Não foi possível carregar a equipe docente.</h3>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

setupInteractions();
loadDocentes();
