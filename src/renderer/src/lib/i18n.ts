import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// 导入翻译文件
import zhCommon from "@/locales/zh/common.json";
import zhSidebar from "@/locales/zh/sidebar.json";
import zhNote from "@/locales/zh/note.json";
import zhEditor from "@/locales/zh/editor.json";
import zhUI from "@/locales/zh/ui.json";

import enCommon from "@/locales/en/common.json";
import enSidebar from "@/locales/en/sidebar.json";
import enNote from "@/locales/en/note.json";
import enEditor from "@/locales/en/editor.json";
import enUI from "@/locales/en/ui.json";

// 初始化 i18next
i18n.use(initReactI18next).init({
  resources: {
    zh: {
      common: zhCommon,
      sidebar: zhSidebar,
      note: zhNote,
      editor: zhEditor,
      ui: zhUI
    },
    en: {
      common: enCommon,
      sidebar: enSidebar,
      note: enNote,
      editor: enEditor,
      ui: enUI
    }
  },
  lng: "zh", // 默认语言
  fallbackLng: "zh", // 回退语言
  ns: ["common", "sidebar", "note", "editor", "ui"], // 命名空间
  defaultNS: "common", // 默认命名空间
  interpolation: {
    escapeValue: false // React 已经做了转义
  }
});

export default i18n;
