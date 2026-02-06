

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations, type Language, type TranslationKey } from "./i18n";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: TranslationKey;
}

export const useLanguage = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: "zh",
      t: translations.zh,
      setLanguage: (language) =>
        set({
          language,
          t: translations[language] as TranslationKey
        }),
      toggleLanguage: () => {
        const newLang = get().language === "zh" ? "en" : "zh";
        set({
          language: newLang,
          t: translations[newLang] as TranslationKey
        });
      }
    }),
    {
      name: "language-storage"
    }
  )
);
