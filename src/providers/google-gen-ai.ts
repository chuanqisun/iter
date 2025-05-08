import type { Content, Part } from "@google/genai";
import { dataUrlToText } from "../storage/codec";
import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  GenericChatParams,
  GenericMessage,
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
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-exp-03-25",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-2.0-flash-thinking-exp-01-21",
  ];

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

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isAnthropicConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const GoogleGenAI = await import("@google/genai").then((res) => res.GoogleGenAI);
      const client = new GoogleGenAI({ apiKey: connection.apiKey });

      const { system, messages: googleMessages } = that.getGoogleGenAIMessages(messages);

      const canDisableThinking = connection.model.startsWith("gemini-2.5-flash");

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
          thinkingConfig: canDisableThinking ? { thinkingBudget: 0 } : undefined,
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

  private isAnthropicConnection(connection: BaseConnection): connection is GoogleGenAIConnection {
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
            case "text/plain": {
              return {
                text: dataUrlToText(part.url),
              } satisfies Part;
            }
            case "image/gif":
            case "image/png":
            case "image/webp":
            case "application/pdf": {
              return {
                inlineData: this.dataUrlToInlineDataPart(part.url),
              } satisfies Part;
            }
            default: {
              console.warn(`Unsupported content type: ${part.type}`);
              return null;
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
