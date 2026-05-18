import {
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

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

function createHighlightCard(item, index) {
  const link = document.createElement("a");
  link.className = index === 0 ? "magazine-card magazine-card-large" : "magazine-card";
  link.href = item.link_externo || "eventos-noticias.html";
  if (item.link_externo) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const visual = document.createElement("span");
  visual.className = "magazine-visual";
  visual.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.src = item.imagem_url || createFallbackImage(item.tipo);
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
    .select("id, titulo, tipo, resumo, imagem_url, link_externo, data_inicio, destaque_home")
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
