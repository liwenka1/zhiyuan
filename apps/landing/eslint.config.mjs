import nextConfig from "eslint-config-next/typescript";

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
  ...nextConfig,
  {
    rules: {
      // 自定义规则
      "react/no-unescaped-entities": "off"
    }
  }
];
