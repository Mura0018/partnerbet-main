import Link from "next/link";
import { Zap, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative text-center max-w-md">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.5)] mb-6">
          <Zap size={22} className="text-white" fill="white" />
        </div>
        <div className="text-[80px] font-extrabold leading-none bg-gradient-to-r from-accent to-vip bg-clip-text text-transparent">
          404
        </div>
        <h1 className="text-[20px] font-bold mt-3">Sahifa topilmadi</h1>
        <p className="text-[14px] text-muted mt-2 leading-relaxed">
          Siz izlagan sahifa mavjud emas yoki ko'chirilgan bo'lishi mumkin.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] shadow-[0_0_30px_rgba(61,127,255,0.4)]"
        >
          <Home size={16} /> Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
