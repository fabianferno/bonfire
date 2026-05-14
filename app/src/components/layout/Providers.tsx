"use client";
import { AppProvider } from "@/context/AppContext";
import PrivyClientProvider from "@/components/layout/PrivyClientProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyClientProvider>
      <AuthProvider>
        <AppProvider>{children}</AppProvider>
      </AuthProvider>
    </PrivyClientProvider>
  );
}
