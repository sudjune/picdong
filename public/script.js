let currentUser = localStorage.getItem('picdong_user') || null;
let isSignUpMode = false;
let isUploading = false;
let showingRanking = false;

const authModal = document.getElementById('authModal');
const uploadModal = document.getElementById('uploadModal');
const authBtn = document.getElementById('authBtn');
const uploadBtn = document.getElementById('uploadBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const feedList = document.getElementById('feedList');
const postCount = document.getElementById('postCount');
const submitUploadBtn = document.getElementById('submitUploadBtn');
const rankingTabBtn = document.getElementById('rankingTabBtn');
const sectionTitle = document.getElementById('sectionTitle');

function updateUI() {
  if (currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (userInfo) {
      userInfo.style.display = 'inline-flex';
      userInfo.textContent = `${currentUser}님`;
    }
  } else {
    if (authBtn) authBtn.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  }
}

// 피드 로드
async function loadPosts() {
  try {
    const endpoint = showingRanking ? '/api/ranking' : '/api/posts';
    const res = await fetch(endpoint);
    const posts = await res.json();

    if (!Array.isArray(posts)) {
      feedList.innerHTML = '<p class="empty-msg">데이터를 가져오지 못했습니다.</p>';
      return;
    }

    if (postCount) postCount.textContent = `${posts.length}장`;

    if (posts.length === 0) {
      feedList.innerHTML = '<p class="empty-msg">등록된 사진이 없습니다.</p>';
      return;
    }

    feedList.innerHTML = posts.map(post => {
      const postId = post._id || post.id;
      const createdDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '';
      return `
        <div class="card" id="post-${postId}">
          <img src="${post.imageUrl}" alt="${post.title || ''}" loading="lazy">
          <div class="card-body">
            <div class="card-title">${post.title || '무제'}</div>
            <div class="card-footer">
              <span>${post.author || '익명'} ${createdDate ? '· ' + createdDate : ''}</span>
              <div class="card-actions">
                <button class="action-btn" onclick="likePost('${postId}', this)">
                  <span>❤️</span> 
                  <span class="like-count">${post.likes || 0}</span>
                </button>
              </div>
            </div>
            ${currentUser && currentUser === post.author ? `
              <button class="delete-btn" onclick="deletePost('${postId}')">이 사진 삭제하기</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('로딩 오류:', err);
    feedList.innerHTML = '<p class="empty-msg">목록을 불러오는 중 오류가 발생했습니다.</p>';
  }
}

// 깜빡임 없는 좋아요
window.likePost = async function(id, btnElement) {
  try {
    const countSpan = btnElement.querySelector('.like-count');
    const currentCount = parseInt(countSpan.textContent, 10) || 0;
    countSpan.textContent = currentCount + 1;

    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success && typeof data.likes === 'number') {
      countSpan.textContent = data.likes;
    }
  } catch (err) {
    console.error(err);
  }
};

// 사진 삭제
window.deletePost = async function(id) {
  if (!confirm('이 사진을 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const card = document.getElementById(`post-${id}`);
      if (card) card.remove();
      if (postCount) {
        const cur = parseInt(postCount.textContent, 10) || 1;
        postCount.textContent = `${Math.max(0, cur - 1)}장`;
      }
    }
  } catch (err) {
    alert('삭제 오류 발생');
  }
};

// 랭킹 탭
if (rankingTabBtn) {
  rankingTabBtn.onclick = () => {
    showingRanking = !showingRanking;
    if (sectionTitle) sectionTitle.textContent = showingRanking ? '🏆 주간 베스트 랭킹' : '최신 피드';
    rankingTabBtn.textContent = showingRanking ? '📋 전체 피드' : '🏆 랭킹';
    loadPosts();
  };
}

// 모달
if (authBtn) authBtn.onclick = () => { authModal.style.display = 'flex'; };
if (uploadBtn) {
  uploadBtn.onclick = () => {
    if (!currentUser) return alert('로그인 후 이용해 주세요.');
    uploadModal.style.display = 'flex';
  };
}
const closeAuth = document.getElementById('closeAuthModal');
const closeUpload = document.getElementById('closeUploadModal');
if (closeAuth) closeAuth.onclick = () => { authModal.style.display = 'none'; };
if (closeUpload) closeUpload.onclick = () => { uploadModal.style.display = 'none'; };

// 회원가입 전환
const toggleAuthMode = document.getElementById('toggleAuthMode');
if (toggleAuthMode) {
  toggleAuthMode.onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    document.getElementById('modalTitle').textContent = isSignUpMode ? '회원가입' : '로그인';
    toggleAuthMode.textContent = isSignUpMode ? '로그인' : '회원가입';
    document.getElementById('toggleAuthText').textContent = isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
  };
}

// 회원가입/로그인 요청
if (submitAuthBtn) {
  submitAuthBtn.onclick = async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!username || !password) return alert('입력창을 모두 채워주세요.');

    const endpoint = isSignUpMode ? '/api/register' : '/api/login';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      if (isSignUpMode) {
        alert('회원가입 완료! 로그인해 주세요.');
        toggleAuthMode.click();
      } else {
        currentUser = data.username;
        localStorage.setItem('picdong_user', currentUser);
        authModal.style.display = 'none';
        updateUI();
        loadPosts();
      }
    } else {
      alert(data.message || '오류 발생');
    }
  };
}

// 로그아웃
if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.removeItem('picdong_user');
    currentUser = null;
    updateUI();
    loadPosts();
  };
}

// 업로드 (중복 클릭 방지)
if (submitUploadBtn) {
  submitUploadBtn.onclick = async () => {
    if (isUploading) return;

    const titleInput = document.getElementById('uploadTitle');
    const fileInput = document.getElementById('uploadFile');
    const title = titleInput.value.trim();
    const file = fileInput.files[0];

    if (!title || !file) return alert('제목과 사진을 모두 선택하세요.');

    isUploading = true;
    submitUploadBtn.disabled = true;
    submitUploadBtn.textContent = '업로드 중... ⏳';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', currentUser);
    formData.append('image', file);

    try {
      const res = await fetch('/api/posts', { method: 'POST', body: formData });
      if (res.ok) {
        uploadModal.style.display = 'none';
        titleInput.value = '';
        fileInput.value = '';
        await loadPosts();
      } else {
        alert('업로드 실패');
      }
    } catch (err) {
      alert('네트워크 오류');
    } finally {
      isUploading = false;
      submitUploadBtn.disabled = false;
      submitUploadBtn.textContent = '게시하기';
    }
  };
}

updateUI();
loadPosts();