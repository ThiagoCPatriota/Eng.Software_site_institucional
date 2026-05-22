import {
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const CAMPUS_IMAGES_BUCKET = "noticias-eventos-imagens";

const track = document.querySelector("[data-home-destaques-list]");
const actionLink = document.querySelector("[data-home-destaques-action]");

const TYPE_LABELS = {
  evento: "Evento",
  noticia: "Notícia",
  aviso: "Aviso",
  beneficio: "Benefício",
};

function formatBrazilianDate(value) {
  if (!value) return "Destaque";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "Destaque";
  return `${day}/${month}/${year}`;
}

function createFallbackImage(type) {
  if (type === "beneficio") return "assets/img/home/manutencao-academica.png";
  if (type === "noticia" || type === "aviso") return "assets/img/home/ani-ifpe55.png";
  return "assets/img/home/jardim-digital.jpg";
}

function getImageUrl(item) {
  if (item?.imagem_url) return item.imagem_url;
  if (item?.imagem_path && isSupabaseConfigured && supabase) {
    const { data } = supabase.storage.from(CAMPUS_IMAGES_BUCKET).getPublicUrl(item.imagem_path);
    return data?.publicUrl || "";
  }
  return "";
}

function createHighlightCard(item, index) {
  const link = document.createElement("a");
  link.className = index === 0 ? "magazine-card magazine-card-large" : "magazine-card";
  link.href = item.link_externo || `eventos-noticias.html#noticia-${item.id}`;
  if (item.link_externo) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const visual = document.createElement("span");
  visual.className = "magazine-visual";
  visual.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.src = getImageUrl(item) || createFallbackImage(item.tipo);
  image.alt = "";
  image.loading = "lazy";
  visual.appendChild(image);

  const content = document.createElement("span");
  content.className = "magazine-content";

  const small = document.createElement("small");
  small.textContent = item.tipo === "evento" ? "Evento em destaque" : "Destaque institucional";

  const meta = document.createElement("span");
  meta.className = "magazine-meta";
  meta.textContent = `${TYPE_LABELS[item.tipo] || "Destaque"} • ${item.data_inicio ? formatBrazilianDate(item.data_inicio) : "Campus"}`;

  const strong = document.createElement("strong");
  strong.textContent = item.titulo || "Destaque do campus";

  const summary = document.createElement("em");
  summary.textContent = item.resumo || "Confira as novidades acadêmicas do curso.";

  content.append(small, meta, strong, summary);
  link.append(visual, content);
  return link;
}

async function loadHomeHighlights() {
  if (!track || !isSupabaseConfigured || !supabase) return;

  const { data, error } = await supabase
    .from("noticias_eventos_publicos")
    .select("id, titulo, tipo, resumo, imagem_url, imagem_path, link_externo, link_rotulo, data_inicio, destaque_home")
    .eq("destaque_home", true)
    .order("ordem", { ascending: true })
    .order("publicado_em", { ascending: false, nullsFirst: false })
    .limit(3);

  if (error || !data || data.length === 0) return;

  track.innerHTML = "";
  data.forEach((item, index) => track.appendChild(createHighlightCard(item, index)));

  if (actionLink) {
    actionLink.href = "eventos-noticias.html";
    actionLink.textContent = "Ver eventos e notícias do campus";
  }
}

loadHomeHighlights().catch((error) => {
  console.warn("Não foi possível carregar os destaques da home:", error);
});
