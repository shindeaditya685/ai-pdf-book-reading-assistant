"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Languages,
  BrainCircuit,
  Quote,
  Library,
  List,
  GraduationCap,
  Settings,
  Users,
  Share2,
  Sparkles,
  ChevronLeft,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePDFStore } from "@/store/use-pdf-store";
import { ShareSessionPanel } from "@/components/share-session-panel";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "main" | "vocabulary" | "tools" | "admin";
  description?: string;
  action?: "collaborate";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main", description: "Your reading home" },
  { href: "/review", label: "Review", icon: BrainCircuit, group: "vocabulary", description: "Due flashcards" },
  { href: "/vocabulary", label: "Vocabulary", icon: Languages, group: "vocabulary", description: "Your lexicon" },
  { href: "/collections", label: "Collections", icon: Library, group: "vocabulary", description: "Word groups" },
  { href: "/lists", label: "Word Lists", icon: List, group: "vocabulary", description: "Custom lists" },
  { href: "/quotes", label: "Quotes", icon: Quote, group: "tools", description: "Saved passages" },
  { href: "/dashboard", label: "Collaborate", icon: Share2, group: "tools", description: "Share a reading session", action: "collaborate" },
  { href: "/ielts", label: "IELTS", icon: GraduationCap, group: "tools", description: "Exam prep" },
  { href: "/profile", label: "Profile", icon: Settings, group: "tools", description: "Stats & settings" },
];

const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: Users,
  group: "admin",
  description: "User management",
};

const GROUP_LABELS: Record<NavItem["group"], string> = {
  main: "Reading",
  vocabulary: "Vocabulary",
  tools: "Tools",
  admin: "Administration",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pdfDataUrl = usePDFStore((s) => s.pdfDataUrl);
  const toggleSharePanel = usePDFStore((s) => s.toggleSharePanel);
  const showSharePanel = usePDFStore((s) => s.showSharePanel);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("pdfmindai-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("pdfmindai-sidebar-collapsed", String(next));
  };

  const items = user?.isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
  const grouped = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative lg:translate-x-0",
          collapsed ? "w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-105">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-emerald-500/40 blur-xl -z-10" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-serif text-lg font-semibold leading-none tracking-tight">PDFMindAI</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI-Powered Reader</span>
              </div>
            )}
          </Link>
          <button
            onClick={toggleCollapsed}
            className="ml-auto hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar py-4">
          <TooltipProvider delayDuration={collapsed ? 200 : 9999}>
            {Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-4">
                {!collapsed && (
                  <h3 className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {GROUP_LABELS[group as NavItem["group"]]}
                  </h3>
                )}
                <div className="space-y-0.5 px-2">
                  {groupItems.map((item) => {
                    const active = pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/dashboard");
                    const Icon = item.icon;
                    const classes = cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      collapsed && "justify-center px-2",
                      active && !item.action
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                        : item.action === "collaborate" && showSharePanel
                          ? "bg-brand text-brand-fg shadow-sm shadow-brand/25"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    );
                    const link =
                      item.action === "collaborate" ? (
                        <button
                          key={item.label}
                          type="button"
                          onClick={toggleSharePanel}
                          className={`${classes} w-full text-left`}
                          title={item.description}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </button>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={classes}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "drop-shadow-sm")} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    return collapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <p className="font-medium">{item.label}</p>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    );
                  })}
                </div>
              </div>
            ))}
          </TooltipProvider>
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors cursor-pointer",
              collapsed && "justify-center"
            )}
            onClick={() => router.push("/profile")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && router.push("/profile")}
          >
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
              <AvatarFallback className="bg-emerald-500/15 text-emerald-600 font-semibold">
                {user?.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{user?.username || "Guest"}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.plan || "free"} plan</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={logout}
            >
              Sign out
            </Button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-serif text-base font-semibold">PDFMindAI</span>
          </Link>
        </header>

        <main id="main-content" className={cn("flex-1 flex flex-col bg-canvas", pathname === "/dashboard" && pdfDataUrl ? "overflow-hidden" : "overflow-y-auto")}>
          {children}
        </main>
      </div>

      <ShareSessionPanel />
    </div>
  );
}