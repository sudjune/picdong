require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fs = require('fs');
const path = require('path');

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

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'picdong_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
  }
});
const upload = multer({ storage: storage });

// 데이터 파일 헬퍼 함수
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

// 1. 피드 목록 조회 (posts.json 반환)
app.get('/api/posts', (req, res) => {
  const posts = readData(POSTS_FILE);
  // 최신순 정렬
  posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json(posts);
});

// 2. 랭킹 조회 (좋아요 순)
app.get('/api/ranking', (req, res) => {
  const posts = readData(POSTS_FILE);
  posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  res.json(posts.slice(0, 10));
});

// 3. 사진 업로드
app.post('/api/posts', upload.single('image'), (req, res) => {
  try {
    const { title, author } = req.body;
    if (!req.file) return res.status(400).json({ message: '이미지 파일이 필요합니다.' });

    const posts = readData(POSTS_FILE);
    const newPost = {
      _id: Date.now().toString(),
      title: title || '제목 없음',
      imageUrl: req.file.path,
      author: author || '익명',
      likes: 0,
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    writeData(POSTS_FILE, posts);
    res.json({ success: true, post: newPost });
  } catch (err) {
    res.status(500).json({ message: '업로드 실패' });
  }
});

// 4. 좋아요 처리
app.post('/api/posts/:id/like', (req, res) => {
  const posts = readData(POSTS_FILE);
  const post = posts.find(p => String(p._id) === String(req.params.id) || String(p.id) === String(req.params.id));
  if (post) {
    post.likes = (post.likes || 0) + 1;
    writeData(POSTS_FILE, posts);
    return res.json({ success: true, likes: post.likes });
  }
  res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
});

// 5. 사진 삭제
app.delete('/api/posts/:id', (req, res) => {
  let posts = readData(POSTS_FILE);
  posts = posts.filter(p => String(p._id) !== String(req.params.id) && String(p.id) !== String(req.params.id));
  writeData(POSTS_FILE, posts);
  res.json({ success: true });
});

// 6. 회원가입
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '정보를 모두 입력하세요.' });

  const users = readData(USERS_FILE);
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ message: '이미 존재하는 아이디입니다.' });
  }

  users.push({ username, password, createdAt: new Date().toISOString() });
  writeData(USERS_FILE, users);
  res.json({ success: true, message: '회원가입 완료' });
});

// 7. 로그인
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readData(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(400).json({ message: '아이디 또는 비밀번호가 틀렸습니다.' });

  res.json({ success: true, username: user.username });
});

app.listen(PORT, () => {
  console.log(`서버 가동: ${PORT}`);
});