export interface OpenAIChatPayload {
  messages: ChatMessage[];
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stop: string | string[];
  model?: string;
}

export interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: ChatMessagePart[] | string;
}

export type ChatMessagePart = ChatMessageTextPart | ChatMessageImagePart;

export interface ChatMessageImagePart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface ChatMessageTextPart {
  type: "text";
  text: string;
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
      headers: getChatHeaders(endpoint, apiKey),
      body: JSON.stringify(payload),
    }).then((res) => res.json());

    console.log({
      title: `Chat ${result.usage.total_tokens} tokens`,
      messages: payload.messages,
      response: result,
      topChoice: result.choices[0]?.message?.content ?? "",
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

export interface ChatStreamItem {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    delta?: {
      content?: string;
    };
    index: number;
    finish_reason: "stop" | "length" | "content_filter" | null;
  }[];
  usage: null;
}

// ref: https://til.simonwillison.net/llms/streaming-llm-apis
export async function* getChatStream(
  apiKey: string,
  endpoint: string,
  messages: ChatMessage[],
  config?: Partial<OpenAIChatPayload>,
  abortSignal?: AbortSignal
): AsyncGenerator<ChatStreamItem> {
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

  const stream = await fetch(endpoint, {
    method: "post",
    headers: getChatHeaders(endpoint, apiKey),
    body: JSON.stringify({ ...payload, stream: true }),
    signal: abortSignal,
  }).catch((e) => {
    console.error(e);
    throw e;
  });

  if (!stream.ok) {
    throw new Error(`Request failed: ${[stream.status, stream.statusText, await stream.text()].join(" ")}`);
  }

  if (!stream.body) throw new Error("Request failed");

  const reader = stream.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let unfinishedLine = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // Massage and parse the chunk of data
    const chunk = decoder.decode(value, { stream: true });

    // because the packets can split anywhere, we only process whole lines
    const currentWindow = unfinishedLine + chunk;
    unfinishedLine = currentWindow.slice(currentWindow.lastIndexOf("\n") + 1);

    const wholeLines = currentWindow
      .slice(0, currentWindow.lastIndexOf("\n") + 1)
      .split("\n")
      .filter(Boolean);

    const matches = wholeLines.map((wholeLine) => [...wholeLine.matchAll(/^data: (\{.*\})$/g)][0]?.[1]).filter(Boolean);

    for (const match of matches) {
      const item = JSON.parse(match);
      if ((item as any)?.error?.message) throw new Error((item as any).error.message);
      if (!Array.isArray(item?.choices)) throw new Error("Invalid response");
      yield item;
    }
  }
}

function getChatHeaders(endpoint: string, apiKey: string): HeadersInit {
  const isOpenAI = endpoint.includes("api.openai.com");

  return {
    ...(isOpenAI ? { Authorization: `Bearer ${apiKey}` } : { "api-key": apiKey }),
    "Content-Type": "application/json",
  };
}
