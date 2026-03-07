'use client';

/**
 * Lightweight confetti burst animation.
 * Adapted from ftable/js/confetti.js for React/Next.js.
 * No external dependencies — pure DOM-based particle animation.
 */

interface ConfettiOptions {
  /** Number of confetti pieces (default: 50) */
  count?: number;
  /** Duration in ms before cleanup (default: 3000) */
  duration?: number;
  /** Color palette override */
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#22c55e', // green
  '#ef4444', // red
  '#a855f7', // purple
  '#3b82f6', // blue
  '#fbbf24', // gold
  '#ffffff', // white
];

const STYLE_ID = 'explainit-confetti-style';

function injectKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ei-confetti-fall {
      0% {
        transform: translateY(0) rotate(0deg) scale(1);
        opacity: 1;
      }
      75% {
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg) scale(0.5);
        opacity: 0;
      }
    }
    @keyframes ei-confetti-sway {
      0%, 100% { margin-left: 0; }
      25% { margin-left: 15px; }
      75% { margin-left: -15px; }
    }
  `;
  document.head.appendChild(style);
}

export function triggerConfetti(options: ConfettiOptions = {}): void {
  if (typeof document === 'undefined') return;

  const {
    count = 50,
    duration = 3000,
    colors = DEFAULT_COLORS,
  } = options;

  injectKeyframes();

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '99999',
    overflow: 'hidden',
  });
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    const left = 5 + Math.random() * 90;
    const delay = Math.random() * 600;
    const rotation = Math.random() * 360;
    const fallDuration = 1400 + Math.random() * 1200;
    const shape = Math.random();

    let borderRadius = '2px';
    const width = `${size}px`;
    let height = `${size * 0.6}px`;

    if (shape > 0.66) {
      // Circle
      borderRadius = '50%';
      height = `${size}px`;
    } else if (shape > 0.33) {
      // Square
      borderRadius = '2px';
      height = `${size}px`;
    }
    // else rectangle (default)

    Object.assign(piece.style, {
      position: 'absolute',
      top: '-12px',
      left: `${left}%`,
      width,
      height,
      background: color,
      borderRadius,
      opacity: '1',
      transform: `rotate(${rotation}deg)`,
      animation: `ei-confetti-fall ${fallDuration}ms ${delay}ms ease-in forwards, ei-confetti-sway ${800 + Math.random() * 400}ms ${delay}ms ease-in-out infinite`,
    });

    container.appendChild(piece);
  }

  setTimeout(() => {
    container.remove();
  }, duration);
}
