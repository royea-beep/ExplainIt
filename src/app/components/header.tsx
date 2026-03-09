"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/AuthModal";

const NAV_ITEMS = [
  { href: "/", labelHe: "URL Mode", labelEn: "URL Mode" },
  { href: "/editor", labelHe: "Smart Mode", labelEn: "Smart Mode" },
  { href: "/poker", labelHe: "למפעילי פוקר", labelEn: "Poker Ops" },
  { href: "/results", labelHe: "Results", labelEn: "Results" },
  { href: "/pricing", labelHe: "תמחור", labelEn: "Pricing" },
] as const;

export function Header() {
  const pathname = usePathname();
  const { language, isHe, toggleLanguage } = useLanguage();
  const { user, loading: authLoading, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const subtitle = pathname === "/editor"
    ? "Smart Explainer"
    : pathname === "/results"
      ? "Generated Explanations"
      : "Explainer Videos & Docs Generator";

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b border-white/10 px-4 py-4 relative">
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

          <div className="flex items-center gap-2">
            {/* Language toggle — always visible */}
            <button
              onClick={toggleLanguage}
              className="text-sm text-white/60 hover:text-white transition px-3 py-2.5 rounded-lg bg-white/5 min-h-[44px] flex items-center"
              aria-label={`Switch to ${language === "he" ? "English" : "Hebrew"}`}
            >
              {language === "he" ? "EN" : "HE"}
            </button>

            {/* Auth button — always visible */}
            {!authLoading && (
              user ? (
                <div className="flex items-center gap-2 ms-1">
                  <span className="text-xs text-white/50 max-w-[120px] truncate hidden sm:inline" title={user.email}>
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-xs text-white/40 hover:text-white transition px-3 py-2 rounded-lg hover:bg-white/10 min-h-[44px] flex items-center"
                  >
                    {isHe ? "יציאה" : "Sign out"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="text-sm font-medium text-white bg-indigo-600/80 hover:bg-indigo-600 transition px-4 py-2.5 rounded-lg ms-1 min-h-[44px] flex items-center"
                >
                  {isHe ? "התחבר" : "Sign in"}
                </button>
              )
            )}

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2" aria-label="Main navigation">
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
            </nav>

            {/* Hamburger button — mobile only */}
            <button
              className="md:hidden p-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0a0a1a] border-b border-white/10 p-4 flex flex-col gap-3 z-50">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm transition px-3 py-3 rounded-lg min-h-[44px] flex items-center ${
                    isActive
                      ? "text-white bg-indigo-600/40"
                      : "text-white/60 hover:text-white bg-white/5"
                  }`}
                >
                  {isHe ? item.labelHe : item.labelEn}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
