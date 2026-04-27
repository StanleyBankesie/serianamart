import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../auth/AuthContext.jsx";
import {
  readRememberedCredentials,
  readRememberMePreference,
  saveRememberMePreference,
  saveRememberedCredentials,
  clearRememberedCredentials,
} from "../auth/authStorage.js";
import api from "../api/client.js";
import logoClear from "../assets/resources/OMNISUITE_LOGO_CLEAR.png";
import backgroundImage from "../assets/resources/BACKGROUND.jpg";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setScope, token, initialized } = useAuth();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() =>
    readRememberMePreference(),
  );
  const handledStartupRedirect = useRef(false);

  // ── Remembered credential suggestion state ──────────────────
  const [savedCreds, setSavedCreds] = useState(null); // { username, password }
  const [showSuggestion, setShowSuggestion] = useState(false);
  const suggestionRef = useRef(null);

  // Load remembered credentials on mount
  useEffect(() => {
    const creds = readRememberedCredentials();
    if (creds?.username) {
      setSavedCreds(creds);
      setRememberMe(true);
    }
  }, []);

  // Close suggestion dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target) &&
        e.target !== usernameRef.current
      ) {
        setShowSuggestion(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When user focuses or clicks the username field, show saved credential suggestion
  const handleUsernameFocus = useCallback(() => {
    if (savedCreds?.username) {
      setShowSuggestion(true);
    }
  }, [savedCreds]);

  // When user selects the suggested username, fill both fields
  const handleSelectSuggestion = useCallback(() => {
    if (!savedCreds) return;
    if (usernameRef.current) {
      // Set value via native setter so React reads from .value correctly
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      nativeInputValueSetter.call(usernameRef.current, savedCreds.username);
      usernameRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      nativeInputValueSetter.call(passwordRef.current, savedCreds.password);
      passwordRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setShowSuggestion(false);
  }, [savedCreds]);

  useEffect(() => {
    if (handledStartupRedirect.current) return;
    if (!initialized || !token) return;

    // Autofill-safe redirect: We don't care if fields are filled,
    // if we have a token, we move to the dashboard.
    handledStartupRedirect.current = true;
    let target = "/";
    try {
      const fromState = location?.state?.from;
      const fromPath =
        fromState && typeof fromState.pathname === "string"
          ? fromState.pathname + (fromState.search || "")
          : null;
      const last =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("last_path")
          : null;
      const candidate = fromPath || last;
      if (
        candidate &&
        !/^\/(login|reset-password|forgot-password)$/.test(candidate)
      ) {
        target = candidate;
      }
    } catch {}
    navigate(target, { replace: true });
  }, [initialized, token, location, navigate]);

  async function onSubmit(e) {
    e.preventDefault();

    // Read values directly from refs (fixes React/Browser autofill mismatch)
    const submittedUsername = usernameRef.current?.value?.trim() || "";
    const submittedPassword = passwordRef.current?.value || "";

    if (!submittedUsername || !submittedPassword) {
      setError("Please enter both username and password");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await login({
        username: submittedUsername,
        password: submittedPassword,
        rememberMe,
      });

      // ── Save or clear remembered credentials ──────────────
      if (rememberMe) {
        saveRememberedCredentials(submittedUsername, submittedPassword);
        saveRememberMePreference(true);
      } else {
        clearRememberedCredentials();
        saveRememberMePreference(false);
      }

      const branches = Array.isArray(data?.user?.branchIds)
        ? data.user.branchIds.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const companies = Array.isArray(data?.user?.companyIds)
        ? data.user.companyIds.map(Number).filter((n) => Number.isFinite(n))
        : [];

      if (branches.length === 1) {
        const branchId = branches[0];
        let companyId = companies.length === 1 ? companies[0] : null;
        if (!companyId) {
          try {
            const res = await api.get("/admin/branches");
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const b = items.find((x) => Number(x.id) === Number(branchId));
            if (b) companyId = Number(b.company_id);
          } catch {
            companyId = companies[0] || 1;
          }
        }
        setScope((prev) => ({
          ...prev,
          companyId: companyId || prev.companyId || 1,
          branchId: branchId,
        }));

        let target = "/";
        try {
          const fromState = location?.state?.from;
          const fromPath =
            fromState && typeof fromState.pathname === "string"
              ? fromState.pathname + (fromState.search || "")
              : null;
          const last = sessionStorage.getItem("last_path");
          const candidate = fromPath || last;
          if (
            candidate &&
            !/^\/(login|reset-password|forgot-password)$/.test(candidate)
          ) {
            target = candidate;
          }
        } catch {}

        navigate(target, { replace: true });
      } else {
        navigate("/select-branch", { replace: true });
      }
    } catch (err) {
      if (err?.response?.data?.error === "PASSWORD_RESET_REQUIRED") {
        navigate("/reset-password", { replace: true });
      }
      const msg =
        err?.response?.data?.message || err?.message || "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-[400px]">
        <div
          className="card shadow-erp-lg p-8"
          style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
        >
          <div className="flex items-center gap-4 mb-8 ml-7">
            <div>
              <div className="items-center ml-9 mt-3 mb-4">
                <img src={logoClear} alt="OmniSuite" className="h-14 w-auto" />
              </div>
              <div className="items-center text-xl font-bold text-slate-600 dark:text-slate-400 mb-0 mt-4">
                Enterprise Resource Planning
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-status-error/30 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-status-error text-sm">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="space-y-4"
            autoComplete="on"
            method="post"
          >
            {/* ── Username field with suggestion dropdown ── */}
            <div style={{ position: "relative" }}>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="input"
                ref={usernameRef}
                autoComplete="username"
                required
                defaultValue=""
                onFocus={handleUsernameFocus}
                onClick={handleUsernameFocus}
              />

              {/* Credential suggestion dropdown */}
              {showSuggestion && savedCreds?.username && (
                <div
                  ref={suggestionRef}
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    marginTop: "2px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleSelectSuggestion}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f1f5f9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    {/* User avatar icon */}
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "14px",
                        flexShrink: 0,
                      }}
                    >
                      {savedCreds.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          color: "#1e293b",
                          lineHeight: 1.3,
                        }}
                      >
                        {savedCreds.username}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          lineHeight: 1.3,
                        }}
                      >
                        {"•".repeat(8)}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="input pr-10"
                  ref={passwordRef}
                  autoComplete="current-password"
                  required
                  defaultValue=""
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-slate-500"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberMe(checked);
                  saveRememberMePreference(checked);
                }}
              />
              Remember me
            </label>

            <button
              type="submit"
              className="btn-primary w-full mt-6"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <div className="mt-3 text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-brand-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
