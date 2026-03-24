import js from "@eslint/js";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tailwindcss from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

// desktop 使用 Tailwind CSS v4，这里需配合 eslint-plugin-tailwindcss beta 版，
// 并显式指向 CSS 入口文件，否则插件无法正确解析设计令牌。
const tailwindEntryPath = fileURLToPath(new URL("./src/renderer/src/assets/main.css", import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "resources/**",
      ".eslintcache",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs"
    ]
  },
  ...tailwindcss.configs["flat/recommended"],
  {
    settings: {
      tailwindcss: {
        config: tailwindEntryPath
      }
    }
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        // Electron globals
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly"
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      // 类名顺序统一交给 prettier-plugin-tailwindcss，避免与 ESLint 自动修复结果冲突。
      "tailwindcss/classnames-order": "off",
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
);
