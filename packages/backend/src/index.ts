import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { config, validateConfig } from "./config/env";

validateConfig();
import { initDatabase, getDb } from "./db/database";
import { loadScenario } from "./engine/scenarioLoader";
import type { Scenario } from "@cyber-crisis/shared";
import { setupGameSocket } from "./socket/gameSocket";
import adminRoutes from "./api/adminRoutes";
import exportRoutes, { setScenarioForExport } from "./api/exportRoutes";
import dashboardRoutes, { setScenarioForDashboard } from "./api/dashboardRoutes";
import consentPdfRoutes from "./api/consentPdfRoutes";

const app = express();

// Behind Caddy reverse proxy in production: trust the first proxy hop so
// req.ip reflects the real client IP (X-Forwarded-For) for per-IP rate limits.
if (config.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

const httpServer = createServer(app);

// CORS — dev list covers the Vite dev server (port 5175, see vite.config.ts)
// plus common fallback ports Vite picks when the default is taken.
const corsOrigins = config.nodeEnv === "development"
  ? ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3001"]
  : [config.frontendOrigin];

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "50kb" }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// socket.io
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize database
initDatabase();

// Load scenario
let scenario: Scenario;
try {
  scenario = loadScenario(config.scenarioPath);
  setScenarioForExport(scenario);
  setScenarioForDashboard(scenario);
} catch (err) {
  console.error(`\n[FATAL] Failed to load scenario from ${config.scenarioPath}:`);
  console.error(err instanceof Error ? err.message : err);
  console.error("\nPlease check the scenario JSON file for syntax errors or missing fields.");
  process.exit(1);
}

// API routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin", exportRoutes);
app.use("/api/admin", dashboardRoutes);
app.use("/api", consentPdfRoutes);

// Health check — includes a live DB probe
app.get("/api/health", (_req, res) => {
  try {
    getDb().prepare("SELECT 1").get();
    res.json({
      status: "ok",
      scenario: scenario.title,
      version: scenario.version,
      uptime: process.uptime(),
      db: "ok",
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      scenario: scenario.title,
      version: scenario.version,
      uptime: process.uptime(),
      db: "error",
      dbError: err instanceof Error ? err.message : String(err),
    });
  }
});

// Serve static frontend in production
if (config.nodeEnv === "production") {
  const frontendPath = process.env.FRONTEND_STATIC_PATH
    ? path.resolve(process.env.FRONTEND_STATIC_PATH)
    : path.resolve(__dirname, "../frontend-static");
  app.use(express.static(frontendPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// WebSocket handler
setupGameSocket(io, scenario);

// Start server
httpServer.listen(config.port, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║      Fog of Crisis Server v1.0.0         ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  Port:     ${config.port}                          ║`);
  console.log(`║  Scenario: ${scenario.title.substring(0, 28).padEnd(28)} ║`);
  console.log(`║  Env:      ${config.nodeEnv.padEnd(28)} ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});

// Graceful shutdown — gives active DB writes and socket closes time to finish
function shutdown(signal: string): void {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  httpServer.close((err) => {
    if (err) {
      console.error("[Server] Error during shutdown:", err);
      process.exit(1);
    }
    console.log("[Server] HTTP server closed. Goodbye.");
    process.exit(0);
  });

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    console.error("[Server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[Server] UNCAUGHT EXCEPTION:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[Server] UNHANDLED REJECTION:", reason);
});
