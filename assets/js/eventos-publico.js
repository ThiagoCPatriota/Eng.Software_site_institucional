import {
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const CAMPUS_IMAGES_BUCKET = "noticias-eventos-imagens";

const TIPOS = {
  todos: "Todos",
  evento: "Evento",
  noticia: "Notícia",
  aviso: "Aviso",
  beneficio: "Benefício",
};

const publicList = document.querySelector("[data-campus-news-list]");
const publicEmpty = document.querySelector("[data-campus-news-empty]");
const filterButtons = document.querySelectorAll("[data-campus-news-filter]");

let campusPosts = [];
let activeFilter = "todos";

function formatBrazilianDate(value) {
  if (!value) return "Data a confirmar";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatPeriod(item) {
  if (!item.data_inicio && !item.hora_inicio) return item.data_label || "A confirmar";
  const date = formatBrazilianDate(item.data_inicio);
  const hour = item.hora_inicio ? ` · ${String(item.hora_inicio).slice(0, 5)}` : "";
  return `${date}${hour}`;
}

function getFallbackPosts() {
  const dados = window.dadosSite || {};
  const noticias = Array.isArray(dados.noticias) ? dados.noticias.map((item, index) => ({
    id: `fallback-noticia-${index}`,
    tipo: "noticia",
    titulo: item.titulo,
    resumo: item.resumo,
    conteudo: "Conteúdo demonstrativo para validar o canal de notícias do curso.",
    data_inicio: null,
    data_label: item.data || "Demonstração",
    local: item.categoria || "Institucional",
    link_externo: null,
    destaque_home: index < 1,
  })) : [];
  const eventos = Array.isArray(dados.eventos) ? dados.eventos.map((item, index) => ({
    id: `fallback-evento-${index}`,
    tipo: "evento",
    titulo: item.titulo,
    resumo: item.resumo,
    conteudo: "Evento demonstrativo para validar a visualização pública do campus.",
    data_inicio: null,
    data_label: item.data || "Demonstração",
    local: item.formato || "Campus",
    link_externo: null,
    destaque_home: index < 1,
  })) : [];
  return [...eventos, ...noticias];
}

function getFilteredPosts() {
  if (activeFilter === "todos") return campusPosts;
  return campusPosts.filter((item) => item.tipo === activeFilter);
}

function createInfoPill(value) {
  const pill = document.createElement("span");
  pill.textContent = value;
  return pill;
}

function getImageUrl(item) {
  if (item?.imagem_url) return item.imagem_url;
  if (item?.imagem_path && isSupabaseConfigured && supabase) {
    const { data } = supabase.storage.from(CAMPUS_IMAGES_BUCKET).getPublicUrl(item.imagem_path);
    return data?.publicUrl || "";
  }
  return "";
}

function createVisual(item) {
  const imageUrl = getImageUrl(item);
  const visual = document.createElement("div");
  visual.className = imageUrl ? "campus-news-image" : "campus-news-placeholder";

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    visual.appendChild(image);
    return visual;
  }

  const type = document.createElement("span");
  type.textContent = TIPOS[item.tipo] || "Notícia";
  const title = document.createElement("strong");
  title.textContent = "IFPE";
  visual.append(type, title);
  return visual;
}

function createCampusCard(item) {
  const article = document.createElement("article");
  article.className = `campus-news-card${item.destaque_home ? " is-featured" : ""}`;
  article.id = `noticia-${item.id}`;

  article.appendChild(createVisual(item));

  const content = document.createElement("div");
  content.className = "campus-news-content";

  const topLine = document.createElement("div");
  topLine.className = "campus-news-topline";

  const type = document.createElement("span");
  type.textContent = TIPOS[item.tipo] || item.tipo || "Destaque";
  topLine.appendChild(type);

  if (item.destaque_home) {
    const featured = document.createElement("span");
    featured.className = "campus-news-featured-pill";
    featured.textContent = "Destaque";
    topLine.appendChild(featured);
  }

  const date = document.createElement("small");
  date.textContent = formatPeriod(item);
  topLine.appendChild(date);
  content.appendChild(topLine);

  const title = document.createElement("h3");
  title.textContent = item.titulo || "Sem título";
  content.appendChild(title);

  const summary = document.createElement("p");
  summary.className = "campus-news-summary";
  summary.textContent = item.resumo || "Sem resumo cadastrado.";
  content.appendChild(summary);

  if (item.conteudo) {
    const body = document.createElement("p");
    body.className = "campus-news-body";
    body.textContent = item.conteudo;
    content.appendChild(body);
  }

  const meta = document.createElement("div");
  meta.className = "campus-news-meta";
  [item.local, item.organizador].filter(Boolean).forEach((value) => meta.appendChild(createInfoPill(value)));
  if (meta.childElementCount) content.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "campus-news-actions";

  if (item.email_contato) {
    const email = document.createElement("a");
    email.className = "text-link compact-link campus-news-contact";
    email.href = `mailto:${item.email_contato}`;
    email.textContent = item.email_contato;
    actions.appendChild(email);
  }

  if (item.link_externo) {
    const link = document.createElement("a");
    link.className = "text-link compact-link";
    link.href = item.link_externo;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir link oficial";
    actions.appendChild(link);
  }

  if (actions.childElementCount) content.appendChild(actions);

  article.appendChild(content);
  return article;
}

function renderPosts() {
  if (!publicList || !publicEmpty) return;
  const items = getFilteredPosts();
  publicList.innerHTML = "";
  publicEmpty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => publicList.appendChild(createCampusCard(item)));
}

async function loadPosts() {
  if (!publicList) return;

  if (!isSupabaseConfigured || !supabase) {
    campusPosts = getFallbackPosts();
    renderPosts();
    return;
  }

  const { data, error } = await supabase
    .from("noticias_eventos_publicos")
    .select("id, titulo, slug, tipo, resumo, conteudo, imagem_url, imagem_path, link_externo, email_contato, local, organizador, data_inicio, data_fim, hora_inicio, destaque_home, publicado_em, atualizado_em")
    .order("destaque_home", { ascending: false })
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: false, nullsFirst: false })
    .order("publicado_em", { ascending: false, nullsFirst: false });

  if (error) throw error;
  campusPosts = data && data.length ? data : getFallbackPosts();
  renderPosts();
}

function setupFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.campusNewsFilter || "todos";
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderPosts();
    });
  });
}

setupFilters();
loadPosts().catch((error) => {
  console.error("Erro ao carregar eventos e notícias:", error);
  campusPosts = getFallbackPosts();
  if (publicEmpty) publicEmpty.textContent = "Não foi possível carregar os conteúdos do campus agora.";
  renderPosts();
});
