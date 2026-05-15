const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const navGroups = document.querySelectorAll('.nav-group');
const yearElement = document.querySelector('#ano-atual');
const backToTop = document.querySelector('.back-to-top');
const forms = document.querySelectorAll('.interest-form, [data-contact-form]');
const bodyPage = document.body.dataset.page;

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

function closeNavGroups(exceptGroup = null) {
  navGroups.forEach((group) => {
    if (group !== exceptGroup) group.removeAttribute('open');
  });
}

function closeMenu() {
  if (!menuToggle || !mainNav) return;
  menuToggle.classList.remove('is-open');
  mainNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
  closeNavGroups();
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    menuToggle.classList.toggle('is-open', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  navGroups.forEach((group) => {
    group.addEventListener('toggle', () => {
      if (group.open) closeNavGroups(group);
    });
  });

  document.addEventListener('click', (event) => {
    if (!mainNav.contains(event.target) && !menuToggle.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

function updateActiveLink() {
  navLinks.forEach((link) => {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
  });
  navGroups.forEach((group) => group.classList.remove('active'));

  if (bodyPage === 'inicio') {
    const activeLink = document.querySelector('.main-nav a[data-nav="inicio"]');
    if (activeLink) {
      activeLink.classList.add('active');
      activeLink.setAttribute('aria-current', 'page');
    }
    return;
  }

  const activeLink = document.querySelector(`.main-nav a[data-nav="${bodyPage}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
    activeLink.setAttribute('aria-current', 'page');
    const group = activeLink.closest('.nav-group');
    if (group) group.classList.add('active');
  }
}

window.addEventListener('hashchange', updateActiveLink);
window.addEventListener('load', updateActiveLink);

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function setupForms() {
  forms.forEach((form) => {
    const feedback = form.querySelector('.form-feedback');
    if (!feedback) return;

    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const nome = String(formData.get('nome') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const assunto = String(formData.get('assunto') || '').trim();
      const mensagem = String(formData.get('mensagem') || '').trim();
      const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const isContactForm = form.matches('[data-contact-form]');

      feedback.classList.remove('success', 'error');

      if (!nome || !email) {
        feedback.textContent = 'Preencha nome e e-mail para continuar.';
        feedback.classList.add('error');
        return;
      }

      if (!emailValido) {
        feedback.textContent = 'Informe um e-mail válido.';
        feedback.classList.add('error');
        return;
      }

      if (isContactForm && (!assunto || !mensagem)) {
        feedback.textContent = 'Selecione o assunto e escreva sua mensagem antes de simular o envio.';
        feedback.classList.add('error');
        return;
      }

      feedback.textContent = isContactForm
        ? 'Mensagem validada visualmente. Quando houver backend, este envio poderá ser conectado ao canal oficial do curso.'
        : 'Cadastro de interesse registrado visualmente. Depois podemos conectar esse formulário ao backend.';
      feedback.classList.add('success');
      form.reset();
    });
  });
}

setupForms();

const dadosSite = window.dadosSite || {};

function createTag(label) {
  const span = document.createElement('span');
  span.className = 'tag';
  span.textContent = label;
  return span;
}

function createUpdateCard(item) {
  const article = document.createElement('article');
  article.className = 'news-card dynamic-card';

  article.appendChild(createTag(item.tipo || item.categoria || item.formato || 'Destaque'));

  if (item.data) {
    const date = document.createElement('small');
    date.className = 'card-date';
    date.textContent = item.data;
    article.appendChild(date);
  }

  const title = document.createElement('h3');
  title.textContent = item.titulo;
  article.appendChild(title);

  const summary = document.createElement('p');
  summary.textContent = item.resumo;
  article.appendChild(summary);

  if (item.link) {
    const link = document.createElement('a');
    link.className = 'text-link compact-link';
    link.href = item.link;
    link.textContent = 'Ver detalhes';
    article.appendChild(link);
  }

  return article;
}

function createTestimonialCard(item) {
  const article = document.createElement('article');
  article.className = 'testimonial-card';

  const quote = document.createElement('p');
  quote.textContent = `“${item.texto}”`;
  article.appendChild(quote);

  const footer = document.createElement('div');
  footer.className = 'testimonial-author';

  const name = document.createElement('strong');
  name.textContent = item.nome;
  footer.appendChild(name);

  const profile = document.createElement('span');
  profile.textContent = item.perfil;
  footer.appendChild(profile);

  article.appendChild(footer);
  return article;
}


function createStudentLinkCard(item) {
  const article = document.createElement('article');
  article.className = 'student-link-card';

  const icon = document.createElement('span');
  icon.className = 'student-link-icon';
  icon.textContent = item.icone || '↗';
  article.appendChild(icon);

  const title = document.createElement('h3');
  title.textContent = item.titulo;
  article.appendChild(title);

  const summary = document.createElement('p');
  summary.textContent = item.resumo;
  article.appendChild(summary);

  const meta = document.createElement('div');
  meta.className = 'student-link-meta';
  [item.categoria, item.tipo, item.status].filter(Boolean).forEach((label) => {
    const tag = document.createElement('span');
    tag.textContent = label;
    meta.appendChild(tag);
  });
  article.appendChild(meta);

  const link = document.createElement('a');
  link.className = 'student-link-action';
  link.href = item.link || '#';
  link.textContent = item.link && item.link !== '#' ? 'Abrir acesso' : 'Link a confirmar';
  if (!item.link || item.link === '#') {
    link.setAttribute('aria-disabled', 'true');
    link.addEventListener('click', (event) => event.preventDefault());
  }
  article.appendChild(link);

  return article;
}

function createCalendarItem(item) {
  const article = document.createElement('article');
  article.className = 'calendar-item';
  article.dataset.calendarCategory = item.categoria || 'todos';

  const dot = document.createElement('div');
  dot.className = 'calendar-dot';
  dot.textContent = item.marcador || '•';
  article.appendChild(dot);

  const card = document.createElement('div');
  card.className = 'calendar-card';

  const header = document.createElement('div');
  header.className = 'calendar-card-header';

  const tag = document.createElement('small');
  tag.textContent = item.etiqueta || item.categoria || 'Data';
  header.appendChild(tag);

  const date = document.createElement('span');
  date.className = 'status-badge';
  date.textContent = item.data || 'A confirmar';
  header.appendChild(date);
  card.appendChild(header);

  const title = document.createElement('h3');
  title.textContent = item.titulo;
  card.appendChild(title);

  const summary = document.createElement('p');
  summary.textContent = item.resumo;
  card.appendChild(summary);

  if (item.status) {
    const tags = document.createElement('div');
    tags.className = 'calendar-tags';
    const status = document.createElement('span');
    status.textContent = item.status;
    tags.appendChild(status);
    card.appendChild(tags);
  }

  article.appendChild(card);
  return article;
}

function renderCollection(selector, data, factory) {
  const container = document.querySelector(selector);
  if (!container || !Array.isArray(data)) return;

  container.innerHTML = '';
  data.forEach((item) => container.appendChild(factory(item)));
}

renderCollection('[data-render="home-destaques"]', dadosSite.destaquesHome, createUpdateCard);
renderCollection('[data-render="noticias"]', dadosSite.noticias, createUpdateCard);
renderCollection('[data-render="eventos"]', dadosSite.eventos, createUpdateCard);
renderCollection('[data-render="depoimentos"]', dadosSite.depoimentos, createTestimonialCard);
renderCollection('[data-render="links-aluno"]', dadosSite.linksAluno, createStudentLinkCard);
renderCollection('[data-render="calendario"]', dadosSite.calendarioAcademico, createCalendarItem);

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }
}

setupRevealAnimations();

const faqItems = document.querySelectorAll('.faq-item');
const faqSearch = document.querySelector('[data-faq-search]');
const faqEmpty = document.querySelector('[data-faq-empty]');

faqItems.forEach((item) => {
  const button = item.querySelector('button');
  const icon = button?.querySelector('span');

  if (!button) return;

  button.addEventListener('click', () => {
    const isOpen = item.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    if (icon) icon.textContent = isOpen ? '−' : '+';
  });
});

if (faqSearch) {
  faqSearch.addEventListener('input', () => {
    const term = faqSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const searchable = `${item.textContent} ${item.dataset.faqKeywords || ''}`.toLowerCase();
      const visible = !term || searchable.includes(term);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (faqEmpty) faqEmpty.hidden = visibleCount !== 0;
  });
}

const periodTabs = document.querySelectorAll('.period-tab');
const periodPanels = document.querySelectorAll('.period-panel');

periodTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.period;

    periodTabs.forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    });

    periodPanels.forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
  });
});

function setupExperienceRails() {
  const scrollButtons = document.querySelectorAll('[data-rail-prev], [data-rail-next]');

  scrollButtons.forEach((button) => {
    const selector = button.dataset.railPrev || button.dataset.railNext;
    const direction = button.dataset.railPrev ? -1 : 1;
    const rail = selector ? document.querySelector(selector) : null;

    if (!rail) return;

    button.addEventListener('click', () => {
      const distance = Math.max(280, Math.round(rail.clientWidth * 0.78));
      rail.scrollBy({ left: distance * direction, behavior: 'smooth' });
    });
  });
}

function setupChoicePanels() {
  const groups = document.querySelectorAll('[data-choice-group]');

  groups.forEach((group) => {
    const tabs = group.querySelectorAll('[data-choice-target]');
    const panelRoot = document.querySelector(group.dataset.choicePanels || '');
    const panels = panelRoot ? panelRoot.querySelectorAll('.choice-panel') : [];

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.choiceTarget;

        tabs.forEach((item) => {
          const active = item === tab;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', String(active));
        });

        panels.forEach((panel) => {
          const active = panel.id === targetId;
          panel.classList.toggle('active', active);
          panel.hidden = !active;
        });
      });
    });
  });
}

setupExperienceRails();
setupChoicePanels();

function setupCalendarFilters() {
  const filterButtons = document.querySelectorAll('[data-calendar-filter]');
  const calendarItems = document.querySelectorAll('.calendar-item');
  const emptyMessage = document.querySelector('[data-calendar-empty]');

  if (!filterButtons.length || !calendarItems.length) return;

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.calendarFilter || 'todos';
      let visibleCount = 0;

      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });

      calendarItems.forEach((item) => {
        const category = item.dataset.calendarCategory;
        const visible = filter === 'todos' || category === filter;
        item.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (emptyMessage) emptyMessage.hidden = visibleCount !== 0;
    });
  });
}

setupCalendarFilters();
