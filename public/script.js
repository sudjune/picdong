let currentUser = localStorage.getItem('picdong_user') || null;
let currentView = 'feed'; // 'feed' | 'ranking' | 'mypage'
let myTab = 'uploads';    // 'uploads' | 'likes' | 'bookmarks'
let isSignUpMode = false;
let isUploading = false;
let userBookmarks = [];

const authModal = document.getElementById('authModal');
const uploadModal = document.getElementById('uploadModal');
const lightboxModal = document.getElementById('lightboxModal');
const authBtn = document.getElementById('authBtn');
const uploadBtn = document.getElementById('uploadBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const feedList = document.getElementById('feedList');
const postCount = document.getElementById('postCount');
const sectionTitle = document.getElementById('sectionTitle');
const sectionDesc = document.getElementById('sectionDesc');
const mypageSection = document.getElementById('mypageSection');
const submitUploadBtn = document.getElementById('submitUploadBtn');

async function syncBookmarks() {
  if (!currentUser) { userBookmarks = []; return; }
  try {
    const res = await fetch(`/api/users/${currentUser}/bookmarks`);
    userBookmarks = await res.json();
  } catch (e) { userBookmarks = []; }
}

function updateUI() {
  if (currentUser) {
    authBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
    userInfo.style.display = 'inline-flex';
    userInfo.textContent = `${currentUser}님`;
  } else {
    authBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
    userInfo.style.display = 'none';
  }
}

// 피드 화면 렌더링
async function loadData() {
  await syncBookmarks();
  try {
    const endpoint = currentView === 'ranking' ? '/api/ranking' : '/api/posts';
    const res = await fetch(endpoint);
    let posts = await res.json();

    // 마이페이지 탭 필터링
    if (currentView === 'mypage') {
      if (myTab === 'uploads') {
        posts = posts.filter(p => p.author === currentUser);
      } else if (myTab === 'likes') {
        posts = posts.filter(p => (p.likedUsers || []).includes(currentUser));
      } else if (myTab === 'bookmarks') {
        posts = posts.filter(p => userBookmarks.includes(String(p._id || p.id)));
      }
    }

    postCount.textContent = `${posts.length}장`;

    if (posts.length === 0) {
      feedList.innerHTML = '<p style="text-align: center; color: #888; padding: 40px 0;">사진이 없습니다.</p>';
      return;
    }

    feedList.innerHTML = posts.map((post, idx) => {
      const postId = post._id || post.id;
      const isLiked = (post.likedUsers || []).includes(currentUser);
      const isBookmarked = userBookmarks.includes(String(postId));
      const formattedDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '';

      return `
        <div class="card" id="post-${postId}">
          ${currentView === 'ranking' && idx === 0 ? '<div class="rank-badge">1위 🔥</div>' : ''}
          <div class="card-img-wrap" onclick="openLightbox('${post.imageUrl}', '${post.author}')">
            <img src="${post.imageUrl}" alt="${post.title}" loading="lazy">
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span>${post.author}</span>
              <span>${formattedDate}</span>
            </div>
            <div class="card-actions">
              <button class="action-btn ${isLiked ? 'active-like' : ''}" onclick="toggleLike('${postId}', this)">
                <span>${isLiked ? '❤️' : '🤍'}</span>
                <span class="like-cnt">${post.likes || 0}</span>
              </button>
              <button class="action-btn ${isBookmarked ? 'active-bookmark' : ''}" onclick="toggleBookmark('${postId}', this)">
                <span>${isBookmarked ? '📑' : '📄'}</span>
                <span>${isBookmarked ? '저장됨' : '저장'}</span>
              </button>
            </div>
            ${currentUser === post.author ? `
              <button class="delete-btn" onclick="deletePost('${postId}')">이 사진 삭제하기</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    feedList.innerHTML = '<p style="text-align:center; padding: 40px 0; color:#888;">데이터를 불러오지 못했습니다.</p>';
  }
}

// ⚡ 깜빡임 없는 좋아요
window.toggleLike = async function(id, btn) {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');
  try {
    const res = await fetch(`/api/posts/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (data.success) {
      btn.querySelector('.like-cnt').textContent = data.likes;
      if (data.isLiked) {
        btn.classList.add('active-like');
        btn.querySelector('span').textContent = '❤️';
      } else {
        btn.classList.remove('active-like');
        btn.querySelector('span').textContent = '🤍';
      }
    }
  } catch (e) { console.error(e); }
};

// ⚡ 책갈피 토글
window.toggleBookmark = async function(id, btn) {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');
  try {
    const res = await fetch(`/api/posts/${id}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (data.success) {
      if (data.isBookmarked) {
        btn.classList.add('active-bookmark');
        btn.innerHTML = '<span>📑</span><span>저장됨</span>';
      } else {
        btn.classList.remove('active-bookmark');
        btn.innerHTML = '<span>📄</span><span>저장</span>';
      }
      await syncBookmarks();
    }
  } catch (e) { console.error(e); }
};

// 사진 삭제
window.deletePost = async function(id) {
  if (!confirm('이 사진을 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    if (res.ok) {
      document.getElementById(`post-${id}`)?.remove();
    } else {
      alert('삭제 권한이 없거나 실패했습니다.');
    }
  } catch (e) { alert('삭제 도중 오류가 발생했습니다.'); }
};

// 라이트박스 전체화면 뷰어
window.openLightbox = function(src, author) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxAuthor').textContent = `📸 ${author}`;
  lightboxModal.style.display = 'flex';
};
document.getElementById('closeLightbox').onclick = () => { lightboxModal.style.display = 'none'; };

// 마이페이지 탭 전환
window.switchMyTab = function(tab) {
  myTab = tab;
  document.querySelectorAll('.mypage-tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadData();
};

// 화면 뷰 전환 (홈, 랭킹, 마이페이지)
document.getElementById('brandLogoHome').onclick = () => {
  currentView = 'feed';
  mypageSection.style.display = 'none';
  sectionTitle.textContent = '최신 피드';
  sectionDesc.style.display = 'none';
  loadData();
};

document.getElementById('rankingTabBtn').onclick = () => {
  currentView = 'ranking';
  mypageSection.style.display = 'none';
  sectionTitle.textContent = '🏆 명예의 전당 (주간 베스트)';
  sectionDesc.textContent = '최근 가장 많은 하트를 받은 사진 순위입니다.';
  sectionDesc.style.display = 'block';
  loadData();
};

userInfo.onclick = () => {
  currentView = 'mypage';
  mypageSection.style.display = 'block';
  document.getElementById('mypageName').textContent = currentUser;
  document.getElementById('mypageId').textContent = `@${currentUser}`;
  sectionTitle.textContent = '보관함 피드';
  sectionDesc.style.display = 'none';
  loadData();
};

// 모달 제어
authBtn.onclick = () => { authModal.style.display = 'flex'; };
uploadBtn.onclick = () => {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');
  uploadModal.style.display = 'flex';
};
document.getElementById('closeAuthModal').onclick = () => { authModal.style.display = 'none'; };
document.getElementById('closeUploadModal').onclick = () => { uploadModal.style.display = 'none'; };

// 회원가입 모드 토글
document.getElementById('toggleAuthMode').onclick = (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  document.getElementById('modalTitle').textContent = isSignUpMode ? '회원가입' : '로그인';
  document.getElementById('toggleAuthMode').textContent = isSignUpMode ? '로그인' : '회원가입';
  document.getElementById('toggleAuthText').textContent = isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
};

// 회원가입 및 로그인 요청
document.getElementById('submitAuthBtn').onclick = async () => {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  if (!username || !password) return alert('아이디와 비밀번호를 모두 입력하세요.');

  const endpoint = isSignUpMode ? '/api/register' : '/api/login';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (res.ok) {
    if (isSignUpMode) {
      alert('회원가입이 완료되었습니다. 로그인해 주세요!');
      document.getElementById('toggleAuthMode').click();
    } else {
      currentUser = data.username;
      localStorage.setItem('picdong_user', currentUser);
      authModal.style.display = 'none';
      updateUI();
      loadData();
    }
  } else {
    alert(data.message || '요청 실패');
  }
};

// 로그아웃
logoutBtn.onclick = () => {
  localStorage.removeItem('picdong_user');
  currentUser = null;
  updateUI();
  document.getElementById('brandLogoHome').click();
};

// ⚡ 중복 업로드 방지
submitUploadBtn.onclick = async () => {
  if (isUploading) return;

  const titleInput = document.getElementById('uploadTitle');
  const fileInput = document.getElementById('uploadFile');
  const title = titleInput.value.trim();
  const file = fileInput.files[0];

  if (!file) return alert('사진 파일을 선택하세요.');

  isUploading = true;
  submitUploadBtn.disabled = true;
  submitUploadBtn.textContent = '게시 중... ⏳';

  const formData = new FormData();
  formData.append('title', title || '무제');
  formData.append('author', currentUser);
  formData.append('image', file);

  try {
    const res = await fetch('/api/posts', { method: 'POST', body: formData });
    if (res.ok) {
      uploadModal.style.display = 'none';
      titleInput.value = '';
      fileInput.value = '';
      await loadData();
    } else {
      alert('사진 업로드 실패 (5MB 용량 초과 여부를 확인하세요)');
    }
  } catch (e) {
    alert('업로드 도중 오류가 발생했습니다.');
  } finally {
    isUploading = false;
    submitUploadBtn.disabled = false;
    submitUploadBtn.textContent = '게시하기';
  }
};

updateUI();
loadData();