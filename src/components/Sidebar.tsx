import { useState } from 'react'
import { MessageSquare, Trash2, X, Clock, Edit3, Check, Settings, Edit, Plus, Search, Menu, Sparkles, ChevronRight, MoreVertical } from 'lucide-react'
import { useConversationStore } from '../stores/conversationStore'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onOpenSettings?: () => void
}

export default function Sidebar({ isOpen, onToggle, onOpenSettings }: SidebarProps) {
  const { 
    conversations, 
    currentConversationId, 
    createNewConversation, 
    setCurrentConversation, 
    deleteConversation,
    updateConversationTitle
  } = useConversationStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleNewConversation = () => {
    const current = conversations.find(c => c.id === currentConversationId)
    if (current && (!current.messages || current.messages.length === 0)) {
      if (isOpen) onToggle()
      return
    }
    createNewConversation()
    if (isOpen) onToggle()
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id)
    if (isOpen) onToggle()
  }

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // 防止触发选择对话
    deleteConversation(id)
  }

  const handleEditTitle = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const handleSaveTitle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (editTitle.trim()) {
      updateConversationTitle(id, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
    setEditTitle('')
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return new Date(date).toLocaleDateString('zh-CN')
  }

  const getLastMessagePreview = (messages: any[]) => {
    if (messages.length === 0) return '暂无消息'
    const lastMessage = messages[messages.length - 1]
    const content = lastMessage.content
    return content.length > 50 ? content.slice(0, 50) + '...' : content
  }

  return (
    <div className={`absolute left-0 top-0 h-full z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-60 lg:translate-x-0'}`}>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden animate-fade-in"
          onClick={onToggle}
        />
      )}
      
      {/* 折叠状态侧边栏 - 图标模式 */}
      {!isOpen && (
        <div className="flex flex-col w-20 bg-blue-50 border-r border-blue-100 h-full">
          {/* 顶部图标 - 菜单按钮在新对话按钮上面 */}
          <div className="flex flex-col items-center py-4 space-y-4 flex-1">
            {/* 展开侧边栏按钮 */}
            <button
              onClick={onToggle}
              className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-xl transition-colors"
              title="展开侧边栏"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* 新对话按钮 */}
            <button
              onClick={handleNewConversation}
              className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-xl transition-colors"
              title="发起新对话"
            >
              <Edit className="w-5 h-5" />
            </button>
          </div>
          
          {/* 底部设置按钮 */}
          <div className="flex flex-col items-center py-4 space-y-4">
            <button
              className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-xl transition-colors"
              title="设置"
              onClick={onOpenSettings}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 展开状态侧边栏 - 完整模式 */}
      {isOpen && (
        <div className="flex flex-col w-80 bg-blue-50 border-r border-blue-100 h-full">
          {/* 顶部操作区 - 类似Gemini官方设计 */}
          <div className="p-4 bg-blue-50 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-medium text-gray-800">Gemini</h1>
              <button
                onClick={onToggle}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="关闭侧边栏"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 新对话按钮 - 使用edit图标匹配Gemini */}
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center gap-3 p-3 text-left text-blue-800 hover:bg-blue-100 rounded-xl transition-colors mb-2"
            >
              <Edit className="w-5 h-5" />
              <span className="font-medium">发起新对话</span>
            </button>
            
            {/* 探索Gemini按钮 - 添加Gemini官方功能 */}
            <button className="w-full flex items-center gap-3 p-3 text-left text-blue-800 hover:bg-blue-100 rounded-xl transition-colors">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span>探索 Gem</span>
            </button>
          </div>

          {/* 对话列表标题 */}
          <div className="p-4 bg-blue-50">
            <h2 className="text-sm font-medium text-gray-500 mb-3">近期对话</h2>
          </div>

          {/* 对话列表 - 改进样式匹配Gemini */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无对话记录</p>
                  <p className="text-xs mt-1">开始一个新对话吧</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => {
                    const isSelected = conversation.id === currentConversationId
                    const isEditing = editingId === conversation.id
                    
                    return (
                      <div key={conversation.id} className="relative group">
                        <div
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-blue-200/60 text-blue-800' 
                              : 'hover:bg-blue-100 text-blue-800'
                          }`}
                          onClick={() => handleSelectConversation(conversation.id)}
                        >
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                  autoFocus
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveTitle(e as any, conversation.id)
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit(e as any)
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => handleSaveTitle(e, conversation.id)}
                                  className="p-1 text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  {isSelected ? (
                                    <MessageSquare className="w-4 h-4" />
                                  ) : (
                                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium truncate">
                                    {conversation.title || '新对话'}
                                  </h3>
                                  <p className="text-xs text-gray-500 truncate">
                                    {getLastMessagePreview(conversation.messages)}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {formatDate(conversation.lastMessageAt || conversation.createdAt)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* 操作按钮 - 悬停显示 */}
                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditTitle(conversation.id, conversation.title || '新对话')
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                title="编辑标题"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteConversation(e, conversation.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                                title="删除对话"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 底部设置区域 - 类似Gemini官方设计 */}
          <div className="p-4 bg-blue-50">
            <button className="w-full flex items-center gap-3 p-3 text-left text-blue-800 hover:bg-blue-100 rounded-xl transition-colors" onClick={onOpenSettings}>
              <Settings className="w-5 h-5" />
              <span>设置与帮助</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
