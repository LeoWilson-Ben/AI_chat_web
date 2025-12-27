import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置DNS解析
dns.setServers([
  '8.8.8.8',  // Google DNS
  '8.8.4.4',  // Google DNS备用
  '211.138.24.66', // 本地DNS
  '211.138.24.68'  // 本地DNS备用
]);

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

// 创建OpenAI客户端配置
const createOpenAIClient = () => {
  return {
    apiKey: process.env.OPENAI_API_KEY || 'sk-972af1aed8dc4cd39764ba34f7e3aacb',
    baseURL: process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.OPENAI_MODEL || 'qwen3-VL-plus'
  };
};

let activeStreams = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, conversationId, images = [] } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const clientConfig = createOpenAIClient();
    
    // 构建请求数据
    const requestData = {
      model: clientConfig.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...messages
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    };

    // 将图片注入到最后一条用户消息，使用OpenAI兼容的多模态格式
    if (Array.isArray(images) && images.length > 0) {
      const lastUserIndex = (() => {
        for (let i = requestData.messages.length - 1; i >= 0; i--) {
          if (requestData.messages[i].role === 'user') return i;
        }
        return -1;
      })();
      const toDataUrlFromUpload = async (filename) => {
        const fullPath = path.join(uploadDir, filename);
        const image = sharp(fullPath).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true });
        const mime = 'image/jpeg';
        const buf = await image.jpeg({ quality: 80 }).toBuffer();
        return `data:${mime};base64,${buf.toString('base64')}`;
      };

      const toContentItemAsync = async (url) => {
        try {
          if (typeof url !== 'string') return null;
          if (url.startsWith('data:image/')) {
            return { type: 'image_url', image_url: { url } };
          }
          if (/^https?:\/\//.test(url)) {
            const m = url.match(/\/uploads\/([^?#]+)/);
            if (m && m[1]) {
              const dataUrl = await toDataUrlFromUpload(m[1]);
              return { type: 'image_url', image_url: { url: dataUrl } };
            }
            return { type: 'image_url', image_url: { url } };
          }
          if (url.startsWith('/uploads/')) {
            const filename = url.replace('/uploads/', '');
            const dataUrl = await toDataUrlFromUpload(filename);
            return { type: 'image_url', image_url: { url: dataUrl } };
          }
        } catch (e) {
          console.error('图片处理失败:', e.message);
          return null;
        }
        return null;
      };

      const limitedImages = images.slice(0, 6);
      const items = (await Promise.all(limitedImages.map(toContentItemAsync))).filter(Boolean);
      if (items.length > 0) {
        const original = lastUserIndex >= 0 ? requestData.messages[lastUserIndex] : { role: 'user', content: '' };
        const originalText = typeof original.content === 'string'
          ? [{ type: 'text', text: original.content }]
          : Array.isArray(original.content) ? original.content : [];
        const content = [...originalText, ...items];
        const newUserMessage = { role: 'user', content };
        if (lastUserIndex >= 0) requestData.messages[lastUserIndex] = newUserMessage; else requestData.messages.push(newUserMessage);
      }
    }

    console.log('发送请求到OpenAI API:', {
      url: `${clientConfig.baseURL}/chat/completions`,
      model: clientConfig.model,
      messagesCount: requestData.messages.length
    });

    const url = new URL(`${clientConfig.baseURL}/chat/completions`);

    const resolve4p = (host) => new Promise((resolve, reject) => {
      dns.resolve4(host, (err, addresses) => {
        if (err) return reject(err);
        resolve(addresses || []);
      });
    });

    let targetHost = 'dashscope.aliyuncs.com';
    try {
      const addresses = await resolve4p('dashscope.aliyuncs.com');
      if (addresses && addresses.length) {
        targetHost = addresses[0];
      }
    } catch {}

    const options = {
      hostname: targetHost,
      servername: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/compatible-mode/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientConfig.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'User-Agent': 'Node.js',
        'Host': 'dashscope.aliyuncs.com'
      },
      timeout: 30000,
      family: 4
    };

    const proxyRequest = https.request(options, (proxyResponse) => {
      if (proxyResponse.statusCode !== 200) {
        let errorData = '';
        proxyResponse.on('data', chunk => errorData += chunk);
        proxyResponse.on('end', () => {
          console.error('OpenAI API错误:', proxyResponse.statusCode, errorData);
          res.status(proxyResponse.statusCode).json({ error: `API错误: ${proxyResponse.statusCode}` });
        });
        return;
      }

      const streamId = Date.now().toString();
      activeStreams.set(streamId, proxyResponse);
      res.setHeader('X-Stream-Id', streamId);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let buffer = '';
      
      proxyResponse.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      proxyResponse.on('end', () => {
        // 处理剩余的数据
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
        activeStreams.delete(streamId);
      });

      proxyResponse.on('error', (error) => {
        console.error('代理响应错误:', error);
        res.write(`data: ${JSON.stringify({ error: '流处理错误' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        activeStreams.delete(streamId);
      });
    });

    proxyRequest.on('error', (error) => {
      console.error('代理请求错误:', error);
      console.error('错误代码:', error.code);
      console.error('错误主机名:', error.hostname);
      console.error('错误地址:', error.address);
      console.error('错误端口:', error.port);
      
      if (error.code === 'ENOTFOUND') {
        res.status(503).json({ error: 'DNS解析失败，请检查网络设置' });
      } else if (error.code === 'ECONNREFUSED') {
        res.status(503).json({ error: '网络连接被拒绝，请检查网络设置' });
      } else if (error.code === 'ETIMEDOUT') {
        res.status(504).json({ error: '请求超时，请稍后重试' });
      } else {
        res.status(500).json({ error: `网络错误: ${error.message}` });
      }
    });

    proxyRequest.on('timeout', () => {
      proxyRequest.destroy();
      res.status(504).json({ error: '请求超时，请稍后重试' });
    });

    proxyRequest.write(JSON.stringify(requestData));
    proxyRequest.end();

  } catch (error) {
    console.error('Chat API错误:', error.message);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/chat/stop', (req, res) => {
  try {
    const { streamId } = req.body;
    
    if (streamId && activeStreams.has(streamId)) {
      const stream = activeStreams.get(streamId);
      if (stream && stream.body) {
        stream.body.cancel();
      }
      activeStreams.delete(streamId);
      res.json({ success: true, message: 'Stream stopped' });
    } else {
      res.status(404).json({ error: 'Stream not found' });
    }
  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Chat System',
    version: '1.0.0'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 AI对话系统后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${port}`);
  console.log(`📡 外部访问地址: http://10.219.55.17:${port}`);
  console.log(`🔑 API模型: ${createOpenAIClient().model}`);
  console.log(`🌐 API地址: ${createOpenAIClient().baseURL}`);
});
