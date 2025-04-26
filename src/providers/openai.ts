import type {
  EasyInputMessage,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputItem,
  ResponseInputText,
  ResponseOutputText,
} from "openai/resources/responses/responses.mjs";
import { dataUrlToText } from "../storage/codec";
import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  GenericChatParams,
  GenericMessage,
} from "./base";

export interface OpenAICredential extends BaseCredential {
  id: string;
  type: "openai";
  accountName: string;
  apiKey: string;
}

export interface OpenAIConnection extends BaseConnection {
  id: string;
  type: "openai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class OpenAIProvider implements BaseProvider {
  static type = "openai";
  static defaultModels = [
    "o4-mini",
    "o3",
    "o3-mini",
    "o1-mini",
    "gpt-4.5-preview",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
  ];

  parseNewCredentialForm(formData: FormData): OpenAICredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "openai",
        accountName: accountName?.length ? accountName : `openai-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): OpenAIConnection[] {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return OpenAIProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "openai",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        }) satisfies OpenAIConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: OpenAIProvider.defaultModels.join(","),
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isOpenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const OpenAI = await import("openai").then((res) => res.OpenAI);
      const client = new OpenAI({
        apiKey: connection.apiKey,
        dangerouslyAllowBrowser: true,
      });

      const isTemperatureSupported =
        !connection.model.startsWith("o1") && !connection.model.startsWith("o3") && !connection.model.startsWith("o4");
      const isSystemMessageSupported = !connection.model.startsWith("o1-mini");

      const stream = client.responses.stream(
        {
          input: that.getOpenAIMessages(messages, { isSystemMessageSupported }),
          model: connection.model,
          temperature: isTemperatureSupported ? config?.temperature : undefined,
          max_output_tokens: config?.maxTokens,
          top_p: config?.topP,
        },
        {
          signal: abortSignal,
        },
      );

      for await (const message of stream) {
        if (message.type === "response.output_text.delta" && message.delta) {
          yield message.delta;
        }
      }
    };
  }

  private getOpenAIMessages(
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
                if (part.type === "text/plain") {
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
                  console.warn("Unsupported message part", part);
                  return null;
                }
              })
              .filter((part) => part !== null),
          } satisfies EasyInputMessage;
        }
        case "assistant": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };

          return {
            role: message.role,
            content: message.content
              .map((part) => {
                if (part.type === "text/plain") {
                  return {
                    type: "output_text",
                    text: dataUrlToText(part.url),
                    annotations: [],
                  } satisfies ResponseOutputText;
                } else {
                  console.warn("Unsupported message part", part);
                  return null;
                }
              })
              .filter((part) => part !== null),
          };
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

  private isOpenAICredential(credential: BaseCredential): credential is OpenAICredential {
    return credential.type === "openai";
  }

  private isOpenAIConnection(connection: BaseConnection): connection is OpenAIConnection {
    return connection.type === "openai";
  }
}
