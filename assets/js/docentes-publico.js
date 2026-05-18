import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const list = document.querySelector("[data-docentes-list]");
const empty = document.querySelector("[data-docentes-empty]");
const stats = {
  total: document.querySelector("[data-docentes-total]"),
  areas: document.querySelector("[data-docentes-areas]"),
  coordenacao: document.querySelector("[data-docentes-coordenacao]"),
};

const FUNCOES = {
  docente: "Docente",
  coordenacao: "Coordenação",
  docente_coordenacao: "Docente e coordenação",
  apoio_academico: "Apoio acadêmico",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    links.push(`<a class="text-link" href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a>`);
  }
  if (shouldShowPhone(item)) {
    links.push(`<a class="text-link" href="tel:${String(item.telefone).replace(/\D/g, "")}">${escapeHtml(item.telefone)}</a>`);
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

function renderDocentes(items) {
  if (!list || !empty) return;
  list.innerHTML = "";
  empty.hidden = items.length > 0;
  updateStats(items);

  items.forEach((item) => {
    const card = document.createElement("article");
    const safeName = escapeHtml(item.nome);
    card.className = `docent-card${item.destaque ? " is-highlighted" : ""}`;

    const photo = item.imagem_url
      ? `<img src="${escapeHtml(item.imagem_url)}" alt="Foto de ${safeName}" loading="lazy" />`
      : `<span>${escapeHtml(initials(item.nome))}</span><figcaption>Foto institucional futura</figcaption>`;

    card.innerHTML = `
      <figure class="docent-photo-frame" aria-label="Foto ou identificação de ${safeName}">
        ${photo}
      </figure>
      <div class="docent-card-body">
        <span class="docent-tag">${escapeHtml(FUNCOES[item.funcao] || "Docente")}${item.destaque ? " · destaque" : ""}</span>
        <h3>${safeName}</h3>
        <ul class="docent-meta">
          ${item.formacao ? `<li><strong>Formação:</strong> ${escapeHtml(item.formacao)}</li>` : ""}
          ${item.area_atuacao ? `<li><strong>Área de atuação:</strong> ${escapeHtml(item.area_atuacao)}</li>` : ""}
          ${item.historico ? `<li><strong>Histórico:</strong> ${escapeHtml(item.historico)}</li>` : ""}
          ${item.projetos_interesses ? `<li><strong>Projetos e interesses:</strong> ${escapeHtml(item.projetos_interesses)}</li>` : ""}
        </ul>
        <div class="docent-contact-links">${createContactLinks(item)}</div>
      </div>
    `;

    list.appendChild(card);
  });
}

async function loadDocentes() {
  if (!list) return;

  if (!isSupabaseConfigured) {
    empty.hidden = false;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("docentes")
      .select("nome, funcao, formacao, area_atuacao, historico, projetos_interesses, email, telefone, contato_preferencial, lattes_url, imagem_url, destaque, ordem")
      .eq("ativo", true)
      .order("destaque", { ascending: false })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) throw error;
    renderDocentes(data || []);
  } catch (error) {
    empty.hidden = false;
    empty.textContent = `Não foi possível carregar a equipe docente: ${error.message}`;
  }
}

loadDocentes();
