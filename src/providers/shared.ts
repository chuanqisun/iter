import type { GenericOptions } from "./base";

export function getOpenAIOptions(model: string): GenericOptions {
  const isTemperatureSupported = model.startsWith("gpt") && !model.startsWith("gpt-5");
  const reasoningOptions = [];
  if (model.startsWith("o") || model.startsWith("codex")) {
    reasoningOptions.push("low", "medium", "high");
  } else if (model.startsWith("gpt-5")) {
    reasoningOptions.push("minimal", "low", "medium", "high");
  }

  const verbosityOptions = [];
  if (model.startsWith("gpt-5")) {
    verbosityOptions.push("low", "medium", "high");
  }

  return {
    temperature: isTemperatureSupported ? { max: 2 } : undefined,
    reasoningEffort: reasoningOptions.length > 0 ? reasoningOptions : undefined,
    verbosity: verbosityOptions.length > 0 ? verbosityOptions : undefined,
  };
}
