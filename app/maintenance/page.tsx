import { Wrench } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";

export default async function MaintenancePage() {
  const supabase = createPublicServerClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "maintenance").maybeSingle();
  const message = (data?.value as any)?.message?.trim();

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative text-center max-w-md">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_30px_rgba(61,127,255,0.4)] mb-6">
          <Wrench size={24} className="text-white" />
        </div>
        <h1 className="text-[24px] font-bold">Texnik ishlar olib borilmoqda</h1>
        <p className="text-[14px] text-muted mt-3 leading-relaxed">
          {message || "Sayt qisqa vaqt ichida yana ishga tushadi. Sabr qilganingiz uchun rahmat."}
        </p>
      </div>
    </div>
  );
}
