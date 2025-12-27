const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let activeStreams = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, conversationId } = req.body;
    
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

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
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