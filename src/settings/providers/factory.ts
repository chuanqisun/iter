import { AnthropicProvider } from "./anthropic";
import { AzureOpenAIProvider } from "./aoai";
import { OpenAIProvider } from "./openai";

export function createProvider(type: string) {
  switch (type) {
    case "openai":
      return new OpenAIProvider();
    case "aoai":
      return new AzureOpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
