"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "../components/header";
import { useLanguage } from "@/lib/language-context";

interface StepHighlight {
  id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface ProjectStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionLabel: string;
  mockupHtml?: string;
  highlights: StepHighlight[];
  editable: boolean;
}

interface SmartProject {
  id: string;
  title: string;
  description: string;
  platform: string;
  language: "he" | "en";
  steps: ProjectStep[];
  clarifyingQuestions?: string[];
  ready: boolean;
  createdAt: string;
}

type Phase = "input" | "questions" | "editor" | "generating" | "done";

export default function EditorPage() {
  const { language, isHe } = useLanguage();
  const [phase, setPhase] = useState<Phase>("input");
  const [request, setRequest] = useState("");
  const [project, setProject] = useState<SmartProject | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = useCallback(async (req: string, ans: Record<string, string>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: req, answers: ans, language }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data: SmartProject = await res.json();
      setProject(data);

      if (!data.ready && data.clarifyingQuestions && data.clarifyingQuestions.length > 0) {
        setPhase("questions");
      } else if (data.ready) {
        setPhase("editor");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [language]);

  const handleInitialSubmit = () => {
    if (!request.trim() || isSubmitting) return;
    submitRequest(request, {});
  };

  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});

  const getQuestionKey = (question: string, index: number): string => {
    if (question.includes("Club ID") || question.includes("\u05E7\u05D5\u05D3") || question.includes("ID")) return "clubId";
    if (question.includes("\u05E9\u05DD") || question.includes("name")) return "clubName";
    if (question.includes("Agent")) return "agentId";
    if (question.includes("\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4") || question.includes("app")) return "appName";
    return `q${index}`;
  };

  const handleAnswersSubmit = () => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    if (project?.clarifyingQuestions) {
      for (let i = 0; i < project.clarifyingQuestions.length; i++) {
        const key = getQuestionKey(project.clarifyingQuestions[i], i);
        if (!answers[key]?.trim()) {
          errors[key] = isHe ? "\u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4" : "This field is required";
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setAnswerErrors(errors);
      return;
    }
    setAnswerErrors({});
    submitRequest(request, answers);
  };

  const updateStep = (stepId: string, field: keyof ProjectStep, value: string) => {
    if (!project) return;
    setProject({
      ...project,
      steps: project.steps.map((s) =>
        s.id === stepId ? { ...s, [field]: value } : s
      ),
    });
  };

  const removeStep = (stepId: string) => {
    if (!project) return;
    setProject({
      ...project,
      steps: project.steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    });
  };

  const addStep = () => {
    if (!project) return;
    const newStep: ProjectStep = {
      id: crypto.randomUUID().slice(0, 8),
      order: project.steps.length + 1,
      title: isHe ? "\u05E9\u05DC\u05D1 \u05D7\u05D3\u05E9" : "New Step",
      description: isHe ? "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05E9\u05DC\u05D1" : "Step description",
      actionLabel: isHe ? "\u05E4\u05E2\u05D5\u05DC\u05D4" : "Action",
      highlights: [],
      editable: true,
    };
    setProject({ ...project, steps: [...project.steps, newStep] });
    setEditingStep(newStep.id);
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    if (!project) return;
    const idx = project.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= project.steps.length) return;

    const newSteps = [...project.steps];
    [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
    setProject({
      ...project,
      steps: newSteps.map((s, i) => ({ ...s, order: i + 1 })),
    });
  };

  const handleGenerate = async () => {
    if (!project) return;
    setPhase("generating");
    setError(null);

    setGeneratingStatus(isHe ? "...\u05DE\u05D9\u05D9\u05E6\u05E8 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05E7\u05D0\u05E4" : "Generating mockup images...");

    try {
      setGeneratingStatus(isHe ? "...\u05DE\u05D9\u05D9\u05E6\u05E8 \u05E1\u05E8\u05D8\u05D5\u05E0\u05D9 \u05D4\u05E1\u05D1\u05E8" : "Generating explainer videos...");

      const res = await fetch("/api/smart/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setGeneratingStatus(isHe ? "!\u05D4\u05D5\u05E9\u05DC\u05DD" : "Complete!");
      setPhase("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGeneratingStatus("");
      setError(msg);
      // Allow returning to editor to fix and retry
      setPhase("editor");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start justify-between gap-3" role="alert">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-400/60 hover:text-red-400 shrink-0"
                aria-label="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Phase: Input */}
          {phase === "input" && (
            <section className="glass p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold gradient-text">
                  {isHe ? "\u05E1\u05E4\u05E8 \u05DC\u05E0\u05D5 \u05DE\u05D4 \u05DC\u05D4\u05E1\u05D1\u05D9\u05E8" : "Tell us what to explain"}
                </h2>
                <p className="text-white/50 text-sm">
                  {isHe
                    ? ".\u05EA\u05D0\u05E8 \u05D1\u05E9\u05E4\u05D4 \u05D7\u05D5\u05E4\u05E9\u05D9\u05EA. \u05E0\u05E9\u05D0\u05DC \u05E9\u05D0\u05DC\u05D5\u05EA \u05E8\u05E7 \u05D0\u05DD \u05E6\u05E8\u05D9\u05DA"
                    : "Describe freely. We'll only ask questions if needed."}
                </p>
              </div>

              <label htmlFor="smart-input" className="sr-only">
                {isHe ? "\u05DE\u05D4 \u05EA\u05E8\u05E6\u05D4 \u05DC\u05D4\u05E1\u05D1\u05D9\u05E8?" : "What do you want to explain?"}
              </label>
              <textarea
                id="smart-input"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder={
                  isHe
                    ? '\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: "\u05D9\u05E9 \u05DC\u05D9 \u05DE\u05D5\u05E2\u05D3\u05D5\u05DF \u05E4\u05D5\u05E7\u05E8 \u05D1-ClubGG \u05D5\u05D0\u05E0\u05D9 \u05E8\u05D5\u05E6\u05D4 \u05DC\u05D4\u05E1\u05D1\u05D9\u05E8 \u05DC\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05D0\u05D9\u05DA \u05DC\u05D4\u05E6\u05D8\u05E8\u05E3"'
                    : 'e.g. "I have a poker club on ClubGG and want to explain to players how to join"'
                }
                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-base leading-relaxed"
                dir={isHe ? "rtl" : "ltr"}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleInitialSubmit}
                  disabled={!request.trim() || isSubmitting}
                  className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                    !request.trim() || isSubmitting
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isHe ? "...\u05DE\u05E2\u05D1\u05D3" : "Processing..."}
                    </span>
                  ) : (
                    isHe ? "!\u05E7\u05D3\u05D9\u05DE\u05D4" : "Let's Go!"
                  )}
                </button>
              </div>

              {/* Examples */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-white/30 mb-3">{isHe ? ":\u05D3\u05D5\u05D2\u05DE\u05D0\u05D5\u05EA" : "Examples:"}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    isHe ? "\u05D9\u05E9 \u05DC\u05D9 \u05DE\u05D5\u05E2\u05D3\u05D5\u05DF \u05E4\u05D5\u05E7\u05E8 \u05D1-ClubGG" : "I have a poker club on ClubGG",
                    isHe ? "\u05D0\u05E0\u05D9 \u05E8\u05D5\u05E6\u05D4 \u05DC\u05D4\u05E1\u05D1\u05D9\u05E8 \u05D0\u05D9\u05DA \u05DC\u05D4\u05D9\u05E8\u05E9\u05DD \u05DC-PPPoker" : "Explain how to join PPPoker club",
                    isHe ? "\u05E6\u05E8\u05D9\u05DA \u05D4\u05E1\u05D1\u05E8 \u05DC\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05D0\u05D9\u05DA \u05DC\u05D4\u05E6\u05D8\u05E8\u05E3 \u05DC-PokerBros" : "Guide for joining PokerBros club",
                  ].map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRequest(ex)}
                      className="text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Phase: Questions */}
          {phase === "questions" && project?.clarifyingQuestions && (
            <section className="glass p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">?</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {isHe ? "\u05E8\u05E7 \u05DB\u05DE\u05D4 \u05E4\u05E8\u05D8\u05D9\u05DD \u05E7\u05D8\u05E0\u05D9\u05DD" : "Just a few details"}
                </h2>
                <p className="text-white/50 text-sm">
                  {isHe ? "\u05E6\u05E8\u05D9\u05DB\u05D9\u05DD \u05D0\u05EA \u05D6\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05DB\u05D9\u05DF \u05D4\u05E1\u05D1\u05E8 \u05DE\u05D3\u05D5\u05D9\u05E7" : "We need this to create an accurate explainer"}
                </p>
              </div>

              <div className="space-y-4">
                {project.clarifyingQuestions.map((q, i) => {
                  const key = getQuestionKey(q, i);

                  return (
                    <div key={i}>
                      <label className="block text-sm text-white/70 mb-2">{q}</label>
                      <input
                        type="text"
                        value={answers[key] || ""}
                        onChange={(e) => {
                          setAnswers({ ...answers, [key]: e.target.value });
                          if (answerErrors[key]) setAnswerErrors({ ...answerErrors, [key]: "" });
                        }}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-1 transition-all ${
                          answerErrors[key] ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : "border-white/10 focus:border-indigo-500 focus:ring-indigo-500"
                        }`}
                        dir={isHe ? "rtl" : "ltr"}
                        placeholder={key === "clubId" ? "e.g. 123456" : ""}
                      />
                      {answerErrors[key] && (
                        <p className="text-xs text-red-400 mt-1">{answerErrors[key]}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPhase("input"); setAnswerErrors({}); }}
                  className="px-6 py-4 rounded-xl font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition"
                >
                  {isHe ? "\u05D7\u05D6\u05D5\u05E8" : "Back"}
                </button>
              <button
                type="button"
                onClick={handleAnswersSubmit}
                disabled={isSubmitting}
                className="flex-1 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isHe ? "...\u05DE\u05E2\u05D1\u05D3" : "Processing..."}
                  </span>
                ) : (
                  isHe ? "\u05E6\u05D5\u05E8 \u05D4\u05E1\u05D1\u05E8" : "Generate Explainer"
                )}
              </button>
              </div>
            </section>
          )}

          {/* Phase: Editor */}
          {phase === "editor" && project && (
            <>
              {/* Project header */}
              <section className="glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{project.title}</h2>
                  <p className="text-sm text-white/40 mt-1">
                    {project.steps.length} {isHe ? "\u05E9\u05DC\u05D1\u05D9\u05DD" : "steps"} | {project.platform}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    <span className="text-lg leading-none">+</span>
                    {isHe ? "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05DC\u05D1" : "Add Step"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold px-5 py-2 rounded-lg hover:shadow-lg hover:shadow-indigo-500/25 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    {isHe ? "PDF + \u05D9\u05D9\u05E6\u05E8 \u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Generate Videos + PDF"}
                  </button>
                </div>
              </section>

              {/* Steps */}
              <div className="space-y-4">
                {project.steps.map((step, idx) => (
                  <section key={step.id} className="glass overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      {/* Step number + mockup preview */}
                      <div className="w-full md:w-80 bg-black/30 p-4 flex flex-col items-center justify-start border-s border-white/5 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg mb-3">
                          {step.order}
                        </div>
                        {step.mockupHtml && (
                          <iframe
                            srcDoc={step.mockupHtml}
                            sandbox="allow-same-origin"
                            className="w-[160px] h-[300px] border-0 rounded-lg pointer-events-none"
                            title={`${step.title} mockup`}
                          />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="flex-1 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          {editingStep === step.id ? (
                            <input
                              type="text"
                              value={step.title}
                              onChange={(e) => updateStep(step.id, "title", e.target.value)}
                              className="flex-1 bg-white/5 border border-indigo-500/50 rounded-lg px-3 py-2 text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                              dir={isHe ? "rtl" : "ltr"}
                              autoFocus
                            />
                          ) : (
                            <h3 className="text-lg font-bold text-white flex-1">{step.title}</h3>
                          )}

                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveStep(step.id, "up")}
                              disabled={idx === 0}
                              className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 transition"
                              aria-label={isHe ? "\u05D4\u05E2\u05DC\u05D4 \u05DC\u05DE\u05E2\u05DC\u05D4" : "Move up"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(step.id, "down")}
                              disabled={idx === project.steps.length - 1}
                              className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 transition"
                              aria-label={isHe ? "\u05D4\u05D5\u05E8\u05D3 \u05DC\u05DE\u05D8\u05D4" : "Move down"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStep(editingStep === step.id ? null : step.id)}
                              className={`p-1.5 rounded-md transition ${editingStep === step.id ? "text-indigo-400 bg-indigo-500/10" : "text-white/30 hover:text-white hover:bg-white/10"}`}
                              aria-label={isHe ? "\u05E2\u05E8\u05D5\u05DA" : "Edit"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStep(step.id)}
                              className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                              aria-label={isHe ? "\u05DE\u05D7\u05E7 \u05E9\u05DC\u05D1" : "Delete step"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>

                        {editingStep === step.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-white/40 block mb-1">{isHe ? "\u05EA\u05D9\u05D0\u05D5\u05E8" : "Description"}</label>
                              <textarea
                                value={step.description}
                                onChange={(e) => updateStep(step.id, "description", e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-indigo-500 resize-none h-20"
                                dir={isHe ? "rtl" : "ltr"}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-white/40 block mb-1">{isHe ? "\u05E4\u05E2\u05D5\u05DC\u05D4" : "Action Label"}</label>
                              <input
                                type="text"
                                value={step.actionLabel}
                                onChange={(e) => updateStep(step.id, "actionLabel", e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-indigo-500"
                                dir={isHe ? "rtl" : "ltr"}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingStep(null)}
                              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
                            >
                              {isHe ? "\u05E1\u05D9\u05D5\u05DD \u05E2\u05E8\u05D9\u05DB\u05D4" : "Done Editing"}
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-white/60 leading-relaxed">{step.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs bg-indigo-600/20 text-indigo-300 px-2.5 py-1 rounded-md font-medium">
                                {step.actionLabel}
                              </span>
                              {step.highlights.map((h) => (
                                <span
                                  key={h.id}
                                  className="text-xs px-2 py-1 rounded-md font-medium"
                                  style={{ backgroundColor: h.color + "20", color: h.color }}
                                >
                                  {h.label}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              {/* Bottom generate bar */}
              <div className="glass p-4 flex items-center justify-between sticky bottom-4">
                <p className="text-sm text-white/50">
                  {project.steps.length} {isHe ? "\u05E9\u05DC\u05D1\u05D9\u05DD \u05DE\u05D5\u05DB\u05E0\u05D9\u05DD" : "steps ready"}
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="bg-gradient-to-r from-indigo-600 to-amber-500 text-white font-bold px-8 py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  {isHe ? "\u05D9\u05D9\u05E6\u05E8 \u05D4\u05DB\u05DC" : "Generate All"}
                </button>
              </div>
            </>
          )}

          {/* Phase: Generating */}
          {phase === "generating" && (
            <section className="glass p-12 text-center space-y-6" aria-live="polite">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-xl font-bold text-white">
                {isHe ? "...\u05DE\u05D9\u05D9\u05E6\u05E8 \u05D0\u05EA \u05D4\u05D4\u05E1\u05D1\u05E8\u05D9\u05DD" : "Generating explanations..."}
              </h2>
              <p className="text-white/50">{generatingStatus}</p>
            </section>
          )}

          {/* Phase: Done */}
          {phase === "done" && (
            <section className="glass p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isHe ? "!\u05D4\u05D4\u05E1\u05D1\u05E8\u05D9\u05DD \u05DE\u05D5\u05DB\u05E0\u05D9\u05DD" : "Explanations Ready!"}
              </h2>
              <p className="text-white/50">
                {isHe
                  ? "\u05D4\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD, \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA, \u05D5-PDF \u05E0\u05D5\u05E6\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4"
                  : "Videos, images, and PDF have been generated successfully"}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/results"
                  className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl hover:shadow-lg transition"
                >
                  {isHe ? "\u05E6\u05E4\u05D4 \u05D1\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA" : "View Results"}
                </Link>
                <button
                  type="button"
                  onClick={() => setPhase("editor")}
                  className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl transition"
                >
                  {isHe ? "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E2\u05E8\u05D9\u05DB\u05D4" : "Back to Editor"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPhase("input"); setProject(null); setRequest(""); setAnswers({}); setError(null); }}
                  className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl transition"
                >
                  {isHe ? "\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8 \u05D7\u05D3\u05E9" : "New Project"}
                </button>
              </div>
            </section>
          )}

        </div>
      </main>

      <footer className="border-t border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto text-center text-xs text-white/30">
          ExplainIt v1.0
        </div>
      </footer>
    </div>
  );
}
