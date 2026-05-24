import { getConfigMessage, isSupabaseConfigured, supabase } from "./supabase-client.js";

const root = document.querySelector("[data-aprovados-page]");
const grid = document.querySelector("[data-aprovados-results]");
const empty = document.querySelector("[data-aprovados-empty]");
const searchInput = document.querySelector("[data-calls-search]");
const filterButtons = Array.from(document.querySelectorAll("[data-calls-filter]"));

let allItems = [];
let activeFilter = "todos";

const TYPE_LABELS = {
  aprovados: "Listas de aprovados",
  remanejamento: "Remanejamento",
  matricula: "Matrícula inicial",
  rematricula: "Rematrícula",
  reingresso: "Reingresso",
  geral: "Comunicados gerais",
};

const STATUS_LABELS = {
  aprovados: "Lista publicada",
  remanejamento: "Chamada publicada",
  matricula: "Matrícula",
  rematricula: "Rematrícula",
  reingresso: "Reingresso",
  geral: "Aviso importante",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function normalizeBucket(tipo) {
  if (tipo === "aprovados") return "aprovados";
  if (tipo === "remanejamento" || tipo === "aprovados_remanejamento") return "remanejamento";
  if (tipo === "matricula" || tipo === "matricula_rematricula") return "matricula";
  if (tipo === "rematricula") return "rematricula";
  if (tipo === "reingresso") return "reingresso";
  return "geral";
}

function getPeriod(item) {
  if (item.data_inicio && item.data_fim) return `${formatDate(item.data_inicio)} a ${formatDate(item.data_fim)}`;
  if (item.data_inicio) return formatDate(item.data_inicio);
  if (item.data_fim) return formatDate(item.data_fim);
  if (item.publicado_em) return formatDate(String(item.publicado_em).slice(0, 10));
  if (item.criado_em) return formatDate(String(item.criado_em).slice(0, 10));
  return "";
}

function getActionLabel(item) {
  if (item.link_label) return item.link_label;
  const isPdf = item.documento_nome || item.documento_tipo === "pdf" || String(item.link_url || "").toLowerCase().includes(".pdf");
  return isPdf ? "Abrir PDF" : "Acessar documento";
}

function createCard(item) {
  const type = normalizeBucket(item.tipo);
  const article = document.createElement("article");
  article.className = `result-card is-${type}${item.destaque ? " is-featured" : ""}`;
  article.dataset.type = type;

  const period = getPeriod(item);
  const typeLabel = TYPE_LABELS[type] || TYPE_LABELS.geral;
  const statusLabel = item.destaque ? "Destaque" : (STATUS_LABELS[type] || "Publicação");
  const actionLabel = getActionLabel(item);
  const title = esc(item.titulo);
  const resumo = esc(item.resumo || "");
  const conteudo = esc(item.conteudo || "");
  const link = item.link_url ? String(item.link_url) : "";

  article.innerHTML = `
    <div class="result-card-body">
      <div class="result-card-topline">
        <span class="result-status">${esc(statusLabel)}</span>
        ${period ? `<time class="result-date">${esc(period)}</time>` : ""}
      </div>
      <span class="result-type">${esc(typeLabel)}</span>
      <h3>${title}</h3>
      ${resumo ? `<p>${resumo}</p>` : ""}
      ${conteudo ? `<p class="result-card-content">${conteudo}</p>` : ""}
    </div>
    <div class="result-card-footer">
      ${link ? `<a class="result-card-link" href="${esc(link)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
        ${esc(actionLabel)}
      </a>` : `<span class="result-card-link is-muted">Informação publicada</span>`}
      <button class="share-button" type="button" aria-label="Copiar link de ${title}" data-share-url="${esc(link || window.location.href)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
      </button>
    </div>
  `;
  return article;
}

function getFilteredItems() {
  const term = String(searchInput?.value || "").trim().toLowerCase();
  return allItems.filter((item) => {
    const type = normalizeBucket(item.tipo);
    const matchesFilter = activeFilter === "todos" || type === activeFilter;
    const searchable = [item.titulo, item.resumo, item.conteudo, item.link_label, item.documento_nome, TYPE_LABELS[type], getPeriod(item)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesFilter && (!term || searchable.includes(term));
  });
}

function renderResults() {
  if (!grid) return;
  const items = getFilteredItems();
  grid.innerHTML = "";
  items.forEach((item) => grid.appendChild(createCard(item)));

  if (empty) {
    empty.textContent = allItems.length
      ? "Nenhuma publicação encontrada para esse filtro ou busca."
      : "Nenhuma chamada, lista ou orientação publicada no momento.";
    empty.classList.toggle("is-visible", items.length === 0);
  }
}

function setupInteractions() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.callsFilter || "todos";
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderResults();
    });
  });

  searchInput?.addEventListener("input", renderResults);

  grid?.addEventListener("click", async (event) => {
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
}

async function loadResults() {
  if (!root) return;
  setupInteractions();

  if (!isSupabaseConfigured || !supabase) {
    if (empty) {
      empty.textContent = getConfigMessage();
      empty.classList.add("is-visible");
    }
    return;
  }

  const { data, error } = await supabase
    .from("ingresso_informacoes_publicas")
    .select("*")
    .in("tipo", ["aprovados", "remanejamento", "aprovados_remanejamento", "matricula", "matricula_rematricula", "rematricula", "reingresso", "geral"])
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;

  allItems = data || [];
  renderResults();
}

loadResults().catch((error) => {
  if (empty) {
    empty.textContent = `Erro ao carregar chamadas: ${error.message}`;
    empty.classList.add("is-visible");
  }
});
