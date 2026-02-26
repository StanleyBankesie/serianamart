import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../auth/AuthContext.jsx";
import api from "../api/client.js";
import logoClear from "../assets/resources/OMNISUITE_LOGO_CLEAR.png";
import backgroundImage from "../assets/resources/BACKGROUND.jpg";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setScope } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login({ username, password });
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
      } else {
        navigate("/select-branch", { replace: true });
      }
    } catch (err) {
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
              {/* <div className="text-2xl font-bold text-brand dark:text-brand-300">
                OmniSuite
              </div> */}
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

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
