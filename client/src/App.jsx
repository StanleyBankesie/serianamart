import React, { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./auth/AuthContext.jsx";
import { PermissionProvider } from "./auth/PermissionContext.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import { Notifications } from "react-push-notification";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const ForgotPasswordRequest = lazy(() => import("./pages/ForgotPasswordRequest.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.jsx"));
const BranchSelectionPage = lazy(() => import("./pages/BranchSelectionPage.jsx"));
const AppShell = lazy(() => import("./layout/AppShell.jsx"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export default function App() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const basename = base.startsWith("/") ? base : "/";
  return (
    <BrowserRouter
      basename={basename}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Provider store={store}>
        <ThemeProvider>
          <AuthProvider>
            <PermissionProvider>
              <ToastContainer position="top-right" theme="dark" />
              <Notifications />
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordRequest />}
                  />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />
                  <Route
                    path="/select-branch"
                    element={
                      <ProtectedRoute>
                        <BranchSelectionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </PermissionProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  );
}
