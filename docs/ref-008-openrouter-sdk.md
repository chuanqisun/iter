> ## Documentation Index
>
> Fetch the complete documentation index at: https://openrouter.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Client SDKs

> Lightweight, type-safe clients for the OpenRouter API

The Client SDKs give you a thin, type-safe layer over the OpenRouter REST API. It handles authentication, request validation, and response typing so you can call any of 400+ models with a single function call, with no boilerplate and no provider-specific quirks.

## Installation

| Language   | Package                                                            |
| ---------- | ------------------------------------------------------------------ |
| TypeScript | [`@openrouter/sdk`](https://www.npmjs.com/package/@openrouter/sdk) |
| Python     | [`openrouter`](https://pypi.org/project/openrouter/)               |
| Go         | [`go-sdk`](https://pkg.go.dev/github.com/OpenRouterTeam/go-sdk)    |

<CodeGroup>
  ```bash title="npm" lines theme={null}
  npm install @openrouter/sdk
  ```

```bash title="pnpm" lines theme={null}
pnpm add @openrouter/sdk
```

```bash title="yarn" lines theme={null}
yarn add @openrouter/sdk
```

```bash title="bun" lines theme={null}
bun add @openrouter/sdk
```

```bash title="deno" lines theme={null}
deno add npm:@openrouter/sdk
```

```bash title="pip" lines theme={null}
pip install openrouter
```

```bash title="go" lines theme={null}
go get github.com/OpenRouterTeam/go-sdk
```

</CodeGroup>

All three SDKs are auto-generated from the OpenRouter OpenAPI spec, so new models, parameters, and endpoints appear immediately after each API release.

## When to use the Client SDKs

Choose the Client SDKs when you need **direct, efficient access to model inference** and want to manage your own application logic:

- **Single-turn completions**, send a prompt, get a response
- **Streaming responses**, real-time token-by-token output
- **Embeddings, video, and rerank**, generate vector representations, create videos, and rerank results
- **API key and credit management**, programmatic control over your account
- **Custom orchestration**, you handle conversation loops, tool dispatch, and state yourself

The Client SDKs are intentionally lean. It mirrors the OpenRouter API surface 1:1 with full type safety, so there is no abstraction to fight when you need fine-grained control.

<Tip>
  If you want higher-level primitives for building agents (multi-turn loops, tool definitions, stop conditions, and conversation state management), see the [Agent SDK](/docs/agent-sdk/overview) instead.
</Tip>

## Quick example

<CodeGroup>
  ```typescript title="TypeScript" lines theme={null}
  import { OpenRouter } from '@openrouter/sdk';

const client = new OpenRouter({
apiKey: process.env.OPENROUTER_API_KEY,
});

const response = await client.chat.send({
model: 'openai/gpt-5.2',
messages: [
{ role: 'user', content: 'Explain quantum computing in one sentence.' },
],
});

console.log(response.choices[0].message.content);

````

```python title="Python" lines theme={null}
from openrouter import OpenRouter
import os

with OpenRouter(api_key=os.getenv("OPENROUTER_API_KEY")) as client:
    response = client.chat.send(
        model="openai/gpt-5.2",
        messages=[
            {"role": "user", "content": "Explain quantum computing in one sentence."}
        ],
    )

    print(response.choices[0].message.content)
````

</CodeGroup>

## Client SDKs vs Agent SDK

|                        | Client SDKs                                                   | Agent SDK                                                           |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Focus**              | Lean API client, mirrors the REST API with full type safety   | Agentic primitives, multi-turn loops, tools, stop conditions        |
| **Use when**           | You want direct model calls and manage orchestration yourself | You want built-in agent loops, tool execution, and state management |
| **Conversation state** | You manage it                                                 | Managed for you via `callModel`                                     |
| **Tool execution**     | You dispatch tool calls                                       | Automatic with the `tool()` helper                                  |
| **Languages**          | TypeScript, Python, Go                                        | TypeScript                                                          |

## Next steps

- [TypeScript SDK reference](/docs/client-sdks/typescript)
- [Python SDK reference](/docs/client-sdks/python)
- [Go SDK reference](/docs/client-sdks/go)
- [Agent SDK overview](/docs/agent-sdk/overview), for building agents with multi-turn loops and tools

# Streaming

export const Template = ({children, data}) => {
const replace = s => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in data) ? data[k] : `{{${k}}}`);
const leafText = node => typeof node === 'string' ? node : node?.$$typeof && typeof node.props?.children === 'string' ? node.props.children : null;
  const collapseTokens = nodes => {
    const out = [];
    let i = 0;
    while (i < nodes.length) {
      const ta = leafText(nodes[i]);
      const tb = leafText(nodes[i + 1]);
      const tc = leafText(nodes[i + 2]);
      if (ta != null && tb != null && tc != null) {
        const m = (ta + tb + tc).match(/^([\s\S]*)\{\{(\w+)\}\}([\s\S]*)$/);
        if (m && (m[2] in data)) {
          out.push(m[1] + data[m[2]] + m[3]);
          i += 3;
          continue;
        }
      }
      out.push(nodes[i]);
      i++;
    }
    return out;
  };
  const process = node => {
    if (typeof node === 'string') return replace(node);
    if (Array.isArray(node)) return collapseTokens(node.map(process));
    if (node && typeof node === 'object') {
      if (node.$$typeof) return {
...node,
props: process(node.props)
};
return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, process(v)]));
}
return node;
};
return <>{process(children)}</>;
};

export const Model = {
GPT_4_Omni: 'openai/gpt-4o'
};

export const API_KEY_REF = '<OPENROUTER_API_KEY>';

The OpenRouter API allows streaming responses from _any model_. This is useful for building chat interfaces or other applications where the UI should update as the model generates the response.

To enable streaming, you can set the `stream` parameter to `true` in your request. The model will then stream the response to the client in chunks, rather than returning the entire response at once.

Here is an example of how to stream a response, and process it:

<Template
data={{
API_KEY_REF,
MODEL: Model.GPT_4_Omni
}}

>

  <CodeGroup>
    ```typescript title="TypeScript SDK" expandable lines theme={null}
    import { OpenRouter } from '@openrouter/sdk';

    const openRouter = new OpenRouter({
      apiKey: '{{API_KEY_REF}}',
    });

    const question = 'How would you build the tallest building ever?';

    const stream = await openRouter.chat.send({
      model: '{{MODEL}}',
      messages: [{ role: 'user', content: question }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        console.log(content);
      }

      // Final chunk includes usage stats
      if (chunk.usage) {
        console.log('Usage:', chunk.usage);
      }
    }
    ```

    ```python Python expandable lines theme={null}
    import requests
    import json

    question = "How would you build the tallest building ever?"

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
      "Authorization": f"Bearer {{API_KEY_REF}}",
      "Content-Type": "application/json"
    }

    payload = {
      "model": "{{MODEL}}",
      "messages": [{"role": "user", "content": question}],
      "stream": True
    }

    buffer = ""
    with requests.post(url, headers=headers, json=payload, stream=True) as r:
      for chunk in r.iter_content(chunk_size=1024, decode_unicode=True):
        buffer += chunk
        while True:
          try:
            # Find the next complete SSE line
            line_end = buffer.find('\n')
            if line_end == -1:
              break

            line = buffer[:line_end].strip()
            buffer = buffer[line_end + 1:]

            # Skip SSE comments (lines starting with ":"), e.g. the
            # ": OPENROUTER PROCESSING" keep-alive — they are not JSON
            if line.startswith(':'):
              continue

            if line.startswith('data: '):
              data = line[6:]
              if data == '[DONE]':
                break

              try:
                data_obj = json.loads(data)
                content = data_obj["choices"][0]["delta"].get("content")
                if content:
                  print(content, end="", flush=True)
              except json.JSONDecodeError:
                pass
          except Exception:
            break
    ```

    ```typescript title="TypeScript (fetch)" expandable lines theme={null}
    const question = 'How would you build the tallest building ever?';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY_REF}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        messages: [{ role: 'user', content: question }],
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        while (true) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          // Skip SSE comments (lines starting with ":"), e.g. the
          // ": OPENROUTER PROCESSING" keep-alive — they are not JSON
          if (line.startsWith(':')) continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0].delta.content;
              if (content) {
                console.log(content);
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }
    ```

  </CodeGroup>
</Template>

### Additional information

For SSE (Server-Sent Events) streams, OpenRouter occasionally sends comments to prevent connection timeouts. These comments look like:

```text lines theme={null}
: OPENROUTER PROCESSING
```

Comment payload can be safely ignored per the [SSE specs](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation). However, you can use it to improve UX as needed, e.g. by showing a dynamic loading indicator.

<Warning>
  If you parse the stream by hand, skip lines that start with `:` before
  calling `JSON.parse`. Passing a comment line like `: OPENROUTER PROCESSING`
  to `JSON.parse` throws, and unhandled it will crash your stream loop. The
  snippets above handle this.
</Warning>

A spec-compliant parser such as [eventsource-parser](https://github.com/rexxars/eventsource-parser) handles comments, multi-line `data:` fields, and buffering for you:

```typescript title="eventsource-parser" expandable lines theme={null}
import { createParser } from "eventsource-parser";

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
  }),
});

// Errors that occur before streaming starts are plain JSON, not SSE
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error.message);
}

const parser = createParser({
  onEvent(event) {
    if (event.data === "[DONE]") return;
    try {
      const chunk = JSON.parse(event.data);
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        console.log(content);
      }
    } catch {
      // Ignore invalid JSON
    }
  },
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  parser.feed(decoder.decode(value, { stream: true }));
}
```

A parser only handles the SSE framing. Errors that occur mid-generation still arrive as regular `data:` events with an `error` field. See [Handling Errors During Streaming](#handling-errors-during-streaming) below.

The generation ID is returned in the `X-Generation-Id` response header for all endpoints (chat completions, completions, responses, and messages), which can be useful for debugging and correlating requests.

Some SSE client implementations might not parse the payload according to spec, which leads to an uncaught error when you `JSON.stringify` the non-JSON payloads. We recommend the following clients:

- [eventsource-parser](https://github.com/rexxars/eventsource-parser)
- [OpenAI SDK](https://www.npmjs.com/package/openai)
- [Vercel AI SDK](https://www.npmjs.com/package/ai)

### Stream cancellation

Streaming requests can be cancelled by aborting the connection. For supported providers, this immediately stops model processing and billing.

<Accordion title="Provider Support">
  **Supported**

- OpenAI, Azure, Anthropic
- Fireworks, Mancer, Recursal
- AnyScale, Lepton, OctoAI
- Novita, DeepInfra, Together
- Cohere, Hyperbolic, Infermatic
- Avian, XAI, Cloudflare
- SFCompute, Nineteen, Liquid
- Friendli, Chutes, DeepSeek

**Not Currently Supported**

- AWS Bedrock, Groq, Modal
- Google, Google AI Studio, Minimax
- HuggingFace, Replicate, Perplexity
- Mistral, AI21, Featherless
- Lynn, Lambda, Reflection
- SambaNova, Inflection, ZeroOneAI
- AionLabs, Alibaba, Nebius
- Kluster, Targon, InferenceNet
</Accordion>

To implement stream cancellation:

<Template
data={{
API_KEY_REF,
MODEL: Model.GPT_4_Omni
}}

>

  <CodeGroup>
    ```typescript title="TypeScript SDK" expandable lines theme={null}
    import { OpenRouter } from '@openrouter/sdk';

    const openRouter = new OpenRouter({
      apiKey: '{{API_KEY_REF}}',
    });

    const controller = new AbortController();

    try {
      const stream = await openRouter.chat.send({
        model: '{{MODEL}}',
        messages: [{ role: 'user', content: 'Write a story' }],
        stream: true,
      }, {
        signal: controller.signal,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          console.log(content);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled');
      } else {
        throw error;
      }
    }

    // To cancel the stream:
    controller.abort();
    ```

    ```python Python expandable lines theme={null}
    import requests
    from threading import Event, Thread

    def stream_with_cancellation(prompt: str, cancel_event: Event):
        with requests.Session() as session:
            response = session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {{API_KEY_REF}}"},
                json={"model": "{{MODEL}}", "messages": [{"role": "user", "content": prompt}], "stream": True},
                stream=True
            )

            try:
                for line in response.iter_lines():
                    if cancel_event.is_set():
                        response.close()
                        return
                    if line:
                        print(line.decode(), end="", flush=True)
            finally:
                response.close()

    # Example usage:
    cancel_event = Event()
    stream_thread = Thread(target=lambda: stream_with_cancellation("Write a story", cancel_event))
    stream_thread.start()

    # To cancel the stream:
    cancel_event.set()
    ```

    ```typescript title="TypeScript (fetch)" expandable lines theme={null}
    const controller = new AbortController();

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${{{API_KEY_REF}}}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: '{{MODEL}}',
            messages: [{ role: 'user', content: 'Write a story' }],
            stream: true,
          }),
          signal: controller.signal,
        },
      );

      // Process the stream...
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled');
      } else {
        throw error;
      }
    }

    // To cancel the stream:
    controller.abort();
    ```

  </CodeGroup>
</Template>

<Warning>
  Cancellation only works for streaming requests with supported providers. For
  non-streaming requests or unsupported providers, the model will continue
  processing and you will be billed for the complete response.
</Warning>

### Handling errors during streaming

OpenRouter handles errors differently depending on when they occur during the streaming process:

#### Errors before any tokens are sent

If an error occurs before any tokens have been streamed to the client, OpenRouter returns a standard JSON error response with the appropriate HTTP status code. This follows the standard error format:

```json lines theme={null}
{
  "error": {
    "code": 400,
    "message": "Invalid model specified"
  }
}
```

Common HTTP status codes include:

- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (invalid API key)
- **402**: Payment Required (insufficient credits)
- **429**: Too Many Requests (rate limited)
- **502**: Bad Gateway (provider error)
- **503**: Service Unavailable (no available providers)

#### Errors after tokens have been sent (mid-stream)

If an error occurs after some tokens have already been streamed to the client, OpenRouter cannot change the HTTP status code (which is already 200 OK). Instead, the error is sent as a Server-Sent Event (SSE) with a unified structure:

```text lines theme={null}
data: {"id":"cmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"openai/gpt-4o","provider":"openai","error":{"code":"server_error","message":"Provider disconnected unexpectedly"},"choices":[{"index":0,"delta":{"content":""},"finish_reason":"error"}]}
```

Key characteristics of mid-stream errors:

- The error appears at the **top level** alongside standard response fields (id, object, created, etc.)
- A `choices` array is included with `finish_reason: "error"` to properly terminate the stream
- The HTTP status remains 200 OK since headers were already sent
- The stream is terminated after this unified error event

#### Code examples

Here's how to properly handle both types of errors in your streaming implementation:

<Template
data={{
API_KEY_REF,
MODEL: Model.GPT_4_Omni
}}

>

  <CodeGroup>
    ```typescript title="TypeScript SDK" expandable lines theme={null}
    import { OpenRouter } from '@openrouter/sdk';

    const openRouter = new OpenRouter({
      apiKey: '{{API_KEY_REF}}',
    });

    async function streamWithErrorHandling(prompt: string) {
      try {
        const stream = await openRouter.chat.send({
          model: '{{MODEL}}',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });

        for await (const chunk of stream) {
          // Check for errors in chunk
          if ('error' in chunk) {
            console.error(`Stream error: ${chunk.error.message}`);
            if (chunk.choices?.[0]?.finish_reason === 'error') {
              console.log('Stream terminated due to error');
            }
            return;
          }

          // Process normal content
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            console.log(content);
          }
        }
      } catch (error) {
        // Handle pre-stream errors
        console.error(`Error: ${error.message}`);
      }
    }
    ```

    ```python Python expandable lines theme={null}
    import requests
    import json

    async def stream_with_error_handling(prompt):
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={'Authorization': f'Bearer {{API_KEY_REF}}'},
            json={
                'model': '{{MODEL}}',
                'messages': [{'role': 'user', 'content': prompt}],
                'stream': True
            },
            stream=True
        )

        # Check initial HTTP status for pre-stream errors
        if response.status_code != 200:
            error_data = response.json()
            print(f"Error: {error_data['error']['message']}")
            return

        # Process stream and handle mid-stream errors
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith('data: '):
                    data = line_text[6:]
                    if data == '[DONE]':
                        break

                    try:
                        parsed = json.loads(data)

                        # Check for mid-stream error
                        if 'error' in parsed:
                            print(f"Stream error: {parsed['error']['message']}")
                            # Check finish_reason if needed
                            if parsed.get('choices', [{}])[0].get('finish_reason') == 'error':
                                print("Stream terminated due to error")
                            break

                        # Process normal content
                        content = parsed['choices'][0]['delta'].get('content')
                        if content:
                            print(content, end='', flush=True)

                    except json.JSONDecodeError:
                        pass
    ```

    ```typescript title="TypeScript (fetch)" expandable lines theme={null}
    async function streamWithErrorHandling(prompt: string) {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${{{API_KEY_REF}}}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: '{{MODEL}}',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          }),
        }
      );

      // Check initial HTTP status for pre-stream errors
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error: ${error.error.message}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const lineEnd = buffer.indexOf('\n');
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;

              try {
                const parsed = JSON.parse(data);

                // Check for mid-stream error
                if (parsed.error) {
                  console.error(`Stream error: ${parsed.error.message}`);
                  // Check finish_reason if needed
                  if (parsed.choices?.[0]?.finish_reason === 'error') {
                    console.log('Stream terminated due to error');
                  }
                  return;
                }

                // Process normal content
                const content = parsed.choices[0].delta.content;
                if (content) {
                  console.log(content);
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      } finally {
        reader.cancel();
      }
    }
    ```

  </CodeGroup>
</Template>

#### API-specific behavior

Different API endpoints may handle streaming errors slightly differently:

- **OpenAI Chat Completions API**: Returns `ErrorResponse` directly if no chunks were processed, or includes error information in the response if some chunks were processed
- **OpenAI Responses API**: May transform certain error codes (like `context_length_exceeded`) into a successful response with `finish_reason: "length"` instead of treating them as errors
