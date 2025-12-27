import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { presetPrompt, setPresetPrompt } = useSettingsStore()
  const [localPrompt, setLocalPrompt] = useState(presetPrompt)

  useEffect(() => {
    setLocalPrompt(presetPrompt)
  }, [presetPrompt])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-800">设置</h3>
          <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">预设提示词</label>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="在这里输入系统提示词，如角色、风格、格式等"
              className="w-full min-h-[120px] px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <p className="mt-2 text-xs text-gray-500">该提示词将作为系统消息加入到每次对话的开头</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg" onClick={onClose}>取消</button>
          <button
            className="px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            onClick={() => { setPresetPrompt(localPrompt.trim()); onClose() }}
          >保存</button>
        </div>
      </div>
    </div>
  )
}