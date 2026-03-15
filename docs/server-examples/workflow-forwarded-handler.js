const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const webpush = require("web-push");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 25000,
  pingTimeout: 60000,
});

webpush.setVapidDetails(
  "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function getUserById(id) {
  return { id, email: "approver@example.com" };
}

async function getPushSubscriptionsForUser(userId) {
  return [];
}

async function createWorkflowNotification(payload) {
  return;
}

io.on("connection", (socket) => {
  socket.on("workflow:forwarded", async (payload) => {
    try {
      const targetId = Number(payload?.target_user_id || 0);
      if (!targetId) return;
      await createWorkflowNotification({
        user_id: targetId,
        title: payload?.title || "Document forwarded",
        message:
          `${payload?.docType || "Document"} #${payload?.docId || ""} forwarded`,
        link: payload?.url || "/notifications",
        meta: payload,
      });
      const subs = await getPushSubscriptionsForUser(targetId);
      const pushPayload = JSON.stringify({
        title: payload?.title || "Approval Required",
        message:
          `${payload?.docType || "Document"} #${payload?.docId || ""} requires approval`,
        url: payload?.url || "/notifications",
        type: "workflow_push",
      });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, pushPayload);
        } catch {}
      }
      const approver = await getUserById(targetId);
      if (approver?.email) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "no-reply@example.com",
            to: approver.email,
            subject: payload?.title || "Approval Required",
            text:
              `${payload?.docType || "Document"} #${payload?.docId || ""} requires your approval. ` +
              `Open: ${process.env.APP_ORIGIN}${payload?.url || "/notifications"}`,
          });
        } catch {}
      }
      io.to(String(targetId)).emit("notifications:new", {
        title: payload?.title || "Approval Required",
        message:
          `${payload?.docType || "Document"} #${payload?.docId || ""} requires approval`,
        link: payload?.url || "/notifications",
      });
    } catch {}
  });
  socket.on("auth:identify", (u) => {
    try {
      const id = String(u?.id || "");
      if (id) socket.join(id);
    } catch {}
  });
});

const port = Number(process.env.PORT || 8081);
server.listen(port);
