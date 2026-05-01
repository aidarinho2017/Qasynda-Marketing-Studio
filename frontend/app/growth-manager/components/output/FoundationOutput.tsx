'use client';

import { Target, Megaphone, Compass, HelpCircle } from 'lucide-react';
import type { FoundationStructured } from '../../lib/coachTypes';

export default function FoundationOutput({ data }: { data: FoundationStructured }) {
  return (
    <div className="space-y-5">
      {data.product_summary && (
        <Section title="Product summary">
          <p className="text-sm text-gray-700 leading-relaxed">{data.product_summary}</p>
        </Section>
      )}

      <Section icon={<Target className="w-4 h-4" />} title="Ideal customer">
        <Field label="Who" value={data.icp?.who} />
        <Field label="Age" value={data.icp?.age_range} />
        <Field label="Where" value={data.icp?.where} />
        {data.icp?.pains?.length > 0 && (
          <BulletGroup label="Pains" items={data.icp.pains} />
        )}
        {data.icp?.jobs_to_be_done?.length > 0 && (
          <BulletGroup label="Jobs to be done" items={data.icp.jobs_to_be_done} />
        )}
      </Section>

      <Section icon={<Megaphone className="w-4 h-4" />} title="Offer">
        {data.offer?.headline && (
          <p className="text-base font-semibold text-gray-900 mb-1.5">{data.offer.headline}</p>
        )}
        {data.offer?.value_props?.length > 0 && (
          <BulletGroup label="Value props" items={data.offer.value_props} />
        )}
        <Field label="Price anchor" value={data.offer?.price_anchor} />
        <Field label="Guarantee" value={data.offer?.guarantee} />
      </Section>

      {data.positioning_angle && (
        <Section icon={<Compass className="w-4 h-4" />} title="Positioning angle">
          <p className="text-sm text-gray-700 italic">{data.positioning_angle}</p>
        </Section>
      )}

      {data.validation_questions?.length > 0 && (
        <Section icon={<HelpCircle className="w-4 h-4" />} title="Validation questions">
          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            {data.validation_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
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

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function BulletGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <ul className="text-sm text-gray-800 space-y-0.5 list-disc pl-5">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
