#### Tools

# Web Search

The Web Search tool enables Grok to search the web in real-time and browse web pages to find information. This powerful tool allows the model to search the internet, access web pages, and extract relevant information to answer queries with up-to-date content.

## SDK Support

| SDK/API              | Tool Name               |
| -------------------- | ----------------------- |
| xAI SDK              | `web_search`            |
| OpenAI Responses API | `web_search`            |
| Vercel AI SDK        | `xai.tools.webSearch()` |

This tool is also supported in all Responses API compatible SDKs.

## Basic Usage

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4.6",  # reasoning model
    tools=[web_search()],
    include=["verbose_streaming"],
)

chat.append(user("What is xAI?"))

is_thinking = True
for response, chunk in chat.stream():
    for tool_call in chunk.tool_calls:
        print(f"\\nCalling tool: {tool_call.function.name} with arguments: {tool_call.function.arguments}")
    if response.usage.reasoning_tokens and is_thinking:
        print(f"\\rThinking... ({response.usage.reasoning_tokens} tokens)", end="", flush=True)
    if chunk.content and is_thinking:
        print("\\n\\nFinal Response:")
        is_thinking = False
    if chunk.content and not is_thinking:
        print(chunk.content, end="", flush=True)

print("\\n\\nCitations:")
print(response.citations)
```

```pythonOpenAISDK
import os
from openai import OpenAI

api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)

response = client.responses.create(
    model="grok-4.6",
    input=[
        {
            "role": "user",
            "content": "What is xAI?",
        },
    ],
    tools=[
        {
            "type": "web_search",
        },
    ],
)

print(response)
```

```javascriptAISDK
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

const { text, sources } = await generateText({
  model: xai.responses('grok-4.6'),
  prompt: 'What is xAI?',
  tools: {
    web_search: xai.tools.webSearch(),
  },
});

console.log(text);
console.log('Citations:', sources);
```

```bash
curl https://api.x.ai/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -d '{
  "model": "grok-4.6",
  "input": [
    {
      "role": "user",
      "content": "What is xAI?"
    }
  ],
  "tools": [
    {
      "type": "web_search"
    }
  ]
}'
```

## Web Search Parameters

| Parameter                    | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `allowed_domains`            | Only search within specific domains (max 5)                   |
| `excluded_domains`           | Exclude specific domains from search (max 5)                  |
| `enable_image_understanding` | Enable analysis of images found during browsing               |
| `enable_image_search`        | Enable image search results that can be embedded in responses |

### Only Search in Specific Domains

Use `allowed_domains` to make the web search **only** perform the search and web browsing on web pages that fall within the specified domains.

> [!NOTE]
>
> `allowed_domains` cannot be set together with `excluded_domains` in the same request.

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4.6",
    tools=[
        web_search(allowed_domains=["grokipedia.com"]),
    ],
)

chat.append(user("What is xAI?"))
# stream or sample the response...
```

```pythonOpenAISDK
response = client.responses.create(
    model="grok-4.6",
    input=[{"role": "user", "content": "What is xAI?"}],
    tools=[
        {
            "type": "web_search",
            "filters": {"allowed_domains": ["grokipedia.com"]},
        },
    ],
)
```

```javascriptAISDK
const { text } = await generateText({
  model: xai.responses('grok-4.6'),
  prompt: 'What is xAI?',
  tools: {
    web_search: xai.tools.webSearch({
      allowedDomains: ['grokipedia.com'],
    }),
  },
});
```

### Exclude Specific Domains

Use `excluded_domains` to prevent the model from including the specified domains in any web search tool invocations.

```pythonXAI
chat = client.chat.create(
    model="grok-4.6",
    tools=[
        web_search(excluded_domains=["grokipedia.com"]),
    ],
)
```

```pythonOpenAISDK
response = client.responses.create(
    model="grok-4.6",
    input=[{"role": "user", "content": "What is xAI?"}],
    tools=[
        {
            "type": "web_search",
            "filters": {"excluded_domains": ["grokipedia.com"]},
        },
    ],
)
```

### Enable Image Understanding

Setting `enable_image_understanding` to true equips the agent with access to the `view_image` tool, allowing it to analyze images encountered during the search process.

When enabled, you will see `SERVER_SIDE_TOOL_VIEW_IMAGE` in `response.server_side_tool_usage` along with the number of times it was called.

> [!NOTE]
>
> Enabling this parameter for Web Search will also enable the image understanding for X Search tool if it's also included in the request.

```pythonXAI
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4.6",
    tools=[
        web_search(enable_image_understanding=True),
    ],
)

chat.append(user("What is included in the image in xAI's official website?"))
# stream or sample the response...
```

```pythonOpenAISDK
response = client.responses.create(
    model="grok-4.6",
    input=[
        {
            "role": "user",
            "content": "What is included in the image in xAI's official website?",
        },
    ],
    tools=[
        {
            "type": "web_search",
            "enable_image_understanding": True,
        },
    ],
)
```

```javascriptAISDK
const { text } = await generateText({
  model: xai.responses('grok-4.6'),
  prompt: "What is included in the image in xAI's official website?",
  tools: {
    web_search: xai.tools.webSearch({
      enableImageUnderstanding: true,
    }),
  },
});
```

### Enable Image Search

Setting `enable_image_search` to true lets Grok search for relevant images and include them in the response as Markdown image embeds such as `![alt](url)`.

> [!NOTE]
>
> After Grok searches for images, the returned images are included in the model context used to write the response. This is separate from `enable_image_understanding`, which lets Grok inspect images it finds while browsing regular web pages.

The Vercel AI SDK does not yet expose `enableImageSearch`; the examples below use the Responses API and xAI Python SDK.

```bash customLanguage="bash"
curl https://api.x.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
  "model": "grok-4.6",
  "input": [
    {
      "role": "user",
      "content": "Show me images of Starship on the launch pad."
    }
  ],
  "tools": [
    {
      "type": "web_search",
      "enable_image_search": true
    }
  ]
}'
```

```python customLanguage="pythonXAI"
import os

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4.6",
    tools=[
        web_search(enable_image_search=True),
    ],
)

chat.append(user("Show me images of Starship on the launch pad."))
response = chat.sample()
print(response.content)
print(response.server_side_tool_usage)
```

```python customLanguage="pythonOpenAISDK"
response = client.responses.create(
    model="grok-4.6",
    input=[
        {
            "role": "user",
            "content": "Show me images of Starship on the launch pad.",
        },
    ],
    tools=[
        {
            "type": "web_search",
            "enable_image_search": True,
        },
    ],
)

print(response)
```

A response can include Markdown image embeds directly in the output text:

```output
![Why the SpaceX Starship launch pad matters](https://www.astronomy.com/wp-content/uploads/2024/09/starship-test-flight-mission-scaled.jpg)

Here are several high-quality images of SpaceX's Starship on the launch pad at Starbase in Boca Chica, Texas.
```

In the xAI SDK, successful image search executions appear in `response.server_side_tool_usage` as `SERVER_SIDE_TOOL_IMAGE_SEARCH`.

## Citations

For details on how to retrieve and use citations from search results, see the [Citations](/developers/tools/citations) page.

# Chat with Files

You can attach files to chat conversations using a public URL or an uploaded file ID. When files are attached, the system automatically enables document search capabilities, transforming your request into an agentic workflow.

## Attaching Files

There are two ways to attach a file to a message:

**Public URL (`file_url`)** — reference any publicly accessible file directly, no upload step needed:

```json
{ "type": "input_file", "file_url": "https://example.com/document.pdf" }
```

**Uploaded file (`file_id`)** — [upload](/developers/files/managing-files) files first via the Files API and reference by ID. Useful for files that aren't publicly accessible, such as private or sensitive documents:

```json
{ "type": "input_file", "file_id": "file-abc123" }
```

The examples below use `file_url` for simplicity. You can replace with `file_id` to use uploaded files instead.

## Basic Chat with a Single File

Attach a file to a conversation to let the model search through it for relevant information.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Attach a file by public URL (or use file(file_id) for uploaded files)
chat = client.chat.create(model="grok-4.6")
chat.append(user(
    "What was the total revenue in this report?",
    file(url="https://docs.x.ai/assets/api-examples/documents/sales-report.txt"),
))

# Get the response
response = chat.sample()

print(f"Answer: {response.content}")
```

```pythonOpenAISDK
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("XAI_API_KEY"),
    base_url="https://api.x.ai/v1",
)

# Attach a file by public URL (or use file_id for uploaded files)
response = client.responses.create(
    model="grok-4.6",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "What was the total revenue in this report?"},
                {"type": "input_file", "file_url": "https://docs.x.ai/assets/api-examples/documents/sales-report.txt"}
            ]
        }
    ]
)

final_answer = response.output[-1].content[0].text
print(f"Answer: {final_answer}")
```

```pythonRequests
import os
import requests

api_key = os.getenv("XAI_API_KEY")
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

# Attach a file by public URL (or use file_id for uploaded files)
chat_url = "https://api.x.ai/v1/responses"
payload = {
    "model": "grok-4.6",
    "input": [
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "What was the total revenue in this report?"},
                {"type": "input_file", "file_url": "https://docs.x.ai/assets/api-examples/documents/sales-report.txt"}
            ]
        }
    ]
}
response = requests.post(chat_url, headers=headers, json=payload)
print(response.json())
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach a file by public URL (or use file_id for uploaded files)
const response = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                { type: "input_text", text: "What was the total revenue in this report?" },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/sales-report.txt" },
            ],
        },
    ],
});

const finalAnswer = response.output[response.output.length - 1].content[0].text;
console.log("Answer: " + finalAnswer);
```

```bash
# Attach a file by public URL (or use file_id for uploaded files)
curl -X POST "https://api.x.ai/v1/responses" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "grok-4.6",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "What was the total revenue in this report?"},
          {"type": "input_file", "file_url": "https://docs.x.ai/assets/api-examples/documents/sales-report.txt"}
        ]
      }
    ]
  }'
```

## Streaming Chat with Files

Get real-time responses while the model searches through your documents.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Attach a file by public URL (or use file(file_id) for uploaded files)
chat = client.chat.create(model="grok-4.6")
chat.append(user(
    "What is the weight of the XR-2000?",
    file(url="https://docs.x.ai/assets/api-examples/documents/product-specs.txt"),
))

# Stream the response
is_thinking = True
for response, chunk in chat.stream():
    # Show tool calls as they happen
    for tool_call in chunk.tool_calls:
        print(f"\\nSearching: {tool_call.function.name}")

    if response.usage.reasoning_tokens and is_thinking:
        print(f"\\rThinking... ({response.usage.reasoning_tokens} tokens)", end="", flush=True)

    if chunk.content and is_thinking:
        print("\\n\\nAnswer:")
        is_thinking = False

    if chunk.content:
        print(chunk.content, end="", flush=True)

print(f"\\n\\nUsage: {response.usage}")
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach a file by public URL (or use file_id for uploaded files)
const stream = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                { type: "input_text", text: "What is the weight of the XR-2000?" },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/product-specs.txt" },
            ],
        },
    ],
    stream: true,
});

for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
        process.stdout.write(event.delta);
    }
}

console.log();
```

## Multiple File Attachments

Query across multiple documents simultaneously.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Attach files by public URL (or use file(file_id) for uploaded files)
chat = client.chat.create(model="grok-4.6")
chat.append(
    user(
        "Based on these documents, when did the project start, what is the budget, and how many people are on the team?",
        file(url="https://docs.x.ai/assets/api-examples/documents/project-timeline.txt"),
        file(url="https://docs.x.ai/assets/api-examples/documents/project-budget.txt"),
        file(url="https://docs.x.ai/assets/api-examples/documents/project-team.txt"),
    )
)

response = chat.sample()

print(f"Answer: {response.content}")
print("\\nDocuments searched: 3")
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach files by public URL (or use file_id for uploaded files)
const response = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: "Based on these documents, when did the project start, what is the budget, and how many people are on the team?",
                },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/project-timeline.txt" },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/project-budget.txt" },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/project-team.txt" },
            ],
        },
    ],
});

const finalAnswer = response.output[response.output.length - 1].content[0].text;
console.log("Answer: " + finalAnswer);
console.log("Documents searched: 3");
```

## Multi-Turn Conversations with Files

Maintain context across multiple questions about the same documents. Use encrypted content to preserve file context efficiently across multiple turns.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Create a multi-turn conversation with encrypted content
chat = client.chat.create(
    model="grok-4.6",
    use_encrypted_content=True,  # Enable encrypted content for efficient multi-turn
)

# First turn: Attach a file by public URL (or use file(file_id) for uploaded files)
chat.append(user(
    "What is the employee's name?",
    file(url="https://docs.x.ai/assets/api-examples/documents/employee-info.txt"),
))
response1 = chat.sample()
print("Q1: What is the employee's name?")
print(f"A1: {response1.content}\\n")

# Add the response to conversation history
chat.append(response1)

# Second turn: Ask about department (agentic context is retained via encrypted content)
chat.append(user("What department does this employee work in?"))
response2 = chat.sample()
print("Q2: What department does this employee work in?")
print(f"A2: {response2.content}\\n")

# Add the response to conversation history
chat.append(response2)

# Third turn: Ask about skills
chat.append(user("What skills does this employee have?"))
response3 = chat.sample()
print("Q3: What skills does this employee have?")
print(f"A3: {response3.content}\\n")
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach a file by public URL (or use file_id for uploaded files)

// First turn: Ask about the document
const response1 = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                { type: "input_text", text: "What is the employee's name?" },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/employee-info.txt" },
            ],
        },
    ],
});

console.log("Q1: What is the employee's name?");
console.log("A1: " + response1.output[response1.output.length - 1].content[0].text + "\\n");

// Second turn: Ask about department (uses previous_response_id for context)
const response2 = await client.responses.create({
    model: "grok-4.6",
    previous_response_id: response1.id,
    input: [
        { role: "user", content: "What department does this employee work in?" },
    ],
});

console.log("Q2: What department does this employee work in?");
console.log("A2: " + response2.output[response2.output.length - 1].content[0].text + "\\n");

// Third turn: Ask about skills
const response3 = await client.responses.create({
    model: "grok-4.6",
    previous_response_id: response2.id,
    input: [
        { role: "user", content: "What skills does this employee have?" },
    ],
});

console.log("Q3: What skills does this employee have?");
console.log("A3: " + response3.output[response3.output.length - 1].content[0].text + "\\n");
```

## Combining Files with Other Modalities

You can combine file attachments with images and other content types in a single message.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file, image

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Attach files by public URL (or use file(file_id) for uploaded files)
chat = client.chat.create(model="grok-4.6")
chat.append(
    user(
        "Based on the attached care guide, do you have any advice about the pictured cat?",
        file(url="https://docs.x.ai/assets/api-examples/documents/cat-care.txt"),
        image("https://media.x.ai/v1/docs/example-cat-in-tree-8e9ac3e0.png"),
    )
)

response = chat.sample()

print(f"Analysis: {response.content}")
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach files by public URL (or use file_id for uploaded files)
const response = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: "Based on the attached care guide, do you have any advice about the pictured cat?",
                },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/cat-care.txt" },
                {
                    type: "input_image",
                    image_url: "https://media.x.ai/v1/docs/example-cat-in-tree-8e9ac3e0.png",
                },
            ],
        },
    ],
});

const analysis = response.output[response.output.length - 1].content[0].text;
console.log("Analysis: " + analysis);
```

## Combining Files with Code Execution

For data analysis tasks, you can attach data files and enable the code execution tool. This allows Grok to write and run Python code to analyze and process your data.

```pythonXAI
import os
from xai_sdk import Client
from xai_sdk.chat import user, file
from xai_sdk.tools import code_execution

client = Client(api_key=os.getenv("XAI_API_KEY"))

# Attach a file by public URL (or use file(file_id) for uploaded files)
chat = client.chat.create(
    model="grok-4.6",
    tools=[code_execution()],  # Enable code execution
)

chat.append(
    user(
        "Analyze this sales data and calculate: 1) Total revenue by product, 2) Average units sold by region, 3) Which product-region combination has the highest revenue",
        file(url="https://docs.x.ai/assets/api-examples/documents/sales-data.csv"),
    )
)

# Stream the response to see code execution in real-time
is_thinking = True
for response, chunk in chat.stream():
    for tool_call in chunk.tool_calls:
        if tool_call.function.name == "code_execution":
            print("\\n[Executing Code]")

    if response.usage.reasoning_tokens and is_thinking:
        print(f"\\rThinking... ({response.usage.reasoning_tokens} tokens)", end="", flush=True)

    if chunk.content and is_thinking:
        print("\\n\\nAnalysis Results:")
        is_thinking = False

    if chunk.content:
        print(chunk.content, end="", flush=True)

print(f"\\n\\nUsage: {response.usage}")
```

```javascriptOpenAISDK
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

// Attach a file by public URL (or use file_id for uploaded files)
const stream = await client.responses.create({
    model: "grok-4.6",
    input: [
        {
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: "Analyze this sales data and calculate: 1) Total revenue by product, " +
                        "2) Average units sold by region, " +
                        "3) Which product-region combination has the highest revenue",
                },
                { type: "input_file", file_url: "https://docs.x.ai/assets/api-examples/documents/sales-data.csv" },
            ],
        },
    ],
    tools: [{ type: "code_interpreter" }],
    stream: true,
});

for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
        process.stdout.write(event.delta);
    }
}

console.log();
```

The model will:

1. Access the attached data file
2. Write Python code to load and analyze the data
3. Execute the code in a sandboxed environment
4. Perform calculations and statistical analysis
5. Return the results and insights in the response

## Limitations and Considerations

### Request Constraints

- **No batch requests**: File attachments with document search are agentic requests and do not support batch mode (`n > 1`)
- **Streaming recommended**: Use streaming mode for better observability of document search process

### Document Complexity

- Highly unstructured or very long documents may require more processing
- Well-organized documents with clear structure are easier to search
- Large documents with many searches can result in higher token usage

### Model Compatibility

- **Recommended model**: `grok-4.6` for best document understanding
- **Agentic requirement**: File attachments require [agentic-capable](/developers/tools/overview) models that support server-side tools.

## Next Steps

Learn more about managing your files:
