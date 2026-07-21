import { Wallet, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container } from "@/lib/ui/primitives";

export const metadata = { title: "Top-Up Center — hisobingizni to'ldiring" };

// Real bot username
const BOT_USERNAME = "BetCorePay_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

const STEPS = [
  { n: 1, title: "Platformani tanlang", desc: "1xBet, Melbet, Betwinner va boshqalar" },
  { n: 2, title: "Ma'lumotlaringiz", desc: "ID va to'ldirmoqchi bo'lgan summa" },
  { n: 3, title: "Tekshirish", desc: "Operator to'lovni tasdiqlaydi" },
  { n: 4, title: "Yakunlash", desc: "Hisobingiz to'ldiriladi" },
];

const METHODS = ["Click", "Payme", "Bank karta", "Crypto"];

function TopupHeroGraphic() {
  return (
    <div
      className="group relative block w-full max-w-[360px] mx-auto md:mx-0 aspect-[4/5] select-none"
    >
      <style>{`
        @keyframes topupBob { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(-1.5deg); } }
        @keyframes topupGlow { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.08); } }
        @keyframes topupSparkle { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes topupBadge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes topupHands { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes topupRing { 0%, 100% { opacity: 0.15; transform: scale(0.94); } 50% { opacity: 0.6; transform: scale(1.06); } }
        .topup-bob { animation: topupBob 4.5s ease-in-out infinite; }
        .topup-glow { animation: topupGlow 3.2s ease-in-out infinite; }
        .topup-sparkle-a { animation: topupSparkle 2.4s ease-in-out infinite; }
        .topup-sparkle-b { animation: topupSparkle 2.8s ease-in-out infinite 0.6s; }
        .topup-sparkle-c { animation: topupSparkle 2.1s ease-in-out infinite 1.1s; }
        .topup-badge { animation: topupBadge 2.6s ease-in-out infinite; }
        .topup-hands { animation: topupHands 3.6s ease-in-out infinite; }
        .topup-ring { animation: topupRing 1.8s ease-in-out infinite; transform-origin: center; }
        .topup-box-link { cursor: pointer; transform-origin: center; transition: transform 0.12s ease; }
        .topup-box-link:active { transform: scale(0.9); }
        @media (prefers-reduced-motion: reduce) {
          .topup-bob, .topup-glow, .topup-sparkle-a, .topup-sparkle-b, .topup-sparkle-c, .topup-badge, .topup-hands, .topup-ring { animation: none; }
        }
      `}</style>

      {/* ambient glow */}
      <div
        className="topup-glow absolute inset-[8%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(61,127,255,0.35), transparent 70%)" }}
      />

      {/* shop window frame */}
      <div className="topup-bob absolute inset-[6%] rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
        style={{ background: "linear-gradient(160deg, rgba(61,127,255,0.16), rgba(10,20,38,0.9) 55%)" }}
      >
        {/* glass highlight streak */}
        <div
          className="absolute -top-1/4 -left-1/3 w-2/3 h-[160%] rotate-12"
          style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.09), transparent)" }}
        />

        {/* 1xBet market kiosk backdrop, behind the character */}
        <div className="absolute inset-x-0 top-0 h-[42%] overflow-hidden">
          {/* striped awning */}
          <div
            className="absolute top-0 inset-x-0 h-[22%]"
            style={{
              background: "repeating-linear-gradient(115deg, #3D7FFF 0 22px, #0A1830 22px 44px)",
              clipPath: "polygon(0 0, 100% 0, 100% 70%, 92% 100%, 84% 70%, 76% 100%, 68% 70%, 60% 100%, 52% 70%, 44% 100%, 36% 70%, 28% 100%, 20% 70%, 12% 100%, 4% 70%, 0 100%)",
            }}
          />
          {/* sign board */}
          <div className="absolute top-[22%] inset-x-0 flex justify-center">
            <div className="px-4 py-1 rounded-b-lg bg-[#0b1730] border border-t-0 border-accent/30 shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
              <span className="text-[13px] font-extrabold tracking-wide"><span className="text-white">1X</span><span className="text-accent">BET</span></span>
              <span className="text-[9px] font-semibold ml-1 text-accent">market</span>
            </div>
          </div>
          {/* left pane — bonus badge */}
          <div className="absolute top-[42%] left-[6%] w-[18%] aspect-square rounded-md bg-accent/[0.08] border border-accent/25 flex flex-col items-center justify-center">
            <span className="text-[11px] font-extrabold text-[#4ADE80] leading-none">+100%</span>
            <span className="text-[6px] text-white/50 mt-0.5">bonus</span>
          </div>
          {/* right pane — speed badge */}
          <div className="absolute top-[42%] right-[6%] w-[18%] aspect-square rounded-md bg-accent/[0.08] border border-accent/25 flex flex-col items-center justify-center">
            <span className="text-[13px] leading-none">⚡</span>
            <span className="text-[6px] text-white/50 mt-0.5">tezkor</span>
          </div>
        </div>
        {/* counter shelf beneath the kiosk sign, in front of the mascot's legs */}
        <div className="absolute bottom-0 inset-x-0 h-[10%]" style={{ background: "linear-gradient(180deg, transparent, rgba(20,32,58,0.9))" }} />

        {/* sparkles */}
        <div className="topup-sparkle-a absolute top-[14%] left-[16%] w-2 h-2 rounded-full bg-[#F4C76A]" />
        <div className="topup-sparkle-b absolute top-[22%] right-[18%] w-1.5 h-1.5 rounded-full bg-white" />
        <div className="topup-sparkle-c absolute top-[38%] left-[24%] w-1 h-1 rounded-full bg-accent" />

        {/* cartoon mascot character offering the bonus box */}
        <svg viewBox="0 0 300 340" className="topup-hands absolute bottom-0 left-0 w-full h-[86%]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD6B0" />
              <stop offset="100%" stopColor="#F0B786" />
            </linearGradient>
            <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5C8CFF" />
              <stop offset="100%" stopColor="#2B45B0" />
            </linearGradient>
            <linearGradient id="hoodieShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2456C9" />
              <stop offset="100%" stopColor="#1A3689" />
            </linearGradient>
            <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B4630" />
              <stop offset="100%" stopColor="#3D3220" />
            </linearGradient>
            <linearGradient id="walletBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFE29A" />
              <stop offset="55%" stopColor="#F4C76A" />
              <stop offset="100%" stopColor="#C98F2E" />
            </linearGradient>
            <linearGradient id="walletShine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* torso / hoodie */}
          <path d="M70 340 C 62 250, 90 196, 150 190 C 210 196, 238 250, 230 340 Z" fill="url(#hoodie)" />
          <path d="M70 340 C 62 250, 90 196, 150 190 L150 340 Z" fill="url(#hoodieShade)" opacity="0.35" />
          <circle cx="150" cy="204" r="9" fill="#1A3689" opacity="0.5" />

          {/* left arm reaching forward-down to the box */}
          <path d="M92 214 C 62 224, 44 250, 46 276 C 47 292, 62 300, 78 292 C 96 283, 104 258, 108 232 Z" fill="url(#hoodie)" />
          <circle cx="60" cy="284" r="19" fill="url(#skin)" />

          {/* right arm reaching forward-down to the box */}
          <path d="M208 214 C 238 224, 256 250, 254 276 C 253 292, 238 300, 222 292 C 204 283, 196 258, 192 232 Z" fill="url(#hoodie)" />
          <circle cx="240" cy="284" r="19" fill="url(#skin)" />

          {/* head */}
          <circle cx="150" cy="120" r="58" fill="url(#skin)" />
          {/* cap with logo */}
          <path d="M90 102 C 84 54, 122 26, 150 26 C 178 26, 216 54, 210 102 C 210 84, 192 76, 150 76 C 108 76, 90 84, 90 102 Z" fill="#12224A" stroke="#0A1830" strokeWidth="2" />
          <ellipse cx="150" cy="100" rx="68" ry="11" fill="#0A1830" />
          <rect x="122" y="52" width="56" height="22" rx="5" fill="#fff" />
          <text x="150" y="68" textAnchor="middle" fontSize="13" fontWeight="800"><tspan fill="#12224A">1X</tspan><tspan fill="#3D7FFF">BET</tspan></text>
          {/* ears */}
          <circle cx="94" cy="122" r="9" fill="url(#skin)" />
          <circle cx="206" cy="122" r="9" fill="url(#skin)" />
          {/* rosy cheeks */}
          <ellipse cx="120" cy="138" rx="10" ry="6" fill="#FF9E8A" opacity="0.5" />
          <ellipse cx="180" cy="138" rx="10" ry="6" fill="#FF9E8A" opacity="0.5" />
          {/* eyes */}
          <circle cx="130" cy="118" r="6" fill="#2A2118" />
          <circle cx="170" cy="118" r="6" fill="#2A2118" />
          <circle cx="132" cy="115" r="1.8" fill="#fff" />
          <circle cx="172" cy="115" r="1.8" fill="#fff" />
          {/* eyebrows */}
          <path d="M119 104 Q130 98 141 104" stroke="#3D3220" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M159 104 Q170 98 181 104" stroke="#3D3220" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* smile */}
          <path d="M126 148 Q150 168 174 148" stroke="#8A4A2E" strokeWidth="4" fill="none" strokeLinecap="round" />

          {/* bonus box held out in front, between the hands */}
          <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" aria-label="Bonusni oling — botni ochish" className="topup-box-link">
            <g transform="translate(150,266)">
              <rect x="-68" y="-52" width="136" height="104" rx="22" fill="none" stroke="#4ADE80" strokeWidth="3" opacity="0.55" className="topup-ring" />
              <rect x="-56" y="-40" width="112" height="80" rx="14" fill="url(#walletBody)" stroke="#8A5E1E" strokeWidth="2" />
              <rect x="-56" y="-40" width="112" height="80" rx="14" fill="url(#walletShine)" />
              <rect x="-56" y="-6" width="112" height="9" fill="#B87F27" opacity="0.55" />
              <circle cx="0" cy="0" r="13" fill="#FFF6DE" stroke="#8A5E1E" strokeWidth="2" />
              <text x="0" y="5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#8A5E1E">$</text>
            </g>
          </a>
        </svg>
      </div>

      {/* floating CTA badge */}
      <div className="topup-badge absolute -top-2 right-2 md:right-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-accent to-accent-dim shadow-[0_8px_24px_rgba(61,127,255,0.5)] text-[12px] font-bold whitespace-nowrap">
        ⚡ Hoziroq to'ldiring!
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-[12px] font-semibold">
          Qo'lidagi bonusga teging <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
}

export default function TopUpPage() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/topup" />

      <Container className="py-14 max-w-5xl">
        <div className="grid md:grid-cols-2 gap-10 items-center mb-14">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.4)]">
                <Wallet size={17} className="text-white" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/30">
                Ishlaydi
              </span>
            </div>

            <h1 className="text-[28px] md:text-[38px] font-extrabold leading-tight mb-3">
              Hisobingizni hoziroq to'ldiring
            </h1>
            <p className="text-[14px] text-muted max-w-xl mb-8 leading-relaxed">
              Tez, xavfsiz va ishonchli — operatorlarimiz doim onlayn va sizga yordam berishga tayyor. Click, Payme,
              bank kartasi yoki crypto orqali bir necha daqiqada to'ldiring.
            </p>

            <a
              href={BOT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] shadow-[0_10px_30px_rgba(61,127,255,0.35)]"
            >
              Hisobni to'ldirish <ArrowRight size={16} />
            </a>
          </div>

          <TopupHeroGraphic />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 relative overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-accent/15 text-accent text-[12px] font-bold flex items-center justify-center mb-3">
                {step.n}
              </div>
              <div className="text-[13px] font-semibold mb-1">{step.title}</div>
              <div className="text-[11px] text-muted leading-relaxed">{step.desc}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-accent" />
            <span className="text-[13px] font-semibold">Qo'llab-quvvatlanadigan to'lov usullari</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <span key={m} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white/5 border border-white/10 text-muted">
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-accent/20 bg-gradient-to-b from-accent/10 to-transparent p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-accent shrink-0" />
            <div>
              <div className="text-[14px] font-semibold">Botni oching va hoziroq to'ldiring</div>
              <div className="text-[12px] text-muted mt-0.5">Ro'yxatdan o'ting va bir necha daqiqada hisobingiz to'ladi.</div>
            </div>
          </div>
          <a
            href={BOT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] shrink-0"
          >
            <Wallet size={14} /> Botni ochish
          </a>
        </div>
      </Container>

      <PublicFooter />
    </div>
  );
}
