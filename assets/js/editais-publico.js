import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const list = document.querySelector("[data-editais-list]");
const empty = document.querySelector("[data-editais-empty]");
const filters = Array.from(document.querySelectorAll("[data-edital-public-filter]"));
const searchInput = document.querySelector("[data-editais-search]");

let editais = [];
let activeFilter = "todos";

const CATEGORY_LABELS = {
  moradia: "Moradia",
  manutencao: "Manutenção",
  auxilio: "Auxílios",
  selecao: "Seleção",
  geral: "Comunicados gerais",
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

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function normalizeCategory(value) {
  return ["moradia", "manutencao", "auxilio", "selecao", "geral"].includes(value) ? value : "geral";
}

function getMainDate(item) {
  if (item.data_publicacao) return formatDate(item.data_publicacao);
  if (item.publicado_em) return formatDate(String(item.publicado_em).slice(0, 10));
  if (item.criado_em) return formatDate(String(item.criado_em).slice(0, 10));
  return "";
}

function getStatusLabel(item) {
  if (item.data_limite) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(`${item.data_limite}T00:00:00`);
    if (!Number.isNaN(deadline.getTime())) {
      return deadline >= today ? "Prazo aberto" : "Encerrado";
    }
  }
  if (item.data_publicacao || item.publicado_em) return "Publicado";
  return "Comunicado";
}

function getActionLabel(item) {
  const link = String(item.link_documento || "").toLowerCase();
  if (link.includes(".pdf")) return "Abrir edital PDF";
  if (item.categoria === "selecao") return "Ver seleção";
  if (item.categoria === "auxilio") return "Ver auxílio";
  return "Abrir edital";
}

function getFilteredItems() {
  const term = String(searchInput?.value || "").trim().toLowerCase();
  return editais.filter((item) => {
    const category = normalizeCategory(item.categoria);
    const matchesFilter = activeFilter === "todos" || category === activeFilter;
    const searchable = [
      item.titulo,
      item.numero,
      item.resumo,
      item.descricao,
      item.orgao,
      item.data_publicacao,
      item.data_limite,
      CATEGORY_LABELS[category],
      getStatusLabel(item),
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && (!term || searchable.includes(term));
  });
}

function createCard(item) {
  const category = normalizeCategory(item.categoria);
  const article = document.createElement("article");
  article.className = `edict-card is-${category}`;

  const date = getMainDate(item);
  const title = esc(item.titulo || "Edital sem título");
  const resumo = esc(item.resumo || "Sem resumo cadastrado.");
  const descricao = esc(item.descricao || "");
  const numero = item.numero ? esc(item.numero) : "Sem número";
  const orgao = item.orgao ? esc(item.orgao) : "";
  const deadline = item.data_limite ? formatDate(item.data_limite) : "";
  const link = item.link_documento ? String(item.link_documento) : "";
  const actionLabel = getActionLabel(item);

  article.innerHTML = `
    <div class="edict-card-body">
      <div class="edict-card-topline">
        <span class="edict-status">${esc(getStatusLabel(item))}</span>
        ${date ? `<time class="edict-date">${esc(date)}</time>` : ""}
      </div>
      <span class="edict-type">${esc(CATEGORY_LABELS[category])} · ${numero}</span>
      <h3>${title}</h3>
      <p>${resumo}</p>
      ${descricao ? `<p class="edict-description">${descricao}</p>` : ""}
      ${deadline || orgao ? `<p class="edict-description">${deadline ? `Prazo: ${esc(deadline)}` : ""}${deadline && orgao ? " · " : ""}${orgao}</p>` : ""}
    </div>
    <div class="edict-card-footer">
      ${link ? `<a class="edict-card-link" href="${esc(link)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
        ${esc(actionLabel)}
      </a>` : `<span class="edict-card-link is-muted">Edital informativo</span>`}
      <button class="edict-share-button" type="button" aria-label="Copiar link de ${title}" data-share-url="${esc(link || window.location.href)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
      </button>
    </div>
  `;

  return article;
}

function render() {
  if (!list || !empty) return;
  const items = getFilteredItems();
  list.innerHTML = "";
  items.forEach((item) => list.appendChild(createCard(item)));

  empty.textContent = editais.length
    ? "Nenhum edital encontrado para esse filtro ou busca."
    : "Nenhum edital publicado no momento.";
  empty.classList.toggle("is-visible", items.length === 0);
}

async function load() {
  if (!isSupabaseConfigured || !supabase) {
    if (empty) {
      empty.textContent = getConfigMessage();
      empty.classList.add("is-visible");
    }
    return;
  }

  const { data, error } = await supabase
    .from("editais_publicos")
    .select("*")
    .order("data_publicacao", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  editais = data || [];
  render();
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.editalPublicFilter || "todos";
    filters.forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
});

searchInput?.addEventListener("input", render);

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-share-url]");
  if (!button) return;
  const url = button.dataset.shareUrl;
  try {
    await navigator.clipboard.writeText(url);
    button.classList.add("is-copied");
    setTimeout(() => button.classList.remove("is-copied"), 1200);
  } catch (_) {
    window.prompt("Copie o link:", url);
  }
});

load().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar editais: ${error.message}`;
    empty.classList.add("is-visible");
  }
});
