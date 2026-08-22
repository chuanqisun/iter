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

export class GoogleGenAIProvider implements BaseProvider {
  static type = "google-gen-ai";
  static defaultModels = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"];

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
      temperature: this.supportsTemperature(connection.model) ? { max: 2 } : undefined,
      serviceTier: ["auto", "flex", "priority"],
    };
  }

  private supportsTemperature(model: string): boolean {
    return !model.startsWith("gemini-3");
  }

  private extractCitationsFromAnnotations(annotations?: Array<any>): Citation[] {
    if (!annotations) return [];
    return annotations.flatMap((anno) => {
      const url = anno.url || anno.uri;
      return url ? [{ url, title: anno.title }] : [];
    });
  }

  private getReasoningEffortConfig(model: string): string[] | undefined {
    if (model.startsWith("gemini-3.7")) return ["low", "medium", "high"];
    if (model.startsWith("gemini-3.1-pro")) return ["low", "medium", "high"];
    if (model.startsWith("gemini-3")) return ["minimal", "low", "medium", "high"];
    return undefined;
  }

  private getFinalThinkingLevel(model: string, inputLevel?: string) {
    if (model.startsWith("gemini-3") && model.includes("-pro")) {
      const supported = ["low", "high"];
      const level = supported.includes(inputLevel!) ? inputLevel : "low";
      return level as "low" | "high";
    }

    if (model.startsWith("gemini-3") && model.includes("-flash")) {
      const supported = ["minimal", "low", "medium", "high"];
      const level = supported.includes(inputLevel!) ? inputLevel : "minimal";
      return level as "minimal" | "low" | "medium" | "high";
    }

    return undefined;
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isGoogleGenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: RuntimeChatParams) {
      const GoogleGenAI = await import("@google/genai").then((res) => res.GoogleGenAI);
      const client = new GoogleGenAI({ apiKey: connection.apiKey });

      const { system, steps } = that.getGoogleGenAIMessages(messages);

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
            config.onMetadata?.({
              cachedInputTokens: interaction.usage.total_cached_tokens,
              totalOutputTokens: interaction.usage.total_output_tokens,
              latencyMs,
              durationMs: performance.now() - start,
            });
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

  private getGoogleGenAIMessages(messages: GenericMessage[]): {
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
            } else if (part.type === "application/pdf") {
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
