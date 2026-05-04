'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertCircle, ImageOff, Download } from 'lucide-react';
import type { Generation } from '@/lib/types';
import { imageUrlOf } from '@/lib/types';
import { useT } from '@/lib/i18n';

interface GenerationCardProps {
  generation: Generation;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_STYLES: Record<Generation['status'], string> = {
  pending:    'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed:  'bg-green-50 text-green-700 border-green-200',
  failed:     'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: Generation['status'] }) {
  const { t } = useT();
  const STATUS_LABELS: Record<Generation['status'], string> = {
    pending:    t.generationCard.pending,
    processing: t.generationCard.processing,
    completed:  t.generationCard.completed,
    failed:     t.generationCard.failed,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {(status === 'pending' || status === 'processing') && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {status === 'failed' && <AlertCircle className="w-3 h-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function GenerationCard({ generation, onDelete }: GenerationCardProps) {
  const { t, locale } = useT();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t.generationCard.confirmDelete)) return;
    setDeleting(true);
    try {
      await onDelete(generation.id);
    } finally {
      setDeleting(false);
    }
  };

  const MINI_APP_LABELS: Record<string, string> = {
    fat_maker: t.generationCard.fatMaker,
    chess: t.generationCard.chess,
  };

  const typeLabel = (() => {
    switch (generation.type) {
      case 'marketplace': return t.generationCard.marketplace;
      case 'ugc':         return t.generationCard.ugc;
      case 'enhance':     return t.generationCard.enhance;
      case 'listing_pack': return t.generationCard.listingPack;
      case 'mini_app': {
        const appId = (generation.input_data as { app_id?: string } | null)?.app_id;
        return appId ? MINI_APP_LABELS[appId] ?? t.generationCard.miniApp : t.generationCard.miniApp;
      }
      default: return '';
    }
  })();

  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const date = new Date(generation.created_at).toLocaleDateString(dateLocale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image area */}
      <div className="relative bg-gray-50">
        {generation.status === 'completed' && generation.image_urls.length > 0 ? (
          <div className={`grid gap-0.5 ${generation.image_urls.length >= 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {generation.image_urls.slice(0, 4).map((entry, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={imageUrlOf(entry)}
                alt={`Generated image ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 text-gray-300">
            {generation.status === 'pending' || generation.status === 'processing' ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-brand-300" />
                <span className="text-xs text-gray-400">{t.generationCard.generating}</span>
              </>
            ) : (
              <>
                <ImageOff className="w-8 h-8" />
                <span className="text-xs">{t.generationCard.noImages}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={generation.status} />
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            {typeLabel}
          </span>
        </div>

        <p className="text-xs text-gray-400">{date}</p>

        {generation.error_message && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">
            {generation.error_message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
          {generation.status === 'completed' && generation.image_urls.length > 0 && (
            <a
              href={imageUrlOf(generation.image_urls[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              {t.generationCard.download}
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {t.generationCard.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
