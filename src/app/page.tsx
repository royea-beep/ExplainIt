"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "./components/header";
import { StyleDNA, type StyleOverrides, type StyleProfile } from "./components/style-dna";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { triggerConfetti } from "@/lib/confetti";

// ── ftable Analyzer narration script (75 seconds) ──────────────────────────
const FTABLE_ANALYZER_SCRIPT = `
Are you spending hours writing product descriptions for every item in your catalog?
Stop. There's a better way.

Introducing ftable Analyzer — the AI-powered listing engine built for e-commerce sellers on Wix, Shopify, and WooCommerce.

Here's how it works: upload any product image. In seconds, our AI vision model reads every detail — material, style, use case, target buyer — and generates a complete, ready-to-publish listing.

You get a professional product title, a compelling description, SEO-optimized keywords, and smart pricing recommendations — all in one click.

No copywriting experience needed. No expensive agencies. Just upload, analyze, and paste.

Whether you're launching ten products or ten thousand, ftable Analyzer scales with you.

Try it free today. Five credits, no credit card required.

ftable Analyzer — turn any product photo into a listing that sells.
`.trim();

// Default demo values for the Generate MP4 button
const DEMO_VIDEO_CONFIG = {
  url: "https://analyzer.ftable.co.il",
  script: FTABLE_ANALYZER_SCRIPT,
  voiceId: "EXAVITQu4vr4xnSDxMaL",       // ElevenLabs "Bella"
  avatarId: "Abigail_expressive_2024112501", // HeyGen EN avatar
} as const;

interface VideoGenerateResult {
  outputPath: string;
  downloadUrl: string;
  runId: string;
  hasAudio: boolean;
  hasAvatar: boolean;
  durationSeconds: number;
  screenshotCount: number;
  warnings?: string[];
}

type InputType = "url";
type Stage = "idle" | "intake" | "capture" | "produce" | "document" | "done" | "error";
type Orientation = "portrait" | "landscape";

interface PipelineStatus {
  stage: Stage;
  progress: number;
  currentAgent: string;
  message: string;
}

interface ScreenResult {
  id: string;
  name: string;
  url: string;
  screenshotPath: string;
  videoPath?: string;
  status: string;
}

interface PipelineResultData {
  status: string;
  errors: string[];
  capture?: { screens: ScreenResult[] };
  videos?: Array<{ screenName: string; videoPath: string }>;
  pdf?: { pdfPath: string; mdPath: string; pageCount: number };
  demoPagePath?: string;
  reportPath?: string;
}

const STAGE_LABELS_EN: Record<Stage, string> = {
  idle: "Ready",
  intake: "Stage 1: Planning",
  capture: "Stage 2: Capturing Screenshots",
  produce: "Stage 3: Generating Videos",
  document: "Stage 4: Creating PDF",
  done: "Complete!",
  error: "Error",
};

const STAGE_LABELS_HE: Record<Stage, string> = {
  idle: "\u05DE\u05D5\u05DB\u05DF",
  intake: "\u05E9\u05DC\u05D1 1: \u05EA\u05DB\u05E0\u05D5\u05DF",
  capture: "\u05E9\u05DC\u05D1 2: \u05E6\u05D9\u05DC\u05D5\u05DD \u05DE\u05E1\u05DB\u05D9\u05DD",
  produce: "\u05E9\u05DC\u05D1 3: \u05D9\u05E6\u05D9\u05E8\u05EA \u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD",
  document: "\u05E9\u05DC\u05D1 4: \u05D9\u05E6\u05D9\u05E8\u05EA PDF",
  done: "!\u05D4\u05D5\u05E9\u05DC\u05DD",
  error: "\u05E9\u05D2\u05D9\u05D0\u05D4",
};

const AGENT_STEPS = [
  { id: "intake", label: "Agent 1 - Product + QA Lead", icon: "1" },
  { id: "capture", label: "Agent 2 - Capture Engineer", icon: "2" },
  { id: "produce", label: "Agent 3 - Video Producer", icon: "3" },
  { id: "document", label: "Agent 4 - PDF Designer", icon: "4" },
];

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toExportsServePath(filePath: string): string {
  // Convert an absolute or relative file path to an API serve URL
  const rel = filePath.replace(/^.*[/\\]exports[/\\]/, "").replace(/\\/g, "/");
  return `/api/exports?file=${encodeURIComponent(rel)}`;
}

function authHeaders(token: string | null): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (token) (h as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function Home() {
  const { language, isHe } = useLanguage();
  const { token } = useAuth();

  const inputType: InputType = "url";
  const [inputValue, setInputValue] = useState("");
  const [projectName, setProjectName] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [maxScreens, setMaxScreens] = useState(5);
  const [useCredentials, setUseCredentials] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [styleOverrides, setStyleOverrides] = useState<StyleOverrides>({
    videoTheme: "modern",
    detailLevel: "standard",
  });

  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [result, setResult] = useState<PipelineResultData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  // ── MP4 video generation state ──────────────────────────────────────────
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoGenerateResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Apply learned defaults from Style DNA when profile loads
  const handleDefaultsLoaded = useCallback((profile: StyleProfile) => {
    setStyleOverrides({
      videoTheme: profile.videoTheme,
      detailLevel: profile.detailLevel,
    });
    if (profile.preferredOrientation === "portrait" || profile.preferredOrientation === "landscape") {
      setOrientation(profile.preferredOrientation);
    }
    if (profile.preferredMaxScreens && profile.preferredMaxScreens >= 1 && profile.preferredMaxScreens <= 30) {
      setMaxScreens(profile.preferredMaxScreens);
    }
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline?id=${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          stopPolling();
          setIsRunning(false);
          isRunningRef.current = false;
          return;
        }
        const data = await res.json();
        setStatus(data.status);
        if (data.status.stage === "done" || data.status.stage === "error") {
          stopPolling();
          setIsRunning(false);
          isRunningRef.current = false;
          if (data.result) setResult(data.result);
          if (data.status.stage === "done") triggerConfetti();
        }
      } catch {
        stopPolling();
        setIsRunning(false);
        isRunningRef.current = false;
      }
    }, 1500);
  }, [stopPolling, token]);

  // Validate input on change
  const validateInput = useCallback((value: string, type: InputType) => {
    if (!value.trim()) {
      setInputError(null);
      return;
    }
    if (type === "url" && !isValidUrl(value.trim())) {
      setInputError(isHe ? "URL \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF. \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1-https://..." : "Invalid URL. Use https://...");
    } else {
      setInputError(null);
    }
  }, [isHe]);

  const handleGenerateVideo = async () => {
    setIsGeneratingVideo(true);
    setVideoResult(null);
    setVideoError(null);
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_VIDEO_CONFIG),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setVideoError(data.error || "Video generation failed");
      } else {
        setVideoResult(data as VideoGenerateResult);
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleStart = async () => {
    if (isRunningRef.current) return;
    if (!inputValue.trim()) return;

    if (inputType === "url" && !isValidUrl(inputValue.trim())) {
      setInputError(isHe ? "URL \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF" : "Invalid URL");
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    setResult(null);
    setInputError(null);
    setStatus({ stage: "intake", progress: 0, currentAgent: "Pipeline", message: isHe ? "...\u05DE\u05EA\u05D7\u05D9\u05DC" : "Starting..." });

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          type: inputType,
          value: inputValue.trim(),
          projectName: projectName || "ExplainIt Project",
          orientation,
          maxScreens,
          language,
          credentials: useCredentials ? { username, password } : undefined,
          videoTheme: styleOverrides.videoTheme,
          detailLevel: styleOverrides.detailLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus({ stage: "error", progress: 0, currentAgent: "Pipeline", message: data.error || "Server error" });
        setIsRunning(false);
        isRunningRef.current = false;
        return;
      }

      setStatus(data.status);
      setPipelineId(data.pipelineId);
      pollStatus(data.pipelineId);
    } catch (err) {
      setStatus({
        stage: "error",
        progress: 0,
        currentAgent: "Pipeline",
        message: err instanceof Error ? err.message : "Connection failed",
      });
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  const handleCancel = () => {
    stopPolling();
    setIsRunning(false);
    isRunningRef.current = false;
    // Signal server to cancel
    if (pipelineId) {
      fetch(`/api/pipeline?id=${pipelineId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).catch(() => {});
    }
    setStatus(prev => prev ? { ...prev, stage: "error", message: isHe ? "\u05D1\u05D5\u05D8\u05DC \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9" : "Cancelled by user" } : null);
  };

  const canStart = inputValue.trim().length > 0 && !inputError && !isRunning;

  const currentStageIndex = status
    ? AGENT_STEPS.findIndex((s) => s.id === status.stage)
    : -1;

  const stageLabels = isHe ? STAGE_LABELS_HE : STAGE_LABELS_EN;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Hero */}
          <section className="text-center py-6 md:py-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight max-w-3xl mx-auto mb-4">
              {isHe
                ? "הפוך כל אתר להדרכת וידאו ב־60 שניות"
                : "Turn Any Website Into a Video Tutorial in 60 Seconds"}
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-6">
              {isHe
                ? "סרוק אתר, קבל סרטוני הסבר ו־PDF אוטומטית. ללא עריכה ידנית."
                : "Scan any site, get explainer videos and PDFs automatically. No manual editing."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition"
              >
                {isHe ? "נסה חינם" : "Try Free"}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition"
              >
                {isHe ? "תמחור" : "Pricing"}
              </Link>
            </div>
          </section>

          {/* Demo: pipeline output (screenshot → video → PDF) */}
          <section className="glass p-6 md:p-8">
            <h3 className="text-xl font-bold text-white mb-4 text-center">
              {isHe ? "איך זה עובד" : "How it works"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <span className="text-4xl text-white/30">📸</span>
                </div>
                <p className="text-sm font-medium text-white">
                  {isHe ? "צילומי מסך" : "Screenshots"}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isHe ? "סריקת דפים אוטומטית" : "Automatic page capture"}
                </p>
              </div>
              <div className="text-center">
                <div className="aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <span className="text-4xl text-white/30">🎬</span>
                </div>
                <p className="text-sm font-medium text-white">
                  {isHe ? "סרטונים" : "Videos"}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isHe ? "הסברי וידאו לכל מסך" : "Explainer video per screen"}
                </p>
              </div>
              <div className="text-center">
                <div className="aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <span className="text-4xl text-white/30">📄</span>
                </div>
                <p className="text-sm font-medium text-white">
                  {isHe ? "PDF" : "PDF"}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isHe ? "מדריך אחד להורדה" : "Single guide to download"}
                </p>
              </div>
            </div>
          </section>

          {/* Smart Mode Banner */}
          <Link
            href="/editor"
            className="block glass p-5 hover:border-indigo-500/40 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-500 flex items-center justify-center text-white text-xl">
                  AI
                </div>
                <div>
                  <p className="font-bold text-white text-lg">
                    {isHe ? "Smart Mode - \u05E1\u05E4\u05E8 \u05DC\u05E0\u05D5 \u05DE\u05D4 \u05DC\u05D4\u05E1\u05D1\u05D9\u05E8" : "Smart Mode - Tell us what to explain"}
                  </p>
                  <p className="text-sm text-white/40">
                    {isHe
                      ? "\u05EA\u05D0\u05E8 \u05D1\u05E9\u05E4\u05D4 \u05D7\u05D5\u05E4\u05E9\u05D9\u05EA \u05D5\u05E0\u05D9\u05D9\u05E6\u05E8 \u05D4\u05DB\u05DC \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA. \u05EA\u05D5\u05DE\u05DA \u05D1-ClubGG, PPPoker, PokerBros \u05D5\u05E2\u05D5\u05D3"
                      : "Describe freely and we'll generate everything. Supports ClubGG, PPPoker, PokerBros & more"}
                  </p>
                </div>
              </div>
              <svg className="w-6 h-6 text-white/30 group-hover:text-indigo-400 transition rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </Link>

          {/* Input Section */}
          <section className="glass p-6 space-y-6">
            <h2 className="text-2xl font-bold gradient-text">
              {isHe ? "URL Mode - \u05E1\u05E8\u05D9\u05E7\u05EA \u05D0\u05EA\u05E8" : "URL Mode - Scan Website"}
            </h2>

            {/* Input Type — URL only (repo/build not yet implemented) */}

            {/* Main Input */}
            <div className="space-y-4">
              <div>
                <label htmlFor="main-input" className="sr-only">Website URL</label>
                <input
                  id="main-input"
                  type="text"
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); validateInput(e.target.value, inputType); }}
                  placeholder="https://example.com"
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:ring-1 transition-all text-start ${
                    inputError
                      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
                      : "border-white/10 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                  dir="ltr"
                  aria-invalid={!!inputError}
                  aria-describedby={inputError ? "input-error" : undefined}
                />
                {inputError && (
                  <p id="input-error" className="text-sm text-red-400 mt-2" role="alert">
                    {inputError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="project-name" className="sr-only">{isHe ? "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8" : "Project name"}</label>
                  <input
                    id="project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={isHe ? "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8" : "Project name"}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="orientation" className="sr-only">{isHe ? "\u05DB\u05D9\u05D5\u05D5\u05DF" : "Orientation"}</label>
                  <select
                    id="orientation"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-indigo-500 transition-all [&>option]:bg-[#0a0a0f]"
                  >
                    <option value="portrait">
                      {isHe ? "\u05D0\u05E0\u05DB\u05D9 (\u05D8\u05DC\u05E4\u05D5\u05DF)" : "Portrait (Phone)"}
                    </option>
                    <option value="landscape">
                      {isHe ? "\u05D0\u05D5\u05E4\u05E7\u05D9 (\u05DE\u05D7\u05E9\u05D1)" : "Landscape (Desktop)"}
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="max-screens" className="text-sm text-white/60 whitespace-nowrap">
                    {isHe ? "\u05DE\u05E1\u05DB\u05D9\u05DD:" : "Screens:"}
                  </label>
                  <input
                    id="max-screens"
                    type="number"
                    min={1}
                    max={30}
                    value={maxScreens}
                    onChange={(e) => setMaxScreens(Math.min(30, Math.max(1, Number(e.target.value))))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Credentials Toggle */}
              <div>
                <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={useCredentials}
                    onChange={(e) => setUseCredentials(e.target.checked)}
                    className="rounded w-5 h-5"
                  />
                  {isHe ? "?\u05E6\u05E8\u05D9\u05DA Login" : "Requires Login?"}
                </label>
                {useCredentials && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label htmlFor="cred-user" className="sr-only">Username</label>
                      <input
                        id="cred-user"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-all"
                        dir="ltr"
                        autoComplete="username"
                      />
                    </div>
                    <div>
                      <label htmlFor="cred-pass" className="sr-only">Password</label>
                      <input
                        id="cred-pass"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-all"
                        dir="ltr"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Style DNA Panel */}
            <div className="border-t border-white/5 pt-4">
              <StyleDNA
                overrides={styleOverrides}
                onChange={setStyleOverrides}
                onDefaultsLoaded={handleDefaultsLoaded}
              />
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                isRunning
                  ? "bg-indigo-800 text-white/50 cursor-not-allowed"
                  : !canStart
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
              }`}
            >
              {isRunning
                ? isHe ? "...\u05DE\u05D9\u05D9\u05E6\u05E8" : "Generating..."
                : isHe ? "\u05D4\u05EA\u05D7\u05DC \u05D4\u05E4\u05E7\u05D4" : "Start Production"}
            </button>

            {/* ── Generate MP4 Video button ──────────────────────────────── */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <p className="text-xs text-white/40 text-center">
                Demo: Generate a full narrated MP4 video for ftable Analyzer
              </p>
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  isGeneratingVideo
                    ? "bg-amber-800 text-white/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]"
                }`}
              >
                {isGeneratingVideo ? "Generating MP4 Video..." : "Generate MP4 Video"}
              </button>

              {/* Video generation result */}
              {videoResult && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
                  <p className="text-sm font-bold text-green-400">MP4 Video Ready</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                    <span>{videoResult.screenshotCount} screens</span>
                    <span>{videoResult.durationSeconds}s</span>
                    <span>
                      {videoResult.hasAvatar ? "Avatar" : "No avatar"} / {videoResult.hasAudio ? "Audio" : "Silent"}
                    </span>
                  </div>
                  {videoResult.warnings && videoResult.warnings.length > 0 && (
                    <ul className="text-xs text-amber-400/80 space-y-0.5">
                      {videoResult.warnings.map((w, i) => (
                        <li key={i} dir="ltr">{w}</li>
                      ))}
                    </ul>
                  )}
                  <a
                    href={videoResult.downloadUrl}
                    download
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-green-500/25 transition-all"
                  >
                    Download MP4
                  </a>
                </div>
              )}

              {/* Video generation error */}
              {videoError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl" role="alert">
                  <p className="text-red-400 text-sm" dir="ltr">{videoError}</p>
                  <button
                    type="button"
                    onClick={() => setVideoError(null)}
                    className="mt-2 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1 rounded-lg transition"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Pipeline Status */}
          {status && (
            <section className="glass p-6 space-y-6" aria-live="polite">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {isHe ? "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D4\u05E4\u05E7\u05D4" : "Pipeline Status"}
                </h3>
                {isRunning && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-1.5 rounded-lg transition"
                  >
                    {isHe ? "\u05D1\u05D8\u05DC" : "Cancel"}
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">{stageLabels[status.stage]}</span>
                  <span className="text-indigo-400">{status.progress}%</span>
                </div>
                <div
                  className="h-2 bg-white/5 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={status.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={stageLabels[status.stage]}
                >
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-amber-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>

              {/* Agent Steps */}
              <div className="space-y-3">
                {AGENT_STEPS.map((step, i) => {
                  const isActive = step.id === status.stage;
                  const isDone = currentStageIndex > i || status.stage === "done";
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isActive
                          ? "bg-indigo-500/10 border border-indigo-500/30"
                          : isDone
                          ? "bg-green-500/5 border border-green-500/20"
                          : "bg-white/[0.02] border border-white/5"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isActive
                            ? "bg-indigo-600 text-white animate-pulse"
                            : isDone
                            ? "bg-green-600 text-white"
                            : "bg-white/10 text-white/30"
                        }`}
                      >
                        {isDone ? "\u2713" : step.icon}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isActive ? "text-white" : isDone ? "text-green-300" : "text-white/40"}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-indigo-300 mt-0.5">{status.message}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Current Agent Message */}
              {status.stage !== "done" && status.stage !== "error" && status.stage !== "idle" && (
                <div className="p-3 bg-white/[0.03] rounded-lg border border-white/5">
                  <p className="text-sm text-white/60 font-mono" dir="ltr">
                    {status.currentAgent}: {status.message}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {status.stage === "error" && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl" role="alert">
                  <p className="text-red-400 text-sm">{status.message}</p>
                  <button
                    type="button"
                    onClick={() => { setStatus(null); setIsRunning(false); isRunningRef.current = false; }}
                    className="mt-3 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-lg transition"
                  >
                    {isHe ? "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1" : "Try Again"}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Results Section */}
          {result && (
            <section className="glass p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
                    {"\u2713"}
                  </span>
                  {isHe ? "\u05EA\u05D5\u05E6\u05E8\u05D9\u05DD" : "Deliverables"}
                </h3>
                <Link
                  href="/results"
                  className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  {isHe ? "\u05E6\u05E4\u05D4 \u05D1\u05DB\u05DC \u05D4\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA" : "View All Results"}
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/[0.03] rounded-xl">
                  <p className="text-3xl font-bold text-indigo-400">{result.capture?.screens?.length || 0}</p>
                  <p className="text-xs text-white/50 mt-1">{isHe ? "\u05DE\u05E1\u05DB\u05D9\u05DD" : "Screens"}</p>
                </div>
                <div className="text-center p-4 bg-white/[0.03] rounded-xl">
                  <p className="text-3xl font-bold text-amber-400">{result.videos?.length || 0}</p>
                  <p className="text-xs text-white/50 mt-1">{isHe ? "\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Videos"}</p>
                </div>
                <div className="text-center p-4 bg-white/[0.03] rounded-xl">
                  <p className="text-3xl font-bold text-green-400">{result.pdf?.pageCount || 0}</p>
                  <p className="text-xs text-white/50 mt-1">{isHe ? "\u05E2\u05DE\u05D5\u05D3\u05D9 PDF" : "PDF Pages"}</p>
                </div>
              </div>

              {/* Actionable File Links */}
              <div className="space-y-3">
                {result.demoPagePath && (
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/5">
                    <span className="text-sm text-white/80 font-medium">{isHe ? "\u05E2\u05DE\u05D5\u05D3 \u05D3\u05DE\u05D5 (\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD)" : "Demo Page (Videos)"}</span>
                    <div className="flex gap-2">
                      <a
                        href={toExportsServePath(result.demoPagePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition"
                      >
                        {isHe ? "\u05E4\u05EA\u05D7" : "Open"}
                      </a>
                    </div>
                  </div>
                )}
                {result.pdf?.pdfPath && (
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/5">
                    <span className="text-sm text-white/80 font-medium">PDF Guide ({result.pdf.pageCount} {isHe ? "\u05E2\u05DE\u05D5\u05D3\u05D9\u05DD" : "pages"})</span>
                    <div className="flex gap-2">
                      <a
                        href={toExportsServePath(result.pdf.pdfPath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition"
                      >
                        {isHe ? "\u05E4\u05EA\u05D7" : "Open"}
                      </a>
                      <a
                        href={toExportsServePath(result.pdf.pdfPath)}
                        download
                        className="text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-4 py-1.5 rounded-lg transition"
                      >
                        {isHe ? "\u05D4\u05D5\u05E8\u05D3" : "Download"}
                      </a>
                    </div>
                  </div>
                )}
                {result.reportPath && (
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/5">
                    <span className="text-sm text-white/80 font-medium">Report JSON</span>
                    <a
                      href={toExportsServePath(result.reportPath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-4 py-1.5 rounded-lg transition"
                    >
                      {isHe ? "\u05E4\u05EA\u05D7" : "Open"}
                    </a>
                  </div>
                )}
              </div>

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <h4 className="text-sm font-bold text-amber-400 mb-2">
                    {isHe ? "\u05D0\u05D6\u05D4\u05E8\u05D5\u05EA" : "Warnings"}
                  </h4>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-300/80" dir="ltr">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Screen List */}
              {result.capture?.screens && result.capture.screens.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-white/80 mb-3">
                    {isHe ? "\u05DE\u05E1\u05DB\u05D9\u05DD \u05E9\u05E0\u05DC\u05DB\u05D3\u05D5" : "Captured Screens"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.capture.screens.map((screen) => (
                      <div key={screen.id} className="p-3 bg-white/[0.03] rounded-lg border border-white/5">
                        <p className="text-sm font-medium text-white">{screen.name}</p>
                        <p className="text-xs text-white/40 mt-1 font-mono" dir="ltr">{screen.url}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto text-center text-xs text-white/30">
          ExplainIt v1.0 - Automated Explainer Video & Documentation Generator
        </div>
      </footer>
    </div>
  );
}
