import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useLocation } from "@tanstack/react-router";
import { ArrowRight, AudioLines, LayoutDashboard, LogOut, Menu, Mic2, ShieldCheck, X, Sparkles, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: Layout,
});

const navItems = [
  { to: "/playground" as const, label: "Evaluation studio", caption: "Prompt testing", Icon: LayoutDashboard, number: "01" },
  { to: "/voice-reliability" as const, label: "Voice Reliability", caption: "Live voice checks", Icon: Mic2, number: "02" },
  { to: "/guardrails" as const, label: "Guardrails", caption: "Safety patterns", Icon: ShieldCheck, number: "03" },
];

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const activeItem = navItems.find((item) => item.to === location.pathname) ?? navItems[0];

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully");
      await navigate({ to: "/" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not sign out. Please retry.");
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f8f6] text-foreground">
      <div className="min-h-screen lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="relative hidden h-screen flex-col overflow-hidden bg-[#102b25] px-4 py-5 text-white lg:sticky lg:top-0 lg:flex">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <Link to="/" className="group relative mb-10 flex items-center gap-3 px-2" aria-label="PromptLab home">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300 text-[#0c2921] shadow-lg shadow-emerald-950/20 transition-transform group-hover:rotate-[-5deg]">
              <AudioLines className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight tracking-tight">PromptLab</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-100/55">Agent quality studio</span>
            </span>
          </Link>

          <div className="relative mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/45">Workspace</div>
          <nav aria-label="Workspace navigation" className="relative flex flex-col gap-2">
            {navItems.map(({ to, label, caption, Icon, number }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3.5 text-white/65 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                activeProps={{ className: "border-emerald-200/15 bg-white/[0.10] text-white shadow-sm shadow-black/10" }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-100/75 transition-colors group-hover:bg-white/10 group-hover:text-emerald-100">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-5">{label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-white/40">{caption}</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-white/25">{number}</span>
              </Link>
            ))}
          </nav>

          <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-emerald-100">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold">Before you ship</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-white/55">Run the prompt against realistic failure cases, review the evidence, and save a version only when you’re happy with the result.</p>
            <Link to="/playground" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:text-white">
              Open evaluation studio <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="relative mt-4 border-t border-white/10 pt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="h-10 w-full justify-start rounded-xl px-3 text-white/60 hover:bg-white/[0.07] hover:text-white"
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-[#e2eae5] bg-[#f8faf9]/90 backdrop-blur-xl">
            <div className="mx-auto flex min-h-[72px] max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Link to="/" className="flex shrink-0 items-center gap-2.5 lg:hidden" aria-label="PromptLab home">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14372e] text-emerald-200"><AudioLines className="h-4.5 w-4.5" /></span>
                  <span className="text-sm font-semibold tracking-tight">PromptLab</span>
                </Link>
                <span className="hidden h-8 w-px bg-border lg:block" />
                <div className="min-w-0">
                  <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:block">PromptLab / Workspace</p>
                  <p className="truncate text-sm font-semibold text-[#17352d]">{activeItem.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-[#dce8e1] bg-white px-3 py-2 text-[11px] font-medium text-[#446258] sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Private workspace
                </div>
                <Button size="sm" variant="ghost" onClick={() => void signOut()} disabled={signingOut} className="hidden h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground sm:inline-flex lg:hidden">
                  <LogOut className="mr-2 h-4 w-4" />{signingOut ? "Signing out…" : "Sign out"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMobileOpen((value) => !value)}
                  aria-label={mobileOpen ? "Close workspace navigation" : "Open workspace navigation"}
                  aria-expanded={mobileOpen}
                  aria-controls="workspace-mobile-nav"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce8e1] bg-white text-[#25483c] transition-colors hover:bg-[#eef5f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                >
                  {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mobileOpen && (
              <nav id="workspace-mobile-nav" aria-label="Mobile workspace navigation" className="border-t border-[#e2eae5] bg-white px-4 py-3 lg:hidden">
                <div className="mx-auto flex max-w-[1800px] flex-col gap-1">
                  {navItems.map(({ to, label, caption, Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      activeProps={{ className: "bg-[#edf6f0] font-semibold text-[#1e6b4d]" }}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4" /></span>
                      <span className="flex-1">
                        <span className="block">{label}</span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{caption}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                    </Link>
                  ))}
                  <Button variant="outline" onClick={() => void signOut()} disabled={signingOut} className="mt-2 justify-start rounded-xl">
                    <LogOut className="mr-2 h-4 w-4" />{signingOut ? "Signing out…" : "Sign out"}
                  </Button>
                </div>
              </nav>
            )}
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
