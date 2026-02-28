import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";
import { sendPushToUser } from "./push.routes.js";

const router = express.Router();

const uploadsRoot = path.join(process.cwd(), "uploads", "chatv2");
fs.mkdirSync(uploadsRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dir = path.join(uploadsRoot, `${yy}/${mm}/${dd}`);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const ext = path.extname(file.originalname || "");
    cb(null, `${stamp}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function ensureChatTables() {
  // Assume migration script created tables; minimal guard to avoid crashes
  await query(
    `CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_by BIGINT UNSIGNED NOT NULL,
      is_group TINYINT(1) NOT NULL DEFAULT 0,
      title VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_participants (
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner','member') NOT NULL DEFAULT 'member',
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      sender_user_id BIGINT UNSIGNED NOT NULL,
      content_type ENUM('text','image','video','document','contact') NOT NULL DEFAULT 'text',
      content TEXT NULL,
      reply_to BIGINT UNSIGNED NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      edited_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_conv_time (conversation_id, created_at)
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_message_status (
      message_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      message_id BIGINT UNSIGNED NOT NULL,
      file_path VARCHAR(1024) NOT NULL,
      mime_type VARCHAR(255) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      thumbnail_path VARCHAR(1024) NULL,
      PRIMARY KEY (id),
      KEY idx_msg (message_id)
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_presence (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      is_online TINYINT(1) NOT NULL DEFAULT 0,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS chat_deleted_messages (
      message_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    ) ENGINE=InnoDB`,
  );
}

function basePathFrom(p) {
  const raw = String(p || "").trim() || "/";
  const parts = raw.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last === "new" || last === "create") {
      return `/${parts.slice(0, parts.length - 1).join("/")}`;
    }
    if (/^[0-9]+$/.test(last) || /^[0-9a-fA-F-]{8,}$/.test(last)) {
      return `/${parts.slice(0, parts.length - 1).join("/")}`;
    }
    return `/${parts.slice(0, 2).join("/")}`;
  }
  if (parts.length === 1) return `/${parts[0]}`;
  return "/";
}

router.use(requireAuth);
router.use(async (req, res, next) => {
  try {
    await ensureChatTables();
  } catch {}
  next();
});

// Search users by username (exclude self) with presence
router.get("/users", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const q = String(req.query?.search || "").trim();
    const like = q ? `%${q}%` : "%%";
    const rows = await query(
      `SELECT u.id, u.username, u.full_name,
              COALESCE(p.is_online, 0) AS is_online,
              p.last_seen
       FROM adm_users u
       LEFT JOIN chat_presence p ON p.user_id = u.id
       WHERE u.is_active = 1 AND u.id <> :me
         AND (u.username LIKE :like OR u.full_name LIKE :like)
       ORDER BY u.username ASC
       LIMIT 50`,
      { me, like },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/conversations", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const rows = await query(
      `SELECT c.id, c.title, c.is_group,
              MAX(m.created_at) AS last_time,
              SUM(CASE WHEN s.user_id = :me AND s.status != 'read' THEN 1 ELSE 0 END) AS unread_count,
              (SELECT cm.content
                 FROM chat_messages cm
                 WHERE cm.conversation_id = c.id
                 ORDER BY cm.id DESC LIMIT 1) AS last_preview
       FROM chat_conversations c
       JOIN chat_participants p ON p.conversation_id = c.id AND p.user_id = :me
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
       LEFT JOIN chat_message_status s ON s.message_id = m.id AND s.user_id = :me
       GROUP BY c.id
       ORDER BY last_time DESC`,
      { me },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

router.post("/conversations", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const { user_ids, title } = req.body || {};
    const ids = Array.isArray(user_ids) ? user_ids.map((n) => Number(n)) : [];
    if (!ids.length) throw httpError(400, "BAD_REQUEST", "user_ids required");
    const cRes = await query(
      `INSERT INTO chat_conversations (created_by, is_group, title)
       VALUES (:me, :group, :title)`,
      { me, group: ids.length > 1 ? 1 : 0, title: title || null },
    );
    const convId = cRes.insertId;
    const values = [me, ...ids].map((uid) => `(${convId}, ${uid}, 'member')`);
    await query(
      `INSERT IGNORE INTO chat_participants (conversation_id, user_id, role)
       VALUES ${values.join(",")}`,
    );
    res.status(201).json({ id: convId });
  } catch (err) {
    next(err);
  }
});

router.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const beforeId = Number(req.query?.beforeId || 0) || null;
    const search = String(req.query?.search || "").trim();
    const limit = Math.min(Number(req.query?.limit || 20), 100);
    const auth = await query(
      `SELECT 1 FROM chat_participants WHERE conversation_id = :id AND user_id = :me LIMIT 1`,
      { id, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    const rows = await query(
      `SELECT m.*,
              sm.status AS my_status,
              so.status AS other_status,
              COALESCE(JSON_ARRAYAGG(
                CASE WHEN ca.id IS NOT NULL THEN
                  JSON_OBJECT(
                    'id', ca.id,
                    'file_path', ca.file_path,
                    'mime_type', ca.mime_type,
                    'file_size', ca.file_size,
                    'thumbnail_path', ca.thumbnail_path
                  )
                ELSE NULL END
              ), JSON_ARRAY()) AS attachments
       FROM chat_messages m
       LEFT JOIN chat_message_status sm
         ON sm.message_id = m.id AND sm.user_id = :me
       LEFT JOIN chat_participants op
         ON op.conversation_id = m.conversation_id AND op.user_id <> :me
       LEFT JOIN chat_message_status so
         ON so.message_id = m.id AND so.user_id = op.user_id
       LEFT JOIN chat_attachments ca
         ON ca.message_id = m.id
       WHERE m.conversation_id = :id
         ${beforeId ? "AND m.id < :beforeId" : ""}
         ${search ? "AND m.content LIKE :term" : ""}
         AND NOT EXISTS (
            SELECT 1 FROM chat_deleted_messages d
            WHERE d.message_id = m.id AND d.user_id = :me
         )
       GROUP BY m.id
       ORDER BY m.id DESC
       LIMIT :limit`,
      { id, beforeId, limit, term: `%${search}%` },
    );
    // Mark any messages for me that are currently 'sent' as 'delivered'
    try {
      const ids = (rows || [])
        .filter((r) => String(r.my_status || "sent") === "sent")
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n));
      if (ids.length) {
        await query(
          `UPDATE chat_message_status
           SET status = 'delivered', updated_at = NOW()
           WHERE user_id = :me AND message_id IN (${ids.join(",")})`,
          { me },
        );
      }
    } catch {}
    res.json({ items: rows.reverse() });
  } catch (err) {
    next(err);
  }
});

// Mark all messages as read in a conversation for current user
router.post("/conversations/:id/read", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const auth = await query(
      `SELECT 1 FROM chat_participants WHERE conversation_id = :id AND user_id = :me LIMIT 1`,
      { id, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    await query(
      `UPDATE chat_message_status s
       JOIN chat_messages m ON m.id = s.message_id
       SET s.status = 'read', s.updated_at = NOW()
       WHERE s.user_id = :me AND m.conversation_id = :id`,
      { me, id },
    );
    try {
      const { io } = await import("../index.js");
      if (io)
        io.to(`chat2_${id}`).emit("chat2:read", {
          conversation_id: id,
          user_id: me,
        });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Star / unstar a message for current user
router.post("/messages/:id/star", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const { star } = req.body || {};
    await query(
      `CREATE TABLE IF NOT EXISTS chat_starred_messages (
        message_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (message_id, user_id)
      ) ENGINE=InnoDB`,
    );
    if (star) {
      await query(
        `INSERT IGNORE INTO chat_starred_messages (message_id, user_id) VALUES (:id, :me)`,
        { id, me },
      );
    } else {
      await query(
        `DELETE FROM chat_starred_messages WHERE message_id = :id AND user_id = :me`,
        { id, me },
      );
    }
    try {
      const { io } = await import("../index.js");
      if (io)
        io.to(`chat2_${id}`).emit("chat2:star", {
          message_id: id,
          user_id: me,
          star: !!star,
        });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Edit a message (sender only, time-limited)
router.post("/messages/:id/edit", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const { content } = req.body || {};
    const rows = await query(
      `SELECT sender_user_id, created_at, conversation_id FROM chat_messages WHERE id = :id LIMIT 1`,
      { id },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Missing message");
    const msg = rows[0];
    if (Number(msg.sender_user_id) !== me)
      throw httpError(403, "FORBIDDEN", "Not sender");
    const diff = await query(
      `SELECT TIMESTAMPDIFF(MINUTE, :created, NOW()) AS mins`,
      { created: msg.created_at },
    );
    const mins = Number(diff?.[0]?.mins || 0);
    if (mins > 10) throw httpError(400, "TIME_LIMIT", "Edit window elapsed");
    await query(
      `UPDATE chat_messages SET content = :content, edited_at = NOW() WHERE id = :id`,
      { content, id },
    );
    try {
      const { io } = await import("../index.js");
      if (io)
        io.to(`chat2_${msg.conversation_id}`).emit("chat2:edit", {
          message_id: id,
        });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete a message (me or everyone)
router.post("/messages/:id/delete", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const { scope } = req.body || {};
    const rows = await query(
      `SELECT sender_user_id, conversation_id, created_at FROM chat_messages WHERE id = :id LIMIT 1`,
      { id },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Missing message");
    const msg = rows[0];
    if (scope === "everyone") {
      if (Number(msg.sender_user_id) !== me)
        throw httpError(403, "FORBIDDEN", "Not sender");
      const diff = await query(
        `SELECT TIMESTAMPDIFF(MINUTE, :created, NOW()) AS mins`,
        { created: msg.created_at },
      );
      const mins = Number(diff?.[0]?.mins || 0);
      if (mins > 10)
        throw httpError(400, "TIME_LIMIT", "Delete window elapsed");
      await query(`UPDATE chat_messages SET is_deleted = 1 WHERE id = :id`, {
        id,
      });
      try {
        const { io } = await import("../index.js");
        if (io)
          io.to(`chat2_${msg.conversation_id}`).emit("chat2:delete", {
            message_id: id,
            scope: "everyone",
          });
      } catch {}
    } else {
      await query(
        `INSERT IGNORE INTO chat_deleted_messages (message_id, user_id) VALUES (:id, :me)`,
        { id, me },
      );
      try {
        const { io } = await import("../index.js");
        if (io)
          io.to(`chat2_${msg.conversation_id}`).emit("chat2:delete", {
            message_id: id,
            scope: "me",
            user_id: me,
          });
      } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/messages", upload.array("files", 5), async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const { conversation_id, content_type, content, reply_to } = req.body || {};
    const convId = Number(conversation_id);
    const auth = await query(
      `SELECT 1 FROM chat_participants WHERE conversation_id = :id AND user_id = :me LIMIT 1`,
      { id: convId, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    const ct = String(content_type || "text");
    const ins = await query(
      `INSERT INTO chat_messages (conversation_id, sender_user_id, content_type, content, reply_to)
         VALUES (:cid, :me, :ct, :content, :reply)`,
      {
        cid: convId,
        me,
        ct,
        content: content || null,
        reply: reply_to || null,
      },
    );
    const msgId = ins.insertId;
    const files = Array.isArray(req.files) ? req.files : [];
    for (const f of files) {
      await query(
        `INSERT INTO chat_attachments (message_id, file_path, mime_type, file_size)
           VALUES (:mid, :fp, :mt, :sz)`,
        {
          mid: msgId,
          fp: path.relative(process.cwd(), f.path).replace(/\\/g, "/"),
          mt: f.mimetype || "application/octet-stream",
          sz: Number(f.size || 0),
        },
      );
    }
    // Insert message status for participants and emit notifications
    try {
      // statuses
      const participants = await query(
        `SELECT user_id FROM chat_participants WHERE conversation_id = :cid`,
        { cid: convId },
      );
      for (const p of participants || []) {
        const uid = Number(p.user_id);
        if (!Number.isFinite(uid)) continue;
        const st = uid === me ? "read" : "sent";
        await query(
          `INSERT INTO chat_message_status (message_id, user_id, status)
           VALUES (:mid, :uid, :st)
           ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
          { mid: msgId, uid, st },
        );
      }
      // socket emissions
      const { io } = await import("../index.js");
      if (io) {
        io.to(`chat2_${convId}`).emit("chat2:message", {
          message_id: msgId,
          conversation_id: convId,
        });
        for (const p of participants || []) {
          const uid = Number(p.user_id);
          if (!Number.isFinite(uid) || uid === me) continue;
          io.to(`user_${uid}`).emit("chat2:notify", {
            message_id: msgId,
            conversation_id: convId,
          });
        }
      }
      // push notifications (best-effort)
      for (const p of participants || []) {
        const uid = Number(p.user_id);
        if (!Number.isFinite(uid) || uid === me) continue;
        try {
          await sendPushToUser(
            uid,
            "New message",
            String(content || "New message"),
            {
              link: "/",
              tag: "chat2",
              icon: "/OMNISUITE_ICON_CLEAR.png",
            },
          );
        } catch {}
      }
    } catch {}
    res.status(201).json({ id: msgId });
  } catch (err) {
    next(err);
  }
});

router.post("/messages/:id/status", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const msg = await query(
      `SELECT conversation_id FROM chat_messages WHERE id = :id LIMIT 1`,
      { id },
    );
    if (!msg.length) throw httpError(404, "NOT_FOUND", "Message missing");
    const auth = await query(
      `SELECT 1 FROM chat_participants WHERE conversation_id = :cid AND user_id = :me LIMIT 1`,
      { cid: msg[0].conversation_id, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    await query(
      `INSERT INTO chat_message_status (message_id, user_id, status)
       VALUES (:id, :me, :st)
       ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
      { id, me, st: status },
    );
    try {
      const { io } = await import("../index.js");
      if (io)
        io.to(`chat2_${msg[0].conversation_id}`).emit("chat2:status", {
          message_id: id,
          user_id: me,
          status,
        });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    try {
      const rows = await query(
        `SELECT COUNT(*) AS unread FROM chat_message_status s
         JOIN chat_messages m ON m.id = s.message_id
         WHERE s.user_id = :me AND s.status != 'read'`,
        { me },
      );
      res.json({ unread: Number(rows?.[0]?.unread || 0) });
    } catch (e) {
      // Safe fallback when tables aren't available yet
      res.json({ unread: 0 });
    }
  } catch (err) {
    res.json({ unread: 0 });
  }
});

export default router;
