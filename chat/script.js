// Firebase Configuration - Replace with your own config
const firebaseConfig = {
  apiKey: "AIzaSyCX2rt16v6nM6zeJkAZTkeiJmMzrEfHrBY",
  authDomain: "aklatell-chat.firebaseapp.com",
  databaseURL: "https://aklatell-chat-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aklatell-chat",
  storageBucket: "aklatell-chat.firebasestorage.app",
  messagingSenderId: "717231832884",
  appId: "1:717231832884:web:4df4a1e0fdd3fa20f7ef61",
  measurementId: "G-27JG5D6J46"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for cost optimization
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => console.warn('Persistence error:', err));

// App State
let currentUser = null;
let userData = null;
let messagesUnsubscribe = null;
let lastMessageTime = 0;
let editingMessageId = null;
let deletingMessageId = null;
let loadedMessages = new Map();
let lastRenderedDate = null;
let firstVisibleMessage = null;
let latestLoadedTimestamp = null;
let isLoadingMore = false;
const INITIAL_LOAD = 20;
const PAGE_SIZE = 20;
const RATE_LIMIT_MS = 3000;
const MAX_MESSAGES_IN_MEMORY = 200;
const CACHE_DURATION = 60000;
const MAX_CACHE_SIZE = 100;

// LRU Cache for usernames
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
}

const usernameCache = new LRUCache(MAX_CACHE_SIZE);

// DOM Elements
const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const errorMessage = document.getElementById('errorMessage');
const messagesContainer = document.getElementById('messagesContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const rateLimitWarning = document.getElementById('rateLimitWarning');
const editModal = document.getElementById('editModal');
const deleteModal = document.getElementById('deleteModal');
const lightbox = document.getElementById('lightbox');
const loadingMessages = document.getElementById('loadingMessages');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const retryBtn = document.getElementById('retryBtn');

// State Management Functions
function showLoadingState() {
  loadingMessages.classList.remove('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
}

function showEmptyState() {
  loadingMessages.classList.add('hidden');
  emptyState.classList.remove('hidden');
  errorState.classList.add('hidden');
}

function showErrorState(message = 'Something went wrong. Please try again.') {
  loadingMessages.classList.add('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.remove('hidden');
  document.getElementById('errorStateMessage').textContent = message;
}

function hideAllStates() {
  loadingMessages.classList.add('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
}

// Sanitize URL inputs
function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

// XSS Protection
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttribute(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// UPDATED: Gender-neutral avatar styles
function generateRandomAvatar(seed) {
  // Using only gender-neutral avatar styles
  const genderNeutralStyles = [
    'bottts', // Robot avatars
    'fun-emoji' // Emoji-based (neutral)
  ];
  const style = genderNeutralStyles[Math.floor(Math.random() * genderNeutralStyles.length)];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

// Format timestamp
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// Detect and format links, embeds
function processMessageContent(text) {
  const escaped = escapeHtml(text);
  
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const imageRegex = /\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i;
  const videoRegex = /\.(mp4|webm|ogg)(\?[^\s]*)?$/i;
  
  let embeds = [];
  let processedText = escaped;
  
  const urls = text.match(urlRegex) || [];
  
  urls.forEach(url => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return;
    
    const youtubeMatch = safeUrl.match(youtubeRegex);
    
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        embeds.push({ type: 'youtube', videoId });
      }
    } else if (imageRegex.test(safeUrl)) {
      embeds.push({ type: 'image', url: safeUrl });
    } else if (videoRegex.test(safeUrl)) {
      embeds.push({ type: 'video', url: safeUrl });
    }
    
    const escapedUrl = escapeHtml(safeUrl);
    processedText = processedText.replace(
      escapeHtml(url),
      `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`
    );
  });
  
  return { text: processedText, embeds };
}

function renderEmbeds(embeds, messageId) {
  return embeds.map((embed, index) => {
    switch (embed.type) {
      case 'youtube':
        return `<iframe class="youtube-embed" src="https://www.youtube.com/embed/${escapeAttribute(embed.videoId)}" frameborder="0" allowfullscreen="true" loading="lazy"></iframe>`;
      case 'image':
        return `<img class="embedded-image" src="${escapeAttribute(embed.url)}" alt="Embedded image" loading="lazy" data-lightbox-url="${escapeAttribute(embed.url)}" data-image-id="${messageId}-${index}" onerror="this.style.display='none'">`;
      case 'video':
        return `<video class="embedded-video" controls preload="metadata"><source src="${escapeAttribute(embed.url)}">Your browser does not support video.</video>`;
      default:
        return '';
    }
  }).join('');
}

function createMessageElement(messageId, messageData, isOwn) {
  const { text, embeds } = processMessageContent(messageData.text || '');
  const isDeleted = messageData.deleted;
  const isEdited = messageData.edited;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : ''}`;
  messageDiv.id = `message-${messageId}`;
  
  let actionsHtml = '';
  if (isOwn && !isDeleted) {
    actionsHtml = `
      <div class="message-actions">
        <button class="message-action-btn edit-btn" data-message-id="${messageId}" data-action="edit" ${isEdited ? 'disabled' : ''}>
          ${isEdited ? 'Edited' : 'Edit'}
        </button>
        <button class="message-action-btn delete-btn" data-message-id="${messageId}" data-action="delete">Delete</button>
      </div>
    `;
  }
  
  messageDiv.innerHTML = `
    <img class="message-avatar" src="${escapeAttribute(messageData.userAvatar)}" alt="${escapeAttribute(messageData.userName)}" onerror="this.src='${generateRandomAvatar(messageData.userId)}'">
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${escapeHtml(messageData.userName)}</span>
        <span class="message-time">${formatTime(messageData.timestamp)}</span>
      </div>
      ${isDeleted 
        ? '<p class="message-text message-deleted">This message was deleted</p>'
        : `<p class="message-text">${text}</p>${renderEmbeds(embeds, messageId)}`
      }
      ${isEdited && !isDeleted ? '<span class="message-edited">(edited)</span>' : ''}
      ${actionsHtml}
    </div>
  `;
  
  return messageDiv;
}

document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'edit') {
    openEditModal(e.target.dataset.messageId);
  } else if (e.target.dataset.action === 'delete') {
    openDeleteModal(e.target.dataset.messageId);
  }
  
  if (e.target.classList.contains('embedded-image')) {
    const url = e.target.dataset.lightboxUrl;
    if (url) openLightbox(url);
  }
});

function pruneOldMessages() {
  if (loadedMessages.size > MAX_MESSAGES_IN_MEMORY) {
    const sortedMessages = Array.from(loadedMessages.entries())
      .sort((a, b) => {
        const timeA = a[1].timestamp?.toMillis() || 0;
        const timeB = b[1].timestamp?.toMillis() || 0;
        return timeA - timeB;
      });
    
    const toRemove = sortedMessages.slice(0, loadedMessages.size - MAX_MESSAGES_IN_MEMORY);
    
    toRemove.forEach(([id]) => {
      loadedMessages.delete(id);
      const el = document.getElementById(`message-${id}`);
      if (el) el.remove();
    });
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    if (tab.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
    errorMessage.classList.add('hidden');
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    if (error.code === 'auth/invalid-credential') {
      showError("Invalid credentials or user does not exists.");
    } else {
      showError("Login failed. Please try again.");
    }
  }
});

async function isUsernameAvailable(username) {
  const usernameLower = username.toLowerCase();
  
  const cached = usernameCache.get(usernameLower);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }
  
  // Check using the lowercase version
  const snapshot = await db.collection('users')
    .where('usernameLower', '==', usernameLower)
    .limit(1)
    .get();
  
  const available = snapshot.empty;
  usernameCache.set(usernameLower, { available, timestamp: Date.now() });
  return available;
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  let avatarUrl = document.getElementById('registerAvatar').value.trim();
  
  if (/\s/.test(username)) {
    showError("Username cannot contain spaces.");
    return;
  }
  
  if (username.length < 3 || username.length > 20) {
    showError("Username must be between 3-20 characters.");
    return;
  }
  
  try {
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
      showError("This username is already taken.");
      return;
    }
    
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    
    if (!avatarUrl) {
      avatarUrl = generateRandomAvatar(username + userCredential.user.uid);
    }
    
    await db.collection('users').doc(userCredential.user.uid).set({
      username: username,
      usernameLower: username.toLowerCase(),
      email: email,
      avatar: avatarUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isAdmin: false
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      showError("This email is already registered. Please login instead.");
    } else if (error.code === 'auth/weak-password') {
      showError("Password should be at least 6 characters.");
    } else if (error.code === 'auth/invalid-email') {
      showError("Invalid email address.");
    } else if (error.code === 'permission-denied') {
      showError("Registration error. Please try again or contact support.");
    } else {
      showError(error.message || "Registration failed. Please try again.");
    }
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  auth.signOut();
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    
    lastRenderedDate = null;
    firstVisibleMessage = null;
    latestLoadedTimestamp = null;
    isLoadingMore = false;
    loadedMessages.clear();
    
    Array.from(messagesContainer.children).forEach(child => {
      const keepIds = ['loadingMessages', 'emptyState', 'errorState'];
      if (!keepIds.includes(child.id)) {
        child.remove();
      }
    });
    
    hideAllStates();
    
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
        
        document.getElementById('currentUserAvatar').src = userData.avatar;
        document.getElementById('currentUserName').textContent = userData.username;
        
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        loadMessages();
      } else {
        showError('Account not found or banned.');
        auth.signOut();
        currentUser = null;
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading user:', error);
      showError('Failed to load user data.');
      auth.signOut();
    }
  } else {
    currentUser = null;
    userData = null;
    lastRenderedDate = null;
    loadedMessages.clear();
    usernameCache.clear();
    
    authContainer.style.display = 'flex';
    chatContainer.style.display = 'none';
    Array.from(messagesContainer.children).forEach(child => {
      const keepIds = ['loadingMessages', 'emptyState', 'errorState'];
      if (!keepIds.includes(child.id)) {
        child.remove();
      }
    });
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
      messagesUnsubscribe = null;
    }
  }
});

function loadMessages() {
  showLoadingState();
  
  const initialQuery = db.collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(INITIAL_LOAD);
  
  initialQuery.get().then(snapshot => {
    
    if (snapshot.empty) {
      latestLoadedTimestamp = firebase.firestore.Timestamp.now();
      showEmptyState();
    } else {
      hideAllStates();
      latestLoadedTimestamp = snapshot.docs[0].data().timestamp;
      
      const docs = snapshot.docs.reverse();
      docs.forEach(doc => {
        const data = doc.data();
        loadedMessages.set(doc.id, data);
      });
      
      firstVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
      renderMessagesIncremental(docs);
    }
    
    attachRealtimeListener();
    enablePagination();
    
  }).catch(err => {
    console.error(err);
    showErrorState("Failed to load messages.");
  });
}

function attachRealtimeListener() {
  if (!latestLoadedTimestamp) {
    latestLoadedTimestamp = firebase.firestore.Timestamp.now();
  }
  
  const realtimeQuery = db.collection('messages')
    .orderBy('timestamp', 'desc')
    .where('timestamp', '>', latestLoadedTimestamp)
    .limit(50);
  
  messagesUnsubscribe = realtimeQuery.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        hideAllStates();
        const doc = change.doc;
        const data = doc.data();
        const ts = data.timestamp;
        
        if (ts > latestLoadedTimestamp) {
          latestLoadedTimestamp = ts;
        }
        
        if (loadedMessages.has(doc.id)) return;
        
        loadedMessages.set(doc.id, data);
        insertDateSeparatorIfNeeded(ts);
        
        const isOwn = currentUser && data.userId === currentUser.uid;
        const messageEl = createMessageElement(doc.id, data, isOwn);
        
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        pruneOldMessages();
      }
      
      if (change.type === 'modified') {
        const doc = change.doc;
        const data = doc.data();
        
        loadedMessages.set(doc.id, data);
        const existing = document.getElementById(`message-${doc.id}`);
        if (existing) {
          const isOwn = currentUser && data.userId === currentUser.uid;
          const updated = createMessageElement(doc.id, data, isOwn);
          existing.replaceWith(updated);
        }
      }
    });
  });
}

function loadOlderMessages() {
  if (!firstVisibleMessage || isLoadingMore) return;
  
  isLoadingMore = true;
  
  const olderQuery = db.collection('messages')
    .orderBy('timestamp', 'desc')
    .startAfter(firstVisibleMessage)
    .limit(PAGE_SIZE);
  
  olderQuery.get().then(snapshot => {
    if (!snapshot.empty) {
      const docs = snapshot.docs.reverse();
      
      docs.forEach(doc => {
        const data = doc.data();
        loadedMessages.set(doc.id, data);
        const ts = data.timestamp;
        const firstMessageNode = messagesContainer.firstChild;
        
        insertDateSeparatorIfNeeded(ts, firstMessageNode);
        
        const isOwn = data.userId === currentUser.uid;
        const messageEl = createMessageElement(doc.id, data, isOwn);
        messagesContainer.insertBefore(messageEl, firstMessageNode);
      });
      
      firstVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
    }
    
    isLoadingMore = false;
    
  }).catch(err => {
    console.error(err);
    isLoadingMore = false;
  });
}

function enablePagination() {
  messagesContainer.addEventListener("scroll", () => {
    if (messagesContainer.scrollTop <= 50) {
      loadOlderMessages();
    }
  });
}

function renderMessagesIncremental(docs) {
  docs.forEach(doc => {
    const data = doc.data();
    const ts = data.timestamp;
    
    insertDateSeparatorIfNeeded(ts);
    
    const isOwn = data.userId === currentUser.uid;
    const messageEl = createMessageElement(doc.id, data, isOwn);
    messagesContainer.appendChild(messageEl);
  });
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function insertDateSeparatorIfNeeded(timestamp, beforeElement = null) {
  let dateString;
  
  if (!timestamp) {
    dateString = 'Today';
  } else {
    dateString = formatDate(timestamp);
  }
  
  if (dateString === lastRenderedDate) return;
  
  if (beforeElement) {
    const prevSibling = beforeElement.previousElementSibling;
    if (prevSibling && prevSibling.classList.contains('date-separator')) {
      const existingDate = prevSibling.querySelector('span')?.textContent;
      if (existingDate === dateString) return;
    }
  }
  
  lastRenderedDate = dateString;
  
  const separator = document.createElement("div");
  separator.className = "date-separator";
  separator.innerHTML = `<span>${dateString}</span>`;
  
  if (beforeElement) {
    messagesContainer.insertBefore(separator, beforeElement);
  } else {
    messagesContainer.appendChild(separator);
  }
}

retryBtn.addEventListener('click', () => {
  loadedMessages.clear();
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  loadMessages();
});

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const text = messageInput.value.trim();
  if (!text || !currentUser || !userData) return;
  
  const now = Date.now();
  if (now - lastMessageTime < RATE_LIMIT_MS) {
    rateLimitWarning.classList.remove('hidden');
    setTimeout(() => {
      rateLimitWarning.classList.add('hidden');
    }, 2000);
    return;
  }
  
  sendBtn.disabled = true;
  messageInput.value = '';
  lastMessageTime = now;
  
  try {
    await db.collection('messages').add({
      text: text,
      userId: currentUser.uid,
      userName: userData.username,
      userAvatar: userData.avatar,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      edited: false,
      deleted: false
    });
  } catch (error) {
    console.error('Error sending message:', error);
    messageInput.value = text;
  }
  
  sendBtn.disabled = false;
  messageInput.style.height = 'auto';
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 124) + 'px';
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    messageForm.dispatchEvent(new Event('submit'));
  }
});

function openEditModal(messageId) {
  const messageData = loadedMessages.get(messageId);
  if (!messageData || messageData.edited) return;
  
  editingMessageId = messageId;
  document.getElementById('editMessageText').value = messageData.text;
  editModal.classList.add('active');
}

document.getElementById('cancelEdit').addEventListener('click', () => {
  editModal.classList.remove('active');
  editingMessageId = null;
});

document.getElementById('confirmEdit').addEventListener('click', async () => {
  if (!editingMessageId) return;
  
  const newText = document.getElementById('editMessageText').value.trim();
  if (!newText) return;
  
  try {
    await db.collection('messages').doc(editingMessageId).update({
      text: newText,
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
  
  editModal.classList.remove('active');
  editingMessageId = null;
});

function openDeleteModal(messageId) {
  deletingMessageId = messageId;
  deleteModal.classList.add('active');
}

document.getElementById('cancelDelete').addEventListener('click', () => {
  deleteModal.classList.remove('active');
  deletingMessageId = null;
});

document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deletingMessageId) return;
  
  try {
    await db.collection('messages').doc(deletingMessageId).update({
      deleted: true,
      text: '',
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting message:', error);
  }
  
  deleteModal.classList.remove('active');
  deletingMessageId = null;
});

function openLightbox(imageUrl) {
  document.getElementById('lightboxImage').src = imageUrl;
  lightbox.classList.add('active');
}

document.getElementById('closeLightbox').addEventListener('click', () => {
  lightbox.classList.remove('active');
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    lightbox.classList.remove('active');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    editModal.classList.remove('active');
    deleteModal.classList.remove('active');
    lightbox.classList.remove('active');
  }
});

let isTabActive = true;
document.addEventListener('visibilitychange', () => {
  const wasActive = isTabActive;
  isTabActive = !document.hidden;
  
  if (isTabActive && !wasActive && currentUser && !messagesUnsubscribe) {
    console.log('Tab became active, reconnecting listener');
    attachRealtimeListener();
  } else if (!isTabActive && messagesUnsubscribe) {
    console.log('Tab became inactive, disconnecting listener');
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
});