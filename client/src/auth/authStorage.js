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

function readRememberedCredentialPayload() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(REMEMBERED_CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(decode(raw));
  } catch {
    return null;
  }
}

function normalizeRememberedCredentialPayload(payload) {
  const rows = Array.isArray(payload?.profiles)
    ? payload.profiles
    : payload?.u
      ? [payload]
      : [];
  const seen = new Set();
  return rows
    .map((row) => ({
      username: String(row?.username || row?.u || "").trim(),
      password: String(row?.password || row?.p || ""),
      profilePictureUrl: String(row?.profilePictureUrl || ""),
      avatarColor: String(row?.avatarColor || ""),
      updatedAt: Number(row?.updatedAt || 0),
    }))
    .filter((row) => {
      if (!row.username || seen.has(row.username.toLowerCase())) return false;
      seen.add(row.username.toLowerCase());
      return true;
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export function getRememberedAvatarColor(username) {
  const palette = [
    "#0E3646",
    "#2563eb",
    "#047857",
    "#b45309",
    "#be123c",
    "#7c3aed",
    "#0f766e",
    "#4338ca",
    "#c2410c",
    "#0369a1",
  ];
  const text = String(username || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function writeRememberedCredentialProfiles(profiles) {
  if (!canUseStorage()) return;
  try {
    const payload = encode(JSON.stringify({ profiles }));
    localStorage.setItem(REMEMBERED_CREDS_KEY, payload);
  } catch {}
}

/**
 * Save credentials so the login page can suggest them next time.
 * Stores as base64-encoded JSON (basic obfuscation, not encryption).
 */
export function saveRememberedCredentials(username, password, profile = {}) {
  if (!canUseStorage()) return;
  const cleanUsername = String(username || "").trim();
  if (!cleanUsername) return;
  try {
    const existing = readRememberedCredentialProfiles();
    const nextProfile = {
      username: cleanUsername,
      password: String(password || ""),
      profilePictureUrl: String(profile?.profilePictureUrl || ""),
      avatarColor: getRememberedAvatarColor(cleanUsername),
      updatedAt: Date.now(),
    };
    const next = [
      nextProfile,
      ...existing.filter(
        (row) => row.username.toLowerCase() !== cleanUsername.toLowerCase(),
      ),
    ].slice(0, 10);
    writeRememberedCredentialProfiles(next);
  } catch {}
}

/**
 * Read all remembered credentials for the shared login picker.
 * @returns {{ username: string, password: string, updatedAt: number }[]}
 */
export function readRememberedCredentialProfiles() {
  return normalizeRememberedCredentialPayload(readRememberedCredentialPayload());
}

/**
 * Read the most recently remembered credential.
 * @returns {{ username: string, password: string } | null}
 */
export function readRememberedCredentials() {
  const first = readRememberedCredentialProfiles()[0] || null;
  return first
    ? { username: first.username, password: first.password || "" }
    : null;
}

/** Remove remembered credentials. Pass a username to remove only one profile. */
export function clearRememberedCredentials(username = null) {
  if (!canUseStorage()) return;
  try {
    const cleanUsername = String(username || "").trim();
    if (!cleanUsername) {
      localStorage.removeItem(REMEMBERED_CREDS_KEY);
      return;
    }
    const next = readRememberedCredentialProfiles().filter(
      (row) => row.username.toLowerCase() !== cleanUsername.toLowerCase(),
    );
    if (next.length) writeRememberedCredentialProfiles(next);
    else localStorage.removeItem(REMEMBERED_CREDS_KEY);
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
