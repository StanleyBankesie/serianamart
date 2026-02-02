import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "/src/assets/resources/OMNISUITE_WHITE_LOGO.png",
        "/src/assets/resources/OMNISUITE_ICON_CLEAR.png",
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000,
      },
      manifest: {
        name: "OmniSuite ERP",
        short_name: "OmniSuite",
        description: "Enterprise Resource Planning system",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0E3646",
        theme_color: "#0E3646",
        icons: [
          {
            src: "/src/assets/resources/OMNISUITE_WHITE_LOGO.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/src/assets/resources/OMNISUITE_WHITE_LOGO.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/src/assets/resources/OMNISUITE_WHITE_LOGO.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4002",
        changeOrigin: true,
        secure: false,
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
