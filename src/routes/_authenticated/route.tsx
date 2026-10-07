import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      throw redirect({ to: '/auth' })
    }
    return { user: data.user }
  },
  component: Layout,
})

function Layout() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="font-semibold text-foreground">PromptLab</Link>
          <Link to="/playground" className="text-muted-foreground" activeProps={{ className: 'text-foreground' }}>Playground</Link>
          <Link to="/guardrails" className="text-muted-foreground" activeProps={{ className: 'text-foreground' }}>Guardrails</Link>
        </nav>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate({ to: '/' })
          }}
        >
          Sign out
        </Button>
      </header>
      <Outlet />
    </div>
  )
}
