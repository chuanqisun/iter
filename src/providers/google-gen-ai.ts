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

export interface GoogleGenAICredential extends BaseCredential {
  id: string;
  type: "google-gen-ai";
  accountName: string;
  apiKey: string;
}

export interface GoogleGenAIConnection extends BaseConnection {
  id: string;
  type: "google-gen-ai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

const OFFICE_AND_OPENDOCUMENT_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

export class GoogleGenAIProvider implements BaseProvider {
  static type = "google-gen-ai";
  static defaultModels = ["gemini-4-carbon", "gemini-4-neon", "gemini-4-argon", "gemini-4-hydrogen"];

  parseNewCredentialForm(formData: FormData): GoogleGenAICredential[] {
    const accountName = (formData.get("newAccountName") as string)?.trim() || "google-gen-ai";

    return [
      {
        id: crypto.randomUUID(),
        type: "google-gen-ai",
        accountName,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): GoogleGenAIConnection[] {
    if (!this.isGoogleGenAICredential(credential)) throw new Error("Invalid credential type");

    return GoogleGenAIProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "google-gen-ai",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        }) satisfies GoogleGenAIConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isGoogleGenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: GoogleGenAIProvider.defaultModels.join(","),
    };
  }

  getOptions(connection: BaseConnection): ModelParamOptions {
    if (!this.isGoogleGenAIConnection(connection)) throw new Error("Invalid connection type");

    // ref: https://ai.google.dev/gemini-api/docs/thinking
    return {
      reasoningEffort: this.getReasoningEffortConfig(connection.model),
      serviceTier: ["auto", "flex", "priority"],
    };
  }

  private extractCitationsFromAnnotations(annotations?: Array<any>): Citation[] {
    if (!annotations) return [];
    return annotations.flatMap((anno) => {
      const url = anno.url || anno.uri;
      return url ? [{ url, title: anno.title }] : [];
    });
  }

  private getReasoningEffortConfig(model: string): string[] | undefined {
    // neon & hydrogen: minimal/thinking_budget return HTTP 400; default is high, xhigh is supported
    if (model.startsWith("gemini-4-neon") || model.startsWith("gemini-4-hydrogen")) {
      return ["low", "medium", "high", "xhigh"];
    }

    return ["low", "medium", "high"];
  }

  private getFinalThinkingLevel(model: string, inputLevel?: string) {
    const supported = this.getReasoningEffortConfig(model) ?? [];
    return supported.includes(inputLevel!) ? inputLevel! : supported.includes("minimal") ? "minimal" : supported[0];
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isGoogleGenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: RuntimeChatParams) {
      const GoogleGenAI = await import("@google/genai").then((res) => res.GoogleGenAI);
      const client = new GoogleGenAI({ apiKey: connection.apiKey });

      const { system, steps } = that.getGoogleGenAIMessages(messages, connection.model);

      const options = that.getOptions(connection);
      const tools = [
        ...(config.search ? ([{ type: "google_search" }] as const) : []),
        ...(config.fetch ? ([{ type: "url_context" }] as const) : []),
      ];

      const start = performance.now();
      let latencyMs: number | undefined;

      const serviceTier = config.serviceTier ?? options.serviceTier?.at(0);

      const stream = await client.interactions.create(
        {
          model: connection.model,
          input: steps as any,
          stream: true,
          system_instruction: system,
          tools: tools.length ? [...tools] : undefined,
          service_tier: serviceTier && serviceTier !== "auto" ? serviceTier : undefined,
          generation_config: {
            thinking_level: that.getFinalThinkingLevel(connection.model, config.reasoningEffort),
            max_output_tokens: config?.maxTokens,
            ...(options.temperature !== undefined && config?.temperature !== undefined
              ? { temperature: config.temperature }
              : {}),
          } as any,
        },
        {
          signal: abortSignal,
          fetchOptions: { signal: abortSignal },
        },
      );

      const pacer = new OutputIndexPacer();
      let citations: Citation[] = [];
      let totalCachedTokens: number | undefined;
      let totalOutputTokens: number | undefined;
      for await (const event of stream) {
        if (event.event_type === "step.delta" && event.delta) {
          if (event.delta.type === "text" && event.delta.text) {
            latencyMs ??= performance.now() - start;
            yield pacer.process((event as any).index, event.delta.text);
          }
          if (event.delta.type === "text_annotation_delta" && event.delta.annotations) {
            citations.push(...that.extractCitationsFromAnnotations(event.delta.annotations));
          }
        }

        if (event.event_type === "interaction.completed") {
          const interaction = event.interaction;
          if (interaction?.usage) {
            if (interaction.usage.total_cached_tokens !== undefined) {
              totalCachedTokens = (totalCachedTokens ?? 0) + interaction.usage.total_cached_tokens;
            }
            if (interaction.usage.total_output_tokens !== undefined) {
              totalOutputTokens = (totalOutputTokens ?? 0) + interaction.usage.total_output_tokens;
            }
            if (interaction.status !== "requires_continuation") {
              config.onMetadata?.({
                cachedInputTokens: totalCachedTokens,
                totalOutputTokens,
                latencyMs,
                durationMs: performance.now() - start,
              });
            }
          }
          if (interaction?.steps) {
            for (const step of interaction.steps) {
              if (step.type === "model_output" && step.content) {
                for (const c of step.content) {
                  if (c.type === "text" && c.annotations) {
                    citations.push(...that.extractCitationsFromAnnotations(c.annotations));
                  }
                }
              }
            }
          }
        }
      }

      const references = formatReferences(citations);
      if (references) {
        yield references;
      }
    };
  }

  private isGoogleGenAICredential(credential: BaseCredential): credential is GoogleGenAICredential {
    return credential.type === "google-gen-ai";
  }

  private isGoogleGenAIConnection(connection: BaseConnection): connection is GoogleGenAIConnection {
    return connection.type === "google-gen-ai";
  }

  private supportsOfficeDocuments(model: string): boolean {
    return model.startsWith("gemini-4-neon");
  }

  private getGoogleGenAIMessages(
    messages: GenericMessage[],
    model: string,
  ): {
    system?: string;
    steps: Array<{ type: "user_input" | "model_output"; content: any[] }>;
  } {
    let system: string | undefined;
    const steps: Array<{ type: "user_input" | "model_output"; content: any[] }> = [];

    messages.forEach((message) => {
      if (message.role === "system") {
        if (typeof message.content === "string") {
          system = message.content;
        } else {
          system = message.content
            .filter((part) => part.type === "text/plain")
            .map((part) => dataUrlToText(part.url))
            .join("\n");
        }
      } else {
        const convertedContent: any[] = [];

        if (typeof message.content === "string") {
          convertedContent.push({
            type: "text",
            text: message.content,
          });
        } else {
          message.content.forEach((part) => {
            if (part.type.startsWith("image/")) {
              const inline = this.dataUrlToInlineDataPart(part.url);
              convertedContent.push({
                type: "image",
                mime_type: inline.mimeType,
                data: inline.data,
              });
            } else if (
              part.type === "application/pdf" ||
              (this.supportsOfficeDocuments(model) && OFFICE_AND_OPENDOCUMENT_MIME_TYPES.has(part.type))
            ) {
              const inline = this.dataUrlToInlineDataPart(part.url);
              convertedContent.push({
                type: "document",
                mime_type: inline.mimeType,
                data: inline.data,
              });
            } else if (part.type === "text/plain" && !part.name) {
              convertedContent.push({
                type: "text",
                text: dataUrlToText(part.url),
              });
            } else {
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                convertedContent.push({
                  type: "text",
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
`.trim(),
                });
              } else {
                throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
              }
            }
          });
        }

        if (message.role === "assistant") {
          steps.push({
            type: "model_output",
            content: convertedContent,
          });
        } else {
          steps.push({
            type: "user_input",
            content: convertedContent,
          });
        }
      }
    });

    return {
      system,
      steps,
    };
  }

  private dataUrlToInlineDataPart(dataUrl: string) {
    const split = dataUrl.split(",");

    return {
      data: split[1],
      mimeType: split[0].split(";")[0].split(":")[1],
    };
  }
}
