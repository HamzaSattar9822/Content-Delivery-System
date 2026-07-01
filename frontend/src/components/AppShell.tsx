'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

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
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-60 border-b md:border-b-0 md:border-r border-line bg-white shrink-0">
        <div className="px-4 py-4 border-b border-line flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Content Delivery</span>
          <button className="md:hidden text-xs text-muted" onClick={() => setMenuOpen((v) => !v)}>
            Menu
          </button>
        </div>
        <nav className={`${menuOpen ? 'block' : 'hidden'} md:block p-2`}>
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 text-sm rounded mb-0.5 border ${
                  active ? 'border-line bg-subtle text-ink font-medium' : 'border-transparent text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-line bg-white px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-muted truncate">{user.email}</div>
          <div className="flex items-center gap-3">
            <span className="text-xs border border-line rounded px-2 py-0.5 text-muted">{user.role}</span>
            <button onClick={handleLogout} className="text-sm text-ink hover:underline">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 bg-white">{children}</main>
      </div>
    </div>
  );
}
