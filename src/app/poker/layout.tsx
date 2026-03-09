import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ExplainIt for Poker Operators — Auto-generate club join guides",
  description:
    "Stop explaining to players how to join your club. Generate professional explainer videos + PDF guides for ClubGG, PPPoker, PokerBros in minutes. Share via WhatsApp.",
  openGraph: {
    title: "ExplainIt — Poker Club Explainer Generator",
    description:
      "Generate step-by-step video guides for your poker club. ClubGG, PPPoker, PokerBros. Share via WhatsApp in one click.",
    type: "website",
    siteName: "ExplainIt",
    images: [
      {
        url: "/demo/clubgg/screenshots/step_1_ya4leyew.png",
        width: 400,
        height: 780,
        alt: "ClubGG app download step — ExplainIt demo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExplainIt — Poker Club Explainer Generator",
    description:
      "Auto-generate explainer videos for your poker club. Share via WhatsApp.",
    images: ["/demo/clubgg/screenshots/step_1_ya4leyew.png"],
  },
};

export default function PokerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
