import { AnthropicProvider } from "./anthropic";
import { AzureOpenAIProvider } from "./aoai";
import { GoogleGenAIProvider } from "./google-gen-ai";
import { OpenAIProvider } from "./openai";
import { XAIProvider } from "./xai";

export function createProvider(type: string) {
  switch (type) {
    case OpenAIProvider.type:
      return new OpenAIProvider();
    case AzureOpenAIProvider.type:
      return new AzureOpenAIProvider();
    case AnthropicProvider.type:
      return new AnthropicProvider();
    case GoogleGenAIProvider.type:
      return new GoogleGenAIProvider();
    case XAIProvider.type:
      return new XAIProvider();
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
