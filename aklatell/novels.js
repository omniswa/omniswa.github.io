// Batch DOM queries at initialization
const elements = {
  mainControlBtn: null,
  controlMenu: null,
  themeBtn: null,
  homeBtn: null,
  progressBar: null,
  backToTop: null,
  // Use documentElement for attributes, but use scrollingElement for scroll metrics
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
    state.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(state.theme);
}

function setTheme(theme) {
  state.theme = theme;
  elements.html.setAttribute("data-theme", theme);
  try { localStorage.setItem("user-theme", theme); } catch (e) {}
  if (elements.themeBtn) elements.themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

/* ========= Scroll / Progress helpers ========= */

// Get the element that actually scrolls (works across browsers)
function getScrollEl() {
  // Prefer document.scrollingElement; fallback to body or html
  return document.scrollingElement || document.documentElement || document.body;
}

// Compute current maximum scrollable distance (fresh each call)
function computeMaxScroll() {
  const scrollEl = getScrollEl();
  // Use the larger of body/html to be safe when some styles force one to size
  const doc = document.documentElement;
  const body = document.body;
  const scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0, scrollEl.scrollHeight || 0);
  const max = Math.max(0, scrollHeight - window.innerHeight);
  return max;
}

/* ========= Unified Scroll Handler (rAF + passive) ========= */
let scrollTicking = false;

function handleScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  
  requestAnimationFrame(() => {
    const scrollEl = getScrollEl();
    const scrollY = Math.max(0, Math.floor(scrollEl.scrollTop || window.scrollY || 0));
    state.scrollPosition = scrollY;
    
    const maxHeight = computeMaxScroll();
    // Avoid division by zero
    if (maxHeight > 0 && elements.progressBar) {
      let pct = (scrollY / maxHeight) * 100;
      // Clamp to [0,100]
      pct = Math.max(0, Math.min(100, pct));
      elements.progressBar.style.width = pct + "%";
    } else if (elements.progressBar) {
      elements.progressBar.style.width = "0%";
    }
    
    if (elements.backToTop) {
      elements.backToTop.classList.toggle("show", scrollY > 500);
    }
    
    scrollTicking = false;
  });
}

/* ========= Scroll Persistence ========= */
const bookKey = "progress_" + (location.pathname.split("/").pop() || "default");
let scrollSaveTimer;

function saveScrollPosition() {
  try {
    const scrollEl = getScrollEl();
    localStorage.setItem(bookKey, String(Math.floor(scrollEl.scrollTop || 0)));
  } catch (e) {
    // ignore quota errors
  }
}

/* ========= Accurate Scroll Restore (layout-stable restore) ========= */

// Repeatedly try to restore scroll until layout stabilizes (or max attempts reached)
function accurateRestore(saved) {
  if (!saved || isNaN(saved)) return;
  let attempts = 0;
  const maxAttempts = 40; // try for up to ~2s (40 * 50ms)
  const threshold = 2; // px
  
  // If a previous interval exists, clear? We rely on local scope so it's fine.
  const restoreInterval = setInterval(() => {
    attempts++;
    const scrollEl = getScrollEl();
    // Use absolute set to avoid interfering with browser's own restore
    scrollEl.scrollTo(0, saved);
    
    // If we're within a small threshold, stop early
    if (Math.abs((scrollEl.scrollTop || 0) - saved) <= threshold || attempts >= maxAttempts) {
      clearInterval(restoreInterval);
    }
  }, 50);
}

/* ========= Create UI Elements ========= */
function createUIElements() {
  if (document.getElementById('progressBarContainer')) return;
  
  const fragment = document.createDocumentFragment();
  
  const progressBarContainer = document.createElement('div');
  progressBarContainer.id = 'progressBarContainer';
  // Minimal inline structure — styling expected in CSS
  progressBarContainer.innerHTML = '<div id="progressBar" aria-hidden="true"></div>';
  fragment.appendChild(progressBarContainer);
  
  const floatingControls = document.createElement('div');
  floatingControls.className = 'floating-controls';
  floatingControls.innerHTML = `
    <button class="control-btn" id="mainControlBtn" aria-label="Menu">☰</button>
    <div class="control-menu" id="controlMenu" aria-hidden="true">
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
      if (elements.controlMenu) elements.controlMenu.classList.remove("open");
    }
    
    if (!btn) return;
    
    switch (btn.id) {
      case "mainControlBtn":
        state.menuOpen = !state.menuOpen;
        if (elements.controlMenu) elements.controlMenu.classList.toggle("open", state.menuOpen);
        break;
      case "themeBtn":
        setTheme(state.theme === "dark" ? "light" : "dark");
        break;
      case "homeBtn":
        window.location.href = "../index.html";
        break;
      case "backToTop":
        // Use instant scroll to prevent animation interfering with restore
        const scrollEl = getScrollEl();
        scrollEl.scrollTo({ top: 0, behavior: "auto" });
        break;
    }
  });
  
  // Smooth anchor scroll (anchors inside same page)
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href^='#']");
    if (!link) return;
    
    e.preventDefault();
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      // Use auto to make deterministic for restore; if you want smooth, change to 'smooth'
      target.scrollIntoView({ behavior: "auto" });
    }
  });
}

/* ========= Utility: listen for images and media that can change layout ========= */
function watchImagesAndMedia() {
  // Recompute metrics when images load (they may change layout)
  const imgs = Array.from(document.images || []);
  imgs.forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', () => {
        handleScroll(); // recompute and paint progress
      }, { once: true, passive: true });
      img.addEventListener('error', () => {
        handleScroll();
      }, { once: true, passive: true });
    }
  });
  
  // For video elements or iframes, listen for loadedmetadata
  const medias = Array.from(document.querySelectorAll('video, iframe'));
  medias.forEach(m => {
    m.addEventListener('loadedmetadata', handleScroll, { once: true, passive: true });
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
  
  // Setup observers to detect layout changes and recompute progress
  // ResizeObserver to watch body/content size changes (fires quickly when text/images reflow)
  let ro;
  try {
    ro = new ResizeObserver(() => {
      // Layout changed; recompute and update progress
      handleScroll();
    });
    ro.observe(document.body);
  } catch (e) {
    // ResizeObserver not supported -> fallback to window resize
    window.addEventListener('resize', handleScroll, { passive: true });
  }
  
  // Also watch images/media which often cause layout shifts
  watchImagesAndMedia();
  
  // Restore scroll position as accurately as possible
  try {
    const saved = parseFloat(localStorage.getItem(bookKey));
    if (!isNaN(saved) && saved >= 0) {
      // First attempt immediately (in rAF) — then accurateRestore will retry until stable
      requestAnimationFrame(() => {
        const scrollEl = getScrollEl();
        scrollEl.scrollTo(0, saved);
        // Start robust restore loop
        accurateRestore(saved);
      });
    }
  } catch (e) {
    // ignore
  }
  
  setupEventDelegation();
  
  // Save scroll position with a debounce
  window.addEventListener("scroll", () => {
    handleScroll();
    
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(saveScrollPosition, 250);
  }, { passive: true });
  
  // Ensure we run an initial paint for progress
  handleScroll();
  
  // After all resources are loaded, try restore again (images/fonts may have changed layout)
  window.addEventListener("load", () => {
    handleScroll();
    try {
      const saved = parseFloat(localStorage.getItem(bookKey));
      if (!isNaN(saved) && saved >= 0) accurateRestore(saved);
    } catch (e) {}
  });
  
  // Fonts can be slow — when ready, re-run restore/metrics
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      handleScroll();
      try {
        const saved = parseFloat(localStorage.getItem(bookKey));
        if (!isNaN(saved) && saved >= 0) accurateRestore(saved);
      } catch (e) {}
    }).catch(() => {});
  }
  
  // Persist on unload (best-effort)
  window.addEventListener("beforeunload", saveScrollPosition);
}

// Run init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}