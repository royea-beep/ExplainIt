"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "../components/header";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

type PlanId = "free" | "pro" | "team";

const PLANS = [
  {
    id: "free" as const,
    nameEn: "Free",
    nameHe: "חינם",
    priceEn: "$0",
    priceHe: "0 ₪",
    periodEn: "/month",
    periodHe: "/חודש",
    pipelines: 3,
    pipelinesLabelEn: "3 pipelines/month",
    pipelinesLabelHe: "3 פעמים בחודש",
    featuresEn: ["Screenshots", "Videos", "PDF export", "Demo page"],
    featuresHe: ["צילומי מסך", "סרטונים", "ייצוא PDF", "עמוד דמו"],
    ctaEn: "Get Started",
    ctaHe: "התחל",
    highlighted: false,
  },
  {
    id: "pro" as const,
    nameEn: "Pro",
    nameHe: "Pro",
    priceEn: "$19",
    priceHe: "$19",
    periodEn: "/month",
    periodHe: "/חודש",
    pipelines: 50,
    pipelinesLabelEn: "50 pipelines/month",
    pipelinesLabelHe: "50 פעמים בחודש",
    featuresEn: ["Everything in Free", "50 pipelines/mo", "Priority support", "Smart Mode"],
    featuresHe: ["הכל בחינם", "50 פעמים בחודש", "תמיכה מועדפת", "מצב חכם"],
    ctaEn: "Subscribe",
    ctaHe: "הרשמה",
    highlighted: true,
  },
  {
    id: "team" as const,
    nameEn: "Team",
    nameHe: "צוות",
    priceEn: "$49",
    priceHe: "$49",
    periodEn: "/month",
    periodHe: "/חודש",
    pipelines: -1,
    pipelinesLabelEn: "Unlimited pipelines",
    pipelinesLabelHe: "פעמים ללא הגבלה",
    featuresEn: ["Everything in Pro", "Unlimited pipelines", "Team dashboard", "API access"],
    featuresHe: ["הכל ב-Pro", "פעמים ללא הגבלה", "לוח צוות", "גישה ל-API"],
    ctaEn: "Upgrade",
    ctaHe: "שדרוג",
    highlighted: false,
  },
];

export default function PricingPage() {
  const { isHe } = useLanguage();
  const { token, loading: authLoading } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = isHe ? "תמחור" : "Pricing";

  const handleCheckout = async (plan: "pro" | "team") => {
    if (!token) {
      setError(isHe ? "התחבר כדי להירשם" : "Sign in to subscribe");
      return;
    }
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || (isHe ? "שגיאה" : "Checkout failed"));
        setLoadingPlan(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(isHe ? "לא התקבל קישור" : "No checkout URL received");
    } catch {
      setError(isHe ? "שגיאת רשת" : "Network error");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" dir={isHe ? "rtl" : "ltr"}>
      <Header />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-2">
            {title}
          </h1>
          <p className="text-white/60 text-center mb-10 max-w-xl mx-auto">
            {isHe
              ? "בחר את התוכנית שמתאימה לך. התחל בחינם, שדרג מתי שתרצה."
              : "Choose the plan that fits you. Start free, upgrade when you need more."}
          </p>

          {error && (
            <div
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-center text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`glass p-6 rounded-2xl flex flex-col ${
                  plan.highlighted
                    ? "ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/10"
                    : ""
                }`}
              >
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white">
                    {isHe ? plan.nameHe : plan.nameEn}
                  </h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold gradient-text">
                      {isHe ? plan.priceHe : plan.priceEn}
                    </span>
                    <span className="text-white/50 text-sm">
                      {isHe ? plan.periodHe : plan.periodEn}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mt-1">
                    {isHe ? plan.pipelinesLabelHe : plan.pipelinesLabelEn}
                  </p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {(isHe ? plan.featuresHe : plan.featuresEn).map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-white/80"
                    >
                      <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <Link
                    href="/"
                    className="w-full py-3 rounded-xl font-semibold text-center bg-white/10 text-white hover:bg-white/20 transition border border-white/10"
                  >
                    {isHe ? plan.ctaHe : plan.ctaEn}
                  </Link>
                ) : token ? (
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!!loadingPlan || authLoading}
                    className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPlan === plan.id
                      ? isHe
                        ? "טוען..."
                        : "Loading..."
                      : isHe
                        ? plan.ctaHe
                        : plan.ctaEn}
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="w-full py-3 rounded-xl font-semibold text-center bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition"
                  >
                    {isHe ? "התחבר כדי להירשם" : "Sign in to subscribe"}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/"
              className="text-white/60 hover:text-white text-sm transition inline-flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 rtl:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              {isHe ? "חזרה לדף הבית" : "Back to home"}
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto text-center text-xs text-white/30">
          ExplainIt — Pricing
        </div>
      </footer>
    </div>
  );
}
