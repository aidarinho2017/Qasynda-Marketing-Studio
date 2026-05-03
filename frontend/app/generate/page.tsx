'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  Film,
  LayoutGrid,
  Loader2,
  Settings2,
  Wand2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import UploadForm from '@/components/UploadForm';
import { popHandoff } from '@/app/growth-manager/lib/imageHandoff';
import GenerationsGallery, {
  type GenerationsGalleryHandle,
} from '@/components/GenerationsGallery';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import {
  bundlePriceForCount,
  fullPriceForCount,
  refreshCredits,
  useCredits,
} from '@/lib/credits';
import type { GenerationStartResponse } from '@/lib/types';

// ─── Shared input primitives ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={4}
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors resize-y"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white transition-colors appearance-none"
    />
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Slider({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>Creativity</Label>
        <span className="text-sm font-semibold text-brand-600 tabular-nums">{value}/10</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Faithful</span>
        <span>Balanced</span>
        <span>Bold</span>
      </div>
    </div>
  );
}

function SubmitButton({
  count,
  submitting,
  fileMissing,
}: {
  count: number;
  submitting: boolean;
  fileMissing: boolean;
}) {
  const { balance } = useCredits();
  const cost = bundlePriceForCount(count);
  const insufficient = balance !== null && balance < cost;
  const disabled = submitting || fileMissing || insufficient;

  let label: React.ReactNode;
  if (submitting) {
    label = 'Generating…';
  } else if (insufficient) {
    label = `Need ${cost} credits — top up`;
  } else {
    label = (
      <>
        Generate {count} image{count !== 1 ? 's' : ''}
        <span className="opacity-80 font-normal">· {cost} credits</span>
      </>
    );
  }

  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
    >
      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  );
}

function CountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label>Number of images</Label>
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => {
          const bundle = bundlePriceForCount(n);
          const full = fullPriceForCount(n);
          const hasDiscount = bundle < full;
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={[
                'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border transition-colors',
                selected
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600',
              ].join(' ')}
            >
              <span className="text-base font-semibold leading-none">{n}</span>
              <span
                className={[
                  'text-[11px] font-medium leading-tight',
                  selected ? 'text-white/90' : 'text-gray-700',
                ].join(' ')}
              >
                {bundle} cr
              </span>
              {hasDiscount && (
                <span
                  className={[
                    'text-[10px] line-through leading-none',
                    selected ? 'text-white/60' : 'text-gray-400',
                  ].join(' ')}
                >
                  {full} cr
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Collapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-400" />
          {label}
        </span>
        <ChevronDown
          className={[
            'w-4 h-4 text-gray-400 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-5 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Advanced settings (shared between both modes) ───────────────────────────

interface AdvancedState {
  style: string;
  layout: string;
  creativity: number;
  count: number;
}

function AdvancedSettings({
  state,
  onChange,
  styleOptions,
  referenceFile,
  onReferenceFile,
}: {
  state: AdvancedState;
  onChange: (next: AdvancedState) => void;
  styleOptions: { value: string; label: string }[];
  referenceFile: File | null;
  onReferenceFile: (f: File | null) => void;
}) {
  return (
    <Collapsible label="Advanced settings">
      <div className="grid grid-cols-2 gap-4">
        <FormGroup label="Style">
          <Select
            value={state.style}
            onChange={(e) => onChange({ ...state, style: e.target.value })}
          >
            {styleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Layout">
          <Select
            value={state.layout}
            onChange={(e) => onChange({ ...state, layout: e.target.value })}
          >
            <option value="square">Square (1:1)</option>
            <option value="portrait">Portrait (3:4)</option>
            <option value="landscape">Landscape (16:9)</option>
          </Select>
        </FormGroup>
      </div>

      <Slider
        value={state.creativity}
        onChange={(n) => onChange({ ...state, creativity: n })}
      />

      <div>
        <Label>Reference design (optional)</Label>
        <p className="text-xs text-gray-400 mb-2">
          Upload an image whose style or composition you want the result to take cues from.
        </p>
        {referenceFile ? (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
            <span className="text-sm text-gray-700 truncate">{referenceFile.name}</span>
            <button
              type="button"
              onClick={() => onReferenceFile(null)}
              className="text-xs text-red-500 hover:underline shrink-0"
            >
              Remove
            </button>
          </div>
        ) : (
          <UploadForm onFile={onReferenceFile} />
        )}
      </div>
    </Collapsible>
  );
}

// ─── Marketplace form (Cards) ────────────────────────────────────────────────

const CARD_STYLE_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'premium', label: 'Premium' },
  { value: 'bright', label: 'Bright' },
  { value: 'infographic', label: 'Infographic' },
];

function MarketplaceForm({
  file,
  onFile,
  onSubmit,
  submitting,
  error,
  initialDescription = '',
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSubmit: (form: FormData) => Promise<void>;
  submitting: boolean;
  error: string | null;
  initialDescription?: string;
}) {
  const [description, setDescription] = useState(initialDescription);
  const [advanced, setAdvanced] = useState<AdvancedState>({
    style: 'minimal',
    layout: 'square',
    creativity: 5,
    count: 4,
  });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  // Sync if a handoff description arrives after mount.
  useEffect(() => {
    if (initialDescription && !description) {
      setDescription(initialDescription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Please upload a product image.'); return; }
    if (description.trim().length < 10) {
      alert('Please describe your product in at least 10 characters.');
      return;
    }

    const fd = new FormData();
    fd.append('image', file);
    fd.append('description', description.trim());
    fd.append('style', advanced.style);
    fd.append('layout', advanced.layout);
    fd.append('creativity', String(advanced.creativity));
    fd.append('count', String(advanced.count));
    if (referenceFile) fd.append('reference_image', referenceFile);

    await onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label>Product photo</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <FormGroup label="Tell about your product">
        <Textarea
          placeholder="What is it, who is it for, what makes it special? The more vivid the description, the better the results."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </FormGroup>

      <CountPicker
        value={advanced.count}
        onChange={(n) => setAdvanced({ ...advanced, count: n })}
      />

      <AdvancedSettings
        state={advanced}
        onChange={setAdvanced}
        styleOptions={CARD_STYLE_OPTIONS}
        referenceFile={referenceFile}
        onReferenceFile={setReferenceFile}
      />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <SubmitButton count={advanced.count} submitting={submitting} fileMissing={!file} />
    </form>
  );
}

// ─── UGC form ─────────────────────────────────────────────────────────────────

const UGC_STYLE_OPTIONS = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

function UGCForm({
  file,
  onFile,
  onSubmit,
  submitting,
  error,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSubmit: (form: FormData) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [useCase, setUseCase] = useState('');
  const [wishes, setWishes] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedState>({
    style: 'realistic',
    layout: 'square',
    creativity: 5,
    count: 4,
  });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Please upload a product image.'); return; }
    if (useCase.trim().length < 10) {
      alert('Please describe the use case in at least 10 characters.');
      return;
    }

    const fd = new FormData();
    fd.append('image', file);
    fd.append('use_case', useCase.trim());
    fd.append('wishes', wishes.trim());
    fd.append('style', advanced.style);
    fd.append('layout', advanced.layout);
    fd.append('creativity', String(advanced.creativity));
    fd.append('count', String(advanced.count));
    if (referenceFile) fd.append('reference_image', referenceFile);

    await onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label>Product photo</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <FormGroup label="How is the product being used?">
        <Textarea
          placeholder="Where, when, and by whom is the product used? E.g. 'Used in the kitchen by a 30-year-old home chef while cooking dinner.'"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          required
        />
      </FormGroup>

      <FormGroup label="Wishes (optional)">
        <Textarea
          rows={3}
          placeholder="Any specific mood, lighting, props, or vibe you want? Leave blank to let the AI decide."
          value={wishes}
          onChange={(e) => setWishes(e.target.value)}
        />
      </FormGroup>

      <CountPicker
        value={advanced.count}
        onChange={(n) => setAdvanced({ ...advanced, count: n })}
      />

      <AdvancedSettings
        state={advanced}
        onChange={setAdvanced}
        styleOptions={UGC_STYLE_OPTIONS}
        referenceFile={referenceFile}
        onReferenceFile={setReferenceFile}
      />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <SubmitButton count={advanced.count} submitting={submitting} fileMissing={!file} />
    </form>
  );
}

// ─── Enhance form ────────────────────────────────────────────────────────────

function EnhanceForm({
  file,
  onFile,
  onSubmit,
  submitting,
  error,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSubmit: (form: FormData) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [wishes, setWishes] = useState('');
  const [count, setCount] = useState(4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please upload a product image.');
      return;
    }

    const fd = new FormData();
    fd.append('image', file);
    fd.append('wishes', wishes.trim());
    fd.append('count', String(count));

    await onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label>Product photo</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm text-brand-900 leading-relaxed">
        We&apos;ll automatically:
        <ul className="mt-1.5 ml-1 space-y-0.5 text-brand-800">
          <li>· remove the background</li>
          <li>· fix the lighting</li>
          <li>· sharpen the details</li>
        </ul>
      </div>

      <FormGroup label="Tell us how to improve (optional)">
        <Textarea
          rows={3}
          placeholder="E.g. 'make the colors warmer', 'keep the natural shadow', 'whiter background'. Leave blank to let the AI decide."
          value={wishes}
          onChange={(e) => setWishes(e.target.value)}
        />
      </FormGroup>

      <CountPicker value={count} onChange={setCount} />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <SubmitButton count={count} submitting={submitting} fileMissing={!file} />
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function GenerateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as 'marketplace' | 'ugc' | 'enhance') ?? 'marketplace';

  const [mode, setMode] = useState<'marketplace' | 'ugc' | 'enhance'>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffDescription, setHandoffDescription] = useState<string>('');
  const galleryRef = useRef<GenerationsGalleryHandle>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  // Pick up an image-gen handoff coming from the AI Growth Manager.
  useEffect(() => {
    const key = searchParams.get('handoff');
    if (!key) return;
    const description = popHandoff(key);
    if (description) {
      setHandoffDescription(description);
      setMode('marketplace');
    }
  }, [searchParams]);

  const switchMode = (m: 'marketplace' | 'ugc' | 'enhance') => {
    setMode(m);
    setFile(null);
    setError(null);
  };

  const handleSubmit = async (fd: FormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        mode === 'marketplace'
          ? '/generate/marketplace'
          : mode === 'ugc'
            ? '/generate/ugc'
            : '/generate/enhance';
      await api.post<GenerationStartResponse>(endpoint, fd);
      setFile(null);
      await Promise.all([galleryRef.current?.refetch(), refreshCredits()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New Generation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload your product and tell us about it. Tweak advanced settings if you want.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-8">
          {/* Left: form column */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm mb-6 w-fit">
              <button
                type="button"
                onClick={() => switchMode('marketplace')}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === 'marketplace'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <LayoutGrid className="w-4 h-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => switchMode('ugc')}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === 'ugc'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <Film className="w-4 h-4" />
                UGC
              </button>
              <button
                type="button"
                onClick={() => switchMode('enhance')}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === 'enhance'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <Wand2 className="w-4 h-4" />
                Enhance
              </button>
            </div>

            {/* Form card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {mode === 'marketplace' && (
                <MarketplaceForm
                  file={file}
                  onFile={setFile}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={error}
                  initialDescription={handoffDescription}
                />
              )}
              {mode === 'ugc' && (
                <UGCForm
                  file={file}
                  onFile={setFile}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={error}
                />
              )}
              {mode === 'enhance' && (
                <EnhanceForm
                  file={file}
                  onFile={setFile}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={error}
                />
              )}
            </div>
          </div>

          {/* Right: generations gallery */}
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

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}
