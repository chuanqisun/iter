import type { GenericOptions } from "./base";

export function getOpenAIOptions(model: string): GenericOptions {
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
  };
}
