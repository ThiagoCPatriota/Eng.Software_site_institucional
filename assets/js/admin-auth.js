import {
  getConfigMessage,
  getCurrentSession,
  getOwnProfile,
  isAdminProfile,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const statusBox = document.querySelector("[data-auth-status]");
const params = new URLSearchParams(window.location.search);
const redirectTarget = params.get("redirect");
const loginForm = document.querySelector("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");
const tabButtons = document.querySelectorAll("[data-auth-tab]");
const panels = document.querySelectorAll("[data-auth-panel]");

function setStatus(message, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.add("is-visible");
  statusBox.classList.toggle("is-error", type === "error");
  statusBox.classList.toggle("is-success", type === "success");
}

function setLoading(form, isLoading) {
  if (!form) return;
  const button = form.querySelector("button[type='submit']");
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = isLoading;
  });
  if (button) {
    button.dataset.defaultText ||= button.textContent;
    button.textContent = isLoading ? "Validando..." : button.dataset.defaultText;
  }
}

function getSafeRedirectTarget() {
  if (!redirectTarget) return null;
  const trimmed = redirectTarget.trim();
  if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("//")) return null;
  return trimmed;
}

function goToStudentArea() {
  window.location.href = getSafeRedirectTarget() || "../index.html";
}

async function saveExtraStudentData(user, formData) {
  const matricula = String(formData.get("matricula") || "").trim();
  const emailAlternativo = String(formData.get("email_alternativo") || "").trim().toLowerCase();

  if (!user || (!matricula && !emailAlternativo)) return;

  try {
    const { error } = await supabase
      .from("site_profiles")
      .update({
        matricula: matricula || null,
        email_alternativo: emailAlternativo || null,
      })
      .eq("user_id", user.id);

    if (error) throw error;
  } catch (error) {
    console.warn("Dados extras do estudante não foram salvos. Rode o SQL schema-acesso-aluno.sql se necessário.", error);
  }
}

function openTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.authTab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.authPanel === tabName);
  });
}

async function redirectIfAlreadyAdmin() {
  const session = await getCurrentSession();
  if (!session) return;

  const profile = await getOwnProfile(session.user);
  if (isAdminProfile(profile)) {
    window.location.href = "index.html";
    return;
  }

  setStatus("Conta de estudante conectada. Redirecionando para o site...", "success");
  goToStudentArea();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => openTab(button.dataset.authTab));
});

if (isSupabaseConfigured) {
  redirectIfAlreadyAdmin().catch((error) => {
    setStatus(`Não foi possível verificar a sessão: ${error.message}`, "error");
  });
} else {
  console.warn(getConfigMessage());
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const emailAlternativo = String(formData.get("email_alternativo") || "").trim().toLowerCase();
  const matricula = String(formData.get("matricula") || "").trim();
  const password = String(formData.get("password") || "");

  setLoading(loginForm, true);
  setStatus("Conferindo credenciais...", "info");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await saveExtraStudentData(data.user, formData);

    const profile = await getOwnProfile(data.user);
    if (isAdminProfile(profile)) {
      setStatus("Acesso autorizado. Abrindo painel...", "success");
      window.location.href = "index.html";
      return;
    }

    setStatus("Acesso de estudante confirmado. Abrindo o site...", "success");
    goToStudentArea();
  } catch (error) {
    setStatus(`Erro ao entrar: ${error.message}`, "error");
  } finally {
    setLoading(loginForm, false);
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isSupabaseConfigured || !supabase) {
    setStatus(getConfigMessage(), "error");
    return;
  }

  const formData = new FormData(signupForm);
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const emailAlternativo = String(formData.get("email_alternativo") || "").trim().toLowerCase();
  const matricula = String(formData.get("matricula") || "").trim();
  const password = String(formData.get("password") || "");

  if (!matricula) {
    setStatus("Informe sua matrícula para criar o cadastro. Esse dado será usado como referência institucional nas reservas de laboratório.", "error");
    return;
  }

  setLoading(signupForm, true);
  setStatus("Criando cadastro...", "info");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          matricula,
          email_alternativo: emailAlternativo,
        },
      },
    });

    if (error) throw error;

    if (!data.session || !data.user) {
      setStatus("Cadastro criado. Confirme seu e-mail, se o Supabase solicitar, e depois faça login.", "success");
      signupForm.reset();
      openTab("login");
      return;
    }

    await saveExtraStudentData(data.user, formData);

    const profile = await getOwnProfile(data.user);
    if (isAdminProfile(profile)) {
      setStatus("Cadastro criado com permissão administrativa. Abrindo painel...", "success");
      window.location.href = "index.html";
      return;
    }

    setStatus("Cadastro de estudante criado com matrícula. Abrindo o site com seu perfil...", "success");
    signupForm.reset();
    goToStudentArea();
  } catch (error) {
    setStatus(`Erro ao criar cadastro: ${error.message}`, "error");
  } finally {
    setLoading(signupForm, false);
  }
});
