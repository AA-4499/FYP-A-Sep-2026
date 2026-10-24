import type { ForecastEvent, ForecastPoint } from "./forecast";

export const GRU_FEATURES = [
  "glucose",
  "meal",
  "insulin",
  "meal_recent_1h",
  "meal_recent_3h",
  "insulin_recent_1h",
  "insulin_recent_3h",
  "hour_sin",
  "hour_cos",
];
export interface BrowserModelFile {
  version: number;
  architecture: string;
  model_sha256: string;
  sequence_length: number;
  hidden_dim: number;
  num_layers: number;
  feature_columns: string[];
  feature_mean: number[];
  feature_scale: number[];
  target_delta_mean: number;
  target_delta_scale: number;
  weights: Record<string, { shape: number[]; base64: string }>;
}
export interface BrowserHistory {
  version: number;
  patient_id: string;
  record_id: string;
  model_sha256: string;
  data_origin: string;
  timestamps: string[];
  features: number[][];
}
export interface BrowserModel extends Omit<BrowserModelFile, "weights"> {
  tensors: Record<string, Float32Array>;
}

export function decodeBrowserModel(file: BrowserModelFile): BrowserModel {
  if (
    file.version !== 1 ||
    file.architecture !== "pytorch-gru-gelu-v1" ||
    !/^[a-f0-9]{64}$/.test(file.model_sha256) ||
    file.hidden_dim !== 64 ||
    file.num_layers !== 2 ||
    file.sequence_length !== 24 ||
    JSON.stringify(file.feature_columns) !== JSON.stringify(GRU_FEATURES) ||
    file.feature_mean.length !== 9 ||
    file.feature_scale.length !== 9 ||
    ![
      ...file.feature_mean,
      ...file.feature_scale,
      file.target_delta_mean,
      file.target_delta_scale,
    ].every(Number.isFinite) ||
    file.feature_scale.some((value) => value <= 0) ||
    file.target_delta_scale <= 0
  )
    throw new Error("The bundled GRU model format is unsupported or invalid.");
  const dimensions: Record<string, number[]> = {};
  for (let layer = 0; layer < 2; layer++) {
    dimensions[`gru.weight_ih_l${layer}`] = [192, layer === 0 ? 9 : 64];
    dimensions[`gru.weight_hh_l${layer}`] = [192, 64];
    dimensions[`gru.bias_ih_l${layer}`] = [192];
    dimensions[`gru.bias_hh_l${layer}`] = [192];
  }
  Object.assign(dimensions, {
    "head.0.weight": [32, 64],
    "head.0.bias": [32],
    "head.3.weight": [1, 32],
    "head.3.bias": [1],
  });
  const tensors: Record<string, Float32Array> = {};
  for (const [name, shape] of Object.entries(dimensions)) {
    const tensor = file.weights[name];
    if (!tensor || JSON.stringify(tensor.shape) !== JSON.stringify(shape))
      throw new Error(`Invalid model tensor: ${name}`);
    const bytes = atob(tensor.base64);
    if (bytes.length !== shape.reduce((a, b) => a * b) * 4)
      throw new Error(`Incomplete model tensor: ${name}`);
    const view = new DataView(
      Uint8Array.from(bytes, (char) => char.charCodeAt(0)).buffer,
    );
    tensors[name] = Float32Array.from({ length: bytes.length / 4 }, (_, i) =>
      view.getFloat32(i * 4, true),
    );
    if (!tensors[name].every(Number.isFinite))
      throw new Error("The model contains nonfinite weights.");
  }
  const { weights: _, ...metadata } = file;
  return { ...metadata, tensors };
}

function sigmoid(value: number) {
  return value >= 0
    ? 1 / (1 + Math.exp(-value))
    : Math.exp(value) / (1 + Math.exp(value));
}
// Approximation to erf (max absolute error about 1.5e-7), for GELU's default
// x * Phi(x). The checkpoint uses GELU, not tanh-GELU or ReLU.
function gelu(value: number) {
  const x = Math.abs(value) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * value * (1 + (value < 0 ? -erf : erf));
}
function affine(
  matrix: Float32Array,
  bias: Float32Array,
  input: ArrayLike<number>,
): Float64Array {
  const result = new Float64Array(bias.length);
  for (let row = 0; row < bias.length; row++) {
    let sum = bias[row];
    for (let col = 0; col < input.length; col++)
      sum += matrix[row * input.length + col] * input[col];
    result[row] = sum;
  }
  return result;
}

/** PyTorch gate order r,z,n; hidden-state reset between independent windows. */
export function predictGruDelta(
  model: BrowserModel,
  features: number[][],
): number {
  if (
    features.length !== model.sequence_length ||
    features.some((row) => row.length !== 9 || !row.every(Number.isFinite))
  )
    throw new Error("The GRU requires 24 complete nine-feature history rows.");
  const states = [new Float32Array(64), new Float32Array(64)];
  for (const row of features) {
    let input: ArrayLike<number> = Float32Array.from(row, (value, col) =>
      Math.fround(
        Math.fround(Math.fround(value) - Math.fround(model.feature_mean[col])) /
          Math.fround(model.feature_scale[col]),
      ),
    );
    for (let layer = 0; layer < 2; layer++) {
      const previous = states[layer];
      const gi = affine(
        model.tensors[`gru.weight_ih_l${layer}`],
        model.tensors[`gru.bias_ih_l${layer}`],
        input,
      );
      const gh = affine(
        model.tensors[`gru.weight_hh_l${layer}`],
        model.tensors[`gru.bias_hh_l${layer}`],
        previous,
      );
      const next = new Float32Array(64);
      for (let i = 0; i < 64; i++) {
        const reset = sigmoid(gi[i] + gh[i]);
        const update = sigmoid(gi[64 + i] + gh[64 + i]);
        const candidate = Math.tanh(gi[128 + i] + reset * gh[128 + i]);
        next[i] = (1 - update) * candidate + update * previous[i];
      }
      states[layer] = next;
      input = next;
    }
  }
  const hidden = affine(
    model.tensors["head.0.weight"],
    model.tensors["head.0.bias"],
    states[1],
  );
  const activated = Float32Array.from(hidden, gelu);
  return Math.fround(
    affine(
      model.tensors["head.3.weight"],
      model.tensors["head.3.bias"],
      activated,
    )[0],
  );
}

// Repository workbook timestamps have no timezone. Use their recorded clock
// consistently across browsers; never reinterpret them in the viewer's timezone.
export function repositoryTime(value: string): number {
  return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z");
}
export function validateBrowserHistory(
  model: BrowserModel,
  history: BrowserHistory,
  patientId: string,
) {
  if (
    history.version !== 1 ||
    history.patient_id !== patientId ||
    history.data_origin !== "repository-workbook" ||
    history.model_sha256 !== model.model_sha256 ||
    history.features.length !== 24 ||
    history.timestamps.length !== 24 ||
    history.features.some(
      (row) => row.length !== 9 || !row.every(Number.isFinite),
    )
  )
    throw new Error(
      "The repository history does not match this patient record and model.",
    );
  const timestamps = history.timestamps.map(repositoryTime);
  if (
    timestamps.some(
      (time, i) =>
        !Number.isFinite(time) ||
        (i > 0 &&
          (time <= timestamps[i - 1] ||
            time - timestamps[i - 1] > 22.5 * 60000)),
    )
  )
    throw new Error("This record has an incomplete recent CGM segment.");
}

/** Match forecast_from_history, including its future-event feature timing. */
export function rolloutBrowserGru(
  model: BrowserModel,
  history: BrowserHistory,
  hours: number,
  events: ForecastEvent[] = [],
): ForecastPoint[] {
  validateBrowserHistory(model, history, history.patient_id);
  if (
    ![3, 6, 12].includes(hours) ||
    events.length > 12 ||
    events.some(
      (event) =>
        !["meal", "insulin"].includes(event.kind) ||
        !Number.isFinite(event.amount) ||
        event.amount <= 0 ||
        !Number.isInteger(event.minutes_ahead) ||
        event.minutes_ahead < 15 ||
        event.minutes_ahead % 15 !== 0 ||
        event.minutes_ahead >= hours * 60,
    )
  )
    throw new Error(
      "Use positive events at 15-minute intervals within a 3-, 6- or 12-hour horizon.",
    );
  let window = history.features.map((row) =>
    Array.from(Float32Array.from(row)),
  );
  let timestamps = history.timestamps.map(repositoryTime);
  const start = timestamps[timestamps.length - 1];
  let glucose = window[window.length - 1][0];
  const points: ForecastPoint[] = [
    {
      timestamp: history.timestamps[history.timestamps.length - 1],
      value: glucose,
    },
  ];
  for (let step = 1; step <= hours * 4; step++) {
    const next = start + step * 15 * 60000;
    const scheduled = events.filter(
      (event) => event.minutes_ahead === step * 15,
    );
    const meal = scheduled
      .filter((event) => event.kind === "meal")
      .reduce((sum, event) => sum + event.amount, 0);
    const insulin = scheduled
      .filter((event) => event.kind === "insulin")
      .reduce((sum, event) => sum + event.amount, 0);
    const recent = [...window, [glucose, meal, insulin]];
    const times = [...timestamps, next];
    const total = (column: number, minutes: number) =>
      recent.reduce(
        (sum, row, i) =>
          sum + (times[i] >= next - minutes * 60000 ? row[column] : 0),
        0,
      );
    const hour =
      new Date(next).getUTCHours() + new Date(next).getUTCMinutes() / 60;
    const delta = predictGruDelta(model, window);
    glucose += delta * model.target_delta_scale + model.target_delta_mean;
    if (!Number.isFinite(glucose))
      throw new Error("The GRU produced a nonfinite prediction.");
    points.push({
      timestamp: new Date(next).toISOString().replace(".000Z", ""),
      value: glucose,
    });
    const appended = Array.from(
      Float32Array.from([
        glucose,
        meal,
        insulin,
        total(1, 60),
        total(1, 180),
        total(2, 60),
        total(2, 180),
        Math.sin((2 * Math.PI * hour) / 24),
        Math.cos((2 * Math.PI * hour) / 24),
      ]),
    );
    window = [...window.slice(1), appended];
    timestamps = times.slice(1);
  }
  return points;
}
