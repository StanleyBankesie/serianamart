import express from "express";
import { query } from "../db/pool.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";
import { io as ioInstance } from "../index.js";
import { sendPushToUser } from "./push.routes.js";

const router = express.Router();

async function ensureChatTables() {
  // Phase 1: Clean rebuild if legacy schema detected
  try {
    const legacyCol = await query(
      `
      SELECT COUNT(*) AS c
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'chat_messages'
        AND column_name = 'sender_user_id'
      `,
    ).catch(() => []);
    const isLegacy =
      Array.isArray(legacyCol) && Number(legacyCol[0]?.c || 0) > 0;
    if (isLegacy) {
      try {
        await query("DROP TABLE IF EXISTS chat_message_status");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_deleted_messages");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_attachments");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_participants");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_messages");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_conversations");
      } catch {}
    }
  } catch {}
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversation_participants (
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      last_read_message_id BIGINT UNSIGNED NULL,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      KEY idx_user (user_id),
      CONSTRAINT fk_ccp_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      sender_id BIGINT UNSIGNED NOT NULL,
      message_type ENUM('text','image','video','audio','file') NOT NULL DEFAULT 'text',
      content LONGTEXT NULL,
      status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_conv (conversation_id),
      KEY idx_conv_sent (conversation_id, sent_at),
      CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
}

function inRoom(io, room) {
  try {
    const s = io?.sockets?.adapter?.rooms?.get?.(room);
    return (s && s.size > 0) || false;
  } catch {
    return false;
  }
}

router.use(requireAuth, requireCompanyScope, requireBranchScope);

// List conversations for current user
router.get("/conversations", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const companyId = req.scope.companyId;
    const rows = await query(
      `
      SELECT c.id,
             c.title,
             (SELECT m.content FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_preview,
             (SELECT m.sent_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_time,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.id > COALESCE(p.last_read_message_id,0)) AS unread_count
      FROM chat_conversations c
      JOIN chat_conversation_participants p
        ON p.conversation_id = c.id AND p.user_id = :me
      WHERE c.company_id = :companyId
      ORDER BY last_time DESC NULLS LAST, c.id DESC
      `,
      { me, companyId },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

// Create a direct conversation (me + other)
router.post("/conversations/direct", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const companyId = req.scope.companyId;
    const otherId = Number(req.body?.user_id);
    if (!Number.isFinite(otherId) || otherId <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid user_id");
    // Reuse existing direct conversation if exists
    const existing = await query(
      `
      SELECT c.id
      FROM chat_conversations c
      JOIN chat_conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = :me
      JOIN chat_conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = :otherId
      WHERE c.company_id = :companyId
      LIMIT 1
      `,
      { companyId, me, otherId },
    );
    if (existing.length) return res.json({ id: existing[0].id });
    const ins = await query(
      `
      INSERT INTO chat_conversations (company_id, title, created_by)
      VALUES (:companyId, NULL, :me)
      `,
      { companyId, me },
    );
    const cid = ins.insertId;
    await query(
      `INSERT INTO chat_conversation_participants (conversation_id, user_id) VALUES (:cid, :me), (:cid, :other)`,
      { cid, me, other: otherId },
    );
    res.status(201).json({ id: cid });
  } catch (err) {
    next(err);
  }
});

// List messages in a conversation
router.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const isParticipant = await query(
      `SELECT 1 FROM chat_conversation_participants WHERE conversation_id = :id AND user_id = :me LIMIT 1`,
      { id, me },
    );
    if (!isParticipant.length)
      throw httpError(403, "FORBIDDEN", "Not a participant");
    const rows = await query(
      `
      SELECT m.*
      FROM chat_messages m
      WHERE m.conversation_id = :id
      ORDER BY m.id ASC
      `,
      { id },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

// Send a text message
router.post("/messages", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const { conversation_id, content } = req.body || {};
    const cid = Number(conversation_id);
    if (!Number.isFinite(cid) || !String(content || "").trim()) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "conversation_id and content required",
      );
    }
    const auth = await query(
      `SELECT 1 FROM chat_conversation_participants WHERE conversation_id = :cid AND user_id = :me LIMIT 1`,
      { cid, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    const ins = await query(
      `
      INSERT INTO chat_messages (conversation_id, sender_id, message_type, content, status, sent_at)
      VALUES (:cid, :me, 'text', :content, 'sent', NOW())
      `,
      { cid, me, content: String(content).trim() },
    );
    const mid = ins.insertId;
    const io = ioInstance;
    if (io) {
      io.to(`conv_${cid}`).emit("receive_message", {
        id: mid,
        conversation_id: cid,
        sender_id: me,
        message_type: "text",
        content: String(content || ""),
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }
    // Resolve participants (excluding sender)
    const participants = await query(
      `SELECT user_id FROM chat_conversation_participants WHERE conversation_id = :cid AND user_id <> :me`,
      { cid, me },
    );
    const others = participants
      .map((r) => Number(r.user_id))
      .filter((n) => Number.isFinite(n));
    // If receiver not in room, set delivered later when they connect and send push
    const anyInRoom = io ? io.sockets.adapter.rooms.get(`conv_${cid}`) : null;
    const hasViewers = !!(anyInRoom && anyInRoom.size);
    if (!hasViewers) {
      // Trigger existing push + notification row
      const senderNameRows = await query(
        `SELECT full_name AS name, username FROM adm_users WHERE id = :id LIMIT 1`,
        { id: me },
      ).catch(() => []);
      const title =
        senderNameRows?.[0]?.name ||
        senderNameRows?.[0]?.username ||
        "New message";
      const preview = String(content || "").slice(0, 140);
      for (const uid of others) {
        try {
          await query(
            `
            INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
            VALUES (:companyId, :userId, :title, :message, :link, 0)
            `,
            {
              companyId: req.scope.companyId,
              userId: uid,
              title: `${title}`,
              message: preview,
              link: `/chat?cid=${cid}`,
            },
          ).catch(() => null);
          await sendPushToUser(uid, {
            title: `${title}`,
            body: preview || "New message",
            icon: "/logo.png",
            badge: "/badge.png",
            tag: "chat-message",
            data: { url: `/chat?cid=${cid}`, type: "chat", cid },
          });
        } catch {}
      }
    }
    res.status(201).json({ id: mid });
  } catch (err) {
    next(err);
  }
});

// Mark delivered (server can call when receiver socket acknowledges)
router.post("/messages/:id/delivered", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR");
    await query(
      `UPDATE chat_messages SET status = 'delivered', delivered_at = NOW() WHERE id = :id AND status = 'sent'`,
      { id },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark read for a conversation
router.post("/conversations/:id/read", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR");
    // Find last message id in conversation
    const rows = await query(
      `SELECT id FROM chat_messages WHERE conversation_id = :id ORDER BY id DESC LIMIT 1`,
      { id },
    );
    const lastId = Number(rows?.[0]?.id || 0) || null;
    if (lastId) {
      await query(
        `UPDATE chat_conversation_participants SET last_read_message_id = :lastId WHERE conversation_id = :id AND user_id = :me`,
        { lastId, id, me },
      );
      await query(
        `UPDATE chat_messages SET status = 'read', read_at = NOW() WHERE conversation_id = :id AND id <= :lastId`,
        { id, lastId },
      );
      const io = ioInstance;
      if (io)
        io.to(`conv_${id}`).emit("message_read", {
          conversation_id: id,
          user_id: me,
          last_read_id: lastId,
        });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Unread count
router.get("/unread-count", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const rows = await query(
      `
      SELECT SUM(unread) AS total
      FROM (
        SELECT COUNT(*) AS unread
        FROM chat_conversations c
        JOIN chat_conversation_participants p
          ON p.conversation_id = c.id AND p.user_id = :me
        JOIN chat_messages m
          ON m.conversation_id = c.id
        WHERE m.id > COALESCE(p.last_read_message_id, 0)
      ) t
      `,
      { me },
    );
    res.json({ unread: Number(rows?.[0]?.total || 0) });
  } catch (err) {
    next(err);
  }
});

export default router;
