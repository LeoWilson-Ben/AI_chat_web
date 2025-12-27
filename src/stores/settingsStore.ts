import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  presetPrompt: string
  setPresetPrompt: (prompt: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      presetPrompt: '',
      setPresetPrompt: (prompt: string) => set({ presetPrompt: prompt })
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({ presetPrompt: state.presetPrompt })
    }
  )
)