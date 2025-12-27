const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 静态文件目录（用于图片上传后访问）
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// 配置图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true); else cb(new Error('仅支持图片文件'))
  }
});

app.post('/api/upload', upload.array('images', 10), (req, res) => {
  try {
    const files = req.files || [];
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.headers.host || ('localhost:' + port)}`;
    const urls = files.map(f => `${base}/uploads/${f.filename}`);
    res.json({ urls });
  } catch (err) {
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

let activeStreams = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, conversationId, images = [] } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    // 模拟AI回复，实际使用时需要替换为真实的OpenAI API调用
    const responses = [
      "您好！我是一个AI助手，很高兴为您服务。",
      "我理解您的问题，让我为您详细解答。",
      "这是一个很有趣的问题，让我思考一下。",
      "根据我的理解，我可以为您提供一些建议。",
      "如果您还有其他问题，请随时告诉我。"
    ];

    let randomResponse = responses[Math.floor(Math.random() * responses.length)];
    // 演示：如果携带了图片，提示已接收图片数量
    if (Array.isArray(images) && images.length > 0) {
      randomResponse = `已接收 ${images.length} 张图片。`;
    }
    
    // 模拟流式响应
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const words = randomResponse.split('');
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < words.length) {
        res.write(words[index]);
        index++;
      } else {
        clearInterval(interval);
        res.end();
      }
    }, 50);

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.post('/api/chat/stop', (req, res) => {
  res.json({ success: true, message: 'Stream stopped' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
