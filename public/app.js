// ── Nova Black · Router ──
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-links a[data-page]');
const heroTitle = document.getElementById('hero-title');
const heroLabel = document.getElementById('hero-label');

const meta = {
  home:  { title: 'Nova Black', label: 'Welcome' },
  music: { title: 'Music',      label: 'Listen & Discover' },
  chat:  { title: 'Chat',       label: 'Connect' },
  games: { title: 'Games',      label: 'Play Now' },
  tools: { title: 'Tools',      label: 'Build & Create' },
};

function navigate(id) {
  // update pages
  pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));

  // update nav
  navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === id));

  // update hero
  const m = meta[id] || meta.home;
  heroTitle.textContent = m.title;
  heroLabel.textContent = m.label;

  // update URL hash silently
  history.replaceState(null, '', '#' + id);
}

navLinks.forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    navigate(a.dataset.page);
  });
});

// load from hash
const initial = location.hash.replace('#', '') || 'home';
navigate(initial);
