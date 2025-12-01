/* ========= Expandable Controls Menu ========= */
const mainControlBtn = document.getElementById("mainControlBtn");
const controlMenu = document.getElementById("controlMenu");

mainControlBtn.addEventListener("click", () => {
  controlMenu.classList.toggle("open");
});

/* Close menu if clicking outside */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".floating-controls")) {
    controlMenu.classList.remove("open");
  }
});

/* ========= Theme Management ========= */
const themeBtn = document.getElementById('themeBtn');
const html = document.documentElement;

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (saved) {
    setTheme(saved);
  } else {
    setTheme(prefersDark ? "dark" : "light");
  }
}

function setTheme(theme) {
  html.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}

themeBtn.addEventListener("click", () => {
  setTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

/* Sync with system changes */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", e => {
  if (!localStorage.getItem("theme")) {
    setTheme(e.matches ? "dark" : "light");
  }
});

/* ========= Home Button ========= */
const homeBtn = document.getElementById("homeBtn");
homeBtn.addEventListener("click", () => {
  window.location.href = "../index.html";
});

/* ========= Reading Progress ========= */
const bookKey = "progress_" + location.pathname.split("/").pop();

window.addEventListener("load", () => {
  const saved = parseFloat(localStorage.getItem(bookKey));
  if (!isNaN(saved)) window.scrollTo(0, saved);
  initTheme();
});

/* Debounced scroll saving */
let timeout;
window.addEventListener("scroll", () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    localStorage.setItem(bookKey, window.scrollY);
  }, 80);
});

/* ========= Progress Bar ========= */
const progressBar = document.getElementById("progressBar");

function updateProgress() {
  const h = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.width = (scrollY / h * 100) + "%";
}

window.addEventListener("scroll", updateProgress);
window.addEventListener("load", updateProgress);

/* ========= Smooth anchor scrolling ========= */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(a.getAttribute("href"))?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

/* ========= Back to Top Button ========= */
const backToTop = document.getElementById("backToTop");

// Show button when scrolled down 500px
window.addEventListener("scroll", () => {
  if (window.scrollY > 500) {
    backToTop.classList.add("show");
  } else {
    backToTop.classList.remove("show");
  }
});

// Smooth scroll to top
backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});