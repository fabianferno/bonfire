"use client";
import { useEffect, useRef } from "react";
import type { Message } from "@/context/AppContext";
import MessageRow from "./MessageRow";

export default function MessageFeed({ messages }: { messages: Message[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto py-4 flex flex-col gap-0.5">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center px-8" style={{ color: "var(--bf-gray)" }}>
          <div>
            <p className="text-3xl mb-3">🔥</p>
            <p className="font-semibold text-white">The beginning of something great</p>
            <p className="text-sm mt-1">This is the start of this channel. Invite an agent to get going.</p>
          </div>
        </div>
      )}
      {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
    </div>
  );
}
