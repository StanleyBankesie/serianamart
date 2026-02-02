import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api/client.js";
import logoClear from "../assets/resources/OMNISUITE_LOGO_CLEAR.png";
import backgroundImage from "../assets/resources/BACKGROUND.jpg";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password/reset", {
        username,
        otp,
        new_password: newPassword,
      });
      toast.success("Password reset successfully");
      navigate("/login", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reset password";
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
      <div className="w-full max-w-[420px]">
        <div className="card shadow-erp-lg p-8" style={{ backgroundColor: "rgba(255,255,255,0.7)" }}>
          <div className="flex items-center gap-4 mb-6 ml-7">
            <div>
              <div className="items-center ml-9 mt-3 mb-3">
                <img src={logoClear} alt="OmniSuite" className="h-14 w-auto" />
              </div>
              <div className="items-center text-xl font-bold text-slate-600 dark:text-slate-400 mb-0 mt-2">
                Enter OTP and New Password
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
              <label className="label">OTP Code</label>
              <input
                type="text"
                className="input"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                pattern="\\d{6}"
                placeholder="6-digit code"
                required
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>
              {loading ? "Resetting…" : "Reset Password"}
            </button>
            <div className="mt-3 text-right">
              <Link to="/login" className="text-sm text-brand-700 hover:underline">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

