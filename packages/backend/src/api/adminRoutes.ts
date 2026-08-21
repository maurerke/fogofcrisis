import { Router, Request, Response } from "express";
import {
  getAllSessions,
  getSessionDetail,
  deleteSession,
  getStats,
  flagSession,
  getAuditLog,
} from "../db/database";
import { requireApiKey } from "./auth";

const router = Router();

router.use(requireApiKey);

// GET /api/admin/sessions
router.get("/sessions", (_req: Request, res: Response) => {
  const sessions = getAllSessions();
  res.json({ sessions });
});

// GET /api/admin/sessions/:id
router.get("/sessions/:id", (req: Request, res: Response) => {
  const detail = getSessionDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(detail);
});

// GET /api/admin/stats
router.get("/stats", (_req: Request, res: Response) => {
  const stats = getStats();
  res.json(stats);
});

// DELETE /api/admin/sessions/:id
router.delete("/sessions/:id", (req: Request, res: Response) => {
  const deleted = deleteSession(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ success: true });
});

// GET /api/admin/sessions/:id/audit
router.get("/sessions/:id/audit", (req: Request, res: Response) => {
  const log = getAuditLog(req.params.id);
  res.json({ sessionId: req.params.id, events: log });
});

// POST /api/admin/sessions/:id/flag
router.post("/sessions/:id/flag", (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || !reason.trim()) {
    res.status(400).json({ error: "reason is required" });
    return;
  }
  const trimmedReason = reason.trim().substring(0, 500);
  flagSession(req.params.id, trimmedReason);
  res.json({ success: true, sessionId: req.params.id, reason: trimmedReason });
});

export default router;
