'use client';

import Link from 'next/link';
import { Clock, Coins, Compass, LogOut, Plus, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { logout, getUser, isAdmin } from '@/lib/auth';
import { useCredits } from '@/lib/credits';
import { useT } from '@/lib/i18n';

interface NavbarProps {
  /** Show the user menu (dashboard/generate pages). Landing page omits this. */
  showUserMenu?: boolean;
}

export default function Navbar({ showUserMenu = false }: NavbarProps) {
  const { t } = useT();
  const user = showUserMenu ? getUser() : null;

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href={showUserMenu ? '/dashboard' : '/'} className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center group-hover:bg-brand-700 transition-colors">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm sm:text-base">
            Qasynda<span className="text-brand-600"> Studio</span>
          </span>
        </Link>

        {/* Right side */}
        {showUserMenu && user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <CreditsBadge />
            {isAdmin() && (
              <Link
                href="/admin"
                className="hidden sm:flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-brand-50 font-medium"
              >
                <ShieldCheck className="w-4 h-4" />
                {t.nav.admin}
              </Link>
            )}
            <Link
              href="/growth-manager"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Compass className="w-4 h-4" />
              {t.nav.growthManager}
            </Link>
            <Link
              href="/mini-apps"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Sparkles className="w-4 h-4" />
              {t.nav.miniApps}
            </Link>
            <Link
              href="/history"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Clock className="w-4 h-4" />
              {t.nav.history}
            </Link>
            <span className="hidden md:block text-sm text-gray-500 truncate max-w-[160px]">
              {user.name}
            </span>
            <LangSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.logout}</span>
            </button>
          </div>
        )}

        {!showUserMenu && (
          <div className="flex items-center gap-1">
            <LangSwitcher />
          </div>
        )}
      </div>
    </nav>
  );
}

function CreditsBadge() {
  const { t } = useT();
  const { balance } = useCredits();

  return (
    <Link
      href="/topup"
      title={t.nav.topUpCredits}
      className="flex items-center gap-1 bg-brand-50 border border-brand-100 rounded-lg pl-2.5 pr-1 py-1 hover:bg-brand-100 transition-colors"
    >
      <Coins className="w-3.5 h-3.5 text-brand-600" />
      <span className="text-sm font-semibold text-brand-700 tabular-nums min-w-[1.5rem] text-center">
        {balance === null ? '—' : balance}
      </span>
      <span className="ml-1 p-1 rounded-md text-brand-600">
        <Plus className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

export function LangSwitcher({ dark }: { dark?: boolean } = {}) {
  const { locale, setLocale } = useT();
  const active = dark ? 'font-semibold text-white px-1.5 py-1 rounded' : 'font-semibold text-gray-900 px-1.5 py-1 rounded';
  const inactive = dark
    ? 'text-gray-500 hover:text-gray-300 px-1.5 py-1 rounded transition-colors'
    : 'text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded transition-colors';
  return (
    <div className="flex items-center gap-0.5 text-sm">
      <button onClick={() => setLocale('en')} className={locale === 'en' ? active : inactive}>
        EN
      </button>
      <span className={dark ? 'text-gray-700' : 'text-gray-300'}>|</span>
      <button onClick={() => setLocale('ru')} className={locale === 'ru' ? active : inactive}>
        RU
      </button>
    </div>
  );
}
