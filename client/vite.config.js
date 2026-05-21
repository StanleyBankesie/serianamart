import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    sourcemap: false,
    target: "esnext",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-antd": ["antd"],
          "vendor-icons": ["@ant-design/icons", "lucide-react"],
          "vendor-ui": ["react-toastify"],
          "vendor-state": ["@reduxjs/toolkit", "react-redux"],
          "vendor-pdf": ["jspdf", "jspdf-autotable", "html2canvas"],
          "vendor-excel": ["xlsx"],
          "vendor-flows": ["reactflow", "dagre"],
          "vendor-socket": ["socket.io-client"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4002",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      "/uploads": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4002",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4002",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      api: path.resolve(__dirname, "src/api"),
    },
  },
});
