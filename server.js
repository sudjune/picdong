require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cloudinary 연동
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 보안: 5MB 용량 제한 및 이미지 확장자 필터
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'picdong_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB 초과 파일 차단
});

const POSTS_FILE = path.join(__dirname, 'posts.json');
const USERS_FILE = path.join(__dirname, 'users.json');

function readData(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (err) {
    return [];
  }
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 1. 피드 목록 조회
app.get('/api/posts', (req, res) => {
  const posts = readData(POSTS_FILE);
  posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json(posts);
});

// 2. 주간 랭킹 조회 (좋아요 많은 순 정렬)
app.get('/api/ranking', (req, res) => {
  const posts = readData(POSTS_FILE);
  const sorted = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  res.json(sorted.slice(0, 20));
});

// 3. 회원가입 (보안: bcrypt 일방향 해시 암호화 적용)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력하세요.' });

    const users = readData(USERS_FILE);
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // 비밀번호 해시 암호화 (Salt Round 10)
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({
      username,
      password: hashedPassword,
      bookmarks: [],
      createdAt: new Date().toISOString()
    });
    writeData(USERS_FILE, users);
    res.json({ success: true, message: '회원가입 완료' });
  } catch (err) {
    res.status(500).json({ message: '회원가입 처리 중 오류 발생' });
  }
});

// 4. 로그인 (보안: bcrypt 비밀번호 대조 검증)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readData(USERS_FILE);
    const user = users.find(u => u.username === username);
    if (!user) return res.status(400).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    // 암호화된 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    res.json({ success: true, username: user.username });
  } catch (err) {
    res.status(500).json({ message: '로그인 중 오류 발생' });
  }
});

// 5. 사진 업로드
app.post('/api/posts', upload.single('image'), (req, res) => {
  try {
    const { title, author } = req.body;
    if (!req.file) return res.status(400).json({ message: '사진 파일을 첨부해 주세요.' });

    const posts = readData(POSTS_FILE);
    const newPost = {
      _id: Date.now().toString(),
      title: title || '무제',
      imageUrl: req.file.path,
      author: author || '익명',
      likes: 0,
      likedUsers: [], // 중복 좋아요 방지 배열
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    writeData(POSTS_FILE, posts);
    res.json({ success: true, post: newPost });
  } catch (err) {
    res.status(500).json({ message: '업로드 실패' });
  }
});

// 6. 좋아요 토글 (1인 1좋아요 보장)
app.post('/api/posts/:id/like', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const posts = readData(POSTS_FILE);
  const post = posts.find(p => String(p._id) === String(req.params.id) || String(p.id) === String(req.params.id));
  if (!post) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

  if (!post.likedUsers) post.likedUsers = [];

  const index = post.likedUsers.indexOf(username);
  let isLiked = false;
  if (index === -1) {
    post.likedUsers.push(username);
    post.likes = (post.likes || 0) + 1;
    isLiked = true;
  } else {
    post.likedUsers.splice(index, 1);
    post.likes = Math.max(0, (post.likes || 0) - 1);
    isLiked = false;
  }

  writeData(POSTS_FILE, posts);
  res.json({ success: true, likes: post.likes, isLiked });
});

// 7. 책갈피(저장) 토글
app.post('/api/posts/:id/bookmark', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const users = readData(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  if (!user.bookmarks) user.bookmarks = [];

  const postId = String(req.params.id);
  const index = user.bookmarks.indexOf(postId);
  let isBookmarked = false;
  if (index === -1) {
    user.bookmarks.push(postId);
    isBookmarked = true;
  } else {
    user.bookmarks.splice(index, 1);
    isBookmarked = false;
  }

  writeData(USERS_FILE, users);
  res.json({ success: true, isBookmarked });
});

// 8. 북마크 목록 조회
app.get('/api/users/:username/bookmarks', (req, res) => {
  const users = readData(USERS_FILE);
  const user = users.find(u => u.username === req.params.username);
  res.json(user ? user.bookmarks || [] : []);
});

// 9. 사진 삭제 (보안: 본인 작성자 여부 서버 권한 검증)
app.delete('/api/posts/:id', (req, res) => {
  const { username } = req.body;
  const posts = readData(POSTS_FILE);
  const post = posts.find(p => String(p._id) === String(req.params.id) || String(p.id) === String(req.params.id));

  if (!post) return res.status(404).json({ message: '사진을 찾을 수 없습니다.' });
  if (post.author !== username) {
    return res.status(403).json({ message: '본인이 올린 사진만 삭제할 수 있습니다.' });
  }

  const filtered = posts.filter(p => String(p._id) !== String(req.params.id) && String(p.id) !== String(req.params.id));
  writeData(POSTS_FILE, filtered);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`서버 정상 실행 중 (Port: ${PORT})`);
});