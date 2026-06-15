/**
 * Drop-in replacement for `react-push-notification`'s addNotification.
 *
 * Supports the same call signature:
 *   addNotification({ title, message, native, icon, onClick })
 *
 * - When `native: true` and the browser has permission, fires a native
 *   browser Notification (with optional icon and click handler).
 * - Otherwise falls back to a react-toastify toast so the user still sees
 *   the message inside the app.
 */
import { toast } from "react-toastify";

export default function addNotification({
  title = "Notification",
  message = "",
  native = false,
  icon,
  onClick,
} = {}) {
  // ── Native browser notification ──────────────────────────────────────────
  if (
    native &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    window.Notification.permission === "granted"
  ) {
    try {
      const n = new window.Notification(title, {
        body: message,
        icon: icon ?? undefined,
      });
      if (typeof onClick === "function") {
        n.onclick = (e) => {
          e.preventDefault();
          window.focus();
          onClick(e);
          n.close();
        };
      }
      return;
    } catch {
      // fall through to toast on any error
    }
  }

  const content = title ? `${title}${message ? `\n${message}` : ""}` : message;
  toast.info(content, {
    autoClose: 5000,
    onClick: onClick ?? undefined,
    style: { cursor: onClick ? "pointer" : "default" },
  });
}
