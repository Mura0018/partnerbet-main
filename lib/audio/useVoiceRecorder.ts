"use client";

import { useRef, useState } from "react";

export type RecordedVoice = { blob: Blob; mimeType: string; durationSeconds: number };

// Records microphone audio via MediaRecorder. Picks whatever mime type the
// browser actually supports (webm/opus on Chrome, mp4/aac on Safari) —
// callers should treat the mimeType as opaque and just store/play it back
// as-is, never assume a specific format.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickMimeType = (): string => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return "audio/webm";
  };

  const start = async (): Promise<boolean> => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setDurationSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setDurationSeconds((d) => d + 1), 1000);
      return true;
    } catch {
      setError("Mikrofonga ruxsat berilmadi.");
      return false;
    }
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  };

  const stop = (): Promise<RecordedVoice | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      const finalDuration = durationSeconds;
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        resolve(blob.size > 0 ? { blob, mimeType, durationSeconds: finalDuration } : null);
      };
      recorder.stop();
    });
  };

  const cancel = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    cleanup();
  };

  return { recording, durationSeconds, error, start, stop, cancel };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
