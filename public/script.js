let currentUser = localStorage.getItem('picdong_user') || null;
let isSignUpMode = false;
let isUploading = false; // 중복 업로드 방지 플래그

const authModal = document.getElementById('authModal');
const uploadModal = document.getElementById('uploadModal');
const authBtn = document.getElementById('authBtn');
const uploadBtn = document.getElementById('uploadBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const feedList = document.getElementById('feedList');
const postCount = document.getElementById('postCount');
const submitUploadBtn = document.getElementById('submitUploadBtn');

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

// 피드 목록 가져오기
async function loadPosts() {
  try {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    if (postCount) postCount.textContent = `${posts.length}장`;

    if (posts.length === 0) {
      feedList.innerHTML = '<p class="empty-msg" style="padding:20px;text-align:center;color:#888;">사진이 없습니다.</p>';
      return;
    }

    feedList.innerHTML = posts.map(post => `
      <div class="card" id="post-${post._id}">
        <img src="${post.imageUrl}" alt="${post.title}" loading="lazy">
        <div class="card-body">
          <div class="card-title">${post.title}</div>
          <div class="card-footer">
            <span>${post.author}</span>
            <div class="card-actions">
              <!-- 좋아요 클릭 시 화면 전체를 새로고침하지 않고 숫자만 즉각 수정 -->
              <button class="action-btn" onclick="likePost('${post._id}', this)">
                <span class="heart-icon">❤️</span> 
                <span class="like-count">${post.likes}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('피드 로딩 에러:', err);
  }
}

// ⚡ 깜빡임 없는 부분 업데이트(Optimistic Update) 좋아요 기능
window.likePost = async function(id, btnElement) {
  try {
    const countSpan = btnElement.querySelector('.like-count');
    // 1. 화면의 숫자부터 1 올려서 깜빡임 없이 즉각 반응
    const currentCount = parseInt(countSpan.textContent, 10) || 0;
    countSpan.textContent = currentCount + 1;

    // 2. 서버로 조용히 전송
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
    const data = await res.json();
    
    // 3. 서버의 실제 값으로 보정 (전체 화면 새로고침 X)
    if (data.success && typeof data.likes === 'number') {
      countSpan.textContent = data.likes;
    }
  } catch (err) {
    console.error('좋아요 실패:', err);
  }
};

// 모달 제어
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

// 회원가입 / 로그인 토글
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

// 로그인/회원가입 처리
const submitAuthBtn = document.getElementById('submitAuthBtn');
if (submitAuthBtn) {
  submitAuthBtn.onclick = async () => {
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
        toggleAuthMode.click();
      } else {
        currentUser = data.username;
        localStorage.setItem('picdong_user', currentUser);
        authModal.style.display = 'none';
        updateUI();
      }
    } else {
      alert(data.message || '오류가 발생했습니다.');
    }
  };
}

// 로그아웃
if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.removeItem('picdong_user');
    currentUser = null;
    updateUI();
  };
}

// ⚡ 중복 업로드 방지 & 로딩 버튼 상태 적용
if (submitUploadBtn) {
  submitUploadBtn.onclick = async () => {
    if (isUploading) return; // 이미 전송 중이면 클릭 무시

    const titleInput = document.getElementById('uploadTitle');
    const fileInput = document.getElementById('uploadFile');
    const title = titleInput.value.trim();
    const file = fileInput.files[0];

    if (!title || !file) return alert('제목과 사진을 모두 선택하세요.');

    // 1. 버튼 잠금 및 안내 텍스트 표시
    isUploading = true;
    submitUploadBtn.disabled = true;
    submitUploadBtn.textContent = '사진 업로드 중... ⏳';

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
        await loadPosts(); // 새 피드 불러오기
      } else {
        alert('업로드에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (err) {
      alert('업로드 도중 오류가 발생했습니다.');
    } finally {
      // 2. 완료 후 버튼 원상복구
      isUploading = false;
      submitUploadBtn.disabled = false;
      submitUploadBtn.textContent = '업로드';
    }
  };
}

// 초기 실행
updateUI();
loadPosts();