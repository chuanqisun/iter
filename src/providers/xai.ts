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
  GenericMessage,
  ModelParamOptions,
  RuntimeChatParams,
} from "./base";
import { formatReferences, type Citation } from "./citation";
import { OutputIndexPacer } from "./shared";

export interface XAICredential extends BaseCredential {
  id: string;
  type: "xai";
  accountName: string;
  apiKey: string;
}

export interface XAIConnection extends BaseConnection {
  id: string;
  type: "xai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class XAIProvider implements BaseProvider {
  static type = "xai";
  static defaultModels = ["grok-4.6", "grok-4.5"];

  parseNewCredentialForm(formData: FormData): XAICredential[] {
    const accountName = (formData.get("newAccountName") as string)?.trim() || "xai";

    return [
      {
        id: crypto.randomUUID(),
        type: "xai",
        accountName,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): XAIConnection[] {
    if (!this.isXaiCredential(credential)) throw new Error("Invalid credential type");

    return XAIProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "xai",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        }) satisfies XAIConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isXaiCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: XAIProvider.defaultModels.join(","),
    };
  }

  getOptions(connection: BaseConnection): ModelParamOptions {
    if (!this.isXaiConnection(connection)) throw new Error("Invalid connection type");
    return {
      temperature: { max: 2 },
      reasoningEffort: ["low", "medium", "high", ...(connection.model === "grok-4.6" ? ["xhigh"] : [])],
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isXaiConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: RuntimeChatParams) {
      const OpenAI = await import("openai").then((res) => res.OpenAI);
      const client = new OpenAI({
        apiKey: connection.apiKey,
        baseURL: "https://api.x.ai/v1",
        dangerouslyAllowBrowser: true,
      });

      const options = that.getOptions(connection);

      const start = performance.now();
      let latencyMs: number | undefined;
      const stream = client.responses.stream(
        {
          input: that.getXAIMessages(messages, { isSystemMessageSupported: true }),
          model: connection.model,
          tools: config.search || config.fetch ? [{ type: "web_search" }] : undefined,
          temperature: options.temperature !== undefined ? config?.temperature : undefined,
          ...(options.reasoningEffort
            ? { reasoning: { effort: (config.reasoningEffort ?? options.reasoningEffort.at(0)) as ReasoningEffort } }
            : {}),
          max_output_tokens: config?.maxTokens,
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
    return response.output
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .flatMap((content) => (content.type === "output_text" ? (content.annotations ?? []) : []))
      .filter((annotation) => annotation.type === "url_citation")
      .map((annotation) => ({ url: annotation.url, title: new URL(annotation.url).hostname })); // xAI citation is numeric, domain name is more useful.
  }

  private getXAIMessages(
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
                } else if (part.type === "application/pdf" || part.type.startsWith("application/")) {
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
                  return {
                    type: "input_file",
                    file_data: part.url,
                    filename: part.name,
                  } satisfies ResponseInputFile;
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

  private isXaiCredential(credential: BaseCredential): credential is XAICredential {
    return credential.type === "xai";
  }

  private isXaiConnection(connection: BaseConnection): connection is XAIConnection {
    return connection.type === "xai";
  }
}
