"use client";

import React, { useState } from "react";

function WanderingEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <style>{`
        @keyframes eyeLook {
          0%, 12% { transform: translateX(0); }
          22%, 34% { transform: translateX(-2.2px); }
          46%, 58% { transform: translateX(2.2px); }
          70%, 82% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        @keyframes eyeBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          94% { transform: scaleY(0.12); }
        }
        .wandering-eye-lid { animation: eyeBlink 4.2s ease-in-out infinite; transform-origin: 12px 12px; }
        .wandering-eye-pupil { animation: eyeLook 4.2s ease-in-out infinite; transform-origin: 12px 12px; }
        @media (prefers-reduced-motion: reduce) {
          .wandering-eye-lid, .wandering-eye-pupil { animation: none; }
        }
      `}</style>
      <g className="wandering-eye-lid">
        <ellipse cx="12" cy="12" rx="9" ry="5.4" stroke="currentColor" strokeWidth="1.6" />
      </g>
      <circle className="wandering-eye-pupil" cx="12" cy="12" r="2.8" fill="currentColor" />
    </svg>
  );
}

function ClosedEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 12s3.5-5.5 9-5.5S21 12 21 12s-3.5 5.5-9 5.5S3 12 3 12z" opacity="0" />
      <path d="M3.5 12c1.8-2.2 4.6-4 8.5-4s6.7 1.8 8.5 4" />
      <line x1="3.5" y1="18.5" x2="20.5" y2="5.5" />
    </svg>
  );
}

export function PasswordInput({
  className = "",
  iconClassName = "text-[#5b6f85]",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { iconClassName?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 ${iconClassName}`}
        aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
        tabIndex={-1}
      >
        {visible ? <ClosedEye /> : <WanderingEye />}
      </button>
    </div>
  );
}
