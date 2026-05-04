'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';
import { bundlePriceForCount, refreshCredits, useCredits } from '@/lib/credits';
import { useT, interpolate } from '@/lib/i18n';
import type { CatalogueStartResponse } from '@/lib/types';
import { CATALOGUE_COST_PER_PRODUCT } from '@/lib/types';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function CatalogueNewPage() {
  const { t } = useT();
  const router = useRouter();
  const { balance } = useCredits();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [style, setStyle] = useState('minimal');
  const [layout, setLayout] = useState('square');
  const [creativity, setCreativity] = useState(5);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  // Revoke object URLs on unmount to avoid memory leaks.
  useEffect(() => {
    return () => { previews.forEach(URL.revokeObjectURL); };
  }, [previews]);

  const CARD_STYLE_OPTIONS = [
    { value: 'minimal',     label: t.generate.styleMinimal },
    { value: 'premium',     label: t.generate.stylePremium },
    { value: 'bright',      label: t.generate.styleBright },
    { value: 'infographic', label: t.generate.styleInfographic },
  ];

  const LAYOUT_OPTIONS = [
    { value: 'square',    label: t.generate.squareLayout.replace(' (1:1)', '') },
    { value: 'portrait',  label: t.generate.portraitLayout.replace(' (3:4)', '') },
    { value: 'landscape', label: t.generate.landscapeLayout.replace(' (16:9)', '') },
  ];

  function validateAndAdd(incoming: FileList | File[]) {
    setFileError(null);
    const list = Array.from(incoming);
    const valid: File[] = [];
    for (const f of list) {
      if (!ALLOWED_TYPES.has(f.type)) {
        setFileError(interpolate(t.catalogue.fileNotSupported, { name: f.name }));
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(interpolate(t.catalogue.fileTooLarge, { name: f.name }));
        continue;
      }
      valid.push(f);
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, MAX_FILES);
      if (prev.length + valid.length > MAX_FILES) {
        setFileError(interpolate(t.catalogue.tooManyFiles, { max: MAX_FILES }));
      }
      setPreviews((prevPreviews) => {
        prevPreviews.forEach(URL.revokeObjectURL);
        return combined.map((f) => URL.createObjectURL(f));
      });
      return combined;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPreviews((prevPreviews) => {
        URL.revokeObjectURL(prevPreviews[index]);
        return next.map((f) => URL.createObjectURL(f));
      });
      return next;
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    validateAndAdd(e.dataTransfer.files);
  }, []);

  const totalCost = files.length * CATALOGUE_COST_PER_PRODUCT;
  const insufficientCredits = balance !== null && balance < totalCost && files.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      if (name.trim()) fd.append('name', name.trim());
      fd.append('style', style);
      fd.append('layout', layout);
      fd.append('creativity', String(creativity));
      if (description.trim()) fd.append('description', description.trim());

      const res = await api.post<CatalogueStartResponse>('/catalogue', fd);
      await refreshCredits();
      router.replace(`/catalogue/${res.catalogue_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.catalogue.queuing);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.catalogue.backToAll}
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.catalogue.newTitle}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {interpolate(t.catalogue.newSubtitle, { max: MAX_FILES })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Drop zone */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.catalogue.productImages} <span className="text-red-500">*</span>
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {t.catalogue.dropZone}{' '}
                <span className="text-brand-600 font-medium">{t.catalogue.browse}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{interpolate(t.catalogue.dropZoneHint, { max: MAX_FILES })}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => e.target.files && validateAndAdd(e.target.files)}
              />
            </div>

            {fileError && (
              <p className="mt-2 text-sm text-red-500">{fileError}</p>
            )}

            {/* Thumbnails */}
            {files.length > 0 && (
              <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={files[i].name}
                      className="w-full h-full object-cover rounded-xl border border-gray-100"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 flex items-center justify-center text-gray-300 hover:text-brand-400 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Optional name */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t.catalogue.catalogueName} <span className="text-gray-400 font-normal">{t.catalogue.nameOptional}</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.catalogue.namePH}
              maxLength={255}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
            />
          </section>

          {/* Style + Layout */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.catalogue.style}</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white transition-colors appearance-none"
              >
                {CARD_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.catalogue.layout}</label>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white transition-colors appearance-none"
              >
                {LAYOUT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Creativity slider */}
          <section>
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">{t.catalogue.creativity}</label>
              <span className="text-sm font-semibold text-brand-600 tabular-nums">{creativity}/10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
              className="w-full accent-brand-600 cursor-pointer"
            />
          </section>

          {/* Shared description */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t.catalogue.sharedContext} <span className="text-gray-400 font-normal">{t.catalogue.nameOptional}</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.catalogue.sharedContextPH}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors resize-y"
            />
          </section>

          {/* Credit preview */}
          {files.length > 0 && (
            <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
              insufficientCredits
                ? 'bg-red-50 border border-red-100 text-red-800'
                : 'bg-brand-50 border border-brand-100 text-brand-900'
            }`}>
              {interpolate(t.catalogue.creditsNeeded, {
                count: files.length,
                s: files.length !== 1 ? 's' : '',
                cost: CATALOGUE_COST_PER_PRODUCT,
                total: totalCost,
              })}
              {balance !== null && (
                <span className="ml-2 text-inherit opacity-70">
                  {interpolate(t.catalogue.youHave, { balance })}
                </span>
              )}
              {insufficientCredits && (
                <Link href="/topup" className="ml-2 underline font-medium">
                  {t.catalogue.topUp}
                </Link>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={files.length === 0 || submitting || insufficientCredits}
            className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t.catalogue.queuing}
              </>
            ) : files.length > 0 ? (
              interpolate(t.catalogue.generateBtn, { count: files.length, s: files.length !== 1 ? 's' : '' })
            ) : (
              t.catalogue.generateCatalogue
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
