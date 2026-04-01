import { fileURLToPath } from "node:url";
import nextConfig from "eslint-config-next/typescript";
import tailwindcss from "eslint-plugin-tailwindcss";

const tailwindEntryPath = fileURLToPath(new URL("./styles/globals.css", import.meta.url));

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      ".vercel/**",
      ".eslintcache",
      "*.tsbuildinfo",
      "next-env.d.ts"
    ]
  },
  ...tailwindcss.configs["flat/recommended"],
  ...nextConfig,
  {
    settings: {
      tailwindcss: {
        config: tailwindEntryPath
      }
    },
    rules: {
      // 类名顺序交给 prettier-plugin-tailwindcss，避免和 ESLint 自动修复冲突。
      "tailwindcss/classnames-order": "off",
      "react/no-unescaped-entities": "off"
    }
  }
];
