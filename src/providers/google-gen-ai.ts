import { ThinkingLevel, type Content, type Part } from "@google/genai";
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
  static defaultModels = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];

  static thinkingLevelMap: Record<string, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };

  parseNewCredentialForm(formData: FormData): GoogleGenAICredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "google-gen-ai",
        accountName: accountName?.length ? accountName : `google-gen-ai-${timestamp}`,
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

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isGoogleGenAIConnection(connection)) throw new Error("Invalid connection type");

    // ref: https://ai.google.dev/gemini-api/docs/thinking
    return {
      thinkingBudget: this.getThinkingBugetConfig(connection.model),
      reasoningEffort: this.getReasoningEffortConfig(connection.model),
      temperature: { max: 2 },
    };
  }

  private getThinkingBugetConfig(model: string): undefined | { min: number; max: number } {
    if (model.startsWith("gemini-2.5-pro")) return { min: -100, max: 32768 };
    if (model.startsWith("gemini-2.5-flash")) return { min: -100, max: 24576 };
    if (model.startsWith("gemini-2.5-flash-lite")) return { min: -100, max: 24576 };
    return undefined;
  }

  private getReasoningEffortConfig(model: string): string[] | undefined {
    if (model.startsWith("gemini-3-pro")) return ["low", "high"];
    if (model.startsWith("gemini-3-flash")) return ["minimal", "low", "medium", "high"];
    return undefined;
  }

  private getFinalBudget(model: string, inputBudget?: number): number | undefined {
    if (inputBudget === undefined) return undefined;
    if (model.startsWith("gemini-2.5-pro"))
      return inputBudget < 0 ? this.clamp(inputBudget, -1, -1) : this.clamp(inputBudget, 128, 32768);
    if (model.startsWith("gemini-2.5-flash"))
      return inputBudget < 0 ? this.clamp(inputBudget, -1, -1) : this.clamp(inputBudget, 0, 24576);
    if (model.startsWith("gemini-2.5-flash-lite"))
      return inputBudget < 0 ? this.clamp(inputBudget, -1, -1) : this.clamp(inputBudget, 512, 24576);
    return undefined;
  }

  private getFinalThinkingLevel(model: string, inputLevel?: string) {
    if (model.startsWith("gemini-3-pro") || model.startsWith("gemini-3-flash"))
      return (
        GoogleGenAIProvider.thinkingLevelMap[inputLevel as keyof typeof GoogleGenAIProvider.thinkingLevelMap] ??
        this.getReasoningEffortConfig(model)?.at(0)
      );

    return undefined;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isGoogleGenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const GoogleGenAI = await import("@google/genai").then((res) => res.GoogleGenAI);
      const client = new GoogleGenAI({ apiKey: connection.apiKey });

      const { system, messages: googleMessages } = that.getGoogleGenAIMessages(messages);

      const options = that.getOptions(connection);
      const thinkingBudget = options.thinkingBudget
        ? that.getFinalBudget(connection.model, config.thinkingBudget)
        : undefined;

      const start = performance.now();
      const result = await client.models.generateContentStream({
        model: connection.model,
        contents: googleMessages,
        config: {
          systemInstruction: system,
          abortSignal,
          temperature: config?.temperature,
          topP: config?.topP,
          maxOutputTokens: config?.maxTokens,
          tools: config.search ? [{ googleSearch: {} }] : undefined,
          thinkingConfig: {
            thinkingBudget: that.getFinalBudget(connection.model, thinkingBudget),
            thinkingLevel: that.getFinalThinkingLevel(connection.model, config.reasoningEffort),
          },
        },
      });

      for await (const message of result) {
        const chunk = message.text;
        if (message.usageMetadata)
          config.onMetadata?.({
            totalOutputTokens: message.usageMetadata.candidatesTokenCount,
            durationMs: performance.now() - start,
          });
        if (chunk) yield chunk;
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
    messages: Content[];
  } {
    let system: string | undefined;
    const convertedMessages: Content[] = [];

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
      } else if (typeof message.content === "string") {
        convertedMessages.push({
          role: this.toGeminiRoleName(message.role),
          parts: [{ text: message.content }],
        });
      } else {
        const convertedMessageParts = message.content.map((part) => {
          switch (part.type) {
            case "image/gif":
            case "image/png":
            case "image/webp":
            case "application/pdf": {
              return {
                inlineData: this.dataUrlToInlineDataPart(part.url),
              } satisfies Part;
            }
            default: {
              if (part.type === "text/plain" && !part.name) {
                // unnamed message is the main body text
                return {
                  text: dataUrlToText(part.url),
                } satisfies Part;
              }
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                return {
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                      `.trim(),
                } satisfies Part;
              }
              throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
            }
          }
        });

        convertedMessages.push({
          role: this.toGeminiRoleName(message.role),
          parts: convertedMessageParts.filter((part) => part !== null),
        });
      }
    });

    return {
      system,
      messages: convertedMessages,
    };
  }

  private toGeminiRoleName(role: "assistant" | "user") {
    return role === "assistant" ? "model" : "user";
  }

  private dataUrlToInlineDataPart(dataUrl: string) {
    const split = dataUrl.split(",");

    return {
      data: split[1],
      mimeType: split[0].split(";")[0].split(":")[1],
    };
  }
}
