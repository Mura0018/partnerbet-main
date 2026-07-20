import { Wallet, Search, ShieldCheck, CheckCircle2, Send } from "lucide-react";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container } from "@/lib/ui/primitives";

export const metadata = { title: "Top-Up Center — tez orada" };

const STEPS = [
  { n: 1, title: "Platformani tanlang", desc: "1xBet, Melbet, Betwinner va boshqalar" },
  { n: 2, title: "Ma'lumotlaringiz", desc: "ID va to'ldirmoqchi bo'lgan summa" },
  { n: 3, title: "Tekshirish", desc: "Operator to'lovni tasdiqlaydi" },
  { n: 4, title: "Yakunlash", desc: "Hisobingiz avtomatik to'ldiriladi" },
];

const METHODS = ["Click", "Payme", "Bank karta", "Crypto"];

export default function TopUpPage() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/topup" />

      <Container className="py-14 max-w-4xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.4)]">
            <Wallet size={17} className="text-white" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#F4C76A]/10 text-[#F4C76A] border border-[#F4C76A]/30">
            Tez orada
          </span>
        </div>

        <h1 className="text-[28px] md:text-[38px] font-extrabold leading-tight mb-3">Top-Up Center</h1>
        <p className="text-[14px] text-muted max-w-xl mb-10 leading-relaxed">
          Hisobingizni tez, xavfsiz va ishonchli tarzda to'ldiring — operatorlarimiz doim onlayn va sizga
          yordam berishga tayyor. Bu xizmat hozirda ishlab chiqilmoqda.
        </p>

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
            <span className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white/[0.02] border border-dashed border-white/10 text-[#5b6f85]">
              + mintaqaviy usullar tez orada
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-accent/20 bg-gradient-to-b from-accent/10 to-transparent p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-accent shrink-0" />
            <div>
              <div className="text-[14px] font-semibold">Ishga tushganda bilib qolishni xohlaysizmi?</div>
              <div className="text-[12px] text-muted mt-0.5">Telegram kanalimizga qo'shiling — birinchilardan bo'lib xabardor bo'lasiz.</div>
            </div>
          </div>
          <a
            href="https://t.me/winora_support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] shrink-0"
          >
            <Send size={14} /> Xabardor qiling
          </a>
        </div>
      </Container>

      <PublicFooter />
    </div>
  );
}
