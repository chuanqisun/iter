import type {
  EasyInputMessage,
  Response,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputItem,
  ResponseInputText,
  ResponseOutputText,
} from "openai/resources/responses/responses.mjs";
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
      const stream = client.responses.stream(
        {
          input: that.getOpenRouterMessages(messages, { isSystemMessageSupported }),
          model: connection.model,
          tools: tools.length > 0 ? (tools as any) : undefined,
          temperature: options.temperature !== undefined ? config?.temperature : undefined,
          ...reasoning,
          max_output_tokens: config?.maxTokens,
          top_p: config?.topP,
          user: "iter", // HACK: this seems to significantly improve cache hit rate
        },
        {
          signal: abortSignal,
        },
      );

      const pacer = new OutputIndexPacer();
      for await (const message of stream) {
        if (message.type === "response.output_text.delta" && message.delta) {
          latencyMs ??= performance.now() - start;
          yield pacer.process((message as any).output_index, message.delta);
        }
      }

      const finalResponse = await stream.finalResponse();
      const citations = that.extractCitations(finalResponse);
      const references = formatReferences(citations);
      if (references) {
        yield references;
      }

      const finalUsage = finalResponse.usage;
      if (finalUsage) {
        config?.onMetadata?.({
          cachedInputTokens: finalUsage.input_tokens_details?.cached_tokens,
          totalOutputTokens: finalUsage.output_tokens,
          latencyMs,
          durationMs: performance.now() - start,
        });
      }
    };
  }

  private extractCitations(response: Response): Citation[] {
    return (response.output ?? [])
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .flatMap((content) => (content.type === "output_text" ? (content.annotations ?? []) : []))
      .map((ann): Citation | undefined => {
        if (!ann || typeof ann !== "object") return undefined;
        const target =
          ("url_citation" in ann && ann.url_citation && typeof ann.url_citation === "object"
            ? ann.url_citation
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
  ): ResponseInputItem[] {
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
                  return { type: "input_text", text: dataUrlToText(part.url) } satisfies ResponseInputText;
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "input_image",
                    detail: "auto",
                    image_url: part.url,
                  } satisfies ResponseInputImage;
                } else if (part.type === "application/pdf") {
                  return {
                    type: "input_file",
                    file_data: part.url,
                    filename: part.name,
                  } satisfies ResponseInputFile;
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
                    } satisfies ResponseInputText;
                  }
                  throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
                }
              })
              .filter((part) => part !== null),
          } satisfies EasyInputMessage;
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
              } as ResponseOutputText;
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
                } as ResponseOutputText;
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
          } satisfies EasyInputMessage;
        }
        case "system":
          let finalRole: "developer" | "system" | "user" = "developer";
          if (!options?.isSystemMessageSupported) {
            console.error("System message is not supported for this model, converted to user message");
            finalRole = "user";
          }
          if (typeof message.content === "string") {
            return { role: finalRole, content: message.content } satisfies EasyInputMessage;
          } else {
            return {
              role: finalRole,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            } satisfies EasyInputMessage;
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
