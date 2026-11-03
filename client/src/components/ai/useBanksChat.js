/**
 * @fileoverview useBanksChat hook
 * Manages conversation history, message sending, streaming/loading state,
 * tool execution badges, AI health status, and chat clearing.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { usePermission } from "../../auth/PermissionContext.jsx";

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "Hello! I am **Banks**, your OmniSuite AI Assistant. How can I help you today?",
};

export function useBanksChat() {
  const { user } = useAuth();
  const { isSuperAdmin, modules } = usePermission();

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("omnisuite.banks_chat_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeToolBadge, setActiveToolBadge] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem("omnisuite.banks_chat_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Allowed modules for RBAC context
  const userAllowedModules = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return ["*"];
    const list = Array.from(modules || []);
    return list.length ? list : ["general"];
  }, [isSuperAdmin, user, modules]);

  // Check AI health status
  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get("/ai/status");
      setAiStatus(res.data?.data || res.data || null);
    } catch {
      setAiStatus(null);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const sendMessage = useCallback(
    async (userPrompt = null) => {
      const text = String(userPrompt != null ? userPrompt : input).trim();
      if (!text || loading) return;

      const userMsg = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      setActiveToolBadge("Analyzing request...");

      try {
        const res = await api.post("/ai/chat", {
          messages: nextMessages,
          userContext: {
            roleName: user?.role_name || user?.role || "User",
            isSuperAdmin: Boolean(isSuperAdmin || user?.id === 1),
            allowedModules: userAllowedModules,
          },
        });

        const reply =
          res.data?.data?.reply ||
          res.data?.reply ||
          "I have processed your request.";
        const toolsExecuted =
          res.data?.data?.toolCallsExecuted ||
          res.data?.toolCallsExecuted ||
          [];
        const form = res.data?.data?.form || res.data?.form || null;

        if (toolsExecuted.length > 0) {
          const toolNames = toolsExecuted
            .map((t) => (t.toolName || t.name || "Tool").replace(/_/g, " "))
            .join(", ");
          setActiveToolBadge(`Executed: ${toolNames}`);
        } else {
          setActiveToolBadge(null);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            tools: toolsExecuted,
            form,
          },
        ]);
      } catch (err) {
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "An error occurred while communicating with Banks AI.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ **Error**: ${errMsg}`,
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => setActiveToolBadge(null), 3000);
      }
    },
    [input, loading, messages, user, isSuperAdmin, userAllowedModules]
  );

  const startNewChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setActiveToolBadge(null);
    try {
      localStorage.removeItem("omnisuite.banks_chat_messages");
    } catch {}
  }, []);

  const deleteChatHistory = useCallback(async () => {
    try {
      await api.delete("/ai/chat").catch(() => {});
    } catch {}
    startNewChat();
  }, [startNewChat]);

  return {
    messages,
    input,
    setInput,
    loading,
    activeToolBadge,
    aiStatus,
    sendMessage,
    deleteChatHistory,
    startNewChat,
  };
}
export default useBanksChat;
