#### Model Capabilities

# Comparison with Chat Completions API

The Responses API is the recommended way to interact with xAI models. Here's how it compares to the legacy Chat Completions API:

| Feature                    | Responses API                                          | Chat Completions API (Deprecated)    |
| -------------------------- | ------------------------------------------------------ | ------------------------------------ |
| **Stateful Conversations** | Built-in support via `previous_response_id`            | Stateless — must resend full history |
| **Server-side Storage**    | Responses stored for 30 days                           | No storage — manage history yourself |
| **Reasoning Models**       | Full support with encrypted reasoning content          | No reasoning content returned        |
| **Agentic Tools**          | Native support for tools (search, code execution, MCP) | Function calling only                |
| **Billing Optimization**   | Automatic caching of conversation history              | Full history billed on each request  |
| **Future Features**        | All new capabilities delivered here first              | Legacy endpoint, limited updates     |

## Key API Changes

### Parameter Mapping

| Chat Completions | Responses API          | Notes                                                      |
| ---------------- | ---------------------- | ---------------------------------------------------------- |
| `messages`       | `input`                | Array of message objects                                   |
| `max_tokens`     | `max_output_tokens`    | Maximum tokens to generate                                 |
| —                | `previous_response_id` | Continue a stored conversation                             |
| —                | `store`                | Control server-side storage (default: `true`)              |
| —                | `include`              | Request additional data like `reasoning.encrypted_content` |

### Response Structure

The response format differs between the two APIs:

**Chat Completions** returns content in `choices[0].message.content`:

```json
{
  "id": "chatcmpl-123",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      }
    }
  ]
}
```

**Responses API** returns content in an `output` array with typed items:

```json
{
  "id": "resp_123",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Hello! How can I help you?"
        }
      ]
    }
  ]
}
```

### Multi-turn Conversations

With Chat Completions, you must resend the entire conversation history with each request. With Responses API, you can use `previous_response_id` to continue a conversation:

```pythonWithoutSDK
# First request
response = client.responses.create(
    model="grok-4",
    input=[{"role": "user", "content": "What is 2+2?"}],
)

# Continue the conversation - no need to resend history
second_response = client.responses.create(
    model="grok-4",
    previous_response_id=response.id,
    input=[{"role": "user", "content": "Now multiply that by 10"}],
)
```

## Migration Path

Migrating from Chat Completions to Responses API is straightforward. Here's how to update your code for each SDK:

### Vercel AI SDK

Switch from `xai()` to `xai.responses()`:

```javascriptAISDK deletedLines="1" addedLines="2"
  model: xai('grok-4'),
  model: xai.responses('grok-4'),
```

### OpenAI SDK (JavaScript)

Switch from `client.chat.completions.create` to `client.responses.create`, and rename `messages` to `input`:

```javascriptWithoutSDK deletedLines="1,3" addedLines="2,4"
const response = await client.chat.completions.create({
const response = await client.responses.create({
    messages: [
    input: [
        { role: "user", content: "Hello!" }
    ],
});

```

### OpenAI SDK (Python)

Switch from `client.chat.completions.create` to `client.responses.create`, and rename `messages` to `input`:

```pythonWithoutSDK deletedLines="1,3" addedLines="2,4"
response = client.chat.completions.create(
response = client.responses.create(
    messages=[
    input=[
        {"role": "user", "content": "Hello!"}
    ],
)
```

### cURL

Change the endpoint from `/v1/chat/completions` to `/v1/responses`, and rename `messages` to `input`:

```bash deletedLines="1,5" addedLines="2,6"
curl https://api.x.ai/v1/chat/completions \
curl https://api.x.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{ "model": "grok-4", "messages": [{"role": "user", "content": "Hello!"}] }'
  -d '{ "model": "grok-4", "input": [{"role": "user", "content": "Hello!"}] }'
```

This will work for most use cases. If you have a unique integration, refer to the [Responses API documentation](/developers/model-capabilities/text/generate-text) for detailed guidance.
