import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared")
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: "es" // 输出 ESM 格式
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared")
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: "cjs", // CommonJS 格式
          entryFileNames: "[name].cjs" // 输出 .cjs 文件
        }
      }
    }
  },
  renderer: {
    build: {
      // Keep fonts as separate files so they can load under the renderer's CSP.
      assetsInlineLimit: (filePath) => (/\.(woff2?|ttf)$/i.test(filePath) ? false : undefined)
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
        "@": resolve(__dirname, "src/renderer/src"),
        "@shared": resolve(__dirname, "src/shared")
      }
    },
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler", {}]]
        }
      }),
      tailwindcss()
    ]
  }
});
