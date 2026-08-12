import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/index.mjs";
import type { ReasoningEffort } from "openai/resources/shared.mjs";
import { dataUrlToText, tryDecodeDataUrlAsText } from "../storage/codec";
import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  GenericChatParams,
  GenericMessage,
  GenericOptions,
} from "./base";
import { formatReferences, type Citation } from "./citation";

export interface OpenRouterCredential extends BaseCredential {
  id: string;
  type: "openrouter";
  accountName: string;
  models: string;
  apiKey: string;
}

export interface OpenRouterConnection extends BaseConnection {
  id: string;
  type: "openrouter";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class OpenRouterProvider implements BaseProvider {
  static type = "openrouter";
  static defaultModels = ["moonshotai/kimi-k2:free", "qwen/qwen3-coder:free"];

  parseNewCredentialForm(formData: FormData): OpenRouterCredential[] {
    const accountName = (formData.get("newAccountName") as string)?.trim() || "openrouter";

    let models = (formData.get("newModels") as string)
      ?.split(",")
      .map((deployment) => deployment.trim())
      .filter(Boolean)
      .join(",");

    if (!models?.length) {
      models = OpenRouterProvider.defaultModels.join(",");
    }

    return [
      {
        id: crypto.randomUUID(),
        type: "openrouter",
        accountName,
        models,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): OpenRouterConnection[] {
    if (!this.isOpenRouterCredential(credential)) throw new Error("Invalid credential type");

    return credential.models.split(",").map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "openrouter",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        }) satisfies OpenRouterConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isOpenRouterCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: credential.models || OpenRouterProvider.defaultModels.join(","),
    };
  }

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isOpenRouterConnection(connection)) throw new Error("Invalid connection type");
    return {
      temperature: { max: 2 },
      reasoningEffort: ["auto", "max", "xhigh", "high", "medium", "low", "minimal", "none"],
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isOpenRouterConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const OpenAI = await import("openai").then((res) => res.OpenAI);
      const client = new OpenAI({
        apiKey: connection.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        dangerouslyAllowBrowser: true,
      });

      const options = that.getOptions(connection);

      const isSystemMessageSupported = !connection.model.startsWith("o1-mini");

      const reasoningEffort = config?.reasoningEffort;
      const reasoning =
        reasoningEffort && reasoningEffort !== "auto"
          ? { reasoning: { effort: reasoningEffort as ReasoningEffort } }
          : {};

      const tools = [
        ...(config.search ? [{ type: "openrouter:web_search" }] : []),
        ...(config.fetch ? [{ type: "openrouter:web_fetch" }] : []),
      ];

      const start = performance.now();
      let latencyMs: number | undefined;
      const stream = await client.chat.completions.create(
        {
          stream: true,
          stream_options: {
            include_usage: true,
          },
          messages: that.getOpenRouterMessage(messages, { isSystemMessageSupported }),
          model: connection.model,
          tools: tools.length > 0 ? (tools as any) : undefined,
          temperature: options.temperature !== undefined ? config?.temperature : undefined,
          ...reasoning,
          max_completion_tokens: config?.maxTokens,
          top_p: config?.topP,
          user: "iter", // HACK: this seems to significantly improve cache hit rate
        },
        {
          signal: abortSignal,
        },
      );

      const citations: Citation[] = [];
      for await (const chunk of stream) {
        citations.push(...that.extractCitationsFromChunk(chunk));
        const content = chunk.choices.at(0)?.delta?.content;
        if (content) {
          latencyMs ??= performance.now() - start;
          yield content;
        }
        if (chunk.usage) {
          config?.onMetadata?.({
            cachedInputTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
            totalOutputTokens:
              (chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0) + chunk.usage.completion_tokens,
            latencyMs,
            durationMs: performance.now() - start,
          });
        }
      }

      const references = formatReferences(citations);
      if (references) {
        yield references;
      }
    };
  }

  private extractCitationsFromChunk(chunk: unknown): Citation[] {
    if (!chunk || typeof chunk !== "object") return [];

    const obj = chunk as Record<string, any>;
    const targets = [obj, ...(Array.isArray(obj.choices) ? obj.choices : []).flatMap((c) => [c, c?.delta, c?.message])];

    const rawAnnotations = targets.flatMap((target) => {
      if (!target || typeof target !== "object") return [];
      const items = [];
      if (Array.isArray(target.annotations)) items.push(...target.annotations);
      if (Array.isArray(target.citations)) items.push(...target.citations);
      return items;
    });

    return rawAnnotations
      .map((ann): Citation | undefined => {
        if (!ann || typeof ann !== "object") return undefined;
        const target =
          (ann.url_citation && typeof ann.url_citation === "object" ? ann.url_citation : null) ??
          (ann.citation && typeof ann.citation === "object" ? ann.citation : null) ??
          ann;

        if (target && typeof target.url === "string" && target.url) {
          return {
            url: target.url,
            title: typeof target.title === "string" ? target.title : undefined,
          };
        }
        return undefined;
      })
      .filter((c): c is Citation => Boolean(c));
  }

  private getOpenRouterMessage(
    messages: GenericMessage[],
    options?: {
      isSystemMessageSupported?: boolean;
    },
  ): ChatCompletionMessageParam[] {
    const convertedMessage = messages.map((message) => {
      switch (message.role) {
        case "user": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };

          return {
            role: message.role,
            content: message.content
              .map((part) => {
                if (part.type === "text/plain" && !part.name) {
                  // unnamed message is the main body text
                  return { type: "text", text: dataUrlToText(part.url) } satisfies ChatCompletionContentPartText;
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "image_url",
                    image_url: { url: part.url },
                  } satisfies ChatCompletionContentPartImage;
                } else if (part.type === "application/pdf") {
                  return {
                    type: "file",
                    file: {
                      file_data: part.url,
                      filename: part.name,
                    },
                  } satisfies ChatCompletionContentPart.File;
                } else {
                  const maybeTextFile = tryDecodeDataUrlAsText(part.url);
                  if (maybeTextFile) {
                    return {
                      type: "text",
                      text: `
\`\`\`${part.name ?? "unnamed"} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                      `.trim(),
                    } satisfies ChatCompletionContentPartText;
                  }
                  throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
                }
              })
              .filter((part) => part !== null),
          } satisfies ChatCompletionUserMessageParam;
        }
        case "assistant": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };
          if (message.content.length === 0) return { role: message.role, content: "" };
          if (message.content.length === 1 && message.content[0].type === "text/plain") {
            return { role: message.role, content: dataUrlToText(message.content[0].url) };
          }

          const corcedOutputTexts = message.content.map((part) => {
            if (part.type === "text/plain") {
              return {
                type: "text",
                text: dataUrlToText(part.url),
              } as ChatCompletionContentPartText;
            } else {
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                return {
                  type: "text",
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                  `.trim(),
                } as ChatCompletionContentPartText;
              }
              throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
            }
          });

          if (!corcedOutputTexts.length) {
            console.warn(`Unable to format assistant message content`, message.content);
            return null;
          }

          return {
            role: message.role,
            content: corcedOutputTexts as any[],
          } satisfies ChatCompletionAssistantMessageParam;
        }
        case "system":
          let finalRole: "system" | "user" = "system";
          if (!options?.isSystemMessageSupported) {
            console.error("System message is not supported for this model, converted to user message");
            finalRole = "user";
          }
          if (typeof message.content === "string") {
            return { role: finalRole, content: message.content } satisfies
              ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam;
          } else {
            return {
              role: finalRole,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            } satisfies ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam;
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m) => m !== null);
  }

  private isOpenRouterCredential(credential: BaseCredential): credential is OpenRouterCredential {
    return credential.type === "openrouter";
  }

  private isOpenRouterConnection(connection: BaseConnection): connection is OpenRouterConnection {
    return connection.type === "openrouter";
  }
}
