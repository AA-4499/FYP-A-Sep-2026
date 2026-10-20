import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { Patient } from '../types';
import {
  getCachedRawDetails,
  getCachedRawSummaries,
  getSupabaseClient,
  type SupabasePatientDetail,
  type SupabasePatientSummary,
} from '../lib/supabase';

interface KGNodeData {
  id: string;
  label: string;
  kind: string;
  category: string;
  labels?: string[];
  properties?: Record<string, unknown>;
  source?: string;
}
interface KGEdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  kind?: string;
  properties?: Record<string, unknown>;
  sourceSystem?: string;
}
interface GraphResponse {
  patient_id: string;
  elements: { nodes: ElementDefinition[]; edges: ElementDefinition[] };
  meta?: {
    source?: string;
    read_only?: boolean;
    patient_found_in_neo4j?: boolean;
    ontology_node_count?: number;
    node_count?: number;
    relationship_count?: number;
    uri_type?: string;
  };
}
interface GraphModel {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
  meta?: GraphResponse['meta'];
}
interface Props { patient: Patient; patientId: string; isSupabaseConnected: boolean; }
type ViewFilter = 'all' | 'patient' | 'ontology';
type DetailValue = string | number | boolean | null | undefined;

const API_BASE_URL = (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? '';
const EMPTY_VALUES = new Set(['', '-', '--', 'none', 'nil', 'null', 'n/a', 'na', 'not available', 'unknown']);

const SUMMARY_FIELDS: Array<{
  field: keyof SupabasePatientSummary;
  label: string;
  category: string;
  unit?: string;
  concept?: string;
  display?: (value: DetailValue) => string;
}> = [
  { field: 'Gender (Female=1, Male=2)', label: 'Gender', category: 'demographics', display: (v) => Number(v) === 1 ? 'Female' : Number(v) === 2 ? 'Male' : String(v ?? '') },
  { field: 'Age (years)', label: 'Age', category: 'demographics', unit: 'years' },
  { field: 'Height (m)', label: 'Height', category: 'demographics', unit: 'm' },
  { field: 'Weight (kg)', label: 'Weight', category: 'demographics', unit: 'kg' },
  { field: 'BMI (kg/m²)', label: 'BMI', category: 'clinical_data', unit: 'kg/m²', concept: 'BMI' },
  { field: 'Duration of diabetes (years)', label: 'Diabetes duration', category: 'clinical_data', unit: 'years' },
  { field: 'Smoking History (pack year)', label: 'Smoking history', category: 'lifestyle', unit: 'pack-years' },
  { field: 'Alcohol Drinking History (drinker/non-drinker)', label: 'Alcohol history', category: 'lifestyle' },
  { field: 'Fasting Plasma Glucose (mg/dl)', label: 'Fasting plasma glucose', category: 'clinical_data', unit: 'mg/dL', concept: 'Fasting Plasma Glucose' },
  { field: '2-hour Postprandial Plasma Glucose (mg/dl)', label: '2-hour postprandial glucose', category: 'clinical_data', unit: 'mg/dL', concept: 'Postprandial Glucose' },
  { field: 'Fasting C-peptide (nmol/L)', label: 'Fasting C-peptide', category: 'clinical_data', unit: 'nmol/L', concept: 'C-peptide' },
  { field: '2-hour Postprandial C-peptide (nmol/L)', label: '2-hour postprandial C-peptide', category: 'clinical_data', unit: 'nmol/L', concept: 'C-peptide' },
  { field: 'Fasting Insulin (pmol/L)', label: 'Fasting insulin', category: 'clinical_data', unit: 'pmol/L', concept: 'Insulin' },
  { field: '2-hour Postprandial insulin (pmol/L)', label: '2-hour postprandial insulin', category: 'clinical_data', unit: 'pmol/L', concept: 'Insulin' },
  { field: 'HbA1c (mmol/mol)', label: 'HbA1c', category: 'clinical_data', unit: 'mmol/mol', concept: 'HbA1c' },
  { field: 'Glycated Albumin (%)', label: 'Glycated albumin', category: 'clinical_data', unit: '%', concept: 'Glycated Albumin' },
  { field: 'Total Cholesterol (mmol/L)', label: 'Total cholesterol', category: 'clinical_data', unit: 'mmol/L', concept: 'Cholesterol' },
  { field: 'Triglyceride (mmol/L)', label: 'Triglycerides', category: 'clinical_data', unit: 'mmol/L', concept: 'Triglyceride' },
  { field: 'High-Density Lipoprotein Cholesterol (mmol/L)', label: 'HDL cholesterol', category: 'clinical_data', unit: 'mmol/L', concept: 'HDL Cholesterol' },
  { field: 'Low-Density Lipoprotein Cholesterol (mmol/L)', label: 'LDL cholesterol', category: 'clinical_data', unit: 'mmol/L', concept: 'LDL Cholesterol' },
  { field: 'Creatinine (umol/L)', label: 'Creatinine', category: 'clinical_data', unit: 'µmol/L', concept: 'Creatinine' },
  { field: 'Estimated Glomerular Filtration Rate  (ml/min/1.73m²)', label: 'eGFR', category: 'clinical_data', unit: 'mL/min/1.73m²', concept: 'eGFR' },
  { field: 'Uric Acid (mmol/L)', label: 'Uric acid', category: 'clinical_data', unit: 'mmol/L', concept: 'Uric Acid' },
  { field: 'Blood Urea Nitrogen (mmol/L)', label: 'Blood urea nitrogen', category: 'clinical_data', unit: 'mmol/L', concept: 'Blood Urea Nitrogen' },
  { field: 'Hypoglycemic Agents', label: 'Hypoglycemic agents', category: 'medical_data' },
  { field: 'Other Agents', label: 'Other agents', category: 'medical_data' },
];

const CONDITION_FIELDS: Array<{
  field: keyof SupabasePatientSummary;
  relationship: string;
}> = [
  { field: 'Type of Diabetes', relationship: 'has diabetes' },
  { field: 'Comorbidities', relationship: 'has comorbidity' },
  { field: 'Acute Diabetic Complications', relationship: 'has acute complication' },
  { field: 'Diabetic Macrovascular Complications', relationship: 'has macrovascular complication' },
  { field: 'Diabetic Microvascular Complications', relationship: 'has microvascular complication' },
];

const SECTIONS: Record<string, { label: string; description: string }> = {
  demographics: { label: 'Demographics', description: 'Baseline patient attributes' },
  lifestyle: { label: 'Lifestyle', description: 'Recorded smoking and alcohol history' },
  condition: { label: 'Conditions & complications', description: 'Recorded diabetes, comorbidities and complications' },
  clinical_data: { label: 'Clinical measurements', description: 'Summary laboratory and clinical values' },
  medical_data: { label: 'Medical data', description: 'Recorded medications and agents' },
  monitoring: { label: 'Recent monitoring', description: 'Recent CGM, CBG and ketone observations' },
};

const CONCEPT_ALIASES: Record<string, string> = {
  t2dm: 'type 2 diabetes',
  'type 2 diabetes mellitus': 'type 2 diabetes',
  t1dm: 'type 1 diabetes',
  'type 1 diabetes mellitus': 'type 1 diabetes',
  '2-hour postprandial plasma glucose': 'postprandial glucose',
  'fasting c-peptide': 'c-peptide',
  '2-hour postprandial c-peptide': 'c-peptide',
  'fasting insulin': 'insulin',
  '2-hour postprandial insulin': 'insulin',
  'total cholesterol': 'cholesterol',
  'high-density lipoprotein cholesterol': 'hdl cholesterol',
  'low-density lipoprotein cholesterol': 'ldl cholesterol',
  'estimated glomerular filtration rate': 'egfr',
  nephropathy: 'diabetic nephropathy',
  neuropathy: 'diabetic neuropathy',
  retinopathy: 'diabetic retinopathy',
  pad: 'peripheral arterial disease',
  chd: 'coronary heart disease',
};

const CATEGORY_LABELS: Record<string, string> = {
  patient: 'Patient record',
  ontology: 'Medical concept',
  condition: 'Condition / complication',
  clinical_data: 'Clinical measurement',
  demographics: 'Demographics',
  lifestyle: 'Lifestyle',
  medical_data: 'Medical data',
  monitoring: 'Monitoring event',
  group: 'Data category',
  event: 'Clinical event',
  other: 'Other',
};

function slug(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}
function isEmpty(value: DetailValue): boolean {
  return value === null || value === undefined ||
    (typeof value === 'string' && EMPTY_VALUES.has(value.trim().toLowerCase()));
}
function displayValue(value: DetailValue, unit?: string): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number'
    ? Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
    : String(value).trim();
  return unit && text ? text + ' ' + unit : text;
}
function normaliseConcept(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return CONCEPT_ALIASES[cleaned] ?? cleaned;
}
const NEGATIVE_CONDITION_VALUES = new Set([
  'no',
  'negative',
  'absent',
  'not present',
  'no complication',
  'no complications',
  'no comorbidity',
  'no comorbidities',
  'no acute complication',
  'no acute complications',
]);

function splitTerms(value: DetailValue): string[] {
  if (isEmpty(value)) return [];
  if (typeof value !== 'string') return [String(value)];
  if (NEGATIVE_CONDITION_VALUES.has(value.trim().toLowerCase())) return [];
  return value
    .split(/[,;|\\n]+/)
    .map((part) => part.trim())
    .filter((part) => !isEmpty(part) && !NEGATIVE_CONDITION_VALUES.has(part.toLowerCase()));
}
function formatNodeProperties(properties?: Record<string, unknown>): Array<[string, string]> {
  if (!properties) return [];
  const hiddenKeys = new Set(['details']);
  return Object.entries(properties)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
      return [
        key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
        text,
      ] as [string, string];
    })
    .slice(0, 18);
}

function buildGraph(
  patientId: string,
  summary: SupabasePatientSummary | null,
  detailRows: SupabasePatientDetail[],
  auraGraph: GraphResponse | null,
): GraphModel {
  const nodes = new Map<string, ElementDefinition>();
  const edges = new Map<string, ElementDefinition>();
  const addNode = (data: KGNodeData) => {
    const current = nodes.get(data.id)?.data as KGNodeData | undefined;
    nodes.set(data.id, {
      data: current
        ? { ...current, ...data, properties: { ...(current.properties ?? {}), ...(data.properties ?? {}) } }
        : data,
    });
  };
  const addEdge = (data: KGEdgeData) => edges.set(data.id, { data });

  for (const element of auraGraph?.elements.nodes ?? []) {
    const data = element.data as KGNodeData;
    if (data?.id) addNode(data);
  }
  for (const element of auraGraph?.elements.edges ?? []) {
    const data = element.data as KGEdgeData;
    if (data?.id && data.source && data.target) addEdge(data);
  }

  const patientKey = 'patient:' + slug(patientId);
  const patientProperties: Record<string, unknown> = {
    patientId,
    source: summary ? 'Supabase public.patient_summary' : 'Selected patient record',
    dataset: 'ShanghaiT2DM',
    recordType: 'Patient record',
  };
  if (summary) {
    patientProperties['Patient Number'] = summary['Patient Number'];
    patientProperties['Type of Diabetes'] = summary['Type of Diabetes'] ?? null;
  }
  addNode({
    id: patientKey,
    label: 'Patient ' + patientId,
    kind: 'Patient',
    category: 'patient',
    properties: patientProperties,
    source: 'Supabase / selected patient',
  });

  const conceptIdByName = new Map<string, string>();
  for (const item of nodes.values()) {
    const data = item.data as KGNodeData;
    if (data.kind !== 'MedicalConcept') continue;
    const candidates = [data.label, String(data.properties?.name ?? '')];
    for (const name of candidates) if (name) conceptIdByName.set(normaliseConcept(name), data.id);
  }

  const activeSections = new Set<string>();
  const sectionId = (section: string) => 'section:' + slug(patientId) + ':' + section;
  const sectionNode = (section: string) => {
    const definition = SECTIONS[section];
    const id = sectionId(section);
    if (!activeSections.has(section)) {
      addNode({
        id,
        label: definition?.label ?? section,
        kind: 'Category',
        category: 'group',
        properties: { description: definition?.description ?? 'Patient record data category', source: 'Supabase' },
        source: 'Supabase',
      });
      addEdge({
        id: 'edge:' + slug(patientId) + ':section:' + section,
        source: patientKey,
        target: id,
        label: 'has data section',
        kind: 'HAS_DATA_SECTION',
        properties: { source: 'Supabase patient record' },
      });
      activeSections.add(section);
    }
    return id;
  };

  if (summary) {
    const summaryRecordId = summary['Patient Number'] || patientId;
    addNode({
      id: patientKey,
      label: 'Patient ' + summaryRecordId,
      kind: 'Patient',
      category: 'patient',
      properties: { ...patientProperties, 'Patient Number': summaryRecordId },
      source: 'Supabase',
    });

    for (const field of SUMMARY_FIELDS) {
      const rawValue = summary[field.field] as DetailValue;
      if (isEmpty(rawValue)) continue;
      const renderedValue = field.display ? field.display(rawValue) : displayValue(rawValue, field.unit);
      const id = 'supabase:field:' + slug(patientId) + ':' + slug(field.field);
      const groupId = sectionNode(field.category);
      addNode({
        id,
        label: field.label + ': ' + renderedValue,
        kind: 'SupabaseObservation',
        category: field.category,
        properties: {
          source: 'Supabase public.patient_summary',
          sourceField: field.field,
          displayName: field.label,
          recordedValue: renderedValue,
          rawValue,
          patientId: summaryRecordId,
          recordTable: 'patient_summary',
        },
        source: 'Supabase',
      });
      addEdge({
        id: 'edge:' + id + ':section',
        source: groupId,
        target: id,
        label: 'contains',
        kind: 'CONTAINS_FIELD',
        properties: { sourceField: field.field },
      });

      if (field.concept) {
        const targetId = conceptIdByName.get(normaliseConcept(field.concept));
        if (targetId) {
          addEdge({
            id: 'edge:' + id + ':concept:' + targetId,
            source: id,
            target: targetId,
            label: 'measures',
            kind: 'MEASURES',
            properties: { sourceField: field.field, evidenceType: 'Observed patient record' },
          });
        }
      }
    }

    for (const field of CONDITION_FIELDS) {
      const rawValue = summary[field.field] as DetailValue;
      if (isEmpty(rawValue)) continue;
      for (const term of splitTerms(rawValue)) {
        const canonical = normaliseConcept(term);
        const readableName = canonical.split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
        const id = 'supabase:condition:' + slug(patientId) + ':' + slug(field.field) + ':' + slug(readableName);
        const groupId = sectionNode('condition');
        addNode({
          id,
          label: readableName,
          kind: 'SupabaseCondition',
          category: 'condition',
          properties: {
            source: 'Supabase public.patient_summary',
            sourceField: field.field,
            recordedValue: term,
            relationship: field.relationship,
            patientId: summaryRecordId,
          },
          source: 'Supabase',
        });
        addEdge({
          id: 'edge:' + id + ':section',
          source: groupId,
          target: id,
          label: field.relationship,
          kind: 'RECORDED_CONDITION',
          properties: { sourceField: field.field, recordedValue: term },
        });
        const ontologyId = conceptIdByName.get(canonical);
        if (ontologyId) {
          addEdge({
            id: 'edge:' + id + ':ontology:' + ontologyId,
            source: id,
            target: ontologyId,
            label: 'maps to concept',
            kind: 'MAPS_TO_CONCEPT',
            properties: { sourceField: field.field },
          });
        }
      }
    }

    const hypoValue = summary['Hypoglycemia (yes/no)'] as DetailValue;
    if (!isEmpty(hypoValue)) {
      const groupId = sectionNode('condition');
      const id = 'supabase:hypoglycemia-status:' + slug(patientId);
      addNode({
        id,
        label: 'Hypoglycemia reported: ' + String(hypoValue),
        kind: 'SupabaseObservation',
        category: 'condition',
        properties: {
          source: 'Supabase public.patient_summary',
          sourceField: 'Hypoglycemia (yes/no)',
          recordedValue: hypoValue,
          note: 'This source field does not specify severity, timing, or current status.',
        },
        source: 'Supabase',
      });
      addEdge({
        id: 'edge:' + id + ':section',
        source: groupId,
        target: id,
        label: 'records status',
        kind: 'RECORDS_STATUS',
        properties: { sourceField: 'Hypoglycemia (yes/no)' },
      });
      if (String(hypoValue).trim().toLowerCase() === 'yes') {
        const ontologyId = conceptIdByName.get('hypoglycemia');
        if (ontologyId) addEdge({
          id: 'edge:' + id + ':ontology:' + ontologyId,
          source: id,
          target: ontologyId,
          label: 'refers to',
          kind: 'MAPS_TO_CONCEPT',
          properties: { sourceField: 'Hypoglycemia (yes/no)' },
        });
      }
    }
  }

  if (detailRows.length > 0) {
    const rows = detailRows
      .filter((row) => Boolean(row['Date']))
      .slice()
      .sort((a, b) => new Date(String(b.Date)).getTime() - new Date(String(a.Date)).getTime())
      .slice(0, 6);
    for (const row of rows) {
      const date = String(row.Date ?? '');
      const entries: Array<{ field: keyof SupabasePatientDetail; label: string; unit: string; concept: string }> = [
        { field: 'CGM (mg / dl)', label: 'CGM', unit: 'mg/dL', concept: 'CGM' },
        { field: 'CBG (mg / dl)', label: 'CBG', unit: 'mg/dL', concept: 'CBG' },
        { field: 'Blood Ketone (mmol / L)', label: 'Blood ketone', unit: 'mmol/L', concept: 'Blood Ketone' },
      ];
      for (const entry of entries) {
        const raw = row[entry.field] as DetailValue;
        if (isEmpty(raw)) continue;
        const id = 'supabase:detail:' + slug(patientId) + ':' + slug(date) + ':' + slug(entry.field);
        const groupId = sectionNode('monitoring');
        addNode({
          id,
          label: entry.label + ': ' + displayValue(raw, entry.unit),
          kind: 'MonitoringEvent',
          category: 'monitoring',
          properties: {
            source: 'Supabase public.patient_detail',
            sourceField: entry.field,
            recordedValue: displayValue(raw, entry.unit),
            timestamp: date,
            patientId,
            recordTable: 'patient_detail',
          },
          source: 'Supabase',
        });
        addEdge({
          id: 'edge:' + id + ':section',
          source: groupId,
          target: id,
          label: 'observed at',
          kind: 'HAS_MONITORING_EVENT',
          properties: { timestamp: date },
        });
        const conceptId = conceptIdByName.get(normaliseConcept(entry.concept));
        if (conceptId) addEdge({
          id: 'edge:' + id + ':concept:' + conceptId,
          source: id,
          target: conceptId,
          label: 'measures',
          kind: 'MEASURES',
          properties: { sourceField: entry.field, timestamp: date },
        });
      }
      const diet = row['Dietary intake'] as DetailValue;
      if (!isEmpty(diet)) {
        const id = 'supabase:meal:' + slug(patientId) + ':' + slug(date);
        const groupId = sectionNode('lifestyle');
        addNode({
          id,
          label: 'Dietary intake · ' + date.replace('T', ' ').slice(0, 16),
          kind: 'Event',
          category: 'lifestyle',
          properties: { source: 'Supabase public.patient_detail', sourceField: 'Dietary intake', recordedValue: diet, timestamp: date, patientId },
          source: 'Supabase',
        });
        addEdge({
          id: 'edge:' + id + ':section',
          source: groupId,
          target: id,
          label: 'recorded',
          kind: 'HAS_DIETARY_EVENT',
          properties: { timestamp: date },
        });
        const conceptId = conceptIdByName.get('meal');
        if (conceptId) addEdge({
          id: 'edge:' + id + ':concept:' + conceptId,
          source: id,
          target: conceptId,
          label: 'relates to',
          kind: 'INSTANCE_OF',
          properties: { sourceField: 'Dietary intake' },
        });
      }
      const medicationFields: Array<keyof SupabasePatientDetail> = [
        'Insulin dose - s.c.',
        'Insulin dose - i.v.',
        'Non-insulin hypoglycemic agents',
        'CSII - bolus insulin (Novolin R, IU)',
        'CSII - basal insulin (Novolin R, IU / H)',
      ];
      const medicationParts = medicationFields
        .map((field) => ({ field, value: row[field] as DetailValue }))
        .filter((item) => !isEmpty(item.value));
      if (medicationParts.length > 0) {
        const id = 'supabase:treatment:' + slug(patientId) + ':' + slug(date);
        const groupId = sectionNode('medical_data');
        addNode({
          id,
          label: 'Treatment event · ' + date.replace('T', ' ').slice(0, 16),
          kind: 'Event',
          category: 'medical_data',
          properties: {
            source: 'Supabase public.patient_detail',
            timestamp: date,
            patientId,
            recordedFields: medicationParts.map((item) => String(item.field) + ': ' + String(item.value)).join('; '),
            ...Object.fromEntries(medicationParts.map((item) => [item.field, item.value])),
          },
          source: 'Supabase',
        });
        addEdge({
          id: 'edge:' + id + ':section',
          source: groupId,
          target: id,
          label: 'recorded',
          kind: 'HAS_TREATMENT_EVENT',
          properties: { timestamp: date },
        });
        const conceptId = conceptIdByName.get('insulin') ?? conceptIdByName.get('medication');
        if (conceptId) addEdge({
          id: 'edge:' + id + ':concept:' + conceptId,
          source: id,
          target: conceptId,
          label: 'relates to',
          kind: 'INSTANCE_OF',
          properties: { source: 'Supabase public.patient_detail' },
        });
      }
    }
  }

  const allNodes = [...nodes.values()];
  const nodeIds = new Set(allNodes.map((element) => (element.data as KGNodeData).id));
  const safeEdges = [...edges.values()].filter((element) => {
    const edge = element.data as KGEdgeData;
    return nodeIds.has(edge.source) && nodeIds.has(edge.target);
  });
  return { nodes: allNodes, edges: safeEdges, meta: auraGraph?.meta };
}

function categoryClass(category: string): string {
  if (category === 'condition') return 'bg-amber-50 text-amber-800';
  if (category === 'clinical_data' || category === 'monitoring') return 'bg-sky-50 text-sky-800';
  if (category === 'demographics') return 'bg-violet-50 text-violet-800';
  if (category === 'lifestyle') return 'bg-green-50 text-green-800';
  if (category === 'medical_data') return 'bg-rose-50 text-rose-800';
  if (category === 'ontology') return 'bg-indigo-50 text-indigo-800';
  if (category === 'patient') return 'bg-blue-50 text-blue-800';
  return 'bg-slate-100 text-slate-700';
}

function nodeProperties(node?: KGNodeData): Array<[string, string]> {
  if (!node) return [];
  const result = formatNodeProperties(node.properties);
  const seen = new Set(result.map(([label]) => label.toLowerCase()));
  const additions: Array<[string, string]> = [
    ['Type', node.kind],
    ['Category', CATEGORY_LABELS[node.category] ?? node.category],
  ];
  for (const [label, value] of additions) {
    if (!seen.has(label.toLowerCase())) result.unshift([label, value]);
  }
  return result.slice(0, 18);
}

export const KnowledgeGraphView: React.FC<Props> = ({ patient, patientId, isSupabaseConnected }) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [summary, setSummary] = useState<SupabasePatientSummary | null>(null);
  const [detailRows, setDetailRows] = useState<SupabasePatientDetail[]>([]);
  const [auraGraph, setAuraGraph] = useState<GraphResponse | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [auraError, setAuraError] = useState<string | null>(null);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [loadingAura, setLoadingAura] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingSupabase(true);
      setLoadingAura(true);
      setSummary(null);
      setDetailRows([]);
      setAuraGraph(null);
      setSupabaseError(null);
      setAuraError(null);
      setSelectedNodeId(null);

      const client = getSupabaseClient();
      if (!client) {
        if (!cancelled) setSupabaseError('Supabase client is not configured. Use the team Supabase configuration in the top bar.');
      } else {
        try {
          const cachedSummary = getCachedRawSummaries().find((row) => String(row['Patient Number']) === String(patientId));
          let sourceSummary: SupabasePatientSummary | null = cachedSummary ?? null;
          if (!sourceSummary) {
            const { data, error } = await client
              .from('patient_summary')
              .select('*')
              .eq('Patient Number', patientId)
              .maybeSingle();
            if (error) throw new Error(error.message);
            sourceSummary = (data as SupabasePatientSummary | null) ?? null;
          }
          const cachedDetails = getCachedRawDetails()
            .filter((row) => String(row['Patient Number']) === String(patientId))
            .sort((a, b) => new Date(String(b.Date ?? '')).getTime() - new Date(String(a.Date ?? '')).getTime())
            .slice(0, 24);
          let sourceDetails = cachedDetails;
          if (sourceDetails.length === 0) {
            const { data, error } = await client
              .from('patient_detail')
              .select('*')
              .eq('Patient Number', patientId)
              .order('Date', { ascending: false })
              .limit(24);
            if (error) throw new Error(error.message);
            sourceDetails = (data ?? []) as SupabasePatientDetail[];
          }
          if (!cancelled) {
            setSummary(sourceSummary);
            setDetailRows(sourceDetails);
            if (!sourceSummary) setSupabaseError('No patient_summary row was returned for selected record ' + patientId + '.');
          }
        } catch (error) {
          if (!cancelled) setSupabaseError(error instanceof Error ? error.message : 'Could not read the selected patient from Supabase.');
        } finally {
          if (!cancelled) setLoadingSupabase(false);
        }
      }
      if (!client && !cancelled) setLoadingSupabase(false);

      try {
        const sessionResult = client ? await client.auth.getSession() : null;
        const accessToken = sessionResult?.data.session?.access_token;
        if (!accessToken) {
          if (!cancelled) setAuraError('Sign in with a doctor or administrator account to request the protected Neo4j graph. Supabase data remains read-only.');
        } else {
          const url = API_BASE_URL + '/api/doctor/knowledge-graph?patient_id=' + encodeURIComponent(patientId);
          const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken },
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Neo4j knowledge graph request failed (' + response.status + ').');
          if (!cancelled) setAuraGraph(payload as GraphResponse);
        }
      } catch (error) {
        if (!cancelled) setAuraError(error instanceof Error ? error.message : 'Could not load the Neo4j medical concept graph.');
      } finally {
        if (!cancelled) setLoadingAura(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [patientId, isSupabaseConnected]);

  const graph = useMemo(
    () => buildGraph(patientId, summary, detailRows, auraGraph),
    [patientId, summary, detailRows, auraGraph],
  );

  const visibleElements = useMemo(() => {
    const visibleNodes = graph.nodes.filter((element) => {
      const node = element.data as KGNodeData;
      if (filter === 'patient') return node.kind !== 'MedicalConcept' && node.category !== 'ontology';
      if (filter === 'ontology') return node.kind === 'MedicalConcept';
      return true;
    });
    const ids = new Set(visibleNodes.map((element) => (element.data as KGNodeData).id));
    const visibleEdges = graph.edges.filter((element) => {
      const edge = element.data as KGEdgeData;
      if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
      if (filter === 'ontology') {
        const source = visibleNodes.find((node) => (node.data as KGNodeData).id === edge.source)?.data as KGNodeData | undefined;
        const target = visibleNodes.find((node) => (node.data as KGNodeData).id === edge.target)?.data as KGNodeData | undefined;
        return Boolean(source && target && source.kind === 'MedicalConcept' && target.kind === 'MedicalConcept');
      }
      return true;
    });
    return [...visibleNodes, ...visibleEdges];
  }, [graph, filter]);

  const visibleNodeList = visibleElements
    .filter((element) => {
      const data = element.data as KGNodeData & Partial<KGEdgeData>;
      return !(typeof data.source === 'string' && typeof data.target === 'string');
    })
    .map((element) => element.data as KGNodeData);
  const visibleNodeIds = new Set(visibleNodeList.map((node) => node.id));
  const nodeList = graph.nodes.map((element) => element.data as KGNodeData);
  const selectedNode =
    visibleNodeList.find((node) => node.id === selectedNodeId) ??
    visibleNodeList.find((node) => node.kind === 'Patient') ??
    visibleNodeList[0] ??
    null;
  const selectedEdges = selectedNode
    ? graph.edges.map((element) => element.data as KGEdgeData)
      .filter((edge) =>
        (edge.source === selectedNode.id || edge.target === selectedNode.id) &&
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target),
      )
      .slice(0, 20)
    : [];
  const conditionsCount = nodeList.filter((node) => node.category === 'condition' || node.kind === 'SupabaseCondition').length;
  const observationCount = nodeList.filter((node) => ['SupabaseObservation', 'MonitoringEvent'].includes(node.kind)).length;
  const conceptCount = nodeList.filter((node) => node.kind === 'MedicalConcept').length;
  const loading = loadingSupabase || loadingAura;
  const supabaseConnected = Boolean(summary);
  const auraConnected = Boolean(auraGraph);
  const selectedPatientNodeId = 'patient:' + slug(patientId);

  useEffect(() => {
    if (!canvasRef.current) return;
    cyRef.current?.destroy();
    const cy = cytoscape({
      container: canvasRef.current,
      elements: visibleElements,
      layout: {
        name: 'cose',
        animate: false,
        padding: 42,
        nodeRepulsion: () => 9500,
        idealEdgeLength: () => 115,
        componentSpacing: 90,
        nodeDimensionsIncludeLabels: true,
      },
      minZoom: 0.25,
      maxZoom: 2.5,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-size': 10,
            'font-weight': 600,
            color: '#0f172a',
            'text-wrap': 'wrap',
            'text-max-width': '155px',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#e0f2fe',
            'border-width': 1.5,
            'border-color': '#0284c7',
            width: 128,
            height: 48,
            shape: 'round-rectangle',
            padding: '6px',
          },
        },
        {
          selector: 'node[kind = "Patient"]',
          style: {
            label: 'data(label)',
            shape: 'ellipse',
            'background-color': '#1d4ed8',
            'border-color': '#1e40af',
            color: '#ffffff',
            width: 112,
            height: 112,
            'font-size': 14,
            'font-weight': 700,
          },
        },
        {
          selector: 'node[kind = "Category"]',
          style: {
            'background-color': '#f1f5f9',
            'border-color': '#64748b',
            shape: 'round-rectangle',
            width: 135,
            height: 42,
            'font-size': 10,
            'font-weight': 700,
          },
        },
        {
          selector: 'node[kind = "MedicalConcept"]',
          style: { 'background-color': '#e0e7ff', 'border-color': '#6366f1', width: 132, height: 50 },
        },
        {
          selector: 'node[category = "condition"]',
          style: { 'background-color': '#fef3c7', 'border-color': '#d97706' },
        },
        {
          selector: 'node[category = "clinical_data"], node[category = "monitoring"]',
          style: { 'background-color': '#e0f2fe', 'border-color': '#0284c7' },
        },
        {
          selector: 'node[category = "demographics"]',
          style: { 'background-color': '#ede9fe', 'border-color': '#7c3aed' },
        },
        {
          selector: 'node[category = "lifestyle"]',
          style: { 'background-color': '#dcfce7', 'border-color': '#16a34a' },
        },
        {
          selector: 'node[category = "medical_data"]',
          style: { 'background-color': '#ffe4e6', 'border-color': '#e11d48' },
        },
        {
          selector: 'node.selected',
          style: { 'border-width': 4, 'border-color': '#7c3aed', 'overlay-opacity': 0.1, 'overlay-color': '#7c3aed' },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 8,
            color: '#475569',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
          },
        },
      ],
    });
    cy.on('tap', 'node', (event) => setSelectedNodeId(String(event.target.id())));
    cyRef.current = cy;
    if (selectedNodeId) cy.$id(selectedNodeId).addClass('selected');
    return () => {
      cy.off('tap');
      cy.destroy();
      cyRef.current = null;
    };
  }, [visibleElements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('selected');
    const id = selectedNode?.id ?? selectedPatientNodeId;
    cy.$id(id).addClass('selected');
  }, [selectedNode?.id, visibleElements, selectedPatientNodeId]);

  const focusNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('selected');
    cy.$id(nodeId).addClass('selected');
    cy.animate({ center: { eles: cy.$id(nodeId) }, duration: 180 });
  };
  const resetGraph = () => {
    setFilter('all');
    setSelectedNodeId(selectedPatientNodeId);
    const cy = cyRef.current;
    if (cy) {
      cy.fit(undefined, 38);
      cy.animate({ center: { eles: cy.$id(selectedPatientNodeId) }, duration: 180 });
    }
  };

  const filters: Array<{ value: ViewFilter; label: string }> = [
    { value: 'all', label: 'All connected data' },
    { value: 'patient', label: 'Patient context' },
    { value: 'ontology', label: 'Medical concepts' },
  ];

  return (
    <section className="space-y-5 pb-12" aria-labelledby="doctor-kg-title">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-800">Doctor workspace</span>
            <span className="text-xs text-slate-400">Patient-specific context · read-only graph request</span>
          </div>
          <h2 id="doctor-kg-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Clinical Knowledge Graph</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Inspect the selected patient&apos;s recorded conditions and clinical data alongside the shared medical-concept network. Select a node to inspect its source properties.
          </p>
        </div>
        <button type="button" onClick={resetGraph} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          <span aria-hidden="true">↺</span> Reset graph
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected patient record</p>
          <p className="mt-2 break-all text-lg font-bold text-slate-900">{patientId}</p>
          <p className="mt-1 text-xs text-slate-500">{patient.name}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Graph nodes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{graph.nodes.length}</p>
          <p className="mt-1 text-xs text-slate-500">{conceptCount} Neo4j medical concepts</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Relationships</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{graph.edges.length}</p>
          <p className="mt-1 text-xs text-slate-500">{conditionsCount} condition nodes · {observationCount} observations</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Data connections</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + (supabaseConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              Supabase {loadingSupabase ? 'loading' : supabaseConnected ? 'loaded' : 'unavailable'}
            </span>
            <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + (auraConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              Neo4j {loadingAura ? 'loading' : auraConnected ? 'loaded' : 'unavailable'}
            </span>
          </div>
        </div>
      </div>

      {(supabaseError || auraError || (auraGraph && !auraGraph.meta?.patient_found_in_neo4j)) && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Connection / data-source notice</p>
          {supabaseError && <p className="mt-1">Supabase: {supabaseError}</p>}
          {auraError && <p className="mt-1">Neo4j: {auraError}</p>}
          {auraGraph && !auraGraph.meta?.patient_found_in_neo4j && (
            <p className="mt-1">The selected record was not found as a Patient node in Neo4j. The patient fields below come from Supabase and have not been written to Aura.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-slate-500">Graph view</span>
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}
            className={'rounded-full border px-3 py-1.5 text-xs font-semibold transition ' + (filter === item.value
              ? 'border-teal-700 bg-teal-700 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800')}>
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{visibleElements.length} displayed items</span>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Clinical knowledge graph">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Patient & medical concepts</h3>
              <p className="mt-0.5 text-xs text-slate-500">Click a node to view its source fields.</p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Patient</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-indigo-100 ring-1 ring-indigo-500" />Ontology</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-sky-100 ring-1 ring-sky-600" />Clinical</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-600" />Conditions</span>
            </div>
          </div>
          {loading && graph.nodes.length <= 1 && (
            <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">Loading selected patient data and medical concepts…</div>
          )}
          {!loading && graph.nodes.length <= 1 && !summary && !auraGraph && (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-500">
              <p className="font-semibold text-slate-700">No graph data is available.</p>
              <p>Confirm the selected record is visible in Supabase and the backend can read Neo4j Aura.</p>
            </div>
          )}
          <div ref={canvasRef} className="h-[480px] w-full bg-slate-50 sm:h-[620px]" aria-label="Interactive doctor knowledge graph" />
          <p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Supabase data is read for the currently selected patient. The backend fetches the medical-concept graph from Neo4j. This page does not write to or clean up Aura.
          </p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite" aria-labelledby="selected-node-title">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selected node</p>
                <h3 id="selected-node-title" className="mt-1 break-words text-xl font-bold text-slate-900">{selectedNode?.label ?? 'Select a node'}</h3>
              </div>
              {selectedNode && <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + categoryClass(selectedNode.category)}>
                {CATEGORY_LABELS[selectedNode.category] ?? selectedNode.category}
              </span>}
            </div>
            {selectedNode ? (
              <>
                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {nodeProperties(selectedNode).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-500">{label}</p>
                      <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Connected relationships</h4>
                    <span className="text-xs text-slate-400">{selectedEdges.length}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedEdges.length === 0 && <p className="text-xs text-slate-500">No relationships are available for this node.</p>}
                    {selectedEdges.map((edge) => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const other = nodeList.find((node) => node.id === otherId);
                      const direction = edge.source === selectedNode.id ? 'outgoing' : 'incoming';
                      return (
                        <button key={edge.id} type="button" onClick={() => focusNode(otherId)}
                          className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-teal-200 hover:bg-teal-50/60">
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-800">{edge.label}</span>
                            <span className="mt-1 block truncate text-[11px] text-slate-500">{direction} · {other?.label ?? otherId}</span>
                          </span>
                          <span className="text-slate-400" aria-hidden="true">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : <p className="mt-3 text-sm leading-6 text-slate-500">Select a node from the graph to inspect its properties and relationships.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Source summary</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Patient observations and literature-backed concepts are labelled separately.</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-xs text-slate-600">Supabase patient_summary</span>
                <span className={'text-xs font-semibold ' + (summary ? 'text-emerald-700' : 'text-amber-700')}>{summary ? 'Loaded' : loadingSupabase ? 'Loading' : 'Unavailable'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-xs text-slate-600">Supabase patient_detail</span>
                <span className={'text-xs font-semibold ' + (detailRows.length ? 'text-emerald-700' : 'text-slate-500')}>{detailRows.length ? detailRows.length + ' rows' : loadingSupabase ? 'Loading' : 'No rows'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-xs text-slate-600">Neo4j MedicalConcept nodes</span>
                <span className={'text-xs font-semibold ' + (auraGraph ? 'text-emerald-700' : 'text-amber-700')}>{auraGraph ? conceptCount : loadingAura ? 'Loading' : 'Unavailable'}</span>
              </div>
            </div>
            {auraGraph?.meta?.source && <p className="mt-3 text-[11px] text-slate-400">Graph source: {auraGraph.meta.source} · read-only</p>}
          </section>
        </aside>
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm leading-6 text-teal-950">
        <span className="font-semibold">Scope:</span> this is the clinician-facing graph. It combines the selected record&apos;s Supabase observations with the reusable MedicalConcept ontology in Neo4j. The backend only reads Neo4j; it does not seed, delete, or update Aura.
      </div>
    </section>
  );
};

export default KnowledgeGraphView;
