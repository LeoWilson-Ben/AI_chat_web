import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  liked?: boolean
  images?: string[]
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface ConversationStore {
  conversations: Conversation[]
  currentConversationId: string | null
  createNewConversation: () => string
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, content: string) => void
  setCurrentConversation: (id: string) => void
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  getCurrentConversation: () => Conversation | null
  setMessageLiked: (conversationId: string, messageId: string, liked: boolean) => void
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,

      createNewConversation: () => {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title: '新对话',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        set(state => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: newConversation.id
        }))
        
        return newConversation.id
      },

      addMessage: (conversationId: string, message: Message) => {
        set(state => {
          const updatedConversations = state.conversations.map(conv => {
            if (conv.id === conversationId) {
              const updatedMessages = [...conv.messages, message]
              // 如果是第一条用户消息，用前50个字符作为标题
              const newTitle = conv.messages.length === 0 && message.role === 'user' 
                ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                : conv.title
              
              return {
                ...conv,
                messages: updatedMessages,
                title: newTitle,
                updatedAt: new Date()
              }
            }
            return conv
          })
          
          return { conversations: updatedConversations }
        })
      },

      updateMessage: (conversationId: string, messageId: string, content: string) => {
        set(state => ({
          conversations: state.conversations.map(conv => {
            if (conv.id === conversationId) {
              const updatedMessages = conv.messages.map(msg => 
                msg.id === messageId ? { ...msg, content, timestamp: new Date() } : msg
              )
              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: new Date()
              }
            }
            return conv
          })
        }))
      },

      setMessageLiked: (conversationId: string, messageId: string, liked: boolean) => {
        set(state => ({
          conversations: state.conversations.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.id === messageId ? { ...msg, liked } : msg
                ),
                updatedAt: new Date()
              }
            }
            return conv
          })
        }))
      },

      setCurrentConversation: (id: string) => {
        set({ currentConversationId: id })
      },

      deleteConversation: (id: string) => {
        set(state => {
          const filteredConversations = state.conversations.filter(conv => conv.id !== id)
          const newCurrentId = state.currentConversationId === id 
            ? (filteredConversations[0]?.id || null)
            : state.currentConversationId
          
          return {
            conversations: filteredConversations,
            currentConversationId: newCurrentId
          }
        })
      },

      updateConversationTitle: (id: string, title: string) => {
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === id ? { ...conv, title, updatedAt: new Date() } : conv
          )
        }))
      },

      getCurrentConversation: () => {
        const state = get()
        return state.conversations.find(conv => conv.id === state.currentConversationId) || null
      }
    }),
    {
      name: 'conversation-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId
      }),
      // 自定义序列化和反序列化来处理Date对象
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const data = JSON.parse(str)
          // 恢复Date对象
          if (data.state.conversations) {
            data.state.conversations = data.state.conversations.map((conv: any) => ({
              ...conv,
              createdAt: new Date(conv.createdAt),
              updatedAt: new Date(conv.updatedAt),
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }))
          }
          return data
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        }
      }
    }
  )
)
