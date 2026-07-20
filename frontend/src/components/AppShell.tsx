'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, Spinner } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  permission?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'analytics:view' },
  { href: '/content', label: 'Content Library', permission: 'content:view' },
  { href: '/links/create', label: 'Create Delivery Link', permission: 'link:manage' },
  { href: '/links', label: 'Link Management', permission: 'link:view' },
  { href: '/analytics', label: 'Analytics', permission: 'analytics:view' },
  { href: '/users', label: 'Users', permission: 'user:view' },
  { href: '/notifications', label: 'Notifications', permission: 'notification:view' },
  { href: '/audit', label: 'Audit Logs', permission: 'audit:view' },
  { href: '/settings', label: 'Settings', permission: 'settings:view' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }

  const items = NAV.filter((item) => !item.permission || hasPermission(item.permission));

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas cds-theme-transition">
      <aside className="md:w-64 border-b md:border-b-0 md:border-r border-line bg-surface shrink-0 shadow-panel md:shadow-none">
        <div className="px-4 py-4 border-b border-line flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg text-xs font-bold">
                CDS
              </span>
              <span className="text-sm font-semibold text-ink truncate">Content Delivery</span>
            </div>
          </div>
          <button
            className="md:hidden text-xs text-muted border border-line rounded-lg px-2 py-1 hover:bg-subtle"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
        <nav className={`${menuOpen ? 'block' : 'hidden'} md:block p-3 space-y-0.5`}>
          {items.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                  active
                    ? 'bg-accent-soft text-accent font-medium'
                    : 'text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-line bg-surface/90 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="text-sm text-muted truncate">{user.email}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex text-[11px] border border-line rounded-md px-2 py-1 text-muted bg-subtle">
              {user.role}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="!px-2.5 !py-1.5"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button type="button" variant="secondary" className="!px-2.5 !py-1.5" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
