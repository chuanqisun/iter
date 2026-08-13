import { describe, expect, it, vi } from "vitest";
import { OpenRouterProvider } from "./openrouter";

const mockStream = vi.fn().mockImplementation(() => {
  const asyncIterable = (async function* () {
    yield { type: "response.output_text.delta", delta: "hello" };
  })();

  return Object.assign(asyncIterable, {
    finalResponse: async () => ({
      output: [],
      usage: undefined,
    }),
  });
});

vi.mock("openai", () => {
  return {
    OpenAI: class MockOpenAI {
      responses = {
        stream: mockStream,
      };
    },
  };
});

describe("OpenRouterProvider", () => {
  const provider = new OpenRouterProvider();
  const mockConnection = {
    id: "test-id",
    type: "openrouter" as const,
    displayGroup: "test",
    displayName: "test-model",
    model: "anthropic/claude-3.5-sonnet",
    apiKey: "test-key",
  };

  it("returns reasoningEffort options including 'auto' as default", () => {
    const options = provider.getOptions(mockConnection);
    expect(options.reasoningEffort).toEqual(["auto", "max", "xhigh", "high", "medium", "low", "minimal", "none"]);
  });

  it("leaves out reasoning effort parameters when reasoningEffort is 'auto' or undefined", async () => {
    mockStream.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Test with reasoningEffort: "auto"
    const stream1 = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "auto",
    });
    for await (const _ of stream1) {
      // consume stream
    }

    const firstCallArgs = mockStream.mock.calls[0][0];
    expect(firstCallArgs).not.toHaveProperty("reasoning");
    expect(firstCallArgs).not.toHaveProperty("reasoning_effort");

    mockStream.mockClear();

    // Test with reasoningEffort undefined
    const stream2 = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream2) {
      // consume stream
    }

    const secondCallArgs = mockStream.mock.calls[0][0];
    expect(secondCallArgs).not.toHaveProperty("reasoning");
    expect(secondCallArgs).not.toHaveProperty("reasoning_effort");
  });

  it("includes reasoning object when reasoningEffort is specified and not 'auto'", async () => {
    mockStream.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    const stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "high",
    });
    for await (const _ of stream) {
      // consume stream
    }

    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs).toHaveProperty("reasoning", { effort: "high" });
    expect(callArgs).not.toHaveProperty("reasoning_effort");
  });

  it("passes search and fetch tools when requested", async () => {
    mockStream.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Search only
    let stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
    });
    for await (const _ of stream) {
    }
    expect(mockStream.mock.calls[0][0].tools).toEqual([{ type: "openrouter:web_search" }]);

    mockStream.mockClear();

    // Fetch only
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockStream.mock.calls[0][0].tools).toEqual([{ type: "openrouter:web_fetch" }]);

    mockStream.mockClear();

    // Both search and fetch
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockStream.mock.calls[0][0].tools).toEqual([
      { type: "openrouter:web_search" },
      { type: "openrouter:web_fetch" },
    ]);

    mockStream.mockClear();

    // Neither
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream) {
    }
    expect(mockStream.mock.calls[0][0].tools).toBeUndefined();
  });

  it("extracts citations from response and yields formatted references", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield { type: "response.output_text.delta", delta: "Here is the answer." };
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
                  text: "Here is the answer.",
                  annotations: [
                    { type: "url_citation", url: "https://example.com/a", title: "Example A" },
                    {
                      type: "url_citation",
                      url_citation: { url: "https://example.com/b", title: "Example B" },
                    },
                  ],
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
      messages: [{ role: "user", content: "hi" }],
      search: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      "Here is the answer.",
      "\n\n## References\n\n1. [Example A](https://example.com/a)\n2. [Example B](https://example.com/b)",
    ]);
  });
});
