import type { Content, InlineDataPart, TextPart } from "@google/generative-ai";
import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy, GenericChatParams, GenericMessage } from "./base";

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
  static defaultModels = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.0-pro-exp-02-05", "gemini-2.0-flash-thinking-exp-01-21", "gemini-2.0-flash-lite-preview-02-05"];

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
        }) satisfies GoogleGenAIConnection
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
      const GoogleGenerativeAI = await import("@google/generative-ai").then((res) => res.GoogleGenerativeAI);
      const client = new GoogleGenerativeAI(connection.apiKey);

      const { system, messages: googleMessages } = that.getGoogleGenAIMessages(messages);

      const model = client.getGenerativeModel({ model: connection.model });

      const result = await model.generateContentStream(
        {
          systemInstruction: system,
          contents: googleMessages,
          generationConfig: {
            temperature: config?.temperature,
            topP: config?.topP,
            maxOutputTokens: config?.maxTokens,
          },
        },
        {
          signal: abortSignal,
        }
      );

      for await (const message of result.stream) {
        const chunk = message.text();
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

  private getGoogleGenAIMessages(messages: GenericMessage[]): { system?: string; messages: Content[] } {
    let system;
    const convertedMessages: Content[] = [];

    messages.forEach((message) => {
      if (message.role === "system") {
        system = message.content as string;
      } else if (typeof message.content === "string") {
        convertedMessages.push({
          role: message.role as "assistant" | "user",
          parts: [{ text: message.content }],
        });
      } else {
        const convertedMessageParts = message.content.map((part) => {
          switch (part.type) {
            case "text": {
              return {
                text: part.text,
              } satisfies TextPart;
            }
            case "image_url": {
              return {
                inlineData: this.dataUrlToImagePart(part.image_url.url),
              } satisfies InlineDataPart;
            }
            default: {
              console.warn(`Unsupported content type: ${part.type}`);
              return null;
            }
          }
        });

        convertedMessages.push({
          role: message.role as "assistant" | "user",
          parts: convertedMessageParts.filter((part) => part !== null),
        });
      }
    });

    return {
      system,
      messages: convertedMessages,
    };
  }

  private dataUrlToImagePart(dataUrl: string) {
    const split = dataUrl.split(",");

    return {
      data: split[1],
      mimeType: split[0].split(";")[0].split(":")[1],
    };
  }
}
