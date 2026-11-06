document.addEventListener('DOMContentLoaded', () => {
  let currentUser = localStorage.getItem('picdong_user') || null;       // 아이디 (@okjune)
  let currentNickname = localStorage.getItem('picdong_nick') || currentUser; // 닉네임 (동행이1호팬)
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
  const mypageName = document.getElementById('mypageName');
  const mypageId = document.getElementById('mypageId');
  const submitUploadBtn = document.getElementById('submitUploadBtn');
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const brandLogoHome = document.getElementById('brandLogoHome');
  const rankingTabBtn = document.getElementById('rankingTabBtn');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const closeUploadModal = document.getElementById('closeUploadModal');
  const closeLightbox = document.getElementById('closeLightbox');

  const tabUploads = document.getElementById('tabUploads');
  const tabLikes = document.getElementById('tabLikes');
  const tabBookmarks = document.getElementById('tabBookmarks');

  async function syncBookmarks() {
    if (!currentUser) { userBookmarks = []; return; }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser)}/bookmarks`);
      if (res.ok) userBookmarks = await res.json();
    } catch (e) { userBookmarks = []; }
  }

  // 상단 바 UI: <닉네임>님 형태로 표기
  function updateUI() {
    if (currentUser) {
      if (authBtn) authBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      if (userInfo) {
        userInfo.style.display = 'inline-flex';
        userInfo.textContent = `${currentNickname}님`; // <닉네임>님 으로 표시
      }
    } else {
      if (authBtn) authBtn.style.display = 'inline-flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'none';
    }
  }

  // 마이페이지 뷰 열기
  function renderMypageView() {
    currentView = 'mypage';
    if (mypageSection) mypageSection.style.display = 'block';
    if (mypageName) mypageName.textContent = currentNickname;
    if (mypageId) mypageId.textContent = `@${currentUser}`;
    if (sectionTitle) sectionTitle.textContent = '보관함 피드';
    if (sectionDesc) sectionDesc.style.display = 'none';
    loadData();
  }

  async function loadData() {
    await syncBookmarks();
    try {
      const endpoint = currentView === 'ranking' ? '/api/ranking' : '/api/posts';
      const res = await fetch(endpoint);
      let posts = await res.json();
      if (!Array.isArray(posts)) posts = [];

      if (currentView === 'mypage') {
        if (myTab === 'uploads') {
          posts = posts.filter(p => p.author === currentNickname || p.author === currentUser);
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
        const isMyPost = currentUser && (post.author === currentNickname || post.author === currentUser);

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
              ${isMyPost ? `
                <button class="delete-btn" data-action="delete" data-id="${postId}" data-author="${post.author}">이 사진 삭제하기</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (feedList) feedList.innerHTML = '<p style="text-align:center; padding: 40px 0; color:#888;">사진이 없습니다.</p>';
    }
  }

  // 클릭 이벤트 위임
  if (feedList) {
    feedList.addEventListener('click', async (e) => {
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

      const delBtn = e.target.closest('button[data-action="delete"]');
      if (delBtn) {
        if (!confirm('이 사진을 정말 삭제하시겠습니까?')) return;
        const id = delBtn.dataset.id;
        const author = delBtn.dataset.author;
        try {
          const res = await fetch(`/api/posts/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author })
          });
          if (res.ok) {
            document.getElementById(`post-${id}`)?.remove();
          } else {
            alert('삭제 권한이 없습니다.');
          }
        } catch (err) { alert('삭제 도중 오류가 발생했습니다.'); }
      }
    });
  }

  // <닉네임>님 뱃지 클릭 시 -> 마이페이지로 즉각 전환
  if (userInfo) userInfo.onclick = renderMypageView;

  if (brandLogoHome) {
    brandLogoHome.onclick = () => {
      currentView = 'feed';
      if (mypageSection) mypageSection.style.display = 'none';
      if (sectionTitle) sectionTitle.textContent = '최신 피드';
      if (sectionDesc) sectionDesc.style.display = 'none';
      loadData();
    };
  }

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

  function setTab(tab, btn) {
    myTab = tab;
    [tabUploads, tabLikes, tabBookmarks].forEach(b => b?.classList.remove('active'));
    btn?.classList.add('active');
    loadData();
  }
  if (tabUploads) tabUploads.onclick = () => setTab('uploads', tabUploads);
  if (tabLikes) tabLikes.onclick = () => setTab('likes', tabLikes);
  if (tabBookmarks) tabBookmarks.onclick = () => setTab('bookmarks', tabBookmarks);

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

  // 회원가입 모드 토글 (닉네임 인풋창 보이기/숨기기)
  if (toggleAuthMode) {
    toggleAuthMode.onclick = (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      const modalTitle = document.getElementById('modalTitle');
      const toggleAuthText = document.getElementById('toggleAuthText');
      const authNickname = document.getElementById('authNickname');
      if (modalTitle) modalTitle.textContent = isSignUpMode ? '회원가입' : '로그인';
      toggleAuthMode.textContent = isSignUpMode ? '로그인' : '회원가입';
      if (toggleAuthText) toggleAuthText.textContent = isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
      if (authNickname) authNickname.style.display = isSignUpMode ? 'block' : 'none';
    };
  }

  // 로그인 / 회원가입 요청
  if (submitAuthBtn) {
    submitAuthBtn.onclick = async () => {
      const username = document.getElementById('authUsername')?.value.trim();
      const nickname = document.getElementById('authNickname')?.value.trim();
      const password = document.getElementById('authPassword')?.value.trim();
      if (!username || !password) return alert('아이디와 비밀번호를 모두 입력해주세요.');

      const endpoint = isSignUpMode ? '/api/register' : '/api/login';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, nickname, password })
        });
        const data = await res.json();
        if (res.ok) {
          if (isSignUpMode) {
            alert('회원가입 성공! 로그인해 주세요.');
            if (toggleAuthMode) toggleAuthMode.click();
          } else {
            currentUser = data.username;
            currentNickname = data.nickname || data.username;
            localStorage.setItem('picdong_user', currentUser);
            localStorage.setItem('picdong_nick', currentNickname);
            if (authModal) authModal.style.display = 'none';
            updateUI();
            renderMypageView(); // 로그인 직후 마이페이지로 이동
          }
        } else {
          alert(data.message || '요청 실패');
        }
      } catch (e) { alert('서버 통신 오류'); }
    };
  }

  // 로그아웃
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('picdong_user');
      localStorage.removeItem('picdong_nick');
      currentUser = null;
      currentNickname = null;
      updateUI();
      if (brandLogoHome) brandLogoHome.click();
    };
  }

  // 사진 업로드
  if (submitUploadBtn) {
    submitUploadBtn.onclick = async () => {
      if (isUploading) return;
      const titleInput = document.getElementById('uploadTitle');
      const fileInput = document.getElementById('uploadFile');
      const title = titleInput?.value.trim();
      const file = fileInput?.files ? fileInput.files[0] : null;

      if (!file) return alert('사진 파일을 선택하세요.');

      isUploading = true;
      submitUploadBtn.disabled = true;
      submitUploadBtn.textContent = '게시 중... ⏳';

      const formData = new FormData();
      formData.append('title', title || '무제');
      formData.append('author', currentNickname || currentUser || '익명');
      formData.append('image', file);

      try {
        const res = await fetch('/api/posts', { method: 'POST', body: formData });
        if (res.ok) {
          if (uploadModal) uploadModal.style.display = 'none';
          if (titleInput) titleInput.value = '';
          if (fileInput) fileInput.value = '';
          await loadData();
        } else {
          alert('사진 업로드 실패 (5MB 제한)');
        }
      } catch (e) {
        alert('업로드 도중 오류 발생');
      } finally {
        isUploading = false;
        submitUploadBtn.disabled = false;
        submitUploadBtn.textContent = '게시하기';
      }
    };
  }

  updateUI();
  loadData();
});