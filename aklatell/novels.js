// Batch DOM queries at initialization
const elements = {
  mainControlBtn: null,
  controlMenu: null,
  themeBtn: null,
  homeBtn: null,
  progressBar: null,
  backToTop: null,
  html: document.documentElement
};

const state = {
  theme: "light",
  scrollPosition: 0,
  menuOpen: false
};

/* ========= Theme Management ========= */
function initTheme() {
  const savedTheme = localStorage.getItem("user-theme");
  if (savedTheme) {
    state.theme = savedTheme;
  } else {
    state.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ?
      'dark' :
      'light';
  }
  setTheme(state.theme);
}

function setTheme(theme) {
  state.theme = theme;
  elements.html.setAttribute("data-theme", theme);
  localStorage.setItem("user-theme", theme);
  
  if (elements.themeBtn) {
    elements.themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

/* ========= Unified Scroll Handler ========= */
let scrollTicking = false;
let cachedMaxHeight = 0;

function updateMetrics() {
  cachedMaxHeight = elements.html.scrollHeight - window.innerHeight;
}

function handleScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  
  requestAnimationFrame(() => {
    const scrollY = window.scrollY;
    state.scrollPosition = scrollY;
    
    if (cachedMaxHeight > 0) {
      const scrollPercent = (scrollY / cachedMaxHeight) * 100;
      if (elements.progressBar) {
        elements.progressBar.style.width = scrollPercent + "%";
      }
    }
    
    if (elements.backToTop) {
      elements.backToTop.classList.toggle("show", scrollY > 500);
    }
    
    scrollTicking = false;
  });
}

// Update metrics on resize and init
window.addEventListener('resize', () => {
  updateMetrics();
  handleScroll();
});

/* ========= Scroll Persistence ========= */
const bookKey = "progress_" + (location.pathname.split("/").pop() || "default");
let scrollSaveTimer;

function saveScrollPosition() {
  try {
    localStorage.setItem(bookKey, window.scrollY.toString());
  } catch (e) {}
}

/* ========= Create UI Elements ========= */
function createUIElements() {
  if (document.getElementById('progressBarContainer')) return;
  
  const fragment = document.createDocumentFragment();
  
  const progressBarContainer = document.createElement('div');
  progressBarContainer.id = 'progressBarContainer';
  progressBarContainer.innerHTML = '<div id="progressBar"></div>';
  fragment.appendChild(progressBarContainer);
  
  const floatingControls = document.createElement('div');
  floatingControls.className = 'floating-controls';
  floatingControls.innerHTML = `
    <button class="control-btn" id="mainControlBtn" aria-label="Menu">☰</button>
    <div class="control-menu" id="controlMenu">
      <button class="control-item" id="homeBtn" aria-label="Home">🏠</button>
      <button class="control-item" id="themeBtn" aria-label="Toggle Theme">🌙</button>
    </div>
  `;
  fragment.appendChild(floatingControls);
  
  const backToTop = document.createElement('button');
  backToTop.id = 'backToTop';
  backToTop.setAttribute('aria-label', 'Back to Top');
  backToTop.textContent = '↑';
  fragment.appendChild(backToTop);
  
  document.body.insertBefore(fragment, document.body.firstChild);
}

/* ========= Event Delegation ========= */
function setupEventDelegation() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    
    // CLICK OUTSIDE MENU = close
    if (!e.target.closest(".floating-controls") && state.menuOpen) {
      state.menuOpen = false;
      elements.controlMenu.classList.remove("open");
    }
    
    if (!btn) return;
    
    switch (btn.id) {
      case "mainControlBtn":
        state.menuOpen = !state.menuOpen;
        elements.controlMenu.classList.toggle("open", state.menuOpen);
        break;
      case "themeBtn":
        setTheme(state.theme === "dark" ? "light" : "dark");
        break;
      case "homeBtn":
        window.location.href = "../index.html";
        break;
      case "backToTop":
        window.scrollTo({ top: 0, behavior: "auto" });
        break;
    }
  });
  
  // Smooth anchor scroll
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href^='#']");
    if (!link) return;
    
    e.preventDefault();
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      target.scrollIntoView({ behavior: "auto" });
    }
  });
}

/* ========= Initialize ========= */
function init() {
  createUIElements();
  
  // Cache elements
  elements.mainControlBtn = document.getElementById("mainControlBtn");
  elements.controlMenu = document.getElementById("controlMenu");
  elements.themeBtn = document.getElementById("themeBtn");
  elements.homeBtn = document.getElementById("homeBtn");
  elements.progressBar = document.getElementById("progressBar");
  elements.backToTop = document.getElementById("backToTop");
  
  initTheme();
  updateMetrics();
  
  // Restore scroll
  try {
    const saved = parseFloat(localStorage.getItem(bookKey));
    if (!isNaN(saved) && saved > 0) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    }
  } catch (e) {}
  
  setupEventDelegation();
  
  window.addEventListener("scroll", () => {
    handleScroll();
    
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(saveScrollPosition, 250);
  });
  
  handleScroll();
}

document.readyState === "loading" ?
  document.addEventListener("DOMContentLoaded", init) :
  init();

window.addEventListener("beforeunload", saveScrollPosition);