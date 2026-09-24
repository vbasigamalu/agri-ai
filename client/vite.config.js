import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/analyze":    { target:"http://localhost:5000", changeOrigin:true },
      "/chat":       { target:"http://localhost:5000", changeOrigin:true },
      "/history":    { target:"http://localhost:5000", changeOrigin:true },
      "/status":     { target:"http://localhost:5000", changeOrigin:true },
      "/api":        { target:"http://localhost:5000", changeOrigin:true },
      "/uploads":    { target:"http://localhost:5000", changeOrigin:true },
    }
  }
});
