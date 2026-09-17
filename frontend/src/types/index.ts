export interface FieldDefinition {
  name: string;
  label: string;
  kind: 'number' | 'binary';
  default: number;
  attrs: {
    min?: number;
    max?: number;
    step?: number | string;
  };
}

export interface PatientSummary {
  number: number;
  bmi: number;
  age: number;
  sex: 'Male' | 'Female';
  actual_label: string | null;
}

export interface PatientWindowResponse {
  patient_number: number;
  patient_count: number;
  dataset_name: string;
  actual_label: string | null;
  values: Record<string, number>;
  window: PatientSummary[];
}

export interface RiskProbability {
  class_id: number;
  label: string;
  value: number;
}

export interface PredictionResult {
  predicted_class: number;
  label: string;
  high_risk_probability: number;
  probabilities: RiskProbability[];
}

export interface ShapFactor {
  feature: string;
  value: number;
  shap_value: number;
}

export interface SmplTwin {
  bmi: number;
  beta0: number;
  risk_percent: number;
  color: string;
  band: string;
  has_weights: boolean;
}

export interface TwinMetadata {
  asset_key: string;
  asset_url: string;
  version: string | number;
  bmi: number;
  risk_percent: number;
  gender: string;
  risk_color: string;
}

export interface SimulationChange {
  feature: string;
  from: number;
  to: number;
}

export interface SimulationResponse {
  baseline: PredictionResult;
  scenario: PredictionResult;
  changes: SimulationChange[];
  high_risk_change: number;
  smpl: SmplTwin;
  scenario_smpl: SmplTwin;
  twin_metadata: TwinMetadata | null;
  scenario_twin_metadata: TwinMetadata | null;
}

export interface PredictResponse {
  patient_number: number;
  values: Record<string, number>;
  actual_label: string | null;
  current: PredictionResult;
  explanation: ShapFactor[];
  smpl: SmplTwin;
  smpl_status: string;
  twin_metadata: TwinMetadata | null;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  groups: string[];
  summary: string;
  parent?: string;
  details?: Record<string, any>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  label: string;
  group: string;
  weight?: number;
  shap_value?: number;
}

export interface KnowledgeGraphAttribute {
  key: string;
  label: string;
  kind: string;
  domain: string;
  value: string;
  state: string;
  shap_value: number;
}

export interface KnowledgeGraphLegend {
  key: string;
  label: string;
  color: string;
}

export interface KnowledgeGraphResponse {
  connected: boolean;
  message: string;
  warning: string;
  shap_target: {
    class_id: number;
    label: string;
  };
  attributes: KnowledgeGraphAttribute[];
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  legend: KnowledgeGraphLegend[];
}

export interface GuidanceResponse {
  guidance: string;
  source: string;
  error?: string | null;
  patient_number: number;
}

export interface AppConfig {
  fields: FieldDefinition[];
  scenario_features: string[];
  dataset_name: string;
  patient_count: number;
  risk_labels: Record<number, string>;
  ollama_model: string;
}
