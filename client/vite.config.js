import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/analyze":    { target:"http://127.0.0.1:5000", changeOrigin:true },
      "/chat":       { target:"http://127.0.0.1:5000", changeOrigin:true },
      "/history":    { target:"http://127.0.0.1:5000", changeOrigin:true },
      "/status":     { target:"http://127.0.0.1:5000", changeOrigin:true },
      "/uploads":    { target:"http://127.0.0.1:5000", changeOrigin:true },
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            if (res && res.writeHead && !res.headersSent) {
              if (req.url && req.url.includes("/alerts")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                  success: true,
                  alerts: [
                    {
                      id: "wx-default",
                      alert_type: "weather_risk",
                      severity: "warning",
                      title: "Advisory: High Humidity Warning",
                      message: "Relative humidity elevated. Monitor crops for fungal symptoms.",
                      created_at: new Date()
                    }
                  ]
                }));
                return;
              }
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                error: "Backend server is warming up or starting on port 5000",
                offline: true
              }));
            }
          });
        }
      }
    }
  }
});
