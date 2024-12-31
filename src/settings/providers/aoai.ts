import { getChatStream, type ChatMessage, type OpenAIChatPayload } from "../../openai/chat";
import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy } from "./base";

export interface AzureOpenAICredential extends BaseCredential {
  id: string;
  type: "aoai";
  endpoint: string;
  deployments: string;
  apiKey: string;
}

export interface AzureOpenAIConnection extends BaseConnection {
  id: string;
  type: "aoai";
  displayGroup: string;
  displayName: string;
  endpoint: string;
  deployment: string;
  apiKey: string;
  apiVersion: string;
}

export class AzureOpenAIProvider implements BaseProvider {
  static defaultModels = ["gpt-4o", "gpt-4o-mini"];

  parseNewCredentialForm(formData: FormData): AzureOpenAICredential[] {
    const endpoint = this.ensureTrailingSlash(formData.get("newEndpoint") as string);
    const apiKey = formData.get("newKey") as string;
    let deployments = (formData.get("newDeployments") as string)
      .split(",")
      .map((deployment) => deployment.trim())
      .join(",");

    if (!deployments.length) {
      deployments = AzureOpenAIProvider.defaultModels.join(",");
    }

    return [
      {
        id: crypto.randomUUID(),
        type: "aoai",
        endpoint,
        deployments,
        apiKey,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): AzureOpenAIConnection[] {
    if (!this.isAzureOpenAICredential(credential)) throw new Error("Invalid credential type");

    return credential.deployments.split(",").map(
      (deployment) =>
        ({
          id: `${deployment}:${credential.id}`,
          type: "aoai",
          displayGroup: new URL(credential.endpoint).hostname.split(".")[0],
          displayName: deployment,
          endpoint: credential.endpoint,
          deployment,
          apiKey: credential.apiKey,
          apiVersion: "2024-10-01-preview",
        } satisfies AzureOpenAIConnection)
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isAzureOpenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: new URL(credential.endpoint).hostname,
      tagLine: credential.type,
      features: credential.deployments,
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isAzureOpenAIConnection(connection)) throw new Error("Invalid connection type");

    return async function* (messages: ChatMessage[], config?: Partial<OpenAIChatPayload>, abortSignal?: AbortSignal) {
      const finalConfig: Partial<OpenAIChatPayload> = {
        temperature: config?.temperature,
        max_tokens: config?.max_tokens,
        model: connection.deployment,
      };

      const endpoint = `${connection.endpoint}openai/deployments/${connection.deployment}/chat/completions?api-version=${connection.apiVersion}`;
      const innerStream = getChatStream(connection.apiKey, endpoint, messages, finalConfig, abortSignal);

      for await (const chunk of innerStream) {
        const content = chunk.choices[0]?.delta?.content ?? "";
        if (content) yield content;
      }
    };
  }

  private isAzureOpenAICredential(credential: BaseCredential): credential is AzureOpenAICredential {
    return credential.type === "aoai";
  }

  private isAzureOpenAIConnection(connection: BaseConnection): connection is AzureOpenAIConnection {
    return connection.type === "aoai";
  }

  private ensureTrailingSlash(url: string) {
    return url.endsWith("/") ? url : url + "/";
  }
}
