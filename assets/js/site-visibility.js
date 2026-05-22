import { isSupabaseConfigured, supabase } from "./supabase-client.js";

function normalizeHref(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.pathname.split("/").pop() || "index.html";
  } catch {
    return String(value).split("#")[0].split("?")[0];
  }
}

function hideNavigationLinks(hiddenPages) {
  const hiddenSlugs = new Set(hiddenPages.map((page) => page.slug));
  const hiddenUrls = new Set(hiddenPages.map((page) => normalizeHref(page.url)));

  document.querySelectorAll("a[href]").forEach((link) => {
    const navSlug = link.dataset.nav;
    const href = normalizeHref(link.getAttribute("href"));
    if ((navSlug && hiddenSlugs.has(navSlug)) || hiddenUrls.has(href)) {
      link.hidden = true;
      link.setAttribute("aria-hidden", "true");
      link.tabIndex = -1;
    }
  });

  document.querySelectorAll("details.nav-group").forEach((group) => {
    const visibleLinks = Array.from(group.querySelectorAll("a[href]")).filter((link) => !link.hidden);
    if (visibleLinks.length === 0) {
      group.hidden = true;
      group.setAttribute("aria-hidden", "true");
    }
  });
}

function renderUnavailablePage(currentPage) {
  if (!currentPage || currentPage === "inicio") return;
  const main = document.querySelector("main");
  if (!main) return;

  main.innerHTML = `
    <section class="section" aria-labelledby="titulo-pagina-indisponivel">
      <div class="container projects-empty-state is-visible" style="margin-top: clamp(80px, 12vw, 130px);">
        <span class="eyebrow">Página temporariamente indisponível</span>
        <h1 id="titulo-pagina-indisponivel">Esta seção está oculta no momento.</h1>
        <p>O administrador do site desativou temporariamente esta página. Volte para a página inicial ou consulte outro canal institucional.</p>
        <a class="btn btn-primary" href="index.html">Voltar ao início</a>
      </div>
    </section>
  `;
}

async function applyPageVisibility() {
  if (!isSupabaseConfigured || !supabase) return;

  const { data, error } = await supabase
    .from("site_paginas_visibilidade")
    .select("slug, url, visivel")
    .eq("visivel", false);

  if (error) throw error;

  const hiddenPages = data || [];
  if (!hiddenPages.length) return;

  hideNavigationLinks(hiddenPages);

  const current = document.body?.dataset?.page;
  if (current && hiddenPages.some((page) => page.slug === current)) {
    renderUnavailablePage(current);
  }
}

applyPageVisibility().catch((error) => {
  console.warn("Não foi possível aplicar a visibilidade das páginas:", error);
});
