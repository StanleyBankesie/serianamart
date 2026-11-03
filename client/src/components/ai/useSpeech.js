/**
 * @fileoverview useSpeech hook
 * Provides browser Web Speech API integration:
 * - Speech-to-Text (STT) recognition with live audio level visualization & interim transcript
 * - Text-to-Speech (TTS) speech synthesis with voice cancellation and index tracking
 * - Speech-to-Speech continuous Voice Mode with auto-send
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

export function useSpeech({ onAutoSend } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeEngine, setActiveEngine] = useState("WebSpeech");

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const onInterimCbRef = useRef(null);
  const onFinalCbRef = useRef(null);
  const onAutoSendRef = useRef(onAutoSend);

  useEffect(() => {
    onAutoSendRef.current = onAutoSend;
  }, [onAutoSend]);

  // Clean Markdown/HTML formatting before reading aloud
  const cleanTextForSpeech = useCallback((rawText) => {
    if (!rawText) return "";
    return rawText
      .replace(/\|.*?\|/g, " ") // remove markdown tables
      .replace(/[-*#_`>]/g, "") // remove markdown symbols
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // link text only
      .replace(/https?:\/\/\S+/g, "") // remove URLs
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Audio level monitoring setup using Web Audio API
  const startAudioMeter = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // Audio level meter fallback
      setAudioLevel(30);
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Text-To-Speech (TTS)
  const speak = useCallback(
    (text, messageIndex = null) => {
      if (!("speechSynthesis" in window)) {
        toast.warn("Speech synthesis is not supported in this browser.");
        return;
      }

      window.speechSynthesis.cancel();
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Samantha") ||
              v.name.includes("David"))
        ) || voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingId(messageIndex);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
        // In continuous Voice Mode, listen again after speaking finishes
        if (isVoiceMode) {
          setTimeout(() => {
            startListening(onInterimCbRef.current, onFinalCbRef.current);
          }, 300);
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [cleanTextForSpeech, isVoiceMode]
  );

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, []);

  const toggleSpeak = useCallback(
    (text, messageIndex) => {
      if (isSpeaking && speakingId === messageIndex) {
        stopSpeaking();
      } else {
        speak(text, messageIndex);
      }
    },
    [isSpeaking, speakingId, speak, stopSpeaking]
  );

  // Speech-To-Text (STT)
  const startListening = useCallback(
    (onInterim, onFinal) => {
      stopSpeaking();
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        toast.error("Speech recognition is not supported in this browser.");
        return;
      }

      onInterimCbRef.current = onInterim;
      onFinalCbRef.current = onFinal;
      finalTranscriptRef.current = "";

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setIsTranscribing(true);
          setSpeechError(null);
          startAudioMeter();
        };

        recognition.onresult = (event) => {
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (interim && onInterim) {
            onInterim(interim);
          }
          if (final) {
            finalTranscriptRef.current = final;
            if (onFinal) onFinal(final);
          }
        };

        recognition.onerror = (event) => {
          setSpeechError(event.error);
          setIsListening(false);
          setIsTranscribing(false);
          stopAudioMeter();
        };

        recognition.onend = () => {
          setIsListening(false);
          setIsTranscribing(false);
          stopAudioMeter();
          const transcript = finalTranscriptRef.current.trim();
          if (transcript && onAutoSendRef.current) {
            onAutoSendRef.current(transcript);
          }
        };

        recognition.start();
      } catch (err) {
        setSpeechError(err.message);
        setIsListening(false);
        setIsTranscribing(false);
        stopAudioMeter();
      }
    },
    [startAudioMeter, stopAudioMeter, stopSpeaking]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsTranscribing(false);
    stopAudioMeter();
  }, [stopAudioMeter]);

  const toggleListening = useCallback(
    (onInterim, onFinal) => {
      if (isListening) {
        stopListening();
      } else {
        startListening(onInterim, onFinal);
      }
    },
    [isListening, startListening, stopListening]
  );

  const toggleVoiceMode = useCallback(
    (onInterim, onFinal) => {
      setIsVoiceMode((prev) => {
        const next = !prev;
        if (next) {
          toast.info("Voice Mode activated. Speak to Banks!");
          startListening(onInterim, onFinal);
        } else {
          stopSpeaking();
          stopListening();
          toast.info("Voice Mode deactivated.");
        }
        return next;
      });
    },
    [startListening, stopListening, stopSpeaking]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  return {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    speechError,
    audioLevel,
    isTranscribing,
    activeEngine,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
  };
}
export default useSpeech;
