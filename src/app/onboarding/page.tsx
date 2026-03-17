"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "explainit_onboarded";

interface Step {
  icon: string;
  title: string;
  subtitle: string;
  visual: React.ReactNode;
}

const steps: Step[] = [
  {
    icon: "\uD83D\uDD17",
    title: "Paste any URL",
    subtitle:
      "Drop the link to any website, app, or landing page. ExplainIt will scan every screen automatically.",
    visual: (
      <div className="glass p-5 max-w-md mx-auto mt-6 text-left space-y-3">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
          Website URL
        </label>
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-3 border border-white/20">
          <span className="text-white/40 text-sm select-none">https://</span>
          <span className="text-white font-mono">your-website.com</span>
          <span className="ml-auto text-indigo-400 text-xs font-semibold">
            SCAN
          </span>
        </div>
        <p className="text-white/40 text-xs">
          Works with any public or authenticated site
        </p>
      </div>
    ),
  },
  {
    icon: "\u2728",
    title: "AI explains it",
    subtitle:
      "Our AI agents capture screenshots, narrate each step, and generate a full explainer video + annotated PDF.",
    visual: (
      <div className="glass p-5 max-w-md mx-auto mt-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300">
            1
          </div>
          <div className="flex-1 h-2 rounded-full bg-indigo-500/30 overflow-hidden">
            <div className="h-full w-full bg-indigo-500 rounded-full" />
          </div>
          <span className="text-xs text-green-400 font-semibold">Done</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-300">
            2
          </div>
          <div className="flex-1 h-2 rounded-full bg-amber-500/30 overflow-hidden">
            <div className="h-full w-3/4 bg-amber-500 rounded-full" />
          </div>
          <span className="text-xs text-amber-400 font-semibold">75%</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/40">
            3
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/10" />
          <span className="text-xs text-white/30 font-semibold">Pending</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Summary", "Key Points", "Screenshots"].map((label) => (
            <div
              key={label}
              className="bg-white/5 rounded-lg p-2 text-center text-xs text-white/60 border border-white/10"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "\uD83D\uDCE4",
    title: "Export & share",
    subtitle:
      "Download as MP4 video, annotated PDF, or shareable link. Send to clients, post on social, embed anywhere.",
    visual: (
      <div className="glass p-5 max-w-md mx-auto mt-6 space-y-3">
        {[
          {
            icon: "\uD83C\uDFAC",
            label: "MP4 Video",
            desc: "Explainer video with narration",
          },
          {
            icon: "\uD83D\uDCC4",
            label: "PDF Guide",
            desc: "Annotated screenshots + steps",
          },
          {
            icon: "\uD83D\uDD17",
            label: "Share Link",
            desc: "Interactive demo page",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10 hover:border-indigo-500/30 transition"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">{item.label}</p>
              <p className="text-white/40 text-xs">{item.desc}</p>
            </div>
            <svg
              className="w-5 h-5 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If already onboarded, redirect to main app
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true") {
      router.replace("/");
    }
  }, [router]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    router.push("/");
  };

  const skip = () => {
    finish();
  };

  const next = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  if (!mounted) return null;

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Skip button */}
      <button
        onClick={skip}
        className="absolute top-6 right-6 text-sm text-white/40 hover:text-white/70 transition"
      >
        Skip
      </button>

      {/* Step content */}
      <div className="w-full max-w-lg text-center animate-fade-in" key={current}>
        <div className="text-6xl mb-6">{step.icon}</div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          {step.title}
        </h1>
        <p className="text-white/60 text-lg leading-relaxed max-w-md mx-auto">
          {step.subtitle}
        </p>
        {step.visual}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-3 mt-10">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i === current
                ? "bg-indigo-500 w-8"
                : i < current
                  ? "bg-indigo-500/50"
                  : "bg-white/20"
            }`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-4 mt-8">
        {current > 0 && (
          <button
            onClick={prev}
            className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition"
          >
            Back
          </button>
        )}
        <button
          onClick={next}
          className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition"
        >
          {isLast ? "Get Started" : "Next"}
        </button>
      </div>

      {/* Step counter */}
      <p className="text-white/30 text-sm mt-6">
        {current + 1} / {steps.length}
      </p>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}
