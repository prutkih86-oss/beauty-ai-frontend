import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    allowedHosts: [
      "fool-creatable-ignition.ngrok-free.dev",
      "beautyaiservice.polandcentral.cloudapp.azure.com",
    ],

    proxy: {
      "/api": {
        target: "https://beautyaiservice.polandcentral.cloudapp.azure.com",
        changeOrigin: true,

        // Бекенд поки на самопідписаному/недовіреному сертифікаті —
        // вимикаємо перевірку тільки для локального dev proxy.
        secure: false,
      },

      "/ai-chat": {
        target: "http://beautyaiservice.polandcentral.cloudapp.azure.com:8001",
        changeOrigin: true,

        // /ai-chat/chat -> /chat
        rewrite: (path) => path.replace(/^\/ai-chat/, ""),
      },
    },
  },
});