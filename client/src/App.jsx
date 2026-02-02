import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./auth/AuthContext.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPasswordRequest from "./pages/ForgotPasswordRequest.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import BranchSelectionPage from "./pages/BranchSelectionPage.jsx";

import AppShell from "./layout/AppShell.jsx";

const LoadingScreen = () => null;

export default function App() {
  return (
    <BrowserRouter>
      <Provider store={store}>
        <ThemeProvider>
          <AuthProvider>
            <ToastContainer position="top-right" theme="dark" />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordRequest />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  );
}
