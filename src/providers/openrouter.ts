import type { OpenResponsesResult, ReasoningEffort, ResponseOutputText, StreamEvents } from "@openrouter/sdk/models";
import { dataUrlToText, tryDecodeDataUrlAsText } from "../storage/codec";
import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  GenericMessage,
  ModelParamOptions,
  RuntimeChatParams,
} from "./base";
import { formatReferences, type Citation } from "./citation";
import { OutputIndexPacer } from "./shared";

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
  static builtInModels = ["auto", "free", "pareto"];
  static defaultModels = ["auto", "free", "pareto"];

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

    const customModels = credential.models
      ? credential.models
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
      : [];

    const allModels = Array.from(new Set([...OpenRouterProvider.builtInModels, ...customModels]));

    return allModels.map(
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

  getOptions(connection: BaseConnection): ModelParamOptions {
    if (!this.isOpenRouterConnection(connection)) throw new Error("Invalid connection type");

    if (connection.model === "auto" || connection.model === "openrouter/auto") {
      return {
        temperature: { max: 2 },
        costTier: ["low", "medium", "high", "xhigh", "max"],
        reasoningEffort: ["auto", "none", "minimal", "low", "medium", "high", "xhigh", "max"],
        sort: ["price", "throughput", "latency"],
      };
    }

    if (connection.model === "pareto" || connection.model === "openrouter/pareto-code") {
      return {
        temperature: { max: 2 },
        sort: ["price", "throughput", "latency"],
        minCodingScore: { min: 0, max: 1, step: 0.05 },
      };
    }

    return {
      temperature: { max: 2 },
      reasoningEffort: ["auto", "none", "minimal", "low", "medium", "high", "xhigh", "max"],
      sort: ["price", "throughput", "latency"],
    };
  }

  private getOpenRouterModel(model: string): string {
    if (model === "auto" || model === "openrouter/auto") return "openrouter/auto";
    if (model === "free" || model === "openrouter/free") return "openrouter/free";
    if (model === "pareto" || model === "openrouter/pareto-code") return "openrouter/pareto-code";
    return model;
  }

  private isRouterModel(model: string): boolean {
    const resolved = this.getOpenRouterModel(model);
    return resolved === "openrouter/auto" || resolved === "openrouter/free" || resolved === "openrouter/pareto-code";
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isOpenRouterConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: RuntimeChatParams) {
      const { OpenRouter } = await import("@openrouter/sdk");
      const client = new OpenRouter({
        apiKey: connection.apiKey,
      });

      const options = that.getOptions(connection);
      const resolvedModel = that.getOpenRouterModel(connection.model);

      const plugins: any[] = [];
      if (connection.model === "auto" || connection.model === "openrouter/auto") {
        if (config?.costTier) {
          plugins.push({
            id: "auto-router",
            cost_tier: config.costTier,
          });
        }
      } else if (connection.model === "pareto" || connection.model === "openrouter/pareto-code") {
        if (config?.minCodingScore !== undefined && !isNaN(config.minCodingScore)) {
          plugins.push({
            id: "pareto-router",
            min_coding_score: config.minCodingScore,
          });
        }
      }

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
      const responseStream = (await client.responses.send(
        {
          responsesRequest: {
            input: that.getOpenRouterMessages(messages, { isSystemMessageSupported }) as any,
            model: resolvedModel,
            tools: tools.length > 0 ? (tools as any) : undefined,
            temperature: options.temperature !== undefined ? config?.temperature : undefined,
            ...reasoning,
            maxOutputTokens: config?.maxTokens,
            user: "iter", // HACK: this seems to significantly improve cache hit rate
            provider: {
              sort: (config?.sort ?? "price") as any,
            },
            plugins: plugins.length > 0 ? (plugins as any) : undefined,
            stream: true,
          },
        },
        {
          signal: abortSignal,
        },
      )) as AsyncIterable<StreamEvents>;

      let finalResponse: OpenResponsesResult | undefined;
      const pacer = new OutputIndexPacer();

      for await (const message of responseStream) {
        if (message.type === "response.output_text.delta" && message.delta) {
          latencyMs ??= performance.now() - start;
          const outputIndex = (message as any).outputIndex ?? (message as any).output_index;
          yield pacer.process(outputIndex, message.delta);
        } else if ("response" in message && message.response) {
          finalResponse = message.response;
        }
      }

      if (finalResponse) {
        const citations = that.extractCitations(finalResponse);
        const references = formatReferences(citations);
        if (references) {
          yield references;
        }

        const finalUsage = finalResponse.usage;
        const cachedInputTokens =
          finalUsage?.inputTokensDetails?.cachedTokens ?? (finalUsage as any)?.input_tokens_details?.cached_tokens;
        const totalOutputTokens = finalUsage?.outputTokens ?? (finalUsage as any)?.output_tokens;
        config?.onMetadata?.({
          model: that.isRouterModel(connection.model) ? finalResponse.model : undefined,
          cachedInputTokens,
          totalOutputTokens,
          latencyMs,
          durationMs: performance.now() - start,
        });
      }
    };
  }

  private extractCitations(response: OpenResponsesResult): Citation[] {
    return (response.output ?? [])
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .flatMap((content) => (content.type === "output_text" ? (content.annotations ?? []) : []))
      .map((ann): Citation | undefined => {
        if (!ann || typeof ann !== "object") return undefined;
        const target =
          ("url_citation" in ann && ann.url_citation && typeof ann.url_citation === "object"
            ? ann.url_citation
            : null) ??
          ("urlCitation" in ann && (ann as any).urlCitation && typeof (ann as any).urlCitation === "object"
            ? (ann as any).urlCitation
            : null) ??
          ("citation" in ann && ann.citation && typeof ann.citation === "object" ? ann.citation : null) ??
          ann;

        if (target && typeof (target as any).url === "string" && (target as any).url) {
          return {
            url: (target as any).url,
            title: typeof (target as any).title === "string" ? (target as any).title : undefined,
          };
        }
        return undefined;
      })
      .filter((c): c is Citation => Boolean(c));
  }

  private getOpenRouterMessages(
    messages: GenericMessage[],
    options?: {
      isSystemMessageSupported?: boolean;
    },
  ) {
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
                  return { type: "input_text", text: dataUrlToText(part.url) };
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "input_image",
                    detail: "auto",
                    imageUrl: part.url,
                    image_url: part.url,
                  };
                } else if (part.type === "application/pdf") {
                  return {
                    type: "input_file",
                    fileData: part.url,
                    file_data: part.url,
                    filename: part.name,
                  };
                } else {
                  const maybeTextFile = tryDecodeDataUrlAsText(part.url);
                  if (maybeTextFile) {
                    return {
                      type: "input_text",
                      text: `
\`\`\`${part.name ?? "unnamed"} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                      `.trim(),
                    };
                  }
                  throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
                }
              })
              .filter((part) => part !== null),
          };
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
                type: "output_text",
                text: dataUrlToText(part.url),
              } satisfies ResponseOutputText;
            } else {
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                return {
                  type: "output_text",
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                  `.trim(),
                } satisfies ResponseOutputText;
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
          };
        }
        case "system":
          let finalRole: "developer" | "system" | "user" = "developer";
          if (!options?.isSystemMessageSupported) {
            console.error("System message is not supported for this model, converted to user message");
            finalRole = "user";
          }
          if (typeof message.content === "string") {
            return { role: finalRole, content: message.content };
          } else {
            return {
              role: finalRole,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            };
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m): m is NonNullable<typeof m> => m !== null);
  }

  private isOpenRouterCredential(credential: BaseCredential): credential is OpenRouterCredential {
    return credential.type === "openrouter";
  }

  private isOpenRouterConnection(connection: BaseConnection): connection is OpenRouterConnection {
    return connection.type === "openrouter";
  }
}
