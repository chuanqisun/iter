export interface OpenAIChatPayload {
  messages: ChatMessage[];
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stop: string | string[];
}

export interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

export type OpenAIChatResponse = {
  choices: {
    finish_reason: "stop" | "length" | "content_filter" | null;
    index: number;
    message: {
      content?: string; // blank when content_filter is active
      role: "assistant";
    };
  }[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
};

export async function getChatResponse(
  apiKey: string,
  endpoint: string,
  messages: ChatMessage[],
  config?: Partial<OpenAIChatPayload>
): Promise<OpenAIChatResponse> {
  const payload = {
    messages,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 60,
    stop: "",
    ...config,
  };

  try {
    const result: OpenAIChatResponse = await fetch(endpoint, {
      method: "post",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).then((res) => res.json());

    console.log({
      title: `Chat ${result.usage.total_tokens} tokens`,
      messages: payload.messages,
      response: result,
      topChoice: result.choices[0].message?.content ?? "",
      tokenUsage: result.usage.total_tokens,
    });

    return result;
  } catch (e) {
    console.error({
      title: `Completion error`,
      messages: payload.messages,
      error: `${(e as Error).name} ${(e as Error).message}`,
    });
    throw e;
  }
}
