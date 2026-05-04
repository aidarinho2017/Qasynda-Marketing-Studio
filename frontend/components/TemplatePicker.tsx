'use client';

import { Check, LayoutTemplate, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

export function TemplateStatus({
  selected,
  onClear,
}: {
  selected: string | null;
  onClear: () => void;
}) {
  const { t } = useT();

  if (!selected) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
        <LayoutTemplate className="w-4 h-4" />
        {t.templatePicker.noTemplate}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-brand-200 bg-brand-50 rounded-xl overflow-hidden pr-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={selected} alt="" className="w-12 h-12 object-contain bg-white shrink-0" />
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
        <span className="text-sm font-medium text-brand-700 truncate">{t.templatePicker.templateChosen}</span>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded-lg hover:bg-brand-100 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-brand-500" />
      </button>
    </div>
  );
}
