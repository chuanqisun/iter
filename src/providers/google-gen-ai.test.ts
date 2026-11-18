import { describe, expect, it, vi } from "vitest";
import { GoogleGenAIProvider } from "./google-gen-ai";

const mockInteractionsCreate = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      interactions = {
        create: mockInteractionsCreate,
      };
    },
  };
});

describe("GoogleGenAIProvider", () => {
  const provider = new GoogleGenAIProvider();
  const defaultModel = GoogleGenAIProvider.defaultModels[0];
  const mockConnection = {
    id: `${defaultModel}:test-id`,
    type: "google-gen-ai" as const,
    displayGroup: "google-gen-ai",
    displayName: defaultModel,
    model: defaultModel,
    apiKey: "test-key",
  };

  it("returns options for connection", () => {
    const options = provider.getOptions(mockConnection);
    expect(options.temperature).toBeUndefined();
    expect(options.reasoningEffort).toBeDefined();
    expect(options.serviceTier).toEqual(["auto", "flex", "priority"]);
  });

  it("returns credential summary and connections", () => {
    const credential = {
      id: "cred-1",
      type: "google-gen-ai",
      accountName: "my-account",
      apiKey: "key-123",
    };
    const summary = provider.getCredentialSummary(credential);
    expect(summary.title).toBe("my-account");

    const connections = provider.credentialToConnections(credential);
    expect(connections.length).toBe(GoogleGenAIProvider.defaultModels.length);
    expect(connections[0].model).toBe(GoogleGenAIProvider.defaultModels[0]);
  });

  it("calls interactions.create with correct arguments and yields output deltas", async () => {
    mockInteractionsCreate.mockImplementationOnce((params) => {
      expect(params.model).toBe(mockConnection.model);
      expect(params.system_instruction).toBe("You are helpful.");
      expect(params.tools).toEqual([{ type: "google_search" }]);
      expect(params.service_tier).toBe("flex");
      expect(params.generation_config.thinking_level).toBe("medium");
      expect(params.input).toEqual([
        {
          type: "user_input",
          content: [{ type: "text", text: "Hello" }],
        },
      ]);

      const asyncIterable = (async function* () {
        yield {
          event_type: "step.delta",
          delta: { type: "text", text: "Hello " },
        };
        yield {
          event_type: "step.delta",
          delta: { type: "text", text: "world!" },
        };
        yield {
          event_type: "step.delta",
          delta: {
            type: "text_annotation_delta",
            annotations: [{ title: "Example", url: "https://example.com" }],
          },
        };
        yield {
          event_type: "interaction.completed",
          interaction: {
            usage: {
              total_cached_tokens: 10,
              total_output_tokens: 20,
            },
          },
        };
      })();

      return asyncIterable;
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const onMetadata = vi.fn();
    const generator = proxy({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
      search: true,
      reasoningEffort: "medium",
      serviceTier: "flex",
      onMetadata,
    });

    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toContain("Hello world!");
    expect(chunks.join("")).toContain("## References\n\n1. [Example](https://example.com)");
    expect(onMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        cachedInputTokens: 10,
        totalOutputTokens: 20,
      }),
    );
  });

  it("omits service_tier when serviceTier is auto or default", async () => {
    mockInteractionsCreate.mockImplementationOnce((params) => {
      expect(params.service_tier).toBeUndefined();

      return (async function* () {
        yield {
          event_type: "step.delta",
          delta: { type: "text", text: "OK" },
        };
      })();
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const generator = proxy({
      messages: [{ role: "user", content: "Hi" }],
      serviceTier: "auto",
    });

    for await (const _chunk of generator) {
      // consume
    }
  });

  it("includes gemini-4-neon and retires gemini-3.8-flash", () => {
    expect(GoogleGenAIProvider.defaultModels).toContain("gemini-4-neon");
    expect(GoogleGenAIProvider.defaultModels).not.toContain("gemini-3.8-flash");
  });

  it("supports xhigh thinking level and Office/OpenDocument attachments on gemini-4-neon", async () => {
    const neonConnection = {
      ...mockConnection,
      id: "gemini-4-neon:test-id",
      displayName: "gemini-4-neon",
      model: "gemini-4-neon",
    };

    const options = provider.getOptions(neonConnection);
    expect(options.reasoningEffort).toEqual(["low", "medium", "high", "xhigh"]);
    expect(options.temperature).toBeUndefined();

    const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    mockInteractionsCreate.mockImplementationOnce((params) => {
      expect(params.model).toBe("gemini-4-neon");
      expect(params.generation_config.thinking_level).toBe("xhigh");
      expect(params.input).toEqual([
        {
          type: "user_input",
          content: [
            {
              type: "document",
              mime_type: docxMime,
              data: "UEsDBBQ=",
            },
          ],
        },
      ]);

      return (async function* () {
        yield {
          event_type: "step.delta",
          delta: { type: "text", text: "Part 1 " },
        };
        yield {
          event_type: "interaction.completed",
          interaction: {
            status: "requires_continuation",
            usage: {
              total_cached_tokens: 100,
              total_output_tokens: 65536,
            },
          },
        };
        yield {
          event_type: "step.delta",
          delta: { type: "text", text: "Part 2" },
        };
        yield {
          event_type: "interaction.completed",
          interaction: {
            status: "completed",
            usage: {
              total_cached_tokens: 200,
              total_output_tokens: 1000,
            },
          },
        };
      })();
    });

    const proxy = provider.getChatStreamProxy(neonConnection);
    const onMetadata = vi.fn();
    const generator = proxy({
      messages: [
        {
          role: "user",
          content: [{ type: docxMime, name: "spec.docx", url: `data:${docxMime};base64,UEsDBBQ=` }],
        },
      ],
      reasoningEffort: "xhigh",
      onMetadata,
    });

    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Part 1 Part 2");
    expect(onMetadata).toHaveBeenCalledTimes(1);
    expect(onMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        cachedInputTokens: 300,
        totalOutputTokens: 66536,
      }),
    );
  });
});
