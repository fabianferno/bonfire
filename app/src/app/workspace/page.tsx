"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import AppShell from "@/components/layout/AppShell";

function Loading() {
  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: "var(--bf-primary)" }}
    >
      <div className="text-center" style={{ color: "var(--bf-gray)" }}>
        <iframe
          src="/flame.html"
          title="Loading"
          aria-label="Loading"
          className="mx-auto mb-3"
          style={{ width: 240, height: 240, border: 0, background: "transparent", display: "block" }}
        />
        <p className="text-white font-semibold">Loading…</p>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "unknown") return <Loading />;
  if (status === "guest") return null;

  return <AppShell />;
}
