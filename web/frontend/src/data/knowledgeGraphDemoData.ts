/**
 * UI-only Knowledge Graph and recommendation demo data.
 * All recommendation text is placeholder content until the KG/AI services are connected.
 */
export type RecommendationStatus = 'pending_review' | 'approved' | 'declined' | 'published';

export interface ClinicalRecommendation {
  id: string;
  patientId: string;
  title: string;
  patientMessage: string;
  rationale: string;
  category: string;
  priority: 'For review' | 'Discussion' | 'Routine';
  status: RecommendationStatus;
  publishedAt?: string;
}

const recommendationTemplates: Omit<ClinicalRecommendation, 'id' | 'patientId' | 'status' | 'publishedAt'>[] = [
  {
    title: 'Review the glucose monitoring plan',
    patientMessage: 'Your care team would like to review how and when you monitor your blood glucose.',
    rationale: 'A clinician can review the available glucose history and the patient’s circumstances before deciding whether any monitoring changes are appropriate.',
    category: 'Monitoring',
    priority: 'For review',
  },
  {
    title: 'Discuss everyday nutrition and activity goals',
    patientMessage: 'Your care team would like to discuss practical food and activity goals that fit your routine.',
    rationale: 'Use a shared-decision conversation to identify realistic goals. This placeholder does not prescribe a specific diet or exercise plan.',
    category: 'Lifestyle discussion',
    priority: 'Discussion',
  },
  {
    title: 'Plan the next diabetes follow-up',
    patientMessage: 'Your clinician would like to agree with you on what to review at your next appointment.',
    rationale: 'Confirm the follow-up plan using the full clinical context and the established care plan rather than acting on this placeholder alone.',
    category: 'Follow-up',
    priority: 'Routine',
  },
];

export function createDemoRecommendations(patientId: string): ClinicalRecommendation[] {
  return recommendationTemplates.map((item, index) => ({
    ...item,
    id: patientId + ':demo-recommendation-' + (index + 1),
    patientId,
    status: 'pending_review' as const,
  }));
}
