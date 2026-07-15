> ## Documentation Index
>
> Fetch the complete documentation index at: https://inference-docs.cerebras.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Model catelog

> Browse all models available on Cerebras public endpoints.

All models on Cerebras public endpoints are free to use, subject to [rate limits](/support/rate-limits). For additional model families, reserved capacity, higher throughput, and production SLAs, see [Dedicated Endpoints](/dedicated/overview).

## Production Models

Production models are fully supported offerings intended for use in production environments.

| Model Name                           | Model ID       | Parameters  | Speed (tokens/s) |
| :----------------------------------- | :------------- | :---------- | :--------------- |
| [OpenAI GPT OSS](/models/openai-oss) | `gpt-oss-120b` | 120 billion | \~3000           |

<Tip>
  Looking for more models? Many additional model families are available through [Dedicated Endpoints](/dedicated/overview#supported-models).
</Tip>

## Preview Models

Preview models are hosted on Cerebras with full accuracy and performance. Please note that these preview models are intended for evaluation purposes only and should not be used in production, as they may be discontinued on short notice.

| Model Name                                      | Model ID      | Parameters  | Speed (tokens/s) |
| :---------------------------------------------- | :------------ | :---------- | :--------------- |
| [Gemma 4 31B](/models/gemma-4-31b)              | `gemma-4-31b` | 31 billion  | \~1850           |
| [Z.ai GLM 4.7 <sup>1</sup>](/models/zai-glm-47) | `zai-glm-4.7` | 355 billion | \~1000           |

<Tip>
  <sup>1</sup> Migrating from another model? Check out our [GLM 4.7 Migration Guide](/resources/glm-47-migration) for prompt optimization tips and best practices.
</Tip>

## Model Compression

This section provides transparency about the compression state of each model available on our platform.

We host a variety of open-source models from the community. We do not currently host pruned models on our public endpoints. All models served through our public endpoints are the original, unpruned versions.

While we conduct research on pruning techniques like REAP (Router-weighted Expert Activation Pruning), these pruned models are shared with the research community on Hugging Face but are not available through our shared API. You can read more about REAP in our [research blog](https://www.cerebras.ai/blog/reap). **All of our public models are unpruned.**

Cerebras uses selective weight-only quantization only during storage to preserve maximal quality. This means that the weights are stored in partial 16-bit / 8-bit / 4-bit, in-line with industry standards. For quality, sensitive layers are stored at full precision with dequantization on the fly, so operations are done in high precision. The activations, attention, and kv cache remain in full precision and unquantized.

### Frequently Asked Questions

<Accordion title="Will you change a model's architecture without notice?">
  No. We are committed to serving the original models for all existing endpoints, without modification. We do not alter model architectures via pruning on our hosted portfolio. If we explore additional compression techniques (like pruning) in the future, these would be offered as separate endpoints with pruning-specific names, ensuring complete transparency and allowing you to choose which version best fits your needs.
</Accordion>

<Accordion title="Where can I find your REAP pruned models?">
  Our REAP pruned models are available on Hugging Face for research and experimentation purposes: [Cerebras REAP Collection](https://huggingface.co/collections/cerebras/cerebras-reap). These models demonstrate our pruning research but are not served through our production API.
</Accordion>

<Accordion title="What are compression, quantization, and pruning?">
  **Compression** is an umbrella term for techniques that reduce model size or computational requirements. Common compression techniques include:

- **Quantization**: Reducing the precision of numbers used to represent model weights (e.g., converting from FP16 to FP8). This reduces memory usage without changing the model's architecture.
- **Pruning**: Permanently removing parts of a model, like layers or experts, to reduce model size. This changes the model's architecture and creates a different model.
</Accordion>

# OpenAI Compatibility

> Use the OpenAI Client Libraries with Cerebras Inference

We designed the Cerebras API to be mostly compatible with OpenAI's client libraries, making it simple to configure your existing applications to run on Cerebras and take advantage of our inference capabilities.

We also offer dedicated Cerebras Python and Cerebras TypeScript SDKs.

## Configure OpenAI to use the Cerebras API

To start using Cerebras with OpenAI's client libraries, simply pass your Cerebras API key to the `apiKey` parameter and change the `baseURL` to [https://api.cerebras.ai/v1](https://api.cerebras.ai/v1):

<CodeGroup>
  ```python Python theme={null}
  import os
  import openai

client = openai.OpenAI(
base_url="https://api.cerebras.ai/v1",
api_key=os.environ.get("CEREBRAS_API_KEY")
)

````

```javascript Node.js theme={null}
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1"
});
````

</CodeGroup>

## Developer-Level Instructions via System and Developer Roles

<Note>This info is only applicable to the `gpt-oss-120b` model. </Note>

For `gpt-oss-120b`, the API supports both the `system` and `developer` message roles. Both are mapped to a developer-level instruction layer in the prompt hierarchy, elevated above normal user instructions and injected into the model’s internal system prompt. This gives you significant control over the assistant’s tone, style, and behavior while preserving the model’s built-in safety guardrails.

The `developer` role is functionally equivalent to `system` – the `system` role remains supported for backwards compatibility.

### Key Differences from OpenAI

OpenAI’s API distinguishes between `system` and `developer` roles with different behavior. On Cerebras, both roles act at the developer level, meaning they may have stronger influence than `system` messages in OpenAI’s API.

As a result, the same prompt may yield different behavior here compared to OpenAI. This is expected.

## Unsupported Parameter Combinations

Support for combining `tools` and `response_format` is model-dependent. `gpt-oss-120b` rejects requests containing both fields. Other models may accept the combination but prioritize tool calling, so `response_format` should not be relied upon. For portable behavior across Cerebras models, use one of the following approaches:

- **Tool calling only** — Omit `response_format` and let the model invoke tools. If you need structured arguments, define them in the tool's `parameters` JSON schema, which the model will follow.
- **Structured outputs only** — Omit `tools` and use `response_format` with a JSON schema. See [Structured Outputs](/capabilities/structured-outputs).
- **Two-step pipeline** — Make a first call with `tools` to gather data, then make a second call with `response_format` to format the final result.

See [Tool Use](/capabilities/tool-use) and [Structured Outputs](/capabilities/structured-outputs) for details on each capability.

## Pass Non-Standard Parameters

- **OpenAI**: Non-standard parameters (e.g., `clear_thinking` for Z.ai GLM) need to be passed through `extra_body`. Standard OpenAI parameters like `reasoning_effort` work directly.
- **Cerebras SDK**: Non-standard parameters can be passed in **either** `extra_body` **or** as regular parameters like `model`.

<Accordion title="Example: Using the OpenAI Client">
  When using the OpenAI client with Cerebras API, non-standard parameters must be passed through `extra_body`:

  <CodeGroup>
    ```python Python theme={null}
    client = OpenAI(
        base_url="https://api.cerebras.ai/v1",
        api_key=os.environ.get("CEREBRAS_API_KEY")
    )

    response = client.chat.completions.create(
        model="zai-glm-4.7",
        messages=[...],
        reasoning_effort="none",  # Standard parameter, no extra_body needed
        extra_body={
            "clear_thinking": False  # Non-standard: must use extra_body
        }
    )
    ```

    ```javascript Node.js theme={null}
    const client = new OpenAI({
        baseURL: "https://api.cerebras.ai/v1",
        apiKey: process.env.CEREBRAS_API_KEY
    });

    const response = await client.chat.completions.create({
        model: "zai-glm-4.7",
        messages: [...],
        reasoning_effort: "none",  // Standard parameter, no extra_body needed
        extra_body: {
            clear_thinking: false  // Non-standard: must use extra_body
        }
    });
    ```

  </CodeGroup>
</Accordion>

<Accordion title="Example: Using the Cerebras SDK Client">
  When using the Cerebras SDK client, non-standard parameters can be passed as regular parameters:

  <CodeGroup>
    ```python Python theme={null}
    client = Cerebras(
        api_key=os.environ.get("CEREBRAS_API_KEY")
    )

    response = client.chat.completions.create(
        model="zai-glm-4.7",
        messages=[...],
        reasoning_effort="none",  # Standard parameter
        clear_thinking=False       # Non-standard parameter
    )
    ```

    ```javascript Node.js theme={null}
    const client = new Cerebras({
        apiKey: process.env.CEREBRAS_API_KEY
    });

    const response = await client.chat.completions.create({
        model: "zai-glm-4.7",
        messages: [...],
        reasoning_effort: "none",  // Standard parameter
        clear_thinking: false       // Non-standard parameter
    });
    ```

  </CodeGroup>
</Accordion>
