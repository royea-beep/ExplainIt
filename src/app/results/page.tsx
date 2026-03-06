"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "../components/header";
import { useLanguage } from "@/lib/language-context";

interface ExportItem {
  name: string;
  path: string;
  type: "screenshot" | "video" | "pdf" | "markdown" | "json" | "other";
  size: number;
  modified: string;
  servePath: string;
}

interface ExportRun {
  id: string;
  projectName: string;
  generatedAt: string;
  totalScreens: number;
  totalVideos: number;
  screenshots: ExportItem[];
  videos: ExportItem[];
  docs: ExportItem[];
  demoPagePath?: string;
}

type ViewMode = "grid" | "list";
type TabId = "all" | "screenshots" | "videos" | "docs";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function screenNameFromFile(name: string): string {
  return name
    .replace(/\.(png|html|pdf|md|svg)$/i, "")
    .replace(/_[a-f0-9]{8}$/, "")
    .replace(/_thumb$/, "")
    .replace(/___/g, " > ")
    .replace(/_/g, " ");
}

export default function ResultsPage() {
  const { language, isHe } = useLanguage();
  const [run, setRun] = useState<ExportRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItem, setSelectedItem] = useState<ExportItem | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video" | "pdf" | "markdown" | null>(null);
  const [mdContent, setMdContent] = useState<string>("");

  const fetchExports = useCallback(async () => {
    try {
      const res = await fetch("/api/exports");
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      if (data.runs && data.runs.length > 0) {
        setRun(data.runs[0]);
      } else {
        setRun(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const openItem = async (item: ExportItem) => {
    setSelectedItem(item);
    if (item.type === "screenshot") {
      setLightboxType("image");
    } else if (item.type === "video") {
      setLightboxType("video");
    } else if (item.type === "pdf") {
      setLightboxType("pdf");
    } else if (item.type === "markdown") {
      setLightboxType("markdown");
      try {
        const res = await fetch(item.servePath);
        const text = await res.text();
        setMdContent(text);
      } catch {
        setMdContent("Failed to load markdown content.");
      }
    }
  };

  const closeLightbox = useCallback(() => {
    setSelectedItem(null);
    setLightboxType(null);
    setMdContent("");
  }, []);

  // Escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedItem) {
        closeLightbox();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, closeLightbox]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">{isHe ? "...\u05D8\u05D5\u05E2\u05DF" : "Loading exports..."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center glass p-8 max-w-md" role="alert">
            <p className="text-red-400 mb-4">{error}</p>
            <button type="button" onClick={fetchExports} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">
              {isHe ? "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1" : "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!run || (run.totalScreens === 0 && run.totalVideos === 0 && run.docs.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center glass p-12 max-w-lg">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0h.008v.008H15.75V15zm-6-3h.008v.008H9.75V12zm3 0h.008v.008H12.75V12zM9.75 15h.008v.008H9.75V15z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{isHe ? "\u05D0\u05D9\u05DF \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF" : "No exports yet"}</h2>
            <p className="text-white/50 mb-6">{isHe ? ".\u05D4\u05E4\u05E7 \u05D0\u05EA \u05D4\u05D4\u05E1\u05D1\u05E8 \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF \u05E9\u05DC\u05DA" : "Generate your first explainer to see results here."}</p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/"
                className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                {isHe ? "URL Mode" : "Go to Generator"}
              </Link>
              <Link
                href="/editor"
                className="inline-block bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Smart Mode
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allItems: (ExportItem & { category: string })[] = [
    ...run.screenshots.map((s) => ({ ...s, category: "Screenshot" })),
    ...run.videos.map((v) => ({ ...v, category: "Video" })),
    ...run.docs.map((d) => ({ ...d, category: "Document" })),
  ];

  const filteredItems =
    tab === "all"
      ? allItems
      : tab === "screenshots"
      ? allItems.filter((i) => i.category === "Screenshot")
      : tab === "videos"
      ? allItems.filter((i) => i.category === "Video")
      : allItems.filter((i) => i.category === "Document");

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all", label: isHe ? "\u05D4\u05DB\u05DC" : "All", count: allItems.length },
    { id: "screenshots", label: isHe ? "\u05E6\u05D9\u05DC\u05D5\u05DE\u05D9\u05DD" : "Screenshots", count: run.screenshots.length },
    { id: "videos", label: isHe ? "\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Videos", count: run.videos.length },
    { id: "docs", label: isHe ? "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" : "Documents", count: run.docs.length },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Project Info Bar */}
          <div className="glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">{run.projectName}</h2>
              {run.generatedAt && (
                <p className="text-sm text-white/40 mt-1">{formatDate(run.generatedAt, language)}</p>
              )}
            </div>
            <div className="flex gap-6">
              <Stat value={run.totalScreens} label={isHe ? "\u05E6\u05D9\u05DC\u05D5\u05DE\u05D9\u05DD" : "Screenshots"} color="text-indigo-400" />
              <Stat value={run.totalVideos} label={isHe ? "\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Videos"} color="text-amber-400" />
              <Stat value={run.docs.length} label={isHe ? "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" : "Documents"} color="text-green-400" />
            </div>
          </div>

          {/* Demo Page Banner */}
          {run.demoPagePath && (
            <button
              type="button"
              onClick={() =>
                openItem({
                  name: "Demo Page",
                  path: "videos/index.html",
                  type: "video",
                  size: 0,
                  modified: "",
                  servePath: run.demoPagePath!,
                })
              }
              className="w-full glass p-4 flex items-center justify-between hover:bg-white/[0.08] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-amber-500 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
                <div className="text-start">
                  <p className="font-semibold text-white">{isHe ? "\u05E2\u05DE\u05D5\u05D3 \u05D3\u05DE\u05D5 - \u05D2\u05DC\u05E8\u05D9\u05D9\u05EA \u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Demo Page - All Videos Gallery"}</p>
                  <p className="text-xs text-white/40">{isHe ? "\u05DC\u05D7\u05E5 \u05DC\u05E4\u05EA\u05D9\u05D7\u05EA \u05E2\u05DE\u05D5\u05D3 \u05D4\u05D3\u05DE\u05D5 \u05E2\u05DD \u05DB\u05DC \u05D4\u05E1\u05E8\u05D8\u05D5\u05E0\u05D9\u05DD" : "Click to open the interactive demo page with all video explainers"}</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-white/30 group-hover:text-white/60 transition rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}

          {/* Tabs + View Toggle */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    tab === t.id
                      ? "bg-indigo-600 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {t.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-white/20" : "bg-white/10"}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
                aria-label={isHe ? "\u05EA\u05E6\u05D5\u05D2\u05EA \u05E8\u05E9\u05EA" : "Grid view"}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
                aria-label={isHe ? "\u05EA\u05E6\u05D5\u05D2\u05EA \u05E8\u05E9\u05D9\u05DE\u05D4" : "List view"}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content Grid / List */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => openItem(item)}
                  className="glass p-0 overflow-hidden text-start hover:border-indigo-500/40 transition-all group"
                >
                  <div className="h-44 bg-black/30 relative overflow-hidden">
                    {item.type === "screenshot" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.servePath}
                        alt={screenNameFromFile(item.name)}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileIcon type={item.type} />
                      </div>
                    )}
                    <span
                      className={`absolute top-2 start-2 text-[10px] font-bold px-2 py-1 rounded-md ${
                        item.category === "Screenshot"
                          ? "bg-indigo-600/80 text-indigo-100"
                          : item.category === "Video"
                          ? "bg-amber-600/80 text-amber-100"
                          : "bg-green-600/80 text-green-100"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-white truncate">{screenNameFromFile(item.name)}</p>
                    <p className="text-xs text-white/30 mt-1">{formatSize(item.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/40 font-medium">
                    <th className="text-start px-4 py-3">{isHe ? "\u05E9\u05DD" : "Name"}</th>
                    <th className="text-start px-4 py-3 w-24">{isHe ? "\u05E1\u05D5\u05D2" : "Type"}</th>
                    <th className="text-start px-4 py-3 w-20">{isHe ? "\u05D2\u05D5\u05D3\u05DC" : "Size"}</th>
                    <th className="text-start px-4 py-3 w-20">{isHe ? "\u05E4\u05E2\u05D5\u05DC\u05D4" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.path} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white truncate max-w-[200px]">{screenNameFromFile(item.name)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                          item.category === "Screenshot"
                            ? "bg-indigo-600/20 text-indigo-300"
                            : item.category === "Video"
                            ? "bg-amber-600/20 text-amber-300"
                            : "bg-green-600/20 text-green-300"
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40">{formatSize(item.size)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                        >
                          {isHe ? "\u05E4\u05EA\u05D7" : "Open"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto text-center text-xs text-white/30">
          ExplainIt v1.0 - Automated Explainer Video & Documentation Generator
        </div>
      </footer>

      {/* Lightbox / Viewer */}
      {selectedItem && lightboxType && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={screenNameFromFile(selectedItem.name)}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-medium text-sm">{screenNameFromFile(selectedItem.name)}</h3>
              <span className="text-xs text-white/30">{formatSize(selectedItem.size)}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={selectedItem.servePath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 transition"
              >
                {isHe ? "\u05E4\u05EA\u05D7 \u05D1\u05D8\u05D0\u05D1 \u05D7\u05D3\u05E9" : "Open in new tab"}
              </a>
              <a
                href={selectedItem.servePath}
                download
                className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 transition"
              >
                {isHe ? "\u05D4\u05D5\u05E8\u05D3" : "Download"}
              </a>
              <button
                type="button"
                onClick={closeLightbox}
                className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
                aria-label={isHe ? "\u05E1\u05D2\u05D5\u05E8" : "Close"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {lightboxType === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedItem.servePath}
                alt={screenNameFromFile(selectedItem.name)}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
            {lightboxType === "video" && (
              <iframe
                src={selectedItem.servePath}
                className="w-full h-full max-w-4xl rounded-lg shadow-2xl bg-black"
                title={screenNameFromFile(selectedItem.name)}
              />
            )}
            {lightboxType === "pdf" && (
              <iframe
                src={selectedItem.servePath}
                className="w-full h-full max-w-4xl rounded-lg shadow-2xl bg-white"
                title={screenNameFromFile(selectedItem.name)}
              />
            )}
            {lightboxType === "markdown" && (
              <div className="max-w-3xl w-full glass p-8 overflow-auto max-h-full">
                <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {mdContent}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function FileIcon({ type }: { type: ExportItem["type"] }) {
  if (type === "video") {
    return (
      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
      </div>
    );
  }
  if (type === "pdf") {
    return (
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
    );
  }
  if (type === "markdown") {
    return (
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
        <span className="text-2xl font-bold text-green-400">MD</span>
      </div>
    );
  }
  return (
    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
      <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </div>
  );
}
