import { describe, expect, it, vi } from "vitest";
import { XAIProvider } from "./xai";

const mockStream = vi.fn();

vi.mock("openai", () => {
  return {
    OpenAI: class MockOpenAI {
      responses = {
        stream: mockStream,
      };
    },
  };
});

describe("XAIProvider", () => {
  const provider = new XAIProvider();
  const mockConnection = {
    id: "grok-4.6:test-id",
    type: "xai" as const,
    displayGroup: "xai",
    displayName: "grok-4.6",
    model: "grok-4.6",
    apiKey: "test-key",
  };

  it("returns options with reasoningEffort and max temperature", () => {
    const options = provider.getOptions(mockConnection);
    expect(options.temperature?.max).toBe(2);
    expect(options.reasoningEffort).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("calls responses.stream with correct arguments and yields output deltas", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield { type: "response.output_text.delta", delta: "Hello " };
        yield { type: "response.output_text.delta", delta: "world!" };
      })();

      return Object.assign(asyncIterable, {
        finalResponse: async () => ({
          output: [],
          usage: {
            output_tokens: 10,
            input_tokens_details: { cached_tokens: 5 },
          },
        }),
      });
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const chunks: string[] = [];
    let metadata: any;

    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Hi" }],
      search: true,
      onMetadata: (m) => {
        metadata = m;
      },
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello ", "world!"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.6",
        tools: [{ type: "web_search" }],
        input: [{ role: "user", content: "Hi" }],
      }),
      expect.anything(),
    );
    expect(metadata).toMatchObject({
      cachedInputTokens: 5,
      totalOutputTokens: 10,
    });
  });

  it("inserts space between different output_index deltas in multi-part responses", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield { type: "response.output_text.delta", output_index: 1, delta: "First part." };
        yield { type: "response.output_text.delta", output_index: 1, delta: " Still first." };
        yield { type: "response.output_text.delta", output_index: 7, delta: "Second part." };
      })();

      return Object.assign(asyncIterable, {
        finalResponse: async () => ({
          output: [],
          usage: undefined,
        }),
      });
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const chunks: string[] = [];
    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["First part.", " Still first.", " Second part."]);
  });

  it("maps attachments properly including documents and web search tools", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield { type: "response.output_text.delta", delta: "Analyzed" };
      })();

      return Object.assign(asyncIterable, {
        finalResponse: async () => ({
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "Analyzed",
                  annotations: [{ type: "url_citation", url: "https://x.ai/doc", title: "xAI Doc" }],
                },
              ],
            },
          ],
        }),
      });
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const chunks: string[] = [];

    for await (const chunk of proxy({
      messages: [
        {
          role: "user",
          content: [
            { type: "text/plain", url: "data:text/plain;base64,V2hhdCBpcyB0aGlzPw==" },
            { type: "application/pdf", name: "report.pdf", url: "data:application/pdf;base64,JVBERi0xLjQ=" },
            {
              type: "application/octet-stream",
              name: "doc.bin",
              url: "data:application/octet-stream;base64,JVBERi0xLjQ=",
            },
          ],
        },
      ],
      fetch: true,
    })) {
      chunks.push(chunk);
    }

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "What is this?" },
              { type: "input_file", file_data: "data:application/pdf;base64,JVBERi0xLjQ=", filename: "report.pdf" },
              {
                type: "input_file",
                file_data: "data:application/octet-stream;base64,JVBERi0xLjQ=",
                filename: "doc.bin",
              },
            ],
          },
        ],
      }),
      expect.anything(),
    );

    expect(chunks).toEqual(["Analyzed", "\n\n## References\n\n1. [x.ai](https://x.ai/doc)"]);
  });
});
