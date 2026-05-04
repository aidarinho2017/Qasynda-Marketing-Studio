'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
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
  triggerInsufficientCredits,
  useCredits,
} from '@/lib/credits';
import { useT, interpolate } from '@/lib/i18n';
import type { GenerationStartResponse } from '@/lib/types';
import { TemplateStatus } from '@/components/TemplatePicker';
import { MARKETPLACE_TEMPLATES, UGC_TEMPLATES } from '@/lib/templates';

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
  const { t } = useT();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{t.generate.creativity}</Label>
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
        <span>{t.generate.faithful}</span>
        <span>{t.generate.balanced}</span>
        <span>{t.generate.bold}</span>
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
  const { t } = useT();
  const { balance } = useCredits();
  const cost = bundlePriceForCount(count);
  const insufficient = balance !== null && balance < cost;

  if (insufficient) {
    return (
      <button
        type="button"
        onClick={() =>
          triggerInsufficientCredits(
            `Need ${cost} credits to generate, you have ${balance}.`,
          )
        }
        className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
      >
        {interpolate(t.generate.needCredits, { cost })}
      </button>
    );
  }

  const imageWord = count === 1 ? t.generate.imageOne : t.generate.imageMany;

  return (
    <button
      type="submit"
      disabled={submitting || fileMissing}
      className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
    >
      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {submitting ? (
        t.generate.generating
      ) : (
        <>
          {interpolate(t.generate.generateButton, { count, imageWord })}
          <span className="opacity-80 font-normal">{interpolate(t.generate.costSuffix, { cost })}</span>
        </>
      )}
    </button>
  );
}

function CountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return (
    <div>
      <Label>{t.generate.numberOfImages}</Label>
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
  const { t } = useT();
  return (
    <Collapsible label={t.generate.advancedSettings}>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup label={t.generate.style}>
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

        <FormGroup label={t.generate.layout}>
          <Select
            value={state.layout}
            onChange={(e) => onChange({ ...state, layout: e.target.value })}
          >
            <option value="square">{t.generate.squareLayout}</option>
            <option value="portrait">{t.generate.portraitLayout}</option>
            <option value="landscape">{t.generate.landscapeLayout}</option>
          </Select>
        </FormGroup>
      </div>

      <Slider
        value={state.creativity}
        onChange={(n) => onChange({ ...state, creativity: n })}
      />

      <div>
        <Label>{t.generate.referenceDesign}</Label>
        <p className="text-xs text-gray-400 mb-2">
          {t.generate.referenceHint}
        </p>
        {referenceFile ? (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
            <span className="text-sm text-gray-700 truncate">{referenceFile.name}</span>
            <button
              type="button"
              onClick={() => onReferenceFile(null)}
              className="text-xs text-red-500 hover:underline shrink-0"
            >
              {t.generate.remove}
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

function MarketplaceForm({
  file,
  onFile,
  onSubmit,
  submitting,
  error,
  initialDescription = '',
  selectedTemplate,
  onClearTemplate,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSubmit: (form: FormData) => Promise<void>;
  submitting: boolean;
  error: string | null;
  initialDescription?: string;
  selectedTemplate: string | null;
  onClearTemplate: () => void;
}) {
  const { t } = useT();
  const [description, setDescription] = useState(initialDescription);
  const [advanced, setAdvanced] = useState<AdvancedState>({
    style: 'minimal',
    layout: 'square',
    creativity: 5,
    count: 4,
  });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const CARD_STYLE_OPTIONS = [
    { value: 'minimal', label: t.generate.styleMinimal },
    { value: 'premium', label: t.generate.stylePremium },
    { value: 'bright', label: t.generate.styleBright },
    { value: 'infographic', label: t.generate.styleInfographic },
  ];

  // Sync if a handoff description arrives after mount.
  useEffect(() => {
    if (initialDescription && !description) {
      setDescription(initialDescription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert(t.generate.alertUploadImage); return; }
    if (description.trim().length < 10) {
      alert(t.generate.alertDescribeProduct);
      return;
    }

    const fd = new FormData();
    fd.append('image', file);
    fd.append('description', description.trim());
    fd.append('style', advanced.style);
    fd.append('layout', advanced.layout);
    fd.append('creativity', String(advanced.creativity));
    fd.append('count', String(advanced.count));
    let effectiveReference = referenceFile;
    if (!effectiveReference && selectedTemplate) {
      const res = await fetch(selectedTemplate);
      const blob = await res.blob();
      effectiveReference = new File([blob], 'template.png', { type: blob.type });
    }
    if (effectiveReference) fd.append('reference_image', effectiveReference);

    await onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TemplateStatus selected={selectedTemplate} onClear={onClearTemplate} />

      <div>
        <Label>{t.generate.productPhoto}</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <FormGroup label={t.generate.tellAboutProduct}>
        <Textarea
          placeholder={t.generate.tellAboutProductPlaceholder}
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

function UGCForm({
  file,
  onFile,
  onSubmit,
  submitting,
  error,
  selectedTemplate,
  onClearTemplate,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSubmit: (form: FormData) => Promise<void>;
  submitting: boolean;
  error: string | null;
  selectedTemplate: string | null;
  onClearTemplate: () => void;
}) {
  const { t } = useT();
  const [useCase, setUseCase] = useState('');
  const [wishes, setWishes] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedState>({
    style: 'realistic',
    layout: 'square',
    creativity: 5,
    count: 4,
  });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const UGC_STYLE_OPTIONS = [
    { value: 'realistic', label: t.generate.styleRealistic },
    { value: 'instagram', label: t.generate.styleInstagram },
    { value: 'tiktok', label: t.generate.styleTikTok },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert(t.generate.alertUploadImage); return; }
    if (useCase.trim().length < 10) {
      alert(t.generate.alertDescribeUseCase);
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
    let effectiveReference = referenceFile;
    if (!effectiveReference && selectedTemplate) {
      const res = await fetch(selectedTemplate);
      const blob = await res.blob();
      effectiveReference = new File([blob], 'template.png', { type: blob.type });
    }
    if (effectiveReference) fd.append('reference_image', effectiveReference);

    await onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TemplateStatus selected={selectedTemplate} onClear={onClearTemplate} />

      <div>
        <Label>{t.generate.productPhoto}</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <FormGroup label={t.generate.howIsUsed}>
        <Textarea
          placeholder={t.generate.howIsUsedPlaceholder}
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          required
        />
      </FormGroup>

      <FormGroup label={t.generate.wishes}>
        <Textarea
          rows={3}
          placeholder={t.generate.wishesPlaceholder}
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
  const { t } = useT();
  const [wishes, setWishes] = useState('');
  const [count, setCount] = useState(4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert(t.generate.alertUploadImage);
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
        <Label>{t.generate.productPhoto}</Label>
        <UploadForm onFile={onFile} currentFile={file} />
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm text-brand-900 leading-relaxed">
        {t.generate.willAutomatically}
        <ul className="mt-1.5 ml-1 space-y-0.5 text-brand-800">
          <li>{t.generate.removeBg}</li>
          <li>{t.generate.fixLighting}</li>
          <li>{t.generate.sharpenDetails}</li>
        </ul>
      </div>

      <FormGroup label={t.generate.howToImprove}>
        <Textarea
          rows={3}
          placeholder={t.generate.howToImprovePlaceholder}
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
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as 'marketplace' | 'ugc' | 'enhance') ?? 'marketplace';

  const [mode, setMode] = useState<'marketplace' | 'ugc' | 'enhance'>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffDescription, setHandoffDescription] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'generations' | 'templates'>('generations');
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
    setSelectedTemplate(null);
  };

  const currentTemplates =
    mode === 'marketplace' ? MARKETPLACE_TEMPLATES :
    mode === 'ugc' ? UGC_TEMPLATES : [];

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
          <h1 className="text-2xl font-bold text-gray-900">{t.generate.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t.generate.subtitle}
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
                {t.generate.cards}
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
                {t.generate.ugc}
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
                {t.generate.enhance}
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
                  selectedTemplate={selectedTemplate}
                  onClearTemplate={() => setSelectedTemplate(null)}
                />
              )}
              {mode === 'ugc' && (
                <UGCForm
                  file={file}
                  onFile={setFile}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={error}
                  selectedTemplate={selectedTemplate}
                  onClearTemplate={() => setSelectedTemplate(null)}
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

          {/* Right: tabbed panel */}
          <div>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm mb-6 w-fit">
              <button
                type="button"
                onClick={() => setRightTab('generations')}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  rightTab === 'generations'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {t.generate.yourGenerations}
              </button>
              {mode !== 'enhance' && (
                <button
                  type="button"
                  onClick={() => setRightTab('templates')}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    rightTab === 'templates'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {t.generate.templateLibrary}
                </button>
              )}
            </div>

            {/* Generations tab */}
            {rightTab === 'generations' && (
              <GenerationsGallery
                ref={galleryRef}
                gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-4"
              />
            )}

            {/* Templates tab */}
            {rightTab === 'templates' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {currentTemplates.map((path) => {
                  const active = selectedTemplate === path;
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setSelectedTemplate(active ? null : path)}
                      className={[
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-gray-50',
                        active
                          ? 'border-brand-600 shadow-md'
                          : 'border-transparent hover:border-brand-300',
                      ].join(' ')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={path} alt="" className="w-full h-full object-contain" />
                      {active && (
                        <div className="absolute inset-0 bg-brand-600/10 flex items-end justify-end p-1.5">
                          <span className="bg-brand-600 rounded-full p-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
