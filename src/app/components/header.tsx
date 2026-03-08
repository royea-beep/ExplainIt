"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

const NAV_ITEMS = [
  { href: "/", labelHe: "URL Mode", labelEn: "URL Mode" },
  { href: "/editor", labelHe: "Smart Mode", labelEn: "Smart Mode" },
  { href: "/results", labelHe: "Results", labelEn: "Results" },
  { href: "/pricing", labelHe: "תמחור", labelEn: "Pricing" },
] as const;

export function Header() {
  const pathname = usePathname();
  const { language, isHe, toggleLanguage } = useLanguage();

  const subtitle = pathname === "/editor"
    ? "Smart Explainer"
    : pathname === "/results"
      ? "Generated Explanations"
      : "Explainer Videos & Docs Generator";

  return (
    <header className="border-b border-white/10 px-4 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-500 flex items-center justify-center text-white font-bold text-lg">
              E
            </div>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">ExplainIt</h1>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>
        </div>
        <nav className="flex gap-2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition px-3 py-1.5 rounded-lg ${
                  isActive
                    ? "text-white bg-indigo-600/40"
                    : "text-white/60 hover:text-white bg-white/5"
                }`}
              >
                {isHe ? item.labelHe : item.labelEn}
              </Link>
            );
          })}
          <button
            onClick={toggleLanguage}
            className="text-sm text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg bg-white/5"
            aria-label={`Switch to ${language === "he" ? "English" : "Hebrew"}`}
          >
            {language === "he" ? "EN" : "HE"}
          </button>
        </nav>
      </div>
    </header>
  );
}
