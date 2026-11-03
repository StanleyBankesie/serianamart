/**
 * @fileoverview VoiceVisualizer component
 * Displays dynamic animated soundwave bars and level indicator
 * when Banks AI is actively listening or speaking.
 */
import React from "react";
import { Mic, Volume2, ArrowRight } from "lucide-react";

export default function VoiceVisualizer({
  isListening,
  isSpeaking,
  isTranscribing,
  audioLevel = 0,
  activeEngine = "WebSpeech",
  onStopAndSend,
}) {
  if (!isListening && !isSpeaking && !isTranscribing) return null;

  // Generate responsive bars
  const bars = [30, 60, 90, 45, 80, 100, 75, 40, 85, 55, 95, 65, 35];

  return (
    <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-brand-900/10 via-brand-800/10 to-brand-700/10 border border-brand-200 dark:border-brand-800/60 flex items-center justify-between gap-3 animate-fadeIn">
      <div className="flex items-center gap-2 text-xs font-semibold text-brand-900 dark:text-brand-300">
        {isListening ? (
          <>
            <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center animate-pulse">
              <Mic size={14} />
            </div>
            <span>Listening...</span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center animate-bounce">
              <Volume2 size={14} />
            </div>
            <span>Speaking...</span>
          </>
        )}
      </div>

      {/* Dynamic sound wave visualizer bars */}
      <div className="flex items-center gap-1 h-6">
        {bars.map((baseH, idx) => {
          const dynamicHeight = Math.max(
            6,
            Math.min(24, Math.round((baseH * Math.max(audioLevel, 25)) / 100))
          );
          return (
            <span
              key={idx}
              className={`w-1 rounded-full transition-all duration-75 ${
                isListening ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{
                height: `${dynamicHeight}px`,
                animationDelay: `${idx * 0.05}s`,
              }}
            />
          );
        })}
      </div>

      {/* Done & Send button when user is speaking */}
      {isListening && onStopAndSend && (
        <button
          type="button"
          onClick={onStopAndSend}
          className="px-2.5 py-1 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
        >
          <span>Send</span>
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
