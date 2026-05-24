import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const list = document.querySelector("[data-servicos-list]");
const empty = document.querySelector("[data-servicos-empty]");
const filters = document.querySelectorAll("[data-servico-public-filter]");
const searchInput = document.querySelector("[data-servicos-search]");
const count = document.querySelector("[data-servicos-count]");
const featureButtons = document.querySelectorAll("[data-service-feature-filter]");

let servicos = [];
let activeFilter = "todos";
let activeSearch = "";

const LABELS = {
  biblioteca: "Biblioteca",
  atividades_complementares: "Atividades complementares",
  tcc: "TCC",
  outro: "Outro serviço",
};

const ICONS = {
  biblioteca: "▦",
  atividades_complementares: "✦",
  tcc: "⌁",
  outro: "↗",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (!value) return "Publicado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publicado";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getItems() {
  const term = normalize(activeSearch);
  return servicos.filter((item) => {
    const matchesFilter = activeFilter === "todos" || item.tipo === activeFilter;
    if (!matchesFilter) return false;
    if (!term) return true;

    const searchable = normalize([
      item.titulo,
      item.descricao,
      item.link_label,
      LABELS[item.tipo],
    ].filter(Boolean).join(" "));

    return searchable.includes(term);
  });
}

function updateFilterButtons() {
  filters.forEach((button) => {
    button.classList.toggle("is-active", (button.dataset.servicoPublicFilter || "todos") === activeFilter);
  });
}

function updateCount(total) {
  if (!count) return;
  const label = total === 1 ? "serviço encontrado" : "serviços encontrados";
  count.textContent = `${total} ${label}`;
}

function setActiveFilter(nextFilter) {
  activeFilter = nextFilter || "todos";
  updateFilterButtons();
  render();
  document.querySelector("#servicos-links")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createServiceCard(item) {
  const article = document.createElement("article");
  article.className = "service-link-card";
  article.dataset.serviceType = item.tipo || "outro";

  const label = LABELS[item.tipo] || "Serviço";
  const icon = ICONS[item.tipo] || ICONS.outro;
  const linkUrl = String(item.link_url || "").trim();
  const buttonLabel = String(item.link_label || "Acessar serviço").trim();

  article.innerHTML = `
    <div class="service-card-body">
      <div class="service-card-header">
        <span class="service-card-icon" aria-hidden="true">${esc(icon)}</span>
        <span class="service-card-chip">${esc(label)}</span>
      </div>
      <h3>${esc(item.titulo)}</h3>
      <p>${esc(item.descricao || "")}</p>
      <div class="service-card-footer">
        <div class="service-card-meta">
          <span>${esc(formatDate(item.publicado_em || item.atualizado_em || item.criado_em))}</span>
        </div>
        ${linkUrl ? `<a class="service-card-link" href="${esc(linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(buttonLabel)} <span aria-hidden="true">→</span></a>` : ""}
      </div>
    </div>
  `;

  return article;
}

function render() {
  if (!list || !empty) return;
  const items = getItems();

  list.innerHTML = "";
  empty.classList.toggle("is-visible", items.length === 0);
  updateCount(items.length);

  items.forEach((item) => {
    list.appendChild(createServiceCard(item));
  });
}

async function load() {
  if (!isSupabaseConfigured || !supabase) {
    if (empty) {
      empty.textContent = getConfigMessage();
      empty.classList.add("is-visible");
    }
    updateCount(0);
    return;
  }

  const { data, error } = await supabase
    .from("outros_servicos_publicos")
    .select("*")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  servicos = data || [];
  render();
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.servicoPublicFilter || "todos";
    updateFilterButtons();
    render();
  });
});

featureButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveFilter(button.dataset.serviceFeatureFilter || "todos"));
});

document.querySelector(".services-search")?.addEventListener("submit", (event) => {
  event.preventDefault();
});

searchInput?.addEventListener("input", () => {
  activeSearch = searchInput.value;
  render();
});

load().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar serviços: ${error.message}`;
    empty.classList.add("is-visible");
  }
  updateCount(0);
});
