"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      defaultTheme="dark"
      enableSystem={false}
      forcedTheme="dark"
      storageKey="dex8004-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
