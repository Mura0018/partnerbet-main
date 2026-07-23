"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { GlobalChat } from "@/lib/chat/GlobalChat";

export default function PartnerChatPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto flex flex-col h-[calc(100svh-56px)] md:h-[100svh]">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <MessageCircle size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Global chat</h1>
      </div>
      <div className="flex-1 min-h-0">
        <GlobalChat />
      </div>
    </div>
  );
}
