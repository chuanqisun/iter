import type { ModelParamOptions, ModelParams } from "./base";

export const DEFAULT_MAX_TOKENS = 64000;
export const MAX_TOKENS_LIMIT = 128000;
export const DEFAULT_MIN_CODING_SCORE = 0.5;

export class OutputIndexPacer {
  private previousIndex?: number;

  process(index: number | undefined, delta: string): string {
    if (!delta) return delta;
    const shouldInsertSpace = this.previousIndex !== undefined && index !== undefined && this.previousIndex !== index;
    if (index !== undefined) {
      this.previousIndex = index;
    }
    return shouldInsertSpace ? `\n\n${delta}` : delta;
  }
}

export function getOpenAIOptions(model: string): ModelParamOptions {
  const isTemperatureSupported = model.startsWith("gpt") && !model.startsWith("gpt-5");
  const reasoningOptions = [];
  if (model.startsWith("gpt-5.6")) {
    reasoningOptions.push("none", "low", "medium", "high", "xhigh", "max");
  } else if (model.endsWith("gpt-5.5-pro")) {
    reasoningOptions.push("medium", "high", "xhigh");
  } else if (model.startsWith("gpt-5.5")) {
    reasoningOptions.push("none", "low", "medium", "high", "xhigh");
  }

  const verbosityOptions = [];
  if (model.startsWith("gpt-5")) {
    verbosityOptions.push("low", "medium", "high");
  }

  return {
    temperature: isTemperatureSupported ? { max: 2 } : undefined,
    reasoningEffort: reasoningOptions.length > 0 ? reasoningOptions : undefined,
    verbosity: verbosityOptions.length > 0 ? verbosityOptions : undefined,
    serviceTier: ["auto", "fast", "flex"],
  };
}

export function clampNumber(
  val: number | undefined,
  range: { min?: number; max: number } | undefined,
  defaultVal?: number,
): number | undefined {
  if (!range) return undefined;
  const min = range.min ?? 0;
  const max = range.max;
  const num = typeof val === "number" && !Number.isNaN(val) ? val : (defaultVal ?? min);
  return Math.max(min, Math.min(max, num));
}

export function selectEnum<T extends string>(val: string | undefined, allowed: T[] | undefined): T | undefined {
  if (!allowed || allowed.length === 0) return undefined;
  if (val && allowed.includes(val as T)) {
    return val as T;
  }
  return allowed[0];
}

export function sanitizeParamsFromOptions(options: ModelParamOptions, params: ModelParams): ModelParams {
  const maxTokens = options.maxTokens
    ? clampNumber(params.maxTokens, options.maxTokens, options.maxTokens.max)
    : typeof params.maxTokens === "number" && !Number.isNaN(params.maxTokens)
      ? Math.max(0, Math.min(MAX_TOKENS_LIMIT, params.maxTokens))
      : DEFAULT_MAX_TOKENS;

  return {
    temperature: clampNumber(params.temperature, options.temperature, options.temperature?.min ?? 0),
    maxTokens,
    reasoningEffort: selectEnum(params.reasoningEffort, options.reasoningEffort),
    verbosity: selectEnum(params.verbosity, options.verbosity),
    thinkingBudget: clampNumber(params.thinkingBudget, options.thinkingBudget, options.thinkingBudget?.min ?? 0),
    serviceTier: selectEnum(params.serviceTier, options.serviceTier),
    sort: selectEnum(params.sort, options.sort),
    costTier: selectEnum(params.costTier, options.costTier),
    minCodingScore: clampNumber(params.minCodingScore, options.minCodingScore, DEFAULT_MIN_CODING_SCORE),
  };
}

export function parseEndpoint(val: FormDataEntryValue | string | null | undefined): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function parseModelList(val: FormDataEntryValue | string | null | undefined): string | undefined {
  if (typeof val !== "string") return undefined;
  const items = val
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items.join(",") : undefined;
}
