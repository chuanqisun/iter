import { describe, expect, it, vi } from "vitest";
import { OpenRouterProvider } from "./openrouter";

const mockCreate = vi.fn().mockImplementation(async () => {
  return (async function* () {
    yield { choices: [{ delta: { content: "hello" } }] };
  })();
});

vi.mock("openai", () => {
  return {
    OpenAI: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
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
    mockCreate.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Test with reasoningEffort: "auto"
    const stream1 = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "auto",
    });
    for await (const _ of stream1) {
      // consume stream
    }

    const firstCallArgs = mockCreate.mock.calls[0][0];
    expect(firstCallArgs).not.toHaveProperty("reasoning");
    expect(firstCallArgs).not.toHaveProperty("reasoning_effort");

    mockCreate.mockClear();

    // Test with reasoningEffort undefined
    const stream2 = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream2) {
      // consume stream
    }

    const secondCallArgs = mockCreate.mock.calls[0][0];
    expect(secondCallArgs).not.toHaveProperty("reasoning");
    expect(secondCallArgs).not.toHaveProperty("reasoning_effort");
  });

  it("includes reasoning object when reasoningEffort is specified and not 'auto'", async () => {
    mockCreate.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    const stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "high",
    });
    for await (const _ of stream) {
      // consume stream
    }

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).toHaveProperty("reasoning", { effort: "high" });
    expect(callArgs).not.toHaveProperty("reasoning_effort");
  });

  it("passes search and fetch tools when requested", async () => {
    mockCreate.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Search only
    let stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
    });
    for await (const _ of stream) {
    }
    expect(mockCreate.mock.calls[0][0].tools).toEqual([{ type: "openrouter:web_search" }]);

    mockCreate.mockClear();

    // Fetch only
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockCreate.mock.calls[0][0].tools).toEqual([{ type: "openrouter:web_fetch" }]);

    mockCreate.mockClear();

    // Both search and fetch
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockCreate.mock.calls[0][0].tools).toEqual([
      { type: "openrouter:web_search" },
      { type: "openrouter:web_fetch" },
    ]);

    mockCreate.mockClear();

    // Neither
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream) {
    }
    expect(mockCreate.mock.calls[0][0].tools).toBeUndefined();
  });

  it("extracts citations from stream chunks and yields formatted references", async () => {
    mockCreate.mockImplementationOnce(async () => {
      return (async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "Here is the answer.",
                annotations: [{ type: "url_citation", url: "https://example.com/a", title: "Example A" }],
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                annotations: [
                  {
                    type: "url_citation",
                    url_citation: { url: "https://example.com/b", title: "Example B" },
                  },
                ],
              },
            },
          ],
        };
      })();
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
