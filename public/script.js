document.addEventListener('DOMContentLoaded', () => {
  let currentUser = localStorage.getItem('picdong_user') || null;
  let currentView = 'feed'; // 'feed' | 'ranking' | 'mypage'
  let myTab = 'uploads';    // 'uploads' | 'likes' | 'bookmarks'
  let isSignUpMode = false;
  let isUploading = false;
  let userBookmarks = [];

  // DOM 요소 선택
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
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const brandLogoHome = document.getElementById('brandLogoHome');
  const rankingTabBtn = document.getElementById('rankingTabBtn');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const closeUploadModal = document.getElementById('closeUploadModal');
  const closeLightbox = document.getElementById('closeLightbox');

  // 북마크 동기화 (오류 무시 처리)
  async function syncBookmarks() {
    if (!currentUser) {
      userBookmarks = [];
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser)}/bookmarks`);
      if (res.ok) {
        userBookmarks = await res.json();
      }
    } catch (e) {
      userBookmarks = [];
    }
  }

  // 상단바 로그인 UI 업데이트
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

  // 피드 및 랭킹 데이터 불러오기
  async function loadData() {
    await syncBookmarks();
    try {
      const endpoint = currentView === 'ranking' ? '/api/ranking' : '/api/posts';
      const res = await fetch(endpoint);
      
      if (!res.ok) throw new Error('서버 응답 에러');
      let posts = await res.json();
      if (!Array.isArray(posts)) posts = [];

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

      if (postCount) postCount.textContent = `${posts.length}장`;

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
            <div class="card-img-wrap" data-img="${post.imageUrl}" data-author="${post.author || '익명'}">
              <img src="${post.imageUrl}" alt="${post.title || ''}" loading="lazy">
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span>${post.author || '익명'}</span>
                <span>${formattedDate}</span>
              </div>
              <div class="card-actions">
                <button class="action-btn ${isLiked ? 'active-like' : ''}" data-action="like" data-id="${postId}">
                  <span>${isLiked ? '❤️' : '🤍'}</span>
                  <span class="like-cnt">${post.likes || 0}</span>
                </button>
                <button class="action-btn ${isBookmarked ? 'active-bookmark' : ''}" data-action="bookmark" data-id="${postId}">
                  <span>${isBookmarked ? '📑' : '📄'}</span>
                  <span>${isBookmarked ? '저장됨' : '저장'}</span>
                </button>
              </div>
              ${currentUser === post.author ? `
                <button class="delete-btn" data-action="delete" data-id="${postId}">이 사진 삭제하기</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      if (feedList) {
        feedList.innerHTML = '<p style="text-align:center; padding: 40px 0; color:#888;">사진이 없습니다.</p>';
      }
    }
  }

  // 카드 내부 클릭 이벤트 위임 (좋아요, 북마크, 삭제, 사진 확대)
  if (feedList) {
    feedList.addEventListener('click', async (e) => {
      // 1. 이미지 클릭 시 라이트박스 확대
      const imgWrap = e.target.closest('.card-img-wrap');
      if (imgWrap) {
        const src = imgWrap.dataset.img;
        const author = imgWrap.dataset.author;
        if (lightboxModal && src) {
          document.getElementById('lightboxImg').src = src;
          document.getElementById('lightboxAuthor').textContent = `📸 ${author}`;
          lightboxModal.style.display = 'flex';
        }
        return;
      }

      // 2. 좋아요 버튼
      const likeBtn = e.target.closest('button[data-action="like"]');
      if (likeBtn) {
        if (!currentUser) return alert('로그인 후 이용해 주세요.');
        const id = likeBtn.dataset.id;
        try {
          const res = await fetch(`/api/posts/${id}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
          });
          const data = await res.json();
          if (data.success) {
            likeBtn.querySelector('.like-cnt').textContent = data.likes;
            if (data.isLiked) {
              likeBtn.classList.add('active-like');
              likeBtn.querySelector('span').textContent = '❤️';
            } else {
              likeBtn.classList.remove('active-like');
              likeBtn.querySelector('span').textContent = '🤍';
            }
          }
        } catch (err) { console.error(err); }
        return;
      }

      // 3. 북마크 버튼
      const bmkBtn = e.target.closest('button[data-action="bookmark"]');
      if (bmkBtn) {
        if (!currentUser) return alert('로그인 후 이용해 주세요.');
        const id = bmkBtn.dataset.id;
        try {
          const res = await fetch(`/api/posts/${id}/bookmark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
          });
          const data = await res.json();
          if (data.success) {
            if (data.isBookmarked) {
              bmkBtn.classList.add('active-bookmark');
              bmkBtn.innerHTML = '<span>📑</span><span>저장됨</span>';
            } else {
              bmkBtn.classList.remove('active-bookmark');
              bmkBtn.innerHTML = '<span>📄</span><span>저장</span>';
            }
            await syncBookmarks();
          }
        } catch (err) { console.error(err); }
        return;
      }

      // 4. 사진 삭제
      const delBtn = e.target.closest('button[data-action="delete"]');
      if (delBtn) {
        if (!confirm('이 사진을 정말 삭제하시겠습니까?')) return;
        const id = delBtn.dataset.id;
        try {
          const res = await fetch(`/api/posts/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
          });
          if (res.ok) {
            document.getElementById(`post-${id}`)?.remove();
          } else {
            alert('삭제에 실패했습니다.');
          }
        } catch (err) { alert('삭제 도중 오류가 발생했습니다.'); }
      }
    });
  }

  // 상단 로고 (홈 피드로 전환)
  if (brandLogoHome) {
    brandLogoHome.onclick = () => {
      currentView = 'feed';
      if (mypageSection) mypageSection.style.display = 'none';
      if (sectionTitle) sectionTitle.textContent = '최신 피드';
      if (sectionDesc) sectionDesc.style.display = 'none';
      loadData();
    };
  }

  // 랭킹 탭 전환
  if (rankingTabBtn) {
    rankingTabBtn.onclick = () => {
      currentView = 'ranking';
      if (mypageSection) mypageSection.style.display = 'none';
      if (sectionTitle) sectionTitle.textContent = '🏆 명예의 전당 (주간 베스트)';
      if (sectionDesc) {
        sectionDesc.textContent = '최근 가장 많은 하트를 받은 사진 순위입니다.';
        sectionDesc.style.display = 'block';
      }
      loadData();
    };
  }

  // 사용자 정보 클릭 (마이페이지 전환)
  if (userInfo) {
    userInfo.onclick = () => {
      currentView = 'mypage';
      if (mypageSection) mypageSection.style.display = 'block';
      const myName = document.getElementById('mypageName');
      const myId = document.getElementById('mypageId');
      if (myName) myName.textContent = currentUser;
      if (myId) myId.textContent = `@${currentUser}`;
      if (sectionTitle) sectionTitle.textContent = '보관함 피드';
      if (sectionDesc) sectionDesc.style.display = 'none';
      loadData();
    };
  }

  // 마이페이지 탭 버튼 핸들러
  window.switchMyTab = function(tab) {
    myTab = tab;
    document.querySelectorAll('.mypage-tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    loadData();
  };

  // 모달 제어
  if (authBtn && authModal) authBtn.onclick = () => { authModal.style.display = 'flex'; };
  if (uploadBtn && uploadModal) {
    uploadBtn.onclick = () => {
      if (!currentUser) return alert('로그인 후 이용해 주세요.');
      uploadModal.style.display = 'flex';
    };
  }
  if (closeAuthModal && authModal) closeAuthModal.onclick = () => { authModal.style.display = 'none'; };
  if (closeUploadModal && uploadModal) closeUploadModal.onclick = () => { uploadModal.style.display = 'none'; };
  if (closeLightbox && lightboxModal) closeLightbox.onclick = () => { lightboxModal.style.display = 'none'; };

  // 회원가입 모드 토글
  if (toggleAuthMode) {
    toggleAuthMode.onclick = (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      const modalTitle = document.getElementById('modalTitle');
      const toggleAuthText = document.getElementById('toggleAuthText');
      if (modalTitle) modalTitle.textContent = isSignUpMode ? '회원가입' : '로그인';
      toggleAuthMode.textContent = isSignUpMode ? '로그인' : '회원가입';
      if (toggleAuthText) toggleAuthText.textContent = isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
    };
  }

  // 로그인 / 회원가입 제출
  if (submitAuthBtn) {
    submitAuthBtn.onclick = async () => {
      const usernameInput = document.getElementById('authUsername');
      const passwordInput = document.getElementById('authPassword');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      if (!username || !password) return alert('아이디와 비밀번호를 모두 입력하세요.');

      const endpoint = isSignUpMode ? '/api/register' : '/api/login';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
          if (isSignUpMode) {
            alert('회원가입이 완료되었습니다. 로그인해 주세요!');
            if (toggleAuthMode) toggleAuthMode.click();
          } else {
            currentUser = data.username;
            localStorage.setItem('picdong_user', currentUser);
            if (authModal) authModal.style.display = 'none';
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            updateUI();
            loadData();
          }
        } else {
          alert(data.message || '요청 실패');
        }
      } catch (err) {
        alert('서버와 통신할 수 없습니다.');
      }
    };
  }

  // 로그아웃
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('picdong_user');
      currentUser = null;
      updateUI();
      if (brandLogoHome) brandLogoHome.click();
    };
  }

  // 사진 업로드 (중복 클릭 방지)
  if (submitUploadBtn) {
    submitUploadBtn.onclick = async () => {
      if (isUploading) return;

      const titleInput = document.getElementById('uploadTitle');
      const fileInput = document.getElementById('uploadFile');
      const title = titleInput ? titleInput.value.trim() : '';
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      if (!file) return alert('사진 파일을 선택하세요.');

      isUploading = true;
      submitUploadBtn.disabled = true;
      submitUploadBtn.textContent = '게시 중... ⏳';

      const formData = new FormData();
      formData.append('title', title || '무제');
      formData.append('author', currentUser || '익명');
      formData.append('image', file);

      try {
        const res = await fetch('/api/posts', { method: 'POST', body: formData });
        if (res.ok) {
          if (uploadModal) uploadModal.style.display = 'none';
          if (titleInput) titleInput.value = '';
          if (fileInput) fileInput.value = '';
          await loadData();
        } else {
          alert('사진 업로드 실패 (5MB 초과 여부를 확인하세요)');
        }
      } catch (e) {
        alert('업로드 도중 오류가 발생했습니다.');
      } finally {
        isUploading = false;
        submitUploadBtn.disabled = false;
        submitUploadBtn.textContent = '게시하기';
      }
    };
  }

  // 초기 시작
  updateUI();
  loadData();
});