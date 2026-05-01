'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Crown, Loader2 } from 'lucide-react';
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

type ChessPiece = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

const PIECES: { value: ChessPiece; label: string; emoji: string; desc: string }[] = [
  { value: 'pawn',   label: 'Pawn',   emoji: '♟', desc: 'Humble soldier' },
  { value: 'rook',   label: 'Rook',   emoji: '♜', desc: 'Castle tower' },
  { value: 'knight', label: 'Knight', emoji: '♞', desc: 'Horse warrior' },
  { value: 'bishop', label: 'Bishop', emoji: '♝', desc: 'Mitre-hatted' },
  { value: 'queen',  label: 'Queen',  emoji: '♛', desc: 'Most powerful' },
  { value: 'king',   label: 'King',   emoji: '♚', desc: 'The big boss' },
];

export default function ChessPage() {
  const router = useRouter();
  const galleryRef = useRef<GenerationsGalleryHandle>(null);

  const [file, setFile] = useState<File | null>(null);
  const [piece, setPiece] = useState<ChessPiece>('pawn');
  const [wishes, setWishes] = useState('');
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
    fd.append('piece', piece);
    fd.append('wishes', wishes.trim());

    try {
      await api.post<GenerationStartResponse>('/generate/chess', fd);
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
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chess</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload a photo of your friend and turn them into a chess piece.
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

              <PiecePicker value={piece} onChange={setPiece} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tell us your wishes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="E.g. 'make it dark walnut wood', 'give it a crown', 'marble style'."
                  value={wishes}
                  onChange={(e) => setWishes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors resize-y"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <ChessSubmit submitting={submitting} fileMissing={!file} />
            </form>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Check mate. Your friend never saw this coming.
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

function PiecePicker({
  value,
  onChange,
}: {
  value: ChessPiece;
  onChange: (p: ChessPiece) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Chess piece
      </label>
      <div className="grid grid-cols-3 gap-2">
        {PIECES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
              value === p.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <span className="text-2xl leading-none">{p.emoji}</span>
            <span className="font-semibold text-xs">{p.label}</span>
            <span className="text-xs text-gray-400 font-normal">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChessSubmit({
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
      className="w-full py-3 px-6 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
    >
      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {submitting
        ? 'Generating…'
        : insufficient
          ? `Need ${cost} credits — top up`
          : (
            <>
              Make them a chess piece
              <span className="opacity-80 font-normal">· {cost} credits</span>
            </>
          )}
    </button>
  );
}
