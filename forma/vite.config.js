import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function formaImportEndpoint() {
  return {
    name: "forma-import-endpoint",
    configureServer(server) {
      server.middlewares.use("/api/import", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed. Use POST /api/import" }));
          return;
        }

        let body = "";
        req.setEncoding("utf8");

        req.on("data", (chunk) => {
          body += chunk;
          if (!res.writableEnded && body.length > 2 * 1024 * 1024) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Payload too large (max 2MB)" }));
            req.destroy();
          }
        });

        req.on("end", () => {
          if (res.writableEnded) return;
          try {
            const parsed = JSON.parse(body);
            server.ws.send("forma:import", parsed);
            res.statusCode = 202;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, message: "Import payload broadcast to connected clients" }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Invalid JSON: ${error.message}` }));
          }
        });

        req.on("error", () => {
          if (res.writableEnded) return;
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Failed to read request body" }));
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), formaImportEndpoint()],
})
