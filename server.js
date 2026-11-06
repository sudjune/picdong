require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 비속어 필터링 목록
const badWords = ['시발', '병신', '개새끼', '존나', '씨발', '미친', '좆', '지랄', '애미', '애비', '새끼'];

// [1] MongoDB 클라우드 연결
mongoose.connect(process.env.MONGO_URI)
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// MongoDB 데이터 구조(Schema) 정의
const userSchema = new mongoose.Schema({
  id: String,
  username: { type: String, lowercase: true }, // 대소문자 무시 저장
  password: String,
  nickname: String,
  createdAt: String
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  id: String,
  userId: String,
  filename: String,
  url: String, // Cloudinary 이미지 주소
  author: String,
  likes: [String],
  bookmarks: [String],
  createdAt: String
});
const Post = mongoose.model('Post', postSchema);

// [관리자 계정 초기화]
async function initAdmin() {
  const admin = await User.findOne({ username: 'donghang' });
  if (!admin) {
    await User.create({
      id: 'admin_donghang',
      username: 'donghang',
      password: '1q2w3e4r',
      nickname: 'DONGHANG',
      createdAt: new Date().toISOString()
    });
    console.log('✅ 관리자 계정(donghang)이 생성되었습니다.');
  }
}
initAdmin();

// [2] Cloudinary 클라우드 스토리지 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'picdong_uploads', // 클라우드에 생성될 폴더명
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static('public'));
app.use(express.json());

// [회원가입]
app.post('/api/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password || !nickname) return res.status(400).json({ field: 'all', message: '모든 항목을 입력해주세요.' });

  const trimUsername = username.trim();
  const trimNickname = nickname.trim();
  const lowerUsername = trimUsername.toLowerCase();
  
  const idRegex = /^[a-zA-Z0-9]+$/;
  if (!idRegex.test(trimUsername)) return res.status(400).json({ field: 'username', message: '아이디는 영문과 숫자만 사용할 수 있습니다.' });

  const hasBadWord = (text) => badWords.some(word => text.includes(word));
  if (hasBadWord(trimUsername)) return res.status(400).json({ field: 'username', message: '부적절한 단어가 포함되어 있습니다.' });
  if (hasBadWord(trimNickname)) return res.status(400).json({ field: 'nickname', message: '부적절한 단어가 포함되어 있습니다.' });

  // 중복 체크 (DB 조회)
  const userExists = await User.findOne({ username: lowerUsername });
  if (userExists) return res.status(400).json({ field: 'username', message: '이미 사용 중인 아이디입니다.' });
  
  // 닉네임 중복 체크 (대소문자 무시)
  const nickExists = await User.findOne({ nickname: { $regex: new RegExp('^' + trimNickname + '$', 'i') } });
  if (nickExists) return res.status(400).json({ field: 'nickname', message: '이미 사용 중인 닉네임입니다.' });

  const newUser = await User.create({
    id: 'user_' + Date.now(),
    username: lowerUsername,
    password: password.trim(),
    nickname: trimNickname,
    createdAt: new Date().toISOString()
  });

  res.status(200).json({ message: '가입 성공', user: newUser });
});

// [로그인]
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ 
    username: username.trim().toLowerCase(),
    password: password.trim()
  });
  if (!user) return res.status(400).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  res.status(200).json({ message: '로그인 성공', user });
});

// [사진 목록]
app.get('/api/photos', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }); // 최신순 정렬
  res.status(200).json(posts);
});

// [사진 업로드] - 이제 Cloudinary로 전송됨
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
  
  const newPost = await Post.create({
    id: 'post_' + Date.now(),
    userId: req.body.userId,
    filename: req.file.filename,
    url: req.file.path, // Cloudinary에서 발급한 진짜 이미지 주소!
    author: req.body.author || '익명',
    likes: [],
    bookmarks: [],
    createdAt: new Date().toISOString()
  });
  
  res.status(200).json({ message: '성공', post: newPost });
});

// [좋아요 토글]
app.post('/api/photos/:id/like', async (req, res) => {
  const post = await Post.findOne({ id: req.params.id });
  if (!post) return res.status(404).json({ message: '없음' });
  
  const idx = post.likes.indexOf(req.body.userId);
  if (idx === -1) post.likes.push(req.body.userId);
  else post.likes.splice(idx, 1);
  
  await post.save();
  res.status(200).json({ success: true });
});

// [책갈피 토글]
app.post('/api/photos/:id/bookmark', async (req, res) => {
  const post = await Post.findOne({ id: req.params.id });
  if (!post) return res.status(404).json({ message: '없음' });
  
  const idx = post.bookmarks.indexOf(req.body.userId);
  if (idx === -1) post.bookmarks.push(req.body.userId);
  else post.bookmarks.splice(idx, 1);
  
  await post.save();
  res.status(200).json({ success: true });
});

// [사진 삭제] - 관리자 프리패스 로직 유지
app.delete('/api/photos/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const post = await Post.findOne({ id: id });
  
  if (!post) return res.status(404).json({ message: '없음' });

  const isAdmin = userId === 'admin_donghang';
  if (!isAdmin && post.userId !== userId) {
    return res.status(403).json({ message: '권한 없음' });
  }

  // Cloudinary 클라우드에서도 실제 이미지 파일 삭제
  await cloudinary.uploader.destroy(post.filename);
  
  // DB에서 데이터 삭제
  await Post.deleteOne({ id: id });
  res.status(200).json({ message: '삭제 완료' });
});

app.listen(PORT, () => console.log(`서버 실행: http://localhost:${PORT}`));