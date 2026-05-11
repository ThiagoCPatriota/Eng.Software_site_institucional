const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const yearElement = document.querySelector('#ano-atual');
const backToTop = document.querySelector('.back-to-top');
const form = document.querySelector('.interest-form');
const feedback = document.querySelector('.form-feedback');
const revealItems = document.querySelectorAll('.reveal');

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

function closeMenu() {
  if (!menuToggle || !mainNav) return;
  menuToggle.classList.remove('is-open');
  mainNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

const sections = [...document.querySelectorAll('main section[id]')];

function getCurrentFileName() {
  const fileName = window.location.pathname.split('/').pop();
  return fileName || 'index.html';
}

function isSamePageHashLink(link) {
  const href = link.getAttribute('href') || '';
  const currentFile = getCurrentFileName();

  if (!link.hash) return false;
  if (href.startsWith('#')) return true;
  if (href.startsWith(`${currentFile}#`)) return true;
  if (currentFile === 'index.html' && href.startsWith('index.html#')) return true;

  return false;
}

function updateActiveLink() {
  const samePageLinks = [...navLinks].filter(isSamePageHashLink);

  if (!sections.length || !samePageLinks.length) return;

  const scrollPosition = window.scrollY + 130;
  let currentSection = sections[0]?.id;

  sections.forEach((section) => {
    if (scrollPosition >= section.offsetTop) {
      currentSection = section.id;
    }
  });

  samePageLinks.forEach((link) => {
    const isActive = link.hash === `#${currentSection}`;
    link.classList.toggle('active', isActive);
  });
}

window.addEventListener('scroll', updateActiveLink, { passive: true });
window.addEventListener('load', updateActiveLink);

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (form && feedback) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const nome = String(formData.get('nome') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

    feedback.textContent = 'Cadastro de interesse registrado visualmente. Na próxima fase podemos conectar esse formulário.';
    feedback.classList.add('success');
    form.reset();
  });
}

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

const faqItems = document.querySelectorAll('.faq-item');

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
