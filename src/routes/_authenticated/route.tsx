import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, AudioLines, FlaskConical, LayoutDashboard, LogOut, Menu, Mic2, ShieldCheck, X } from "lucide-react";
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
  { to: "/playground" as const, label: "Evaluation studio", Icon: LayoutDashboard },
  { to: "/voice-reliability" as const, label: "Voice Reliability", Icon: Mic2 },
  { to: "/guardrails" as const, label: "Guardrails", Icon: ShieldCheck },
];

function Layout() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="PromptLab home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm transition-transform group-hover:rotate-[-5deg]"><AudioLines className="h-5 w-5" /></span>
            <span><span className="block text-sm font-semibold leading-tight tracking-tight">PromptLab</span><span className="hidden text-[10px] font-medium tracking-[0.14em] text-muted-foreground sm:block">AGENT EVALUATION STUDIO</span></span>
          </Link>

          <nav aria-label="Workspace navigation" className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, Icon }) => <Link key={to} to={to} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" activeProps={{ className: "bg-brand/10 font-medium text-brand" }}><Icon className="h-4 w-4" />{label}</Link>)}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Private workspace</div>
            <Button size="sm" variant="ghost" onClick={() => void signOut()} disabled={signingOut} className="hidden sm:inline-flex">{signingOut ? "Signing out…" : <><LogOut className="mr-2 h-4 w-4" />Sign out</>}</Button>
            <button type="button" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Close workspace navigation" : "Open workspace navigation"} aria-expanded={mobileOpen} aria-controls="workspace-mobile-nav" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">{mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>

        {mobileOpen && <nav id="workspace-mobile-nav" aria-label="Mobile workspace navigation" className="border-t border-border bg-background px-4 py-3 md:hidden"><div className="mx-auto flex max-w-[1600px] flex-col gap-1">{navItems.map(({ to, label, Icon }) => <Link key={to} to={to} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" activeProps={{ className: "bg-brand/10 font-semibold text-brand" }}><Icon className="h-4 w-4" />{label}<ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" /></Link>)}<Button variant="outline" onClick={() => void signOut()} disabled={signingOut} className="mt-2 justify-start">{signingOut ? "Signing out…" : <><LogOut className="mr-2 h-4 w-4" />Sign out</>}</Button></div></nav>}
      </header>
      <Outlet />
    </div>
  );
}
