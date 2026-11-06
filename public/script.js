let currentUser = localStorage.getItem('picdong_user') || null;
let isSignUpMode = false;
let isUploading = false; // 중복 업로드 방지 플래그
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

// 피드 목록 가져오기
async function loadPosts() {
  try {
    const endpoint = showingRanking ? '/api/ranking' : '/api/posts';
    const res = await fetch(endpoint);
    const posts = await res.json();
    postCount.textContent = `${posts.length}장`;

    if (posts.length === 0) {
      feedList.innerHTML = '<p class="empty-msg">등록된 사진이 없습니다.</p>';
      return;
    }

    feedList.innerHTML = posts.map(post => `
      <div class="card" id="post-${post._id}">
        <img src="${post.imageUrl}" alt="${post.title}" loading="lazy">
        <div class="card-body">
          <div class="card-title">${post.title}</div>
          <div class="card-footer">
            <span>${post.author} · ${new Date(post.createdAt).toLocaleDateString()}</span>
            <div class="card-actions">
              <button class="action-btn" onclick="likePost('${post._id}', this)">
                <span>❤️</span> 
                <span class="like-count">${post.likes}</span>
              </button>
            </div>
          </div>
          ${currentUser === post.author ? `
            <button class="delete-btn" onclick="deletePost('${post._id}')">이 사진 삭제하기</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('데이터 로드 실패:', err);
  }
}

// ⚡ 깜빡임 없는 좋아요 처리 (화면 새로고침 없이 숫자만 즉각 수정)
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
    console.error('좋아요 실패:', err);
  }
};

// 사진 삭제
window.deletePost = async function(id) {
  if (!confirm('이 사진을 정말 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const card = document.getElementById(`post-${id}`);
      if (card) card.remove();
      const current = parseInt(postCount.textContent, 10) || 1;
      postCount.textContent = `${Math.max(0, current - 1)}장`;
    } else {
      alert('삭제에 실패했습니다.');
    }
  } catch (err) {
    alert('삭제 중 오류가 발생했습니다.');
  }
};

// 랭킹 토글
if (rankingTabBtn) {
  rankingTabBtn.onclick = () => {
    showingRanking = !showingRanking;
    sectionTitle.textContent = showingRanking ? '🏆 주간 베스트 랭킹' : '최신 피드';
    rankingTabBtn.textContent = showingRanking ? '📋 전체 피드' : '🏆 랭킹';
    loadPosts();
  };
}

// 모달 제어
authBtn.onclick = () => { authModal.style.display = 'flex'; };
uploadBtn.onclick = () => {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');
  uploadModal.style.display = 'flex';
};
document.getElementById('closeAuthModal').onclick = () => { authModal.style.display = 'none'; };
document.getElementById('closeUploadModal').onclick = () => { uploadModal.style.display = 'none'; };

// 회원가입 / 로그인 전환
document.getElementById('toggleAuthMode').onclick = (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  document.getElementById('modalTitle').textContent = isSignUpMode ? '회원가입' : '로그인';
  document.getElementById('toggleAuthMode').textContent = isSignUpMode ? '로그인' : '회원가입';
  document.getElementById('toggleAuthText').textContent = isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
};

// 로그인/회원가입 요청
document.getElementById('submitAuthBtn').onclick = async () => {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  if (!username || !password) return alert('아이디와 비밀번호를 입력해주세요.');

  const endpoint = isSignUpMode ? '/api/register' : '/api/login';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (res.ok) {
    if (isSignUpMode) {
      alert('회원가입 성공! 로그인해 주세요.');
      document.getElementById('toggleAuthMode').click();
    } else {
      currentUser = data.username;
      localStorage.setItem('picdong_user', currentUser);
      authModal.style.display = 'none';
      updateUI();
      loadPosts();
    }
  } else {
    alert(data.message || '오류가 발생했습니다.');
  }
};

// 로그아웃
logoutBtn.onclick = () => {
  localStorage.removeItem('picdong_user');
  currentUser = null;
  updateUI();
  loadPosts();
};

// ⚡ 중복 업로드 방지 (버튼 비활성화 및 로딩 전환)
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
      alert('업로드에 실패했습니다. 다시 시도해 주세요.');
    }
  } catch (err) {
    alert('업로드 도중 네트워크 오류가 발생했습니다.');
  } finally {
    isUploading = false;
    submitUploadBtn.disabled = false;
    submitUploadBtn.textContent = '게시하기';
  }
};

updateUI();
loadPosts();