let currentUser = JSON.parse(localStorage.getItem('picdong_user_session')) || null;
let allPhotos = [];

// DOM 세팅
const goHomeBtn = document.getElementById('goHomeBtn');
const openRankBtn = document.getElementById('openRankBtn');
const openAuthModalBtn = document.getElementById('openAuthModalBtn');
const userProfile = document.getElementById('userProfile');
const currentNickname = document.getElementById('currentNickname');
const openMyPageBtn = document.getElementById('openMyPageBtn');
const logoutBtn = document.getElementById('logoutBtn');
const openUploadBtn = document.getElementById('openUploadBtn');

const homeView = document.getElementById('homeView');
const rankView = document.getElementById('rankView');
const myPageView = document.getElementById('myPageView');

const authModal = document.getElementById('authModal');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const uploadModal = document.getElementById('uploadModal');
const photoInput = document.getElementById('photoInput');
const previewContainer = document.getElementById('previewContainer');
const dropZone = document.getElementById('dropZone');

// [관리자 배지 UI 업데이트]
function updateAuthUI() {
  if (currentUser) {
    userProfile.style.display = 'flex';
    openAuthModalBtn.style.display = 'none';
    
    // 내 프로필 이름에 관리자 표시
    const adminBadge = currentUser.id === 'admin_donghang' ? '👑[관리자] ' : '';
    currentNickname.textContent = adminBadge + currentUser.nickname;
  } else {
    userProfile.style.display = 'none';
    openAuthModalBtn.style.display = 'block';
    showView('home'); 
  }
}

// 화면 전환
function showView(view) {
  homeView.style.display = 'none'; rankView.style.display = 'none'; myPageView.style.display = 'none';
  if (view === 'home') { homeView.style.display = 'block'; fetchPhotos(); } 
  else if (view === 'rank') { rankView.style.display = 'block'; fetchPhotos(); } 
  else if (view === 'mypage') {
    if (!currentUser) { alert('로그인이 필요합니다.'); authModal.style.display = 'flex'; switchAuthTab('login'); return; }
    myPageView.style.display = 'block';
    
    const adminBadge = currentUser.id === 'admin_donghang' ? '👑[관리자] ' : '';
    document.getElementById('myPageNick').textContent = adminBadge + currentUser.nickname;
    document.getElementById('myPageId').textContent = `@${currentUser.username}`;
    renderMyPageContent();
  }
}
goHomeBtn.addEventListener('click', () => showView('home'));
openRankBtn.addEventListener('click', () => showView('rank'));
openMyPageBtn.addEventListener('click', () => showView('mypage'));

// 로그인/회원가입
openAuthModalBtn.addEventListener('click', () => { authModal.style.display = 'flex'; switchAuthTab('login'); });
document.getElementById('closeAuthModalBtn').addEventListener('click', () => { authModal.style.display = 'none'; });

function switchAuthTab(tab) {
  document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
  if (tab === 'login') {
    tabLoginBtn.classList.add('active'); tabRegisterBtn.classList.remove('active');
    loginForm.style.display = 'block'; registerForm.style.display = 'none';
  } else {
    tabRegisterBtn.classList.add('active'); tabLoginBtn.classList.remove('active');
    registerForm.style.display = 'block'; loginForm.style.display = 'none';
  }
}
tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const data = await res.json();
  if (res.ok) {
    currentUser = data.user; localStorage.setItem('picdong_user_session', JSON.stringify(currentUser));
    updateAuthUI(); authModal.style.display = 'none'; loginForm.reset(); fetchPhotos();
  } else { document.getElementById('loginErrorMsg').textContent = data.message; }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('regUserError').textContent = ''; document.getElementById('regNickError').textContent = '';
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const nickname = document.getElementById('regNickname').value;
  const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, nickname }) });
  const data = await res.json();
  if (res.ok) {
    alert('가입 환영합니다! 로그인 해주세요.'); switchAuthTab('login'); document.getElementById('loginUsername').value = username; registerForm.reset();
  } else {
    if (data.field === 'username') document.getElementById('regUserError').textContent = data.message;
    else if (data.field === 'nickname') document.getElementById('regNickError').textContent = data.message;
    else alert(data.message);
  }
});

logoutBtn.addEventListener('click', () => { currentUser = null; localStorage.removeItem('picdong_user_session'); updateAuthUI(); });

// 업로드 모달
openUploadBtn.addEventListener('click', () => {
  if (!currentUser) { alert('로그인이 필요합니다.'); return authModal.style.display = 'flex'; }
  uploadModal.style.display = 'flex';
});
document.getElementById('closeUploadModalBtn').addEventListener('click', () => uploadModal.style.display = 'none');
document.getElementById('cancelUploadBtn').addEventListener('click', () => uploadModal.style.display = 'none');

photoInput.addEventListener('change', () => {
  if (photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('previewImg').src = e.target.result;
      dropZone.style.display = 'none'; previewContainer.style.display = 'block';
      document.getElementById('submitBtn').disabled = false;
    };
    reader.readAsDataURL(photoInput.files[0]);
  }
});

document.getElementById('removeFileBtn').addEventListener('click', () => {
  photoInput.value = ''; previewContainer.style.display = 'none'; dropZone.style.display = 'block'; document.getElementById('submitBtn').disabled = true;
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('photo', photoInput.files[0]);
  formData.append('userId', currentUser.id);
  formData.append('author', currentUser.nickname);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (res.ok) {
    uploadModal.style.display = 'none';
    photoInput.value = ''; previewContainer.style.display = 'none'; dropZone.style.display = 'block';
    showView('home');
  }
});

// 피드 및 랭킹 데이터 불러오기
async function fetchPhotos() {
  const res = await fetch('/api/photos');
  allPhotos = await res.json();
  
  document.getElementById('photoCount').textContent = `${allPhotos.length}장`;
  renderGrid(allPhotos, document.getElementById('galleryGrid'));
  
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyTop = [...allPhotos]
    .filter(p => new Date(p.createdAt).getTime() > oneWeekAgo && (p.likes || []).length > 0)
    .sort((a, b) => b.likes.length - a.likes.length).slice(0, 10);
  
  const weeklyGrid = document.getElementById('weeklyGrid');
  if (weeklyTop.length > 0) {
    renderGrid(weeklyTop, weeklyGrid, true);
    weeklyGrid.parentElement.style.display = 'block';
  } else {
    weeklyGrid.parentElement.style.display = 'none';
  }
}

// [핵심: 관리자 권한 및 UI 렌더링]
function renderGrid(posts, container, isBest = false, allowDelete = false) {
  container.innerHTML = posts.length === 0 ? '<p style="color:#999; margin-top: 20px;">사진이 없습니다.</p>' : '';
  
  // 접속자가 관리자인지 확인
  const isAdmin = currentUser && currentUser.id === 'admin_donghang';

  posts.forEach((post, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    
    const likes = post.likes || [];
    const bookmarks = post.bookmarks || [];
    const isLiked = currentUser && likes.includes(currentUser.id);
    const isBookmarked = currentUser && bookmarks.includes(currentUser.id);
    
    // 삭제 권한: 내 마이페이지(allowDelete)이거나, 내가 관리자면 언제 어디서든 삭제 가능
    const canDelete = allowDelete || isAdmin;
    let deleteBtnHTML = canDelete ? `<button class="btn-delete-post" onclick="deletePhoto('${post.id}')">이 사진 삭제하기</button>` : '';
    let rankBadge = isBest ? `<span class="badge-hot">${index + 1}위 🔥</span>` : '';

    // 작성자가 관리자면 작성자 이름에 배지 붙여주기
    const authorLabel = post.userId === 'admin_donghang' 
      ? `<span style="color:#2563eb; font-weight:800;">👑[관리자]</span> ${post.author}` 
      : post.author;

    card.innerHTML = `
      <div class="card-img-wrap" onclick="openLightbox('${post.url}', '${post.author}', '${post.userId}')">
        ${rankBadge}
        <img src="${post.url}" loading="lazy">
      </div>
      <div class="card-meta">
        <div class="meta-top">
          <div class="meta-author">${authorLabel}</div>
          <div class="meta-date">${new Date(post.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="action-group">
          <button class="icon-btn ${isLiked ? 'liked' : ''}" onclick="toggleAction('${post.id}', 'like')">
            ${isLiked ? '❤️' : '🤍'} ${likes.length}
          </button>
          <button class="icon-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleAction('${post.id}', 'bookmark')">
            ${isBookmarked ? '🔖' : '📑'} 저장
          </button>
        </div>
        ${deleteBtnHTML}
      </div>
    `;
    container.appendChild(card);
  });
}

async function toggleAction(postId, type) {
  if (!currentUser) { alert('로그인이 필요합니다.'); authModal.style.display = 'flex'; switchAuthTab('login'); return; }
  await fetch(`/api/photos/${postId}/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) });
  
  if (myPageView.style.display === 'block') { await fetchPhotos(); renderMyPageContent(); } 
  else { fetchPhotos(); }
}

// 마이페이지
let currentMyTab = 'myUploads';
document.querySelectorAll('.my-tab').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.my-tab').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active'); currentMyTab = e.target.dataset.target; renderMyPageContent();
  });
});

function renderMyPageContent() {
  const container = document.getElementById('myPageContent');
  let filtered = [];
  let allowDelete = false;

  if (currentMyTab === 'myUploads') { filtered = allPhotos.filter(p => p.userId === currentUser.id); allowDelete = true; } 
  else if (currentMyTab === 'myLikes') { filtered = allPhotos.filter(p => (p.likes || []).includes(currentUser.id)); } 
  else if (currentMyTab === 'myBookmarks') { filtered = allPhotos.filter(p => (p.bookmarks || []).includes(currentUser.id)); }
  
  renderGrid(filtered, container, false, allowDelete);
}

// 사진 삭제
async function deletePhoto(postId) {
  if (!confirm('정말 삭제하시겠습니까? (관리자는 모든 사진 삭제 가능)')) return;
  const res = await fetch(`/api/photos/${postId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) });
  if (res.ok) {
    await fetchPhotos();
    if (myPageView.style.display === 'block') renderMyPageContent();
  } else {
    const data = await res.json();
    alert(data.message);
  }
}

// 라이트박스 (크게 보기)
const imageModal = document.getElementById('imageModal');
function openLightbox(url, author, authorUserId) {
  document.getElementById('modalImg').src = url;
  
  // 크게 보기 창에서도 관리자 배지 노출
  const authorLabel = authorUserId === 'admin_donghang' 
    ? `👑[관리자] ${author}` 
    : `📸 ${author}`;
    
  document.getElementById('modalAuthor').textContent = authorLabel;
  imageModal.style.display = 'flex';
}
document.getElementById('closeImageModalBtn').addEventListener('click', () => imageModal.style.display = 'none');
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { imageModal.style.display = 'none'; uploadModal.style.display = 'none'; authModal.style.display = 'none'; } });

updateAuthUI(); showView('home');