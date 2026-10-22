import React from 'react';
import { CheckCircle2, ClipboardCheck, MessageCircle, ShieldCheck } from 'lucide-react';
import type { ClinicalRecommendation } from '../data/knowledgeGraphDemoData';

interface Props {
  recommendations: ClinicalRecommendation[];
}

function formatSharedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Patient-friendly recommendations shared by their clinician.
 * Intentionally does not render or import any Knowledge Graph elements.
 */
export const PatientRecommendationsView: React.FC<Props> = ({ recommendations }) => {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Shared by your care team
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My recommendations</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Advice and follow-up topics your clinician has chosen to share with you. These are written in plain language rather than a technical medical graph.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
          <ClipboardCheck className="h-4 w-4 text-teal-700" />
          <span className="text-xs font-semibold text-slate-700">{recommendations.length} shared {recommendations.length === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">A note about your recommendations</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your care team reviews suggestions before sharing them. Use these items to guide a conversation with your clinician; do not change medication or treatment based solely on a message shown here.
            </p>
          </div>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recommendations.map((recommendation) => {
            const sharedDate = formatSharedDate(recommendation.publishedAt);
            return (
              <article key={recommendation.id} className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">{recommendation.category}</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved by your doctor
                  </span>
                </div>
                <h2 className="mt-4 text-base font-bold leading-6 text-slate-900">{recommendation.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">{recommendation.patientMessage}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-500">Shared by your care team</span>
                  {sharedDate && <span className="text-[11px] text-slate-400">Shared {sharedDate}</span>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">No recommendations shared yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            When your clinician approves and shares a recommendation, it will appear here. Items that are still being reviewed by your care team are not shown on this page.
          </p>
        </div>
      )}

      <p className="text-[11px] leading-5 text-slate-400">
        Prototype notice: shared items are temporary demonstration data and are not saved to your medical record or sent as notifications.
      </p>
    </section>
  );
};

export default PatientRecommendationsView;
