const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const yearElement = document.querySelector('#ano-atual');
const backToTop = document.querySelector('.back-to-top');
const form = document.querySelector('.interest-form');
const feedback = document.querySelector('.form-feedback');
const revealItems = document.querySelectorAll('.reveal');
const bodyPage = document.body.dataset.page;

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

function updateActiveLink() {
  navLinks.forEach((link) => link.classList.remove('active'));

  if (bodyPage === 'inicio') {
    const currentHash = window.location.hash || '#inicio';
    const target = currentHash === '#contato' ? 'contato' : 'inicio';
    const activeLink = document.querySelector(`.main-nav a[data-nav="${target}"]`);
    if (activeLink) activeLink.classList.add('active');
    return;
  }

  const activeLink = document.querySelector(`.main-nav a[data-nav="${bodyPage}"]`);
  if (activeLink) activeLink.classList.add('active');
}

window.addEventListener('hashchange', updateActiveLink);
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
