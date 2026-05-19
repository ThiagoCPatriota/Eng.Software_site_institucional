import {
  getCurrentSession,
  getOwnProfile,
  isAdminProfile,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

const accessLink = document.querySelector(".nav-access-button");
const bodyPage = document.body?.dataset?.page || "";

function buildRedirectTarget() {
  const path = `${window.location.pathname.split("/").pop() || "index.html"}${window.location.search || ""}${window.location.hash || ""}`;
  return path;
}

function getInitials(nameOrEmail = "") {
  const value = String(nameOrEmail || "").trim();
  if (!value) return "ES";

  const parts = value.includes("@")
    ? [value.split("@")[0]]
    : value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function createProfileMenu(profile, session) {
  const wrapper = document.createElement("details");
  wrapper.className = "nav-profile-menu";
  wrapper.dataset.nav = "perfil";

  const displayName = profile?.nome || session.user.email || "Aluno";
  const role = profile?.role === "admin" ? "Admin" : profile?.role === "editor" ? "Editor" : "Aluno";
  const initials = getInitials(displayName);

  const summary = document.createElement("summary");
  summary.className = "nav-profile-summary";
  summary.setAttribute("aria-label", `Perfil logado: ${displayName}`);
  summary.innerHTML = `
    <span class="nav-profile-avatar" aria-hidden="true">${initials}</span>
    <span class="nav-profile-text">
      <strong>${displayName.split(" ").slice(0, 2).join(" ")}</strong>
      <small>${role}</small>
    </span>
  `;

  const dropdown = document.createElement("div");
  dropdown.className = "nav-profile-dropdown";

  if (isAdminProfile(profile)) {
    const adminItem = document.createElement("a");
    adminItem.href = "admin/index.html";
    adminItem.textContent = "Painel administrativo";
    dropdown.appendChild(adminItem);
  } else {
    const studentPanelItem = document.createElement("a");
    studentPanelItem.href = "area-aluno.html";
    studentPanelItem.textContent = "Painel do aluno";
    dropdown.appendChild(studentPanelItem);
  }

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.textContent = "Sair";
  logoutButton.addEventListener("click", async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "admin/login.html";
  });
  dropdown.appendChild(logoutButton);

  wrapper.appendChild(summary);
  wrapper.appendChild(dropdown);
  return wrapper;
}

function keepAccessAsLogin() {
  if (!accessLink) return;
  const redirect = encodeURIComponent(buildRedirectTarget());
  accessLink.href = `admin/login.html?redirect=..%2F${redirect}`;
  accessLink.textContent = "Acesso";
  accessLink.classList.remove("is-hidden");
}

async function setupPublicAuth() {
  if (!accessLink) return;

  if (!isSupabaseConfigured) {
    keepAccessAsLogin();
    return;
  }

  try {
    const session = await getCurrentSession();
    if (!session) {
      keepAccessAsLogin();
      return;
    }

    const profile = await getOwnProfile(session.user);
    const profileMenu = createProfileMenu(profile, session);
    accessLink.replaceWith(profileMenu);

    if (bodyPage === "area-aluno") {
      document.body.classList.add("student-is-logged");
    }
  } catch (error) {
    console.warn("Não foi possível carregar o perfil público:", error);
    keepAccessAsLogin();
  }
}

setupPublicAuth();
