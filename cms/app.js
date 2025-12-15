// --- 1. CONFIGURATION ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAcfvUVaI-Vf2KTov2HbzT8zz2TGRffvUo",
  authDomain: "safe-haven-2025.firebaseapp.com",
  databaseURL: "https://safe-haven-2025-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "safe-haven-2025",
  storageBucket: "safe-haven-2025.firebasestorage.app",
  messagingSenderId: "1006773901595",
  appId: "1:1006773901595:web:4f551d24323f214d0a1bbe",
  measurementId: "G-SKCS3E3TPC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. STATE MANAGEMENT ---
const app = document.getElementById('app');
const navLinks = document.getElementById('nav-links');
let currentUser = null;

// --- 3. AUTHENTICATION LISTENER ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  renderNav();
  router(); // Re-run router on auth change
});

// --- 4. ROUTING ---
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
  const hash = window.location.hash;
  
  if (!hash || hash === '#') {
    renderHome();
  } else if (hash.startsWith('#post/')) {
    const id = hash.split('/')[1];
    renderSinglePost(id);
  } else if (hash === '#login') {
    renderLogin();
  } else if (hash === '#admin') {
    if (currentUser) renderAdmin();
    else window.location.hash = '#login';
  } else if (hash === '#logout') {
    auth.signOut().then(() => window.location.hash = '#');
  }
}

// --- 5. VIEW RENDERERS ---

// A. Navigation Render
function renderNav() {
  let html = `<li><a href="#">Home</a></li>`;
  if (currentUser) {
    html += `
            <li><a href="#admin">Write Post</a></li>
            <li><a href="#logout">Logout</a></li>
        `;
  } else {
    html += `<li><a href="#login">Admin Login</a></li>`;
  }
  navLinks.innerHTML = html;
}

// B. Home View (List Posts)
async function renderHome() {
  app.innerHTML = '<h2>Loading posts...</h2>';
  const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
  
  if (snapshot.empty) {
    app.innerHTML = '<p>No posts found.</p>';
    return;
  }
  
  let postsHtml = '';
  snapshot.forEach(doc => {
    const post = doc.data();
    // Create a snippet of the content (strip HTML tags)
    const snippet = post.content.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';
    
    postsHtml += `
            <div class="post-card">
                <h2 class="post-title" onclick="window.location.hash='#post/${doc.id}'">${post.title}</h2>
                <div class="post-meta">Posted on ${new Date(post.createdAt).toLocaleDateString()}</div>
                <p>${snippet}</p>
                <a href="#post/${doc.id}" class="read-more">Read More &rarr;</a>
            </div>
        `;
  });
  app.innerHTML = `<h1>Latest Posts</h1>${postsHtml}`;
}

// C. Single Post View
async function renderSinglePost(id) {
  app.innerHTML = 'Loading...';
  const doc = await db.collection('posts').doc(id).get();
  
  if (!doc.exists) {
    app.innerHTML = '<h2>Post not found</h2>';
    return;
  }
  
  const post = doc.data();
  let deleteBtn = currentUser ? `<button class="btn-delete" onclick="deletePost('${id}')">Delete Post</button>` : '';
  
  app.innerHTML = `
        <article>
            ${deleteBtn}
            <h1>${post.title}</h1>
            <div class="post-meta">By Admin | ${new Date(post.createdAt).toLocaleDateString()}</div>
            <hr>
            <div class="single-post-content">${post.content}</div> </article>
    `;
}

// D. Login View
function renderLogin() {
  app.innerHTML = `
        <div class="post-card" style="max-width: 400px; margin: 0 auto;">
            <h2>Admin Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <input type="email" id="email" placeholder="Email" required>
                </div>
                <div class="form-group">
                    <input type="password" id="password" placeholder="Password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            <p id="error-msg" class="error"></p>
        </div>
    `;
  
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    auth.signInWithEmailAndPassword(email, pass)
      .then(() => window.location.hash = '#admin')
      .catch(err => document.getElementById('error-msg').innerText = err.message);
  });
}

// E. Admin Dashboard (Create Post)
function renderAdmin() {
  app.innerHTML = `
        <h1>Create New Post</h1>
        <div class="post-card">
            <div class="form-group">
                <input type="text" id="post-title" placeholder="Enter post title..." required>
            </div>
            <div id="editor"></div>
            <br>
            <button onclick="savePost()">Publish Post</button>
        </div>
    `;
  
  // Initialize Quill Editor
  window.quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Write your masterpiece...'
  });
}

// --- 6. ACTIONS ---

// Save Post
window.savePost = async () => {
  const title = document.getElementById('post-title').value;
  const content = window.quill.root.innerHTML; // Get HTML from Quill
  
  if (!title || window.quill.getText().trim().length === 0) {
    alert('Please fill in both title and content');
    return;
  }
  
  try {
    await db.collection('posts').add({
      title: title,
      content: content,
      createdAt: Date.now(),
      author: currentUser.email
    });
    alert('Post Published!');
    window.location.hash = '#';
  } catch (error) {
    console.error(error);
    alert('Error publishing post');
  }
};

// Delete Post
window.deletePost = async (id) => {
  if (confirm('Are you sure you want to delete this post?')) {
    await db.collection('posts').doc(id).delete();
    window.location.hash = '#';
  }
}