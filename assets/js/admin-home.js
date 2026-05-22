import {
  formatDateTime,
  getConfigMessage,
  isSupabaseConfigured,
  requireAdminAccess,
  signOutAndGoToLogin,
  supabase,
} from "./supabase-client.js";

const form = document.querySelector("[data-home-form]");
const statusBox = document.querySelector("[data-admin-status]");
const updatedInfo = document.querySelector("[data-home-updated]");
const logoutButtons = document.querySelectorAll("[data-admin-logout]");

let currentUser = null;
let currentConfig = null;

const DEFAULT_CONFIG = {
  id: "principal",
  hero_kicker: "IFPE Campus Belo Jardim",
  hero_titulo: "Engenharia de Software",
  hero_subtitulo: "Formação pública, prática e conectada ao desenvolvimento de sistemas, projetos, inovação e impacto regional.",
  cta_primario_texto: "Conheça o curso",
  cta_primario_url: "sobre.html",
  cta_secundario_texto: "Veja formas de ingresso",
  cta_secundario_url: "ingresso.html",
  cta_terciario_texto: "Projetos e notícias",
  cta_terciario_url: "projetos.html",
  destaque_1_valor: "8 períodos",
  destaque_1_rotulo: "Jornada acadêmica",
  destaque_2_valor: "Presencial",
  destaque_2_rotulo: "Vivência no campus e contato com docentes",
  destaque_3_valor: "Projetos e extensão",
  destaque_3_rotulo: "Prática, pesquisa, desafios e oportunidades reais",
};

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setLoading(isLoading) {
  form?.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = isLoading;
  });
}

function fillForm(config = DEFAULT_CONFIG) {
  if (!form) return;
  Object.entries({ ...DEFAULT_CONFIG, ...config }).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });

  const updatedAt = config?.atualizado_em || config?.criado_em;
  if (updatedInfo) {
    updatedInfo.textContent = updatedAt
      ? `Última alteração: ${formatDateTime(updatedAt)}`
      : "Nenhuma alteração salva ainda.";
  }
}

function collectPayload() {
  const formData = new FormData(form);
  const payload = { id: "principal", atualizado_por: currentUser?.id || null };
  Object.keys(DEFAULT_CONFIG).forEach((key) => {
    if (key === "id") return;
    payload[key] = String(formData.get(key) || "").trim();
  });
  return payload;
}

async function loadConfig() {
  const { data, error } = await supabase
    .from("site_home_config")
    .select("*")
    .eq("id", "principal")
    .maybeSingle();

  if (error) throw error;
  currentConfig = data || DEFAULT_CONFIG;
  fillForm(currentConfig);
}

async function saveConfig(event) {
  event.preventDefault();
  setLoading(true);
  setStatus("Salvando informações da home...", "info");

  try {
    const payload = collectPayload();
    if (!payload.hero_titulo || !payload.hero_subtitulo) {
      setStatus("Preencha pelo menos o título e o texto principal da home.", "error");
      return;
    }

    const { data, error } = await supabase
      .from("site_home_config")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    currentConfig = data;
    fillForm(currentConfig);
    setStatus("Informações da home atualizadas com sucesso.", "success");
  } catch (error) {
    setStatus(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    setLoading(false);
  }
}

form?.addEventListener("submit", saveConfig);
form?.querySelector("[data-reset-defaults]")?.addEventListener("click", () => fillForm(DEFAULT_CONFIG));
logoutButtons.forEach((button) => button.addEventListener("click", signOutAndGoToLogin));

async function boot() {
  if (!isSupabaseConfigured) {
    setStatus(getConfigMessage(), "error");
    setLoading(true);
    return;
  }

  const access = await requireAdminAccess();
  if (!access.session) {
    window.location.href = "login.html";
    return;
  }
  if (!access.isAdmin) {
    setStatus("Apenas administradores podem editar a home.", "error");
    setLoading(true);
    return;
  }

  currentUser = access.session.user;
  await loadConfig();
  setStatus("Módulo da home carregado.", "success");
}

boot().catch((error) => {
  setStatus(`Erro ao carregar módulo: ${error.message}`, "error");
  setLoading(true);
});
