// State management
let favorites = [];
let currentBooks = [...books];
let currentFilter = 'all';

// Initialize from localStorage
const initStorage = () => {
  try {
    // Load favorites from localStorage
    const storedFavorites = localStorage.getItem('aklatell_favorites');
    if (storedFavorites) {
      favorites = JSON.parse(storedFavorites);
    }
  } catch (e) {
    console.error('Error loading favorites:', e);
    favorites = [];
  }
  
  try {
    // Load theme preference from localStorage
    const storedTheme = localStorage.getItem('aklatell_theme');
    if (storedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.getElementById('themeToggle').textContent = '☀️';
    }
  } catch (e) {
    console.error('Error loading theme:', e);
  }
};

// Save favorites to localStorage
const saveFavorites = () => {
  try {
    localStorage.setItem('aklatell_favorites', JSON.stringify(favorites));
  } catch (e) {
    console.error('Error saving favorites:', e);
  }
};

// Save theme to localStorage
const saveTheme = (isDark) => {
  try {
    localStorage.setItem('aklatell_theme', isDark ? 'dark' : 'light');
  } catch (e) {
    console.error('Error saving theme:', e);
  }
};

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  saveTheme(isDark);
});

// Menu modal
const menuBtn = document.getElementById('menuBtn');
const menuModal = document.getElementById('menuModal');
const closeModal = document.getElementById('closeModal');

menuBtn.addEventListener('click', () => {
  menuModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
  menuModal.classList.remove('active');
});

menuModal.addEventListener('click', (e) => {
  if (e.target === menuModal) {
    menuModal.classList.remove('active');
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuModal.classList.contains('active')) {
    menuModal.classList.remove('active');
  }
});

// Favorites management
const toggleFavorite = (bookId, event) => {
  event.stopPropagation();
  const index = favorites.indexOf(bookId);
  
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(bookId);
  }
  
  saveFavorites();
  updateFavCount();
  renderBooks(currentBooks);
};

const isFavorite = (bookId) => {
  return favorites.includes(bookId);
};

// Render books with virtual scrolling optimization
const renderBooks = (booksToRender) => {
  const grid = document.getElementById('booksGrid');
  
  // Filter by favorites if needed
  let displayBooks = booksToRender;
  if (currentFilter === 'favorites') {
    displayBooks = booksToRender.filter(book => isFavorite(book.id));
  }
  
  if (displayBooks.length === 0) {
    grid.innerHTML = '<div class="no-results">📖 No books found. Try a different search!</div>';
    return;
  }
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  displayBooks.forEach(book => {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.innerHTML = `
      <button class="favorite-btn ${isFavorite(book.id) ? 'active' : ''}" 
              data-book-id="${book.id}"
              aria-label="Toggle favorite">
        ${isFavorite(book.id) ? '❤️' : '🤍'}
      </button>
      <span class="book-emoji">${book.emoji}</span>
      <h3 class="book-title">${book.title}</h3>
      <p class="book-author">by ${book.author}</p>
      <p class="book-preview">${book.preview}</p>
    `;
    
    // Add click handler for navigation
    bookCard.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) {
        window.location.href = book.link;
      }
    });
    
    fragment.appendChild(bookCard);
  });
  
  // Clear and append in one operation
  grid.innerHTML = '';
  grid.appendChild(fragment);
  
  // Attach favorite button listeners
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const bookId = parseInt(btn.dataset.bookId);
      toggleFavorite(bookId, e);
    });
  });
};

// Debounced search for performance
let searchTimeout;
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const searchTerm = e.target.value.toLowerCase();
    currentBooks = books.filter(book =>
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm)
    );
    renderBooks(currentBooks);
  }, 150);
});

// Sort
const sortSelect = document.getElementById('sortSelect');
sortSelect.addEventListener('change', (e) => {
  const sortBy = e.target.value;
  
  if (sortBy === 'title') {
    currentBooks.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'author') {
    currentBooks.sort((a, b) => a.author.localeCompare(b.author));
  } else if (sortBy === 'newest') {
    currentBooks.sort((a, b) => b.id - a.id);
  }
  
  renderBooks(currentBooks);
});

// Filter tabs
const filterTabs = document.querySelectorAll('.filter-tab');
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderBooks(currentBooks);
  });
});

// Favorites button
const favoriteBtn = document.getElementById('favoriteBtn');
favoriteBtn.addEventListener('click', () => {
  const favTab = document.querySelector('[data-filter="favorites"]');
  filterTabs.forEach(t => t.classList.remove('active'));
  favTab.classList.add('active');
  currentFilter = 'favorites';
  renderBooks(currentBooks);
});

// Update favorites count
const updateFavCount = () => {
  document.getElementById('favCount').textContent = favorites.length;
};

// Initialize
initStorage();
updateFavCount();
renderBooks(currentBooks);