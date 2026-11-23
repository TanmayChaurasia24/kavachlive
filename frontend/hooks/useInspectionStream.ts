"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  ClientWsMessage,
  ServerWsMessage,
  ComplianceTicket,
} from "../types/inspection";

export interface TranscriptItem {
  id: string;
  speaker: "user" | "agent";
  text: string;
  timestamp: string;
}

export function useInspectionStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<ComplianceTicket | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [lastCommittedId, setLastCommittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize playback AudioContext lazily on user gesture
  const getPlaybackContext = useCallback(() => {
    if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      playbackContextRef.current = new AudioCtx({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;
    }
    if (playbackContextRef.current.state === "suspended") {
      playbackContextRef.current.resume();
    }
    return playbackContextRef.current;
  }, []);

  // Play incoming PCM chunk from Gemini Live
  const playPcmAudio = useCallback(
    (base64Data: string) => {
      try {
        const audioCtx = getPlaybackContext();
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          const val = int16[i];
          float32[i] = val !== undefined ? val / 32768.0 : 0;
        }

        const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const currentTime = audioCtx.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;
      } catch (err) {
        console.warn("[Playback] Error playing audio chunk:", err);
      }
    },
    [getPlaybackContext]
  );

  // Send typed message through WebSocket
  const sendMessage = useCallback((msg: ClientWsMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Frame Capture (1 FPS @ 640x480 JPEG 0.6 quality)
  const startFrameStreaming = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    frameIntervalRef.current = setInterval(() => {
      if (
        videoElementRef.current &&
        videoElementRef.current.readyState >= 2 &&
        ctx &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        ctx.drawImage(videoElementRef.current, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        const base64 = dataUrl.split(",")[1];
        if (base64) {
          sendMessage({ type: "frame", data: base64 });
        }
      }
    }, 1000); // 1 FPS strictly
  }, [sendMessage]);

  // Audio Capture (16kHz mono PCM)
  const startAudioStreaming = useCallback(
    (stream: MediaStream) => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!isInspecting || wsRef.current?.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        const pcm16 = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const s = inputData[i] ?? 0;
          sum += s * s;
          const clamped = Math.max(-1, Math.min(1, s));
          pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }

        // Calculate RMS for visual audio visualizer
        const rms = Math.sqrt(sum / inputData.length);
        setAudioLevel(Math.min(100, Math.round(rms * 250)));

        // Base64 encode PCM bytes
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          const byte = bytes[i];
          if (byte !== undefined) {
            binary += String.fromCharCode(byte);
          }
        }
        const base64Audio = btoa(binary);

        sendMessage({ type: "audio", data: base64Audio });
      };
    },
    [isInspecting, sendMessage]
  );

  // Start Inspection Session
  const startInspection = useCallback(
    async (
      siteId: string,
      supervisorName: string,
      language: "hinglish" | "hindi" | "english"
    ) => {
      setError(null);
      try {
        // Request Camera + Mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: "environment" }, // Prefer back camera on mobile
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        mediaStreamRef.current = stream;

        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          await videoElementRef.current.play();
        }

        // Open WebSocket
        const wsUrl =
          process.env.NEXT_PUBLIC_WS_URL ||
          (typeof window !== "undefined"
            ? `ws://${window.location.hostname}:8080`
            : "ws://localhost:8080");

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log("[ClientWS] Connected to backend relay.");

          // Send start_inspection
          ws.send(
            JSON.stringify({
              type: "start_inspection",
              siteId,
              supervisorName,
              language,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data: ServerWsMessage = JSON.parse(event.data);

            switch (data.type) {
              case "inspection_started":
                setInspectionId(data.inspectionId);
                setIsInspecting(true);
                startFrameStreaming();
                startAudioStreaming(stream);
                break;

              case "audio_out":
                playPcmAudio(data.data);
                break;

              case "transcript":
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: `tr-${Date.now()}-${Math.random()}`,
                    speaker: data.speaker,
                    text: data.text,
                    timestamp: new Date().toLocaleTimeString(),
                  },
                ]);
                break;

              case "hazard_drafted":
                console.log("[ClientWS] Received drafted hazard ticket:", data.ticket);
                setActiveTicket(data.ticket);
                break;

              case "ticket_committed":
                setLastCommittedId(data.ticketId);
                setActiveTicket(null);
                break;

              case "error":
                console.warn("[ClientWS] Server reported warning:", data.message);
                break;
            }
          } catch (e) {
            console.error("[ClientWS] Error parsing message:", e);
          }
        };

        ws.onerror = (err) => {
          console.error("[ClientWS] WebSocket error:", err);
          setError("Failed to connect to inspection server.");
        };

        ws.onclose = () => {
          setIsConnected(false);
          setIsInspecting(false);
        };
      } catch (err: any) {
        console.error("[Inspection] Failed to start:", err);
        setError(
          err.name === "NotAllowedError"
            ? "Camera/Microphone permission denied. Please allow permissions to inspect."
            : err.message || "Failed to initialize camera/microphone."
        );
      }
    },
    [startFrameStreaming, startAudioStreaming, playPcmAudio]
  );

  // Stop Inspection Session
  const endInspection = useCallback(() => {
    if (inspectionId) {
      sendMessage({ type: "end_inspection", inspectionId });
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsInspecting(false);
    setIsConnected(false);
    setAudioLevel(0);
  }, [inspectionId, sendMessage]);

  // Human-in-the-Loop Actions
  const approveTicket = useCallback(
    (ticketId: string, approvedBy: string) => {
      sendMessage({ type: "approve_ticket", ticketId, approvedBy });
    },
    [sendMessage]
  );

  const rejectTicket = useCallback(
    (ticketId: string, reason: string = "Rejected by supervisor") => {
      sendMessage({ type: "reject_ticket", ticketId, reason });
      setActiveTicket(null);
    },
    [sendMessage]
  );

  useEffect(() => {
    return () => {
      endInspection();
    };
  }, [endInspection]);

  return {
    isConnected,
    isInspecting,
    inspectionId,
    activeTicket,
    transcripts,
    audioLevel,
    lastCommittedId,
    error,
    videoElementRef,
    startInspection,
    endInspection,
    approveTicket,
    rejectTicket,
  };
}
