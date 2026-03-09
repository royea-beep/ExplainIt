"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StyleProfile {
  preferredLanguage: string | null;
  preferredOrientation: string | null;
  preferredMaxScreens: number | null;
  detailLevel: string;
  videoTheme: string;
  includeAnnotations: boolean;
  analyzedPipelineCount: number;
  lastAnalyzedAt: string | null;
}

export interface StyleOverrides {
  videoTheme: string;
  detailLevel: string;
}

interface StyleDNAProps {
  overrides: StyleOverrides;
  onChange: (overrides: StyleOverrides) => void;
  onDefaultsLoaded?: (profile: StyleProfile) => void;
}

// ---------------------------------------------------------------------------
// Theme definitions with visual preview data
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  {
    id: "modern",
    labelEn: "Modern",
    labelHe: "\u05DE\u05D5\u05D3\u05E8\u05E0\u05D9",
    bg: "#0d0d1a",
    titleBg: "rgba(13,13,26,0.88)",
    text: "#ffffff",
    subtext: "#cccccc",
    cta: ["#ff4444", "#ff8800"],
    highlights: ["#ff4444", "#ff8800", "#ffcc00", "#44cc44", "#4488ff"],
    progress: ["#ff4444", "#ff8800", "#ffcc00"],
  },
  {
    id: "clean",
    labelEn: "Clean",
    labelHe: "\u05E0\u05E7\u05D9",
    bg: "#f8f9fa",
    titleBg: "rgba(248,249,250,0.92)",
    text: "#1e293b",
    subtext: "#64748b",
    cta: ["#2563eb", "#3b82f6"],
    highlights: ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed"],
    progress: ["#2563eb", "#3b82f6", "#60a5fa"],
  },
  {
    id: "bold",
    labelEn: "Bold",
    labelHe: "\u05D1\u05D5\u05DC\u05D8",
    bg: "#18181b",
    titleBg: "rgba(24,24,27,0.92)",
    text: "#fafafa",
    subtext: "#a1a1aa",
    cta: ["#e11d48", "#f43f5e"],
    highlights: ["#e11d48", "#f59e0b", "#10b981", "#6366f1", "#ec4899"],
    progress: ["#e11d48", "#f43f5e", "#fb923c"],
  },
] as const;

const DETAIL_OPTIONS = [
  {
    id: "minimal",
    labelEn: "Minimal",
    labelHe: "\u05DE\u05D9\u05E0\u05D9\u05DE\u05DC\u05D9",
    desc_en: "Screenshots only",
    desc_he: "\u05E6\u05D9\u05DC\u05D5\u05DE\u05D9 \u05DE\u05E1\u05DA \u05D1\u05DC\u05D1\u05D3",
    annotations: false,
    toc: false,
    elements: 0,
  },
  {
    id: "standard",
    labelEn: "Standard",
    labelHe: "\u05E8\u05D2\u05D9\u05DC",
    desc_en: "Annotated guide",
    desc_he: "\u05DE\u05D3\u05E8\u05D9\u05DA \u05E2\u05DD \u05D4\u05E2\u05E8\u05D5\u05EA",
    annotations: true,
    toc: true,
    elements: 12,
  },
  {
    id: "detailed",
    labelEn: "Detailed",
    labelHe: "\u05DE\u05E4\u05D5\u05E8\u05D8",
    desc_en: "Full documentation",
    desc_he: "\u05EA\u05D9\u05E2\u05D5\u05D3 \u05DE\u05DC\u05D0",
    annotations: true,
    toc: true,
    elements: 30,
  },
] as const;

// ---------------------------------------------------------------------------
// Mini video frame preview (SVG)
// ---------------------------------------------------------------------------

function ThemePreview({ theme, selected }: { theme: typeof THEME_OPTIONS[number]; selected: boolean }) {
  const w = 120;
  const h = 72;
  const accent = theme.highlights[0];
  const accent2 = theme.highlights[1];
  const accent3 = theme.highlights[2];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full rounded-lg border transition-all ${
        selected ? "border-indigo-500/40" : "border-white/10"
      }`}
      style={{ background: theme.bg }}
    >
      {/* Fake screenshot area */}
      <rect x="8" y="8" width={w - 16} height={h - 24} rx="3"
        fill={theme.bg === "#f8f9fa" ? "#e2e8f0" : "#ffffff10"} />

      {/* Fake UI elements inside screenshot */}
      <rect x="14" y="13" width="40" height="4" rx="1" fill={theme.bg === "#f8f9fa" ? "#94a3b8" : "#ffffff30"} />
      <rect x="14" y="20" width="60" height="3" rx="1" fill={theme.bg === "#f8f9fa" ? "#cbd5e1" : "#ffffff15"} />
      <rect x="14" y="26" width="50" height="3" rx="1" fill={theme.bg === "#f8f9fa" ? "#cbd5e1" : "#ffffff15"} />

      {/* Highlight boxes — the key differentiator */}
      <rect x="12" y="32" width="30" height="10" rx="2"
        fill="none" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <rect x="48" y="32" width="25" height="10" rx="2"
        fill="none" stroke={accent2} strokeWidth="1.5" opacity="0.9" />
      <rect x="78" y="12" width="24" height="8" rx="2"
        fill="none" stroke={accent3} strokeWidth="1.5" opacity="0.7" />

      {/* Callout labels */}
      <rect x="12" y="28" width="16" height="5" rx="1" fill={accent} opacity="0.9" />
      <rect x="48" y="28" width="12" height="5" rx="1" fill={accent2} opacity="0.9" />

      {/* Progress bar at bottom */}
      <defs>
        <linearGradient id={`prog-${theme.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.progress[0]} />
          <stop offset="50%" stopColor={theme.progress[1]} />
          <stop offset="100%" stopColor={theme.progress[2]} />
        </linearGradient>
      </defs>
      <rect x="0" y={h - 3} width={w * 0.65} height="3" fill={`url(#prog-${theme.id})`} />

      {/* CTA button hint */}
      <defs>
        <linearGradient id={`cta-${theme.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.cta[0]} />
          <stop offset="100%" stopColor={theme.cta[1]} />
        </linearGradient>
      </defs>
      <rect x={w / 2 - 18} y={h - 14} width="36" height="8" rx="2" fill={`url(#cta-${theme.id})`} opacity="0.85" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mini PDF page preview (SVG)
// ---------------------------------------------------------------------------

function DetailPreview({ opt, selected }: { opt: typeof DETAIL_OPTIONS[number]; selected: boolean }) {
  const w = 80;
  const h = 100;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full max-w-[80px] rounded border transition-all mx-auto ${
        selected ? "border-indigo-500/40" : "border-white/10"
      }`}
      style={{ background: "#ffffff" }}
    >
      {/* Page header */}
      <rect x="0" y="0" width={w} height="3" fill="#1A237E" />

      {/* Title */}
      <rect x="8" y="8" width="40" height="3" rx="1" fill="#1A237E" />

      {/* Screenshot placeholder */}
      <rect x="8" y="16" width={w - 16} height="30" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />

      {/* Content varies by detail level */}
      {opt.annotations && (
        <>
          {/* Annotation circles on screenshot */}
          <circle cx="18" cy="26" r="3" fill="#E53935" />
          <text x="18" y="27.5" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold">1</text>
          <circle cx="38" cy="32" r="3" fill="#E53935" />
          <text x="38" y="33.5" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold">2</text>
          {opt.elements > 12 && (
            <>
              <circle cx="54" cy="24" r="3" fill="#E53935" />
              <text x="54" y="25.5" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold">3</text>
            </>
          )}
        </>
      )}

      {/* Text lines below screenshot */}
      <rect x="8" y="52" width="50" height="2" rx="0.5" fill="#333333" opacity="0.5" />
      <rect x="8" y="57" width="40" height="2" rx="0.5" fill="#333333" opacity="0.3" />

      {opt.toc && (
        <>
          {/* Element table */}
          <rect x="8" y="64" width={w - 16} height="0.5" fill="#cccccc" />
          <rect x="8" y="68" width="30" height="2" rx="0.5" fill="#333333" opacity="0.4" />
          <rect x="8" y="73" width="25" height="2" rx="0.5" fill="#333333" opacity="0.3" />
          {opt.elements > 12 && (
            <>
              <rect x="8" y="78" width="35" height="2" rx="0.5" fill="#333333" opacity="0.3" />
              <rect x="8" y="83" width="28" height="2" rx="0.5" fill="#333333" opacity="0.2" />
              <rect x="8" y="88" width="32" height="2" rx="0.5" fill="#333333" opacity="0.2" />
            </>
          )}
        </>
      )}

      {/* Footer */}
      <rect x="0" y={h - 3} width={w} height="3" fill="#1A237E" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StyleDNA({ overrides, onChange, onDefaultsLoaded }: StyleDNAProps) {
  const { token } = useAuth();
  const { isHe } = useLanguage();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("/api/preferences", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StyleProfile | null) => {
        if (data) {
          setProfile(data);
          onDefaultsLoaded?.(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSaveAsDefault = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoTheme: overrides.videoTheme,
          detailLevel: overrides.detailLevel,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setSaveMsg(isHe ? "\u05E0\u05E9\u05DE\u05E8!" : "Saved!");
        setTimeout(() => setSaveMsg(null), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [token, overrides, isHe]);

  const handleResetOverride = useCallback(() => {
    if (!profile) return;
    onChange({
      videoTheme: profile.videoTheme,
      detailLevel: profile.detailLevel,
    });
  }, [profile, onChange]);

  const handleResetLearned = useCallback(async () => {
    if (!token) return;
    setResetting(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        onChange({ videoTheme: "modern", detailLevel: "standard" });
        setSaveMsg(isHe ? "\u05D0\u05D5\u05E4\u05E1 \u05DC\u05D1\u05E8\u05D9\u05E8\u05D5\u05EA \u05DE\u05D7\u05D3\u05DC" : "Style reset complete");
        setTimeout(() => setSaveMsg(null), 2500);
      }
    } catch {
      // silent
    } finally {
      setResetting(false);
    }
  }, [token, onChange, isHe]);

  const isOverridden =
    profile &&
    (overrides.videoTheme !== profile.videoTheme ||
      overrides.detailLevel !== profile.detailLevel);

  // Not logged in or still loading
  if (!token) return null;
  if (loading) return null;

  const pipelineCount = profile?.analyzedPipelineCount ?? 0;

  // Build the learned-preferences sentence fragments
  const learnedParts: string[] = [];
  if (profile && pipelineCount > 0) {
    if (profile.preferredLanguage) {
      learnedParts.push(
        isHe
          ? profile.preferredLanguage === "he" ? "\u05E2\u05D1\u05E8\u05D9\u05EA" : "\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA"
          : profile.preferredLanguage === "he" ? "Hebrew" : "English"
      );
    }
    if (profile.preferredOrientation) {
      learnedParts.push(
        isHe
          ? profile.preferredOrientation === "portrait" ? "\u05D0\u05E0\u05DB\u05D9" : "\u05D0\u05D5\u05E4\u05E7\u05D9"
          : profile.preferredOrientation
      );
    }
    if (profile.preferredMaxScreens) {
      learnedParts.push(
        isHe
          ? `~${profile.preferredMaxScreens} \u05DE\u05E1\u05DB\u05D9\u05DD`
          : `~${profile.preferredMaxScreens} screens`
      );
    }
  }

  return (
    <div className="space-y-3">
      {/* Header bar — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-amber-500/20 border border-indigo-500/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 15c6.667-6 13.333 0 20-6" />
              <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
              <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
              <path d="M17 6H3" />
              <path d="M21 18H7" />
            </svg>
          </div>
          <div className="text-start">
            <span className="text-sm font-semibold text-white/90">
              Style DNA
            </span>
            {pipelineCount > 0 ? (
              <span className="ms-2 text-[10px] font-medium text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                {isHe
                  ? `\u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA \u05DE\u05BE${pipelineCount} \u05D4\u05E8\u05E6\u05D5\u05EA`
                  : `Personalized from ${pipelineCount} runs`}
              </span>
            ) : (
              <span className="ms-2 text-[10px] font-medium text-white/30">
                {isHe ? "\u05D4\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA \u05DC\u05E1\u05D2\u05E0\u05D5\u05DF \u05E9\u05DC\u05DA" : "Customize your output style"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOverridden && (
            <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
              {isHe ? "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05DC\u05D4\u05E8\u05E6\u05D4 \u05D6\u05D5" : "This run only"}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-white/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="space-y-5 pt-1">

          {/* Learned defaults banner */}
          {pipelineCount > 0 && learnedParts.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 bg-indigo-500/[0.06] rounded-xl border border-indigo-500/10">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="text-xs leading-relaxed">
                <span className="text-indigo-300/90">
                  {isHe
                    ? `ExplainIt \u05DC\u05DE\u05D3 \u05E9\u05D0\u05EA\u05D4 \u05DE\u05E2\u05D3\u05D9\u05E3 `
                    : `ExplainIt noticed you prefer `}
                </span>
                <span className="text-white/80 font-medium">
                  {learnedParts.join(isHe ? ", " : ", ")}
                </span>
                <span className="text-indigo-300/90">
                  {isHe
                    ? ". \u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05DB\u05D1\u05E8 \u05DE\u05D5\u05D7\u05DC\u05D5\u05EA."
                    : ". These are already set for you."}
                </span>
              </div>
            </div>
          )}

          {/* Video Theme */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {isHe ? "\u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0 \u05DC\u05E1\u05E8\u05D8\u05D5\u05DF" : "Video Theme"}
              </label>
              <span className="text-[10px] text-white/25">
                {isHe ? "\u05E6\u05D1\u05E2\u05D9\u05DD, \u05D4\u05D3\u05D2\u05E9\u05D5\u05EA \u05D5\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D5\u05EA" : "Colors, highlights & animations"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {THEME_OPTIONS.map((theme) => {
                const selected = overrides.videoTheme === theme.id;
                const isDefault = profile?.videoTheme === theme.id && pipelineCount > 0;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChange({ ...overrides, videoTheme: theme.id })}
                    className={`relative rounded-lg sm:rounded-xl border transition-all text-start overflow-hidden ${
                      selected
                        ? "border-indigo-500/60 ring-1 ring-indigo-500/30 bg-indigo-500/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Visual preview */}
                    <div className="p-1.5 sm:p-2 pb-0">
                      <ThemePreview theme={theme} selected={selected} />
                    </div>

                    {/* Label */}
                    <div className="px-2 py-1.5 sm:px-3 sm:py-2">
                      <p className={`text-xs sm:text-sm font-semibold ${selected ? "text-white" : "text-white/70"}`}>
                        {isHe ? theme.labelHe : theme.labelEn}
                      </p>
                    </div>

                    {/* Your style badge */}
                    {isDefault && (
                      <div className="absolute top-1 end-1 sm:top-1.5 sm:end-1.5">
                        <span className="text-[8px] sm:text-[9px] font-medium text-indigo-300/70 bg-indigo-500/15 backdrop-blur-sm px-1 sm:px-1.5 py-0.5 rounded-md">
                          {isHe ? "\u05D4\u05E1\u05D2\u05E0\u05D5\u05DF \u05E9\u05DC\u05DA" : "your style"}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail Level */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {isHe ? "\u05E8\u05DE\u05EA \u05E4\u05D9\u05E8\u05D5\u05D8 PDF" : "PDF Detail Level"}
              </label>
              <span className="text-[10px] text-white/25">
                {isHe ? "\u05D4\u05E2\u05E8\u05D5\u05EA, \u05EA\u05D5\u05DB\u05DF \u05E2\u05E0\u05D9\u05D9\u05E0\u05D9\u05DD \u05D5\u05D8\u05D1\u05DC\u05D0\u05D5\u05EA" : "Annotations, TOC & element tables"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {DETAIL_OPTIONS.map((opt) => {
                const selected = overrides.detailLevel === opt.id;
                const isDefault = profile?.detailLevel === opt.id && pipelineCount > 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ ...overrides, detailLevel: opt.id })}
                    className={`relative rounded-lg sm:rounded-xl border transition-all overflow-hidden ${
                      selected
                        ? "border-indigo-500/60 ring-1 ring-indigo-500/30 bg-indigo-500/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* PDF page preview */}
                    <div className="p-2 sm:p-3 pb-0 flex justify-center">
                      <DetailPreview opt={opt} selected={selected} />
                    </div>

                    {/* Label + description */}
                    <div className="px-2 py-1.5 sm:px-3 sm:py-2 text-start">
                      <p className={`text-xs sm:text-sm font-semibold ${selected ? "text-white" : "text-white/70"}`}>
                        {isHe ? opt.labelHe : opt.labelEn}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-white/35 mt-0.5 leading-tight">
                        {isHe ? opt.desc_he : opt.desc_en}
                      </p>
                    </div>

                    {isDefault && (
                      <div className="absolute top-1 end-1 sm:top-1.5 sm:end-1.5">
                        <span className="text-[8px] sm:text-[9px] font-medium text-indigo-300/70 bg-indigo-500/15 backdrop-blur-sm px-1 sm:px-1.5 py-0.5 rounded-md">
                          {isHe ? "\u05D4\u05E1\u05D2\u05E0\u05D5\u05DF \u05E9\u05DC\u05DA" : "your style"}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 pt-1">
            <div className="flex items-center gap-3">
              {isOverridden && (
                <button
                  type="button"
                  onClick={handleResetOverride}
                  className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isHe ? "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E1\u05D2\u05E0\u05D5\u05DF \u05E9\u05DC\u05D9" : "Back to my style"}
                </button>
              )}
              {pipelineCount > 0 && !isOverridden && (
                <button
                  type="button"
                  onClick={handleResetLearned}
                  disabled={resetting}
                  className="text-xs text-white/25 hover:text-white/50 transition disabled:opacity-50"
                >
                  {resetting
                    ? isHe ? "..." : "..."
                    : isHe ? "\u05D0\u05E4\u05E1 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA" : "Reset learned style"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className="text-xs text-green-400">{saveMsg}</span>
              )}
              {isOverridden && (
                <button
                  type="button"
                  onClick={handleSaveAsDefault}
                  disabled={saving}
                  className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 px-2.5 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {saving
                    ? isHe ? "...\u05E9\u05D5\u05DE\u05E8" : "Saving..."
                    : isHe ? "\u05E9\u05DE\u05D5\u05E8 \u05DB\u05E1\u05D2\u05E0\u05D5\u05DF \u05E9\u05DC\u05D9" : "Make this my style"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
