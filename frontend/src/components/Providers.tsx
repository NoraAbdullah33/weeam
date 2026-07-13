"use client";

import { LangProvider } from "@/components/waaem/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
