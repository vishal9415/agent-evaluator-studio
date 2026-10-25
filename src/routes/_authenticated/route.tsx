import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  AudioLines,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Plug,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const navItems = [
  { to: "/playground" as const, label: "Evaluation studio", description: "Build, test & compare", number: "01", Icon: LayoutDashboard },
  { to: "/voice-reliability" as const, label: "Live Voice Studio", description: "Diagnose input & conversations", number: "02", Icon: Mic2 },
  { to: "/integrations" as const, label: "Integrations", description: "Connect existing voice agents", number: "03", Icon: Plug },
  { to: "/guardrails" as const, label: "Guardrails", description: "Reduce agent risk", number: "04", Icon: ShieldCheck },
];

function Layout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentPage = navItems.find((item) => item.to === pathname) ?? navItems[0];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      {mobileOpen && (
        <button type="button" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 cursor-default bg-slate-950/60 backdrop-blur-sm md:hidden" />
      )}

      <aside
        aria-label="PromptLab workspace"
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-white/10 bg-[#0b1220] text-white shadow-2xl shadow-slate-950/10 transition-transform duration-200 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
          <Link to="/" onClick={() => setMobileOpen(false)} className="group flex min-w-0 items-center gap-3" aria-label="PromptLab home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/30 transition-transform group-hover:-rotate-6">
              <AudioLines className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold tracking-tight text-white">PromptLab</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Agent evaluation</span>
            </span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-2 pt-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <nav aria-label="Workspace navigation" className="mt-3 space-y-1.5">
            {navItems.map(({ to, label, description, number, Icon }) => (
              <Link key={to} to={to} onClick={() => setMobileOpen(false)} activeOptions={{ exact: true }}
                className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-slate-300 transition-all duration-150 hover:bg-white/[0.06] hover:text-white"
                activeProps={{ className: "!border-emerald-300/15 !bg-emerald-300/10 !text-emerald-100 shadow-sm shadow-black/10" }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-400 transition-colors group-hover:text-white">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 group-hover:text-slate-400">{description}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-600">{number}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mx-4 mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> Live reliability loop
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              ["01", "Listen", "Inspect the incoming audio"],
              ["02", "Recover", "Validate details and handle failures"],
              ["03", "Verify", "Replay the case and compare outcomes"],
            ].map(([number, title, description]) => (
              <div key={number} className="flex items-start gap-2.5">
                <span className="mt-0.5 font-mono text-[10px] text-emerald-300/80">{number}</span>
                <span>
                  <span className="block text-xs font-medium text-slate-200">{title}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><ShieldCheck className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-200">Private workspace</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">Your tools, under your account</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <Button variant="ghost" onClick={() => void signOut()} disabled={signingOut} className="h-10 w-full justify-start rounded-xl text-slate-300 hover:bg-white/[0.08] hover:text-white">
            <LogOut className="mr-2.5 h-4 w-4" /> {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 md:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open workspace navigation" aria-expanded={mobileOpen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 md:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>PromptLab</span><ArrowRight className="h-3 w-3" />
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{currentPage.label}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{currentPage.description}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Private workspace
            </span>
            <div className="hidden h-8 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CircleHelp className="h-3.5 w-3.5" /><span className="hidden sm:inline">Built for iteration</span>
            </span>
          </div>
        </header>
        <div className="workspace-content min-h-[calc(100vh-68px)]"><Outlet /></div>
      </div>
    </div>
  );
}
