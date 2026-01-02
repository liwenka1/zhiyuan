import { create } from "zustand";
import { persist } from "zustand/middleware";

type Language = "zh" | "en";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: "zh",
      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set((state) => ({
          language: state.language === "zh" ? "en" : "zh"
        }))
    }),
    {
      name: "language-storage"
    }
  )
);
