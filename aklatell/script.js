// State management
let allBooks = []; // Master list from JSON
let filteredBooks = []; // Currently displayed subset
let favorites = [];
let renderedCount = 0;
const ITEMS_PER_PAGE = 12;
let currentFilter = 'all';

// Initialize
const init = async () => {
  loadStorage();
  setupEventListeners();
  await fetchBooks(); // Wait for data before rendering
};

// FETCH DATA (Replaces the old books.js file)
const fetchBooks = async () => {
  const grid = document.getElementById('booksGrid');
  grid.innerHTML = '<div class="loading">Loading library...</div>';
  
  try {
    const response = await fetch('books.json');
    if (!response.ok) throw new Error('Failed to load books');
    
    allBooks = await response.json();
    filteredBooks = [...allBooks]; // Initialize filtered list
    
    resetAndRender(); // First render
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="error">⚠️ Could not load books. Please refresh.</div>';
  }
};

const loadStorage = () => {
  try {
    const storedFavs = localStorage.getItem('aklatell_favorites');
    if (storedFavs) favorites = JSON.parse(storedFavs);
    
    const storedTheme = localStorage.getItem('aklatell_theme');
    if (storedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.getElementById('themeToggle').textContent = '☀️';
    }
  } catch (e) { console.error(e); }
  updateFavCount();
};

// Render Logic
const renderBatch = () => {
  const grid = document.getElementById('booksGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  
  // Remove loading spinner if it exists
  const loading = grid.querySelector('.loading');
  if (loading) loading.remove();
  
  const fragment = document.createDocumentFragment();
  const nextBatch = filteredBooks.slice(renderedCount, renderedCount + ITEMS_PER_PAGE);
  
  if (nextBatch.length === 0 && renderedCount === 0) {
    grid.innerHTML = '<div class="no-results">📖 No books found.</div>';
    loadMoreBtn.style.display = 'none';
    return;
  }
  
  nextBatch.forEach(book => {
    const isFav = favorites.includes(book.id);
    const card = document.createElement('article');
    card.className = 'book-card';
    
    card.innerHTML = `
      <a href="${book.link}" class="card-link-overlay" aria-label="Read ${book.title}"></a>
      <button class="favorite-btn ${isFav ? 'active' : ''}" 
              data-id="${book.id}"
              aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <span class="book-emoji">${book.emoji}</span>
      <h3 class="book-title">${book.title}</h3>
      <p class="book-author">by ${book.author}</p>
      <p class="book-preview">${book.preview}</p>
    `;
    fragment.appendChild(card);
  });
  
  grid.appendChild(fragment);
  renderedCount += nextBatch.length;
  
  if (renderedCount >= filteredBooks.length) {
    loadMoreBtn.style.display = 'none';
  } else {
    loadMoreBtn.style.display = 'block';
  }
};

const resetAndRender = () => {
  document.getElementById('booksGrid').innerHTML = '';
  renderedCount = 0;
  renderBatch();
};

// Filters & Sort
const applyFilters = (searchTerm) => {
  let result = allBooks; // Start from master list
  
  // 1. Filter by Favorites Tab
  if (currentFilter === 'favorites') {
    result = result.filter(b => favorites.includes(b.id));
  }
  
  // 2. Filter by Search
  if (searchTerm) {
    result = result.filter(b =>
      b.title.toLowerCase().includes(searchTerm) ||
      b.author.toLowerCase().includes(searchTerm)
    );
  }
  
  // 3. Sort
  const sortBy = document.getElementById('sortSelect').value;
  if (sortBy === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === 'author') result.sort((a, b) => a.author.localeCompare(b.author));
  if (sortBy === 'newest') result.sort((a, b) => b.id - a.id);
  
  filteredBooks = result;
  resetAndRender();
};

// Event Listeners
const setupEventListeners = () => {
  document.getElementById('loadMoreBtn').addEventListener('click', renderBatch);
  
  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      applyFilters(e.target.value.toLowerCase());
    }, 300);
  });
  
  document.getElementById('sortSelect').addEventListener('change', () => {
    applyFilters(document.getElementById('searchInput').value.toLowerCase());
  });
  
  document.querySelector('.toolbar-actions').addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-chip')) {
      document.querySelectorAll('.filter-chip').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      applyFilters(document.getElementById('searchInput').value.toLowerCase());
    }
  });
  
  document.getElementById('booksGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.favorite-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const bookId = parseInt(btn.dataset.id);
      toggleFavorite(bookId);
      
      const isFav = favorites.includes(bookId);
      btn.classList.toggle('active', isFav);
      btn.textContent = isFav ? '❤️' : '🤍';
      btn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    }
  });
  
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('aklatell_theme', isDark ? 'dark' : 'light');
  });
  
  const menuModal = document.getElementById('menuModal');
  document.getElementById('menuBtn').addEventListener('click', () => menuModal.classList.add('active'));
  document.getElementById('closeModal').addEventListener('click', () => menuModal.classList.remove('active'));
  menuModal.addEventListener('click', (e) => {
    if (e.target === menuModal) menuModal.classList.remove('active');
  });
};

const toggleFavorite = (id) => {
  const index = favorites.indexOf(id);
  if (index === -1) favorites.push(id);
  else favorites.splice(index, 1);
  
  localStorage.setItem('aklatell_favorites', JSON.stringify(favorites));
  updateFavCount();
  
  if (currentFilter === 'favorites') {
    applyFilters(document.getElementById('searchInput').value.toLowerCase());
  }
};

const updateFavCount = () => {
  document.getElementById('favCount').textContent = favorites.length;
};

// Run
init();