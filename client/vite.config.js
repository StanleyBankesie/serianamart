import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    sourcemap: false,
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ui: ["antd", "@ant-design/icons", "lucide-react", "react-toastify"],
          state: ["@reduxjs/toolkit", "react-redux"],
          docs: ["jspdf", "jspdf-autotable", "html2canvas", "xlsx"],
          flows: ["reactflow", "dagre"],
          socket: ["socket.io-client"],
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
