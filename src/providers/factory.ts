import { AnthropicProvider } from "./anthropic";
import type { BaseProvider } from "./base";
import { CerebrasProvider } from "./cerebras";
import { GoogleGenAIProvider } from "./google-gen-ai";
import { InceptionProvider } from "./inception";
import { OpenAIProvider } from "./openai";
import { OpenRouterProvider } from "./openrouter";
import { UnknownProvider } from "./unknown";
import { XAIProvider } from "./xai";

export function createProvider(type: string): BaseProvider {
  switch (type) {
    case OpenAIProvider.type:
      return new OpenAIProvider();
    case AnthropicProvider.type:
      return new AnthropicProvider();
    case CerebrasProvider.type:
      return new CerebrasProvider();
    case GoogleGenAIProvider.type:
      return new GoogleGenAIProvider();
    case XAIProvider.type:
      return new XAIProvider();
    case OpenRouterProvider.type:
      return new OpenRouterProvider();
    case InceptionProvider.type:
      return new InceptionProvider();
    default:
      return new UnknownProvider(type);
  }
}
