'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { refreshCredits } from '@/lib/credits';
import { leadApi } from '../lib/leadApi';

const BASE_COST = 20;

export default function NewCampaignPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [problem, setProblem] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const addKeyword = () => {
    const v = keywordInput.trim();
    if (!v) return;
    if (keywords.includes(v)) {
      setKeywordInput('');
      return;
    }
    if (keywords.length >= 20) return;
    setKeywords((prev) => [...prev, v]);
    setKeywordInput('');
  };

  const removeKeyword = (k: string) =>
    setKeywords((prev) => prev.filter((x) => x !== k));

  const handleKeywordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    } else if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const canSubmit =
    role.trim().length >= 2 &&
    problem.trim().length >= 10 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await leadApi.create({
        role: role.trim(),
        problem: problem.trim(),
        keywords,
        notes: notes.trim(),
      });
      // Refresh navbar balance after the charge.
      void refreshCredits();
      router.replace(`/lead-search/${res.campaign_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start campaign.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <Link
          href="/lead-search"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New lead campaign</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe your ICP. Costs <strong>{BASE_COST} credits</strong> — fully
            refunded if our AI thinks no free channel has signal for you.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6"
        >
          <Field
            label="Who are you targeting?"
            hint="Role + industry — e.g. “B2B SaaS founders” or “e-commerce sellers in beauty”."
            required
          >
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={200}
              placeholder="B2B SaaS founders"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Field>

          <Field
            label="What problem does your product solve?"
            hint="One or two sentences. The clearer, the better the channel picks."
            required
          >
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="We help indie founders automate cold outreach without sounding spammy."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
            />
            <div className="text-xs text-gray-400 text-right">
              {problem.length} / 600
            </div>
          </Field>

          <Field label="Niche keywords" hint="Optional. Press Enter or comma to add.">
            <div className="flex flex-wrap gap-2 px-2 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-brand-500">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-xs"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="hover:text-brand-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKey}
                onBlur={addKeyword}
                placeholder={keywords.length === 0 ? 'cold email, automation, …' : ''}
                className="flex-1 min-w-[120px] text-sm bg-transparent outline-none py-1"
              />
            </div>
          </Field>

          <Field label="Additional context" hint="Optional. Anything else worth knowing.">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Avoid enterprise. Focus on indie devs and bootstrappers."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
            />
          </Field>

          {error ? (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              {BASE_COST} credits · refundable if refused
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>Start campaign</>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      {hint ? <p className="text-xs text-gray-500 mb-2">{hint}</p> : null}
      {children}
    </div>
  );
}
