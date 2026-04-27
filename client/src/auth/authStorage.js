export const AUTH_STORAGE_KEY = "omnisuite.auth";
export const LAST_ACTIVITY_KEY = "omnisuite.lastActivity";
export const REMEMBERED_CREDS_KEY = "omnisuite.rememberedCreds";
export const REMEMBER_ME_PREF_KEY = "omnisuite.rememberMe";
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const AUTH_EVENT_NAME = "omnisuite:auth-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function dispatchAuthChanged(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail }));
}

export function getAuthChangedEventName() {
  return AUTH_EVENT_NAME;
}

export function readStoredAuth() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredAuth(value) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value || null));
    dispatchAuthChanged(value || null);
  } catch {}
}

export function clearStoredAuth() {
  if (!canUseStorage()) return;
  try {
    const hadValue = localStorage.getItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (hadValue !== null) {
      dispatchAuthChanged(null);
    }
  } catch {}
}

export function getStoredToken() {
  return readStoredAuth()?.token || null;
}

export function touchLastActivity(timestamp = Date.now()) {
  if (!canUseStorage()) return timestamp;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
  } catch {}
  return timestamp;
}

export function getLastActivity() {
  if (!canUseStorage()) return 0;
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const value = Number(raw || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function clearLastActivity() {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {}
}

export function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(
            atob(base64)
              .split("")
              .map(
                (char) =>
                  `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`,
              )
              .join(""),
          )
        : null;
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewSeconds = 30) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return false;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}

/* ── Remembered credentials helpers ─────────────────────────── */

function encode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}
function decode(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return "";
  }
}

/**
 * Save credentials so the login page can suggest them next time.
 * Stores as base64-encoded JSON (basic obfuscation, not encryption).
 */
export function saveRememberedCredentials(username, password) {
  if (!canUseStorage()) return;
  try {
    const payload = encode(JSON.stringify({ u: username, p: password }));
    localStorage.setItem(REMEMBERED_CREDS_KEY, payload);
  } catch {}
}

/**
 * Read previously remembered credentials.
 * @returns {{ username: string, password: string } | null}
 */
export function readRememberedCredentials() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(REMEMBERED_CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(decode(raw));
    if (parsed && parsed.u) {
      return { username: parsed.u, password: parsed.p || "" };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove remembered credentials. */
export function clearRememberedCredentials() {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(REMEMBERED_CREDS_KEY);
  } catch {}
}

export function readRememberMePreference() {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(REMEMBER_ME_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveRememberMePreference(checked) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(REMEMBER_ME_PREF_KEY, checked ? "1" : "0");
  } catch {}
}
