import { useState, useRef, useEffect } from 'react'
import { Send, Square, Plus, Sparkles, Mic, ChevronDown, RotateCcw } from 'lucide-react'
import Sidebar from './components/Sidebar'
import SettingsModal from './components/SettingsModal'
import MarkdownRenderer from './components/MarkdownRenderer'
import { useConversationStore } from './stores/conversationStore'
import { useSettingsStore } from './stores/settingsStore'
import { Message } from './stores/conversationStore'

function App() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasAiStartedReplying, setHasAiStartedReplying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<{ id: string, url: string, file: File }[]>([])
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  
  const {
    currentConversationId,
    createNewConversation,
    addMessage,
    updateMessage,
    getCurrentConversation,
    setCurrentConversation,
    conversations
  } = useConversationStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { presetPrompt } = useSettingsStore()
  const handleCopy = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(msgId)
      setTimeout(() => setCopiedMessageId(null), 1500)
    } catch (err) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopiedMessageId(msgId)
        setTimeout(() => setCopiedMessageId(null), 1500)
      } catch {}
    }
  }

  const currentConversation = getCurrentConversation()

  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversation(conversations[0].id)
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages])

  useEffect(() => {
    const handleResize = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const sendMessage = async (prompt?: string, regenerateMsgId?: string) => {
    const contentToSend = (prompt ?? input).trim()
    if (!contentToSend || isLoading) return

    const convId = currentConversationId || createNewConversation()

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: contentToSend,
      timestamp: new Date(),
      images: pendingImages.map(i => i.url)
    }

    if (!regenerateMsgId) {
      addMessage(convId, userMessage)
      setInput('')
      // 清理待发送图片的预览（仅撤销本地 blob URL）
      if (pendingImages.length) {
        pendingImages.forEach(img => { if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url) })
        setPendingImages([])
      }
    }
    setIsLoading(true)
    if (!regenerateMsgId) {
      setHasAiStartedReplying(false)
    }

    try {
      // 获取对话历史
      const conversationHistory = currentConversationId
        ? (currentConversation?.messages.map(msg => ({ role: msg.role, content: msg.content })) || [])
        : []

      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...(presetPrompt ? [{ role: 'system', content: presetPrompt }] : []),
            ...conversationHistory,
            { role: 'user', content: contentToSend }
          ],
          conversationId: convId,
          images: pendingImages.map(i => i.url)
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      
      const streamId = response.headers.get('X-Stream-Id')
      setCurrentStreamId(streamId)

      // 创建初始的助手消息
      const assistantMsgId = regenerateMsgId || `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      if (regenerateMsgId) {
        updateMessage(convId, assistantMsgId, '')
      } else {
        const initialAssistantMsg: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }
        addMessage(convId, initialAssistantMsg)
      }

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        
        // 解析SSE格式的数据
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            if (!hasAiStartedReplying) {
              setHasAiStartedReplying(true)
            }
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                assistantMessage += parsed.content
              }
            } catch (e) {
              // 如果不是JSON格式，直接添加文本
              assistantMessage += data
            }
          }
        }
        
        // 实时更新消息内容
        updateMessage(convId, assistantMsgId, assistantMessage)
        
        // 当AI开始回复时，标记为已开始
        if (assistantMessage.trim() && !hasAiStartedReplying) {
          setHasAiStartedReplying(true)
        }
      }

    } catch (error) {
      const message = (error as any)?.message || ''
      const name = (error as any)?.name || ''
      const isAbort = /aborted|AbortError/i.test(message) || /AbortError/i.test(name)
      if (!isAbort) {
        console.error('Error sending message:', error)
        const errorMessage: Message = {
          id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: '抱歉，发生了错误。请稍后再试。',
          timestamp: new Date()
        }
        addMessage(convId, errorMessage)
      }
    } finally {
      setIsLoading(false)
      setCurrentStreamId(null)
      abortControllerRef.current = null
    }
  }

  const stopGeneration = async () => {
    if (currentStreamId) {
      try {
        await fetch('/api/chat/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ streamId: currentStreamId })
        })
      } catch (error) {
        console.error('Error stopping generation:', error)
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setIsLoading(false)
    setCurrentStreamId(null)
    setHasAiStartedReplying(true)
  }

  const onSelectImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    try {
      const form = new FormData()
      files.forEach(f => form.append('images', f))
      const resp = await fetch('/api/upload', { method: 'POST', body: form })
      if (!resp.ok) throw new Error('upload failed')
      const data = await resp.json()
      const urls: string[] = data.urls || []
      const items = urls.map((url) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url,
        file: new File([], '')
      }))
      setPendingImages(prev => [...prev, ...items])
    } catch {
      // 回退：读取为 Base64 Data URL 以便后端多模态注入
      const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })

      try {
        const dataUrls = await Promise.all(files.map(readAsDataUrl))
        const items = dataUrls.map((url) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url,
          file: new File([], '')
        }))
        setPendingImages(prev => [...prev, ...items])
      } catch (err) {
        // 最后兜底：仅本地预览（模型无法看到）
        const items = files.map((file) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: URL.createObjectURL(file),
          file
        }))
        setPendingImages(prev => [...prev, ...items])
      }
    }
  }

  const removePendingImage = (id: string) => {
    setPendingImages(prev => {
      const target = prev.find(i => i.id === id)
      if (target && target.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(target.url) } catch {}
      }
      return prev.filter(i => i.id !== id)
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = !currentConversation || currentConversation.messages.length === 0

  return (
    <div className="flex h-screen bg-white relative">
      {/* 侧边栏 */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onOpenSettings={() => setSettingsOpen(true)} />

      {/* 主内容区域 */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-80 lg:ml-80' : 'ml-20'}`}>
        {/* 顶部导航栏 - Gemini风格 */}
        <header className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-medium text-gray-800 font-google-sans-flex">
                Gemini
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Gemini Plus按钮 */}
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="font-medium">Gemini plus</span>
              </button>
              {/* 用户头像 */}
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-medium cursor-pointer">
                X
              </div>
            </div>
          </div>
        </header>

        {/* 通用隐藏文件选择器（图片上传） */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onSelectImages}
        />

        {/* 主界面区域 - 重新设计布局 */}
        <div className="flex-1 flex flex-col min-h-0">
          <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
              <div className="text-center gemini-fade-in mb-6 sm:mb-8">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-blue-600 mb-2">你好！ Creator</h1>
              </div>
              <div className="chat-width">
                <div className="bg-white rounded-[26px] shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 py-4 sm:py-5">
                  {pendingImages.length > 0 && (
                    <div className="px-4 sm:px-5 -mt-1 mb-2 flex flex-wrap gap-2">
                      {pendingImages.map(img => (
                        <div key={img.id} className="relative w-[50px] h-[50px]">
                          <img src={img.url} alt="preview" className="w-full h-full rounded object-cover border border-gray-200" />
                          <button
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                            title="移除"
                            onClick={() => removePendingImage(img.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="问问 Gemini"
                    className="w-full px-4 sm:px-5 pt-3 pb-2 text-sm sm:text-base text-gray-800 bg-transparent border-none resize-none focus:outline-none placeholder-gray-400 leading-relaxed min-h-[48px]"
                    rows={1}
                    disabled={isLoading}
                  />
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2 sm:py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-600">工具</span>
                      <button className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                        快捷
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                        <Mic className="w-4 h-4" />
                      </button>
                      {isLoading ? (
                        <button onClick={stopGeneration} className="px-3 py-2 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200">
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => sendMessage()}
                          disabled={!input.trim()}
                          className="px-3 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md hover:from-purple-600 hover:to-pink-600 hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-400 mt-3">Gemini 的回答未必正确无误，请注意核查</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto">
                <div className="chat-width py-6 sm:py-8">
                  <div className="space-y-8 mb-8">
                    {currentConversation?.messages.map((message, index) => {
                      const isLastMessage = index === currentConversation!.messages.length - 1
                      const isStreaming = isLastMessage && isLoading && message.role === 'assistant'
                      return (
                        <div key={`${message.id}-${index}`} className="conversation-container message-actions-hover-boundary">
                          {message.role === 'user' ? (
                            <div className="flex justify-end message-animate">
                              <div className="user-query-container right-align-content w-full">
                                <div className="user-query-bubble-container">
                                  <div className="file-preview-container mb-2 flex flex-wrap gap-2">
                                    {message.images && message.images.length > 0 && (
                                      message.images.map((url, idx) => (
                                        <button
                                          key={`${message.id}-img-${idx}`}
                                          className="rounded overflow-hidden border border-gray-200"
                                          title="点击放大"
                                          onClick={() => setImagePreviewUrl(url)}
                                        >
                                          <img src={url} alt="image" className="w-[50px] h-[50px] object-cover" />
                                        </button>
                                      ))
                                    )}
                                  </div>
                                  <div
                                    id={`user-query-content-${index}`}
                                    className="query-content verticle-align-for-single-line-text"
                                    style={{ ['--max-lines-for-collapse-count' as any]: '5' }}
                                  >
                                    {message.content}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 sm:space-y-4">
                              <div className="flex items-start gap-3 sm:gap-4">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0">G</div>
                                <div className="assistant-message-bubble">
                                  <div className="text-sm sm:text-base leading-relaxed text-gray-800 break-words mt-0">
                                    <MarkdownRenderer content={message.content} />
                                    {isStreaming && <span className="typing-cursor animate-pulse">▋</span>}
                                  </div>
                                </div>
                              </div>
                              {!isStreaming && (
                                <div className="flex items-center gap-1 ml-10 sm:ml-12">
                                  <button
                                    className={`p-1.5 sm:p-2 ${message.liked ? 'text-red-500' : 'text-gray-500'} hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors`}
                                    title={message.liked ? '取消喜欢' : '喜欢'}
                                    onClick={() => {
                                      // 为喜欢功能设置状态
                                      useConversationStore.getState().setMessageLiked(currentConversationId!, message.id, !message.liked)
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill={message.liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                  </button>
                                  {copiedMessageId === message.id && (
                                    <span className="text-xs text-green-600">已复制</span>
                                  )}
                                  <button
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                    title={copiedMessageId === message.id ? '已复制' : '复制'}
                                    onClick={() => handleCopy(message.content, message.id)}
                                  >
                                    {copiedMessageId === message.id ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </button>
                                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>
                                  <button
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                    title="重试"
                                    onClick={() => {
                                      const prior = currentConversation?.messages.slice(0, index).reverse().find(m => m.role === 'user')
                                      const retryPrompt = prior?.content || currentConversation?.messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
                                      sendMessage(retryPrompt, message.id)
                                    }}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 pb-4 bg-white">
                <div className="chat-width">
                  <div className="bg-white rounded-[26px] shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 py-4 sm:py-5">
                    {pendingImages.length > 0 && (
                      <div className="px-4 sm:px-5 -mt-1 mb-2 flex flex-wrap gap-2">
                        {pendingImages.map(img => (
                          <div key={img.id} className="relative w-[50px] h-[50px]">
                            <img src={img.url} alt="preview" className="w-full h-full rounded object-cover border border-gray-200" />
                            <button
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                              title="移除"
                              onClick={() => removePendingImage(img.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="问问 Gemini"
                      className="w-full px-4 sm:px-5 pt-3 pb-2 text-sm sm:text-base text-gray-800 bg-transparent border-none resize-none focus:outline-none placeholder-gray-400 leading-relaxed min-h-[48px]"
                      rows={1}
                      disabled={isLoading}
                    />
                    <div className="flex items-center justify-between px-4 sm:px-5 py-2 sm:py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-600">工具</span>
                        <button className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                          快捷
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                          <Mic className="w-4 h-4" />
                        </button>
                        {isLoading ? (
                          <button onClick={stopGeneration} className="px-3 py-2 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200">
                            <Square className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim()}
                            className="px-3 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md hover:from-purple-600 hover:to-pink-600 hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">Gemini 的回答未必正确无误，请注意核查</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {imagePreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setImagePreviewUrl(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-2">
            <img src={imagePreviewUrl} alt="preview" className="max-w-[90vw] max-h-[80vh] object-contain rounded" />
            <button
              className="absolute top-2 right-2 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
              onClick={() => setImagePreviewUrl(null)}
            >关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
