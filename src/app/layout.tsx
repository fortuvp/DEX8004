import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Web3Provider } from "@/components/web3/web3-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const appSans = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DEX8004 - The Safest Dapp for AI Agents",
  description: "Trust, Exchange, Protect. Buy and sell ERC-8004 agents via Kleros Escrow with Reality.eth moderation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${appSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Web3Provider>
            <TooltipProvider>
              <Navbar />
              <main className="min-h-[calc(100vh-3.5rem)] overflow-x-hidden">{children}</main>
              <footer className="border-t border-white/[0.08] bg-[#070b12]/80 px-4 py-5 text-sm text-white/70 sm:px-6">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                  <span className="font-medium tracking-wide">
                    Secured by <span className="font-semibold text-cyan-300">Kleros</span>
                  </span>
                  <div className="grid gap-6 text-sm sm:grid-cols-2 md:grid-cols-4">
                    <FooterGroup
                      title="Explore"
                      links={[
                        { href: "/", label: "Home" },
                        { href: "/explore", label: "Explore" },
                        { href: "/leaderboard", label: "Leaderboard" },
                      ]}
                    />
                    <FooterGroup
                      title="Trust"
                      links={[
                        { href: "/trust", label: "Trust" },
                        { href: "/verified", label: "Verified Agents" },
                        { href: "/moderation", label: "Moderation" },
                        { href: "/compare", label: "Compare" },
                        { href: "/watchlist", label: "Watchlist" },
                      ]}
                    />
                    <FooterGroup
                      title="Trade"
                      links={[
                        { href: "/trade", label: "Trade" },
                        { href: "/networks", label: "Networks" },
                      ]}
                    />
                    <FooterGroup
                      title="Resources"
                      links={[
                        { href: "/docs", label: "Docs" },
                        { href: "/faq", label: "FAQ" },
                      ]}
                    />
                  </div>
                </div>
              </footer>
              <Toaster />
            </TooltipProvider>
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wider text-white/45">{title}</div>
      <div className="space-y-1.5">
        {links.map((link) => (
          <a
            key={`${title}-${link.href}`}
            href={link.href}
            className="block text-white/70 transition hover:text-cyan-300 hover:underline"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
