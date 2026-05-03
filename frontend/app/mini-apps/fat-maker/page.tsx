'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Smile } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UploadForm from '@/components/UploadForm';
import GenerationsGallery, {
  type GenerationsGalleryHandle,
} from '@/components/GenerationsGallery';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import {
  bundlePriceForCount,
  refreshCredits,
  useCredits,
} from '@/lib/credits';
import type { GenerationStartResponse } from '@/lib/types';

export default function FatMakerPage() {
  const router = useRouter();
  const galleryRef = useRef<GenerationsGalleryHandle>(null);

  const [file, setFile] = useState<File | null>(null);
  const [wishes, setWishes] = useState('');
  const [fatness, setFatness] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please upload a photo.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append('image', file);
    fd.append('wishes', wishes.trim());
    fd.append('fatness', String(fatness));
    fd.append('count', '1');

    try {
      await api.post<GenerationStartResponse>('/generate/fat-maker', fd);
      setFile(null);
      await Promise.all([galleryRef.current?.refetch(), refreshCredits()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <button
          onClick={() => router.push('/mini-apps')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All mini apps
        </button>

        <div className="mb-8 flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
            <Smile className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fat Maker</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload a photo of your friend and watch them get rounder. Just for laughs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-8">
          {/* Form */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Friend&apos;s photo
                </label>
                <UploadForm onFile={setFile} currentFile={file} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tell us your wishes (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="E.g. 'add a double chin', 'make him look like a sumo wrestler', 'keep it subtle'."
                  value={wishes}
                  onChange={(e) => setWishes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors resize-y"
                />
              </div>

              <FatnessSlider value={fatness} onChange={setFatness} />

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <FatMakerSubmit submitting={submitting} fileMissing={!file} />
            </form>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Be kind — only upload photos of friends who are in on the joke.
            </p>
          </div>

          {/* Right pane: generations */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Your generations</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                New generations appear here as they process.
              </p>
            </div>
            <GenerationsGallery
              ref={galleryRef}
              gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-4"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function FatnessSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const labelFor = (n: number) =>
    n <= 3 ? 'Subtle' : n <= 7 ? 'Noticeable' : 'Cartoonish';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          Fatness scale
        </label>
        <span className="text-sm font-semibold text-brand-600 tabular-nums">
          {value}/10 · {labelFor(value)}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Subtle</span>
        <span>Noticeable</span>
        <span>Cartoonish</span>
      </div>
    </div>
  );
}

function FatMakerSubmit({
  submitting,
  fileMissing,
}: {
  submitting: boolean;
  fileMissing: boolean;
}) {
  const { balance } = useCredits();
  const cost = bundlePriceForCount(1);
  const insufficient = balance !== null && balance < cost;
  const disabled = submitting || fileMissing || insufficient;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
    >
      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {submitting
        ? 'Generating…'
        : insufficient
          ? `Need ${cost} credits — top up`
          : (
            <>
              Make them fat
              <span className="opacity-80 font-normal">· {cost} credits</span>
            </>
          )}
    </button>
  );
}
