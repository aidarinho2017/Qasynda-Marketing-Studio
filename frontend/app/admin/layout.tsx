'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { BarChart2, ShieldCheck, Users, Zap } from 'lucide-react';
import { isAuthenticated, isAdmin, logout } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();

  const NAV = [
    { href: '/admin',             label: t.admin.dashboard, icon: BarChart2 },
    { href: '/admin/users',       label: t.admin.users,     icon: Users },
    { href: '/admin/generations', label: t.admin.generations, icon: Zap },
  ];

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/'); return; }
    if (!isAdmin()) { router.replace('/dashboard'); }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          <span className="font-semibold text-gray-900 text-sm">{t.admin.panel}</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            {t.admin.backToApp}
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            {t.admin.logOut}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-56 min-h-screen">
        {children}
      </div>
    </div>
  );
}
