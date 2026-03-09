'use client';

import { useState, useRef, useEffect } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://explainit-one.vercel.app';
const SHARE_MESSAGE = 'Check out ExplainIt — auto-generate video tutorials for any website!';

function buildUrl(platform: string) {
  const u = new URL(SITE_URL);
  u.searchParams.set('utm_source', platform);
  u.searchParams.set('utm_medium', 'share');
  u.searchParams.set('utm_campaign', 'share_button');
  return u.toString();
}

const platforms = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: 'hover:border-green-500 hover:text-green-400 hover:shadow-green-500/30',
    href: () =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_MESSAGE + '\n' + buildUrl('whatsapp'))}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.347 0-4.524-.802-6.252-2.147l-.367-.298-3.029 1.015 1.015-3.029-.298-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: 'hover:border-sky-500 hover:text-sky-400 hover:shadow-sky-500/30',
    href: () =>
      `https://t.me/share/url?url=${encodeURIComponent(buildUrl('telegram'))}&text=${encodeURIComponent(SHARE_MESSAGE)}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    color: 'hover:border-blue-400 hover:text-blue-400 hover:shadow-blue-400/30',
    href: () =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_MESSAGE)}&url=${encodeURIComponent(buildUrl('twitter'))}`,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export function ShareButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(buildUrl('copy'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
      {/* Expanded panel */}
      {open && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl shadow-2xl animate-fade-in">
          {platforms.map((p) => (
            <a
              key={p.key}
              href={p.href()}
              target="_blank"
              rel="noopener noreferrer"
              title={p.label}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all duration-200 ${p.color} hover:scale-110 hover:shadow-lg`}
            >
              {p.icon}
            </a>
          ))}

          {/* Copy link */}
          <button
            onClick={copyLink}
            title="Copy link"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all duration-200 hover:border-amber-400 hover:text-amber-400 hover:shadow-amber-400/30 hover:scale-110 hover:shadow-lg"
          >
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Toast */}
      {copied && (
        <span className="absolute -top-10 right-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-sm whitespace-nowrap animate-fade-in">
          Link copied!
        </span>
      )}

      {/* FAB trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Share"
        className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
          open
            ? 'bg-white/10 border border-white/20 text-white rotate-45'
            : 'bg-gradient-to-br from-indigo-500 to-amber-500 text-white hover:scale-110 hover:shadow-indigo-500/40'
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
        </svg>
      </button>
    </div>
  );
}
