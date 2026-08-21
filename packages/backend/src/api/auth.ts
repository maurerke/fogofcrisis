import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { auditLog } from "../db/database";

// In-memory throttle for failed auth attempts per IP.
// Single-process deployment, so a Map is sufficient (no shared state needed).
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

interface FailEntry {
  count: number;
  windowStart: number;
}

const failedAttempts = new Map<string, FailEntry>();

function isThrottled(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
}

/** Constant-time comparison via SHA-256 digests (handles unequal lengths). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * API-key middleware for all admin endpoints.
 * - Timing-safe key comparison
 * - Per-IP throttling of failed attempts (10 / 15 min)
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (!config.adminApiKey) {
    // In development without key set, allow access with warning
    if (config.nodeEnv === "development") {
      next();
      return;
    }
    res.status(503).json({ error: "Admin API not configured" });
    return;
  }

  if (isThrottled(ip)) {
    res.status(429).json({ error: "Too many failed attempts. Try again later." });
    return;
  }

  const key = req.headers["x-api-key"];
  if (typeof key !== "string" || !safeEqual(key, config.adminApiKey)) {
    recordFailure(ip);
    console.warn(`[Admin] Unauthorized access attempt from ${ip} to ${req.method} ${req.path}`);
    auditLog(null, "admin_auth_failed", { ip, method: req.method, path: req.path });
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }

  next();
}
