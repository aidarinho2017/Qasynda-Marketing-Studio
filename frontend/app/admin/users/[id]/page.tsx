'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import GenerationCard from '@/components/GenerationCard';
import type { Generation } from '@/lib/types';

interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  credits_balance: number;
  is_admin: boolean;
  created_at: string;
  generation_count: number;
  recent_generations: Generation[];
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credits edit state
  const [creditsInput, setCreditsInput] = useState('');
  const [savingCredits, setSavingCredits] = useState(false);
  const [creditsMsg, setCreditsMsg] = useState<string | null>(null);

  // Admin toggle state
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<AdminUserDetail>(`/admin/users/${id}`)
      .then((u) => { setUser(u); setCreditsInput(String(u.credits_balance)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSaveCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const val = parseFloat(creditsInput);
    if (isNaN(val) || val < 0) { setCreditsMsg('Enter a valid non-negative number.'); return; }
    setSavingCredits(true);
    setCreditsMsg(null);
    try {
      const updated = await api.patch<AdminUserDetail>(`/admin/users/${user.id}`, { credits_balance: val });
      setUser(updated);
      setCreditsInput(String(updated.credits_balance));
      setCreditsMsg('Credits updated.');
    } catch (e) {
      setCreditsMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setSavingCredits(false);
    }
  }

  async function handleToggleAdmin() {
    if (!user) return;
    setSavingAdmin(true);
    setAdminMsg(null);
    try {
      const updated = await api.patch<AdminUserDetail>(`/admin/users/${user.id}`, { is_admin: !user.is_admin });
      setUser(updated);
      setAdminMsg(updated.is_admin ? 'Admin access granted.' : 'Admin access revoked.');
    } catch (e) {
      setAdminMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function handleDeleteGeneration(generationId: string) {
    await api.delete(`/generations/${generationId}`);
    setUser((prev) =>
      prev
        ? { ...prev, recent_generations: prev.recent_generations.filter((g) => g.id !== generationId) }
        : prev,
    );
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (error || !user) return <div className="p-8 text-red-500 text-sm">{error ?? 'User not found.'}</div>;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        All users
      </Link>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              {user.is_admin && <ShieldCheck className="w-4 h-4 text-brand-500" />}
            </div>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{user.generation_count} generations
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Credits */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Credits balance</h2>
          <p className="text-3xl font-bold text-gray-900 tabular-nums mb-4">
            {user.credits_balance.toFixed(2)}
          </p>
          <form onSubmit={handleSaveCredits} className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={creditsInput}
              onChange={(e) => setCreditsInput(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              placeholder="New balance"
            />
            <button
              type="submit"
              disabled={savingCredits}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {savingCredits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Set
            </button>
          </form>
          {creditsMsg && (
            <p className={`mt-2 text-xs ${creditsMsg.includes('updated') ? 'text-green-600' : 'text-red-500'}`}>
              {creditsMsg}
            </p>
          )}
        </div>

        {/* Admin toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Admin access</h2>
          <p className="text-sm text-gray-500 mb-4">
            {user.is_admin
              ? 'This user has admin access to the panel.'
              : 'This user does not have admin access.'}
          </p>
          <button
            onClick={handleToggleAdmin}
            disabled={savingAdmin}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
              user.is_admin
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100'
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100'
            }`}
          >
            {savingAdmin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {user.is_admin
              ? <><ShieldOff className="w-4 h-4" /> Revoke admin</>
              : <><ShieldCheck className="w-4 h-4" /> Grant admin</>}
          </button>
          {adminMsg && (
            <p className={`mt-2 text-xs ${adminMsg.includes('granted') ? 'text-green-600' : 'text-red-500'}`}>
              {adminMsg}
            </p>
          )}
        </div>
      </div>

      {/* Recent generations */}
      {user.recent_generations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Recent generations ({user.recent_generations.length} shown)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.recent_generations.map((g) => (
              <GenerationCard key={g.id} generation={g} onDelete={handleDeleteGeneration} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
