"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/web3/connect-button";
import { Star } from "lucide-react";

const DESKTOP_NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/trust", label: "Trust" },
  { href: "/trade", label: "Trade" },
] as const;

const MOBILE_NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/trust", label: "Trust" },
  { href: "/verified", label: "Verify" },
  { href: "/moderation", label: "Moderate" },
  { href: "/trade", label: "Trade" },
  { href: "/compare", label: "Compare" },
  { href: "/watchlist", label: "Watchlist" },
] as const;

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#07070d]/85 backdrop-blur-xl">
      <div className="relative hidden h-14 w-full items-center px-4 md:flex sm:px-6">
        <Link href="/" className="flex items-center font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-cyan-300 to-cyan-400 bg-clip-text text-lg text-transparent">DEX</span>
          <span className="text-lg text-white/90">8004</span>
        </Link>

        <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
          {DESKTOP_NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} active={isActive(pathname, link.href)}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/compare"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive(pathname, "/compare") ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            Compare
          </Link>
          <Link
            href="/watchlist"
            aria-label="Watchlist"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/8 hover:text-amber-200"
          >
            <Star className="h-4 w-4" />
          </Link>
          <ConnectButton />
        </div>
      </div>

      <div className="md:hidden">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <Link href="/" className="flex items-center font-semibold tracking-[0.01em]">
            <span className="bg-gradient-to-r from-cyan-300 to-cyan-400 bg-clip-text text-base text-transparent">DEX</span>
            <span className="text-base text-white/90">8004</span>
          </Link>
          <ConnectButton compact />
        </div>
        <div className="bg-gradient-to-b from-white/[0.02] to-transparent">
          <nav className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-3 py-2.5 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MOBILE_NAV_LINKS.map((link) => (
              <SwipeNavLink key={link.href} href={link.href} active={isActive(pathname, link.href)}>
                {link.label}
              </SwipeNavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function SwipeNavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`snap-start whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-cyan-300/45 bg-cyan-300/18 text-cyan-100 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
          : "border-white/15 bg-white/[0.04] text-white/75 hover:border-white/35 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
