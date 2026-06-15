import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./auth/AuthContext.jsx";
import { PermissionProvider } from "./auth/PermissionContext.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPasswordRequest from "./pages/ForgotPasswordRequest.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import BranchSelectionPage from "./pages/BranchSelectionPage.jsx";


import AppShell from "./layout/AppShell.jsx";

const LoadingScreen = () => null;

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

              <Routes>
                <Route path="/login" element={
                  <ErrorBoundary><LoginPage /></ErrorBoundary>
                } />
                <Route
                  path="/forgot-password"
                  element={<ErrorBoundary><ForgotPasswordRequest /></ErrorBoundary>}
                />
                <Route path="/reset-password" element={<ErrorBoundary><ResetPasswordPage /></ErrorBoundary>} />
                <Route
                  path="/select-branch"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary><BranchSelectionPage /></ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary><AppShell /></ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PermissionProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  );
}
