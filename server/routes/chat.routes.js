import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { query, pool } from "../db/pool.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";
import { getIO, isUserOnline } from "../utils/socket.js";
import { sendPushToUser } from "./push.routes.js";

const router = express.Router();

async function ensureChatTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      thread_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      last_read_message_id BIGINT UNSIGNED NULL,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_thread_user (thread_id, user_id),
      KEY idx_thread (thread_id),
      KEY idx_user (user_id),
      CONSTRAINT fk_cp_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      thread_id BIGINT UNSIGNED NOT NULL,
      sender_user_id BIGINT UNSIGNED NOT NULL,
      content TEXT NULL,
      content_type ENUM('text','image','video','document','contact') NOT NULL DEFAULT 'text',
      attachment_url VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_thread_time (thread_id, created_at),
      KEY idx_sender (sender_user_id),
      CONSTRAINT fk_cm_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../uploads/chat");
fs.mkdirSync(uploadsRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext).slice(0, 40);
    const ts = Date.now();
    cb(null, `${base}-${ts}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

router.get(
  "/users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureChatTables();
      const me =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      const { companyId } = req.scope;
      const users = await query(
        `SELECT id, username, full_name 
         FROM adm_users 
         WHERE is_active = 1 AND company_id = :companyId AND id <> :me
         ORDER BY username ASC`,
        { companyId, me },
      );
      const items = [];
      for (const u of users) {
        const online = isUserOnline(u.id);
        items.push({
          id: Number(u.id),
          username: u.username,
          full_name: u.full_name || u.username,
          online,
        });
      }
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/threads",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const me =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      const peer = Number(req.body?.peer_user_id || 0);
      if (!peer)
        throw httpError(400, "VALIDATION_ERROR", "peer_user_id required");
      const { companyId } = req.scope;
      await ensureChatTables();
      await conn.beginTransaction();
      const [existing] = await conn.execute(
        `
        SELECT t.id
        FROM chat_threads t
        JOIN chat_participants p1 ON p1.thread_id = t.id AND p1.user_id = :me
        JOIN chat_participants p2 ON p2.thread_id = t.id AND p2.user_id = :peer
        WHERE t.company_id = :companyId
        LIMIT 1
        `,
        { companyId, me, peer },
      );
      let threadId = Number(existing?.[0]?.id || 0);
      if (!threadId) {
        const [tIns] = await conn.execute(
          `INSERT INTO chat_threads (company_id) VALUES (:companyId)`,
          { companyId },
        );
        threadId = Number(tIns.insertId);
        await conn.execute(
          `INSERT INTO chat_participants (thread_id, user_id) VALUES (:threadId, :me), (:threadId, :peer)`,
          { threadId, me, peer },
        );
      }
      await conn.commit();
      res.status(201).json({ id: threadId });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/threads/:id/messages",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid thread id");
      await ensureChatTables();
      const afterId = Number(req.query.afterId || 0);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit || "50", 10)),
      );
      const rows = await query(
        `
        SELECT id, thread_id, sender_user_id, content, content_type, attachment_url, created_at
        FROM chat_messages
        WHERE thread_id = :id
          ${afterId ? "AND id > :afterId" : ""}
        ORDER BY id DESC
        LIMIT ${limit}
        `,
        afterId ? { id, afterId } : { id },
      );
      res.json({ items: rows.reverse() });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/messages",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  upload.single("file"),
  async (req, res, next) => {
    try {
      await ensureChatTables();
      const sender =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      const { thread_id, content, content_type } = req.body || {};
      const threadId = Number(thread_id || 0);
      if (!threadId)
        throw httpError(400, "VALIDATION_ERROR", "thread_id required");
      const type = String(content_type || "text").toLowerCase();
      let attachmentUrl = null;
      if (req.file) {
        const rel = `/uploads/chat/${req.file.filename}`;
        attachmentUrl = rel;
      }
      const [ins] = await query(
        `INSERT INTO chat_messages (thread_id, sender_user_id, content, content_type, attachment_url)
         VALUES (:threadId, :sender, :content, :type, :attachmentUrl)`,
        {
          threadId,
          sender,
          content: content || null,
          type,
          attachmentUrl,
        },
      );
      const id = ins.insertId;
      const message = {
        id,
        thread_id: threadId,
        sender_user_id: sender,
        content: content || null,
        content_type: type,
        attachment_url: attachmentUrl,
        created_at: new Date().toISOString(),
      };
      const participants = await query(
        `SELECT user_id FROM chat_participants WHERE thread_id = :threadId AND user_id <> :sender`,
        { threadId, sender },
      );
      const io = getIO();
      for (const p of participants) {
        const uid = Number(p.user_id);
        io.to(`user_${uid}`).emit("chat:message", message);
        if (!isUserOnline(uid)) {
          try {
            await sendPushToUser(uid, {
              title: "New message",
              message:
                type === "text"
                  ? String(content || "New message")
                  : `New ${type} message`,
              link: `/chat/${threadId}`,
              tag: "chat-message",
            });
          } catch {}
        }
      }
      res.status(201).json({ id, receipt: "sent" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/threads/:id/read",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const userId =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      const threadId = Number(req.params.id || 0);
      const lastId = Number(req.body?.last_message_id || 0);
      if (!threadId || !lastId)
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      await query(
        `UPDATE chat_participants SET last_read_message_id = :lastId WHERE thread_id = :threadId AND user_id = :userId`,
        { lastId, threadId, userId },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/unread-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const userId =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      const rows = await query(
        `
        SELECT p.thread_id, COUNT(m.id) AS unread
        FROM chat_participants p
        JOIN chat_messages m ON m.thread_id = p.thread_id
        WHERE p.user_id = :userId
          AND m.id > COALESCE(p.last_read_message_id, 0)
        GROUP BY p.thread_id
        `,
        { userId },
      );
      const total = rows.reduce((s, r) => s + Number(r.unread || 0), 0);
      res.json({ total, per_thread: rows });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
