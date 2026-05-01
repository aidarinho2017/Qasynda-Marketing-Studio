'use client';

import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Megaphone, Sparkles } from 'lucide-react';
import { stashHandoff } from '../../lib/imageHandoff';
import type { AcquisitionStructured } from '../../lib/coachTypes';

export default function AcquisitionOutput({ data }: { data: AcquisitionStructured }) {
  const router = useRouter();

  const handGoToImageGen = () => {
    if (!data.visual_brief) return;
    const key = stashHandoff(data.visual_brief);
    router.push(`/generate?mode=marketplace&handoff=${key}`);
  };

  return (
    <div className="space-y-5">
      {data.ad_hooks?.length > 0 && (
        <Section icon={<Sparkles className="w-4 h-4" />} title="Ad hooks">
          <div className="space-y-2.5">
            {data.ad_hooks.map((h, i) => (
              <div
                key={i}
                className="border border-gray-100 rounded-xl p-3 bg-gray-50/50"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">{h.hook}</p>
                {h.angle && <p className="text-xs text-gray-500 mb-1">Angle: {h.angle}</p>}
                <span className="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                  {h.format_hint}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(data.primary_caption || data.short_caption) && (
        <Section icon={<Megaphone className="w-4 h-4" />} title="Captions">
          {data.primary_caption && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Primary</p>
              <p className="text-sm text-gray-800 leading-relaxed">{data.primary_caption}</p>
            </div>
          )}
          {data.short_caption && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Short</p>
              <p className="text-sm text-gray-800">{data.short_caption}</p>
            </div>
          )}
        </Section>
      )}

      {data.ctas?.length > 0 && (
        <Section title="CTAs">
          <ul className="text-sm text-gray-800 space-y-0.5 list-disc pl-5">
            {data.ctas.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      )}

      {data.visual_brief && (
        <Section icon={<ImageIcon className="w-4 h-4" />} title="Visual brief">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{data.visual_brief}</p>
          <button
            onClick={handGoToImageGen}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Generate visuals
            <span className="opacity-70 text-xs font-normal">(you’ll add a photo)</span>
          </button>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
