> ## Documentation Index
>
> Fetch the complete documentation index at: https://openrouter.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Web Search

> Give any model access to real-time web information

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

export const API_KEY_REF = '<OPENROUTER_API_KEY>';

<Badge color="blue">Beta</Badge>

<Note>
  **Beta**

Server tools are currently in beta. The API and behavior may change.
</Note>

The `openrouter:web_search` server tool gives any model on OpenRouter access to real-time web information. When the model determines it needs current information, it calls the tool with a search query. OpenRouter executes the search and returns results that the model uses to formulate a grounded, cited response.

## How It Works

1. You include `{ "type": "openrouter:web_search" }` in your `tools` array.
2. Based on the user's prompt, the model decides whether a web search is needed and generates a search query.
3. OpenRouter executes the search using the configured engine (defaults to `auto`, which uses native provider search when available or falls back to [Exa](https://exa.ai)).
4. The search results (URLs, titles, and content snippets) are returned to the model.
5. The model synthesizes the results into its response. It may search multiple times in a single request if needed.

## Quick Start

<Template
data={{
API_KEY_REF,
MODEL: 'openai/gpt-5.2'
}}

>

  <CodeGroup>
    ```typescript title="TypeScript" expandable lines theme={null}
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer {{API_KEY_REF}}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        messages: [
          {
            role: 'user',
            content: 'What were the major AI announcements this week?'
          }
        ],
        tools: [
          { type: 'openrouter:web_search' }
        ]
      }),
    });

    const data = await response.json();
    console.log(data.choices[0].message.content);
    ```

    ```python title="Python" expandable lines theme={null}
    import requests

    response = requests.post(
      "https://openrouter.ai/api/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {{API_KEY_REF}}",
        "Content-Type": "application/json",
      },
      json={
        "model": "{{MODEL}}",
        "messages": [
          {
            "role": "user",
            "content": "What were the major AI announcements this week?"
          }
        ],
        "tools": [
          {"type": "openrouter:web_search"}
        ]
      }
    )

    data = response.json()
    print(data["choices"][0]["message"]["content"])
    ```

    ```bash title="cURL" lines theme={null}
    curl https://openrouter.ai/api/v1/chat/completions \
      -H "Authorization: Bearer {{API_KEY_REF}}" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "{{MODEL}}",
        "messages": [
          {
            "role": "user",
            "content": "What were the major AI announcements this week?"
          }
        ],
        "tools": [
          {"type": "openrouter:web_search"}
        ]
      }'
    ```

  </CodeGroup>
</Template>

## Configuration

The web search tool accepts optional `parameters` to customize search behavior:

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "engine": "exa",
    "max_results": 5,
    "max_total_results": 20,
    "search_context_size": "medium",
    "allowed_domains": ["example.com"],
    "excluded_domains": ["reddit.com"]
  }
}
```

| Parameter             | Type      | Default        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `engine`              | string    | `auto`         | Search engine to use: `auto`, `native`, `exa`, `firecrawl`, `parallel`, or `perplexity`                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mode`                | string    | Engine default | Engine-specific search mode. Exa: `instant`, `fast`, `auto`, `deep-lite`, `deep`, or `deep-reasoning`. Parallel: `turbo`, `basic`, or `advanced`. Ignored by other engines.                                                                                                                                                                                                                                                                                                                            |
| `max_results`         | integer   | 5              | Maximum results per search call (1–25; 1–20 for Perplexity). Applies to Exa, Firecrawl, Parallel, and Perplexity engines; ignored with native provider search                                                                                                                                                                                                                                                                                                                                          |
| `max_uses`            | integer   | —              | Maximum number of searches the model may perform in a single request. Once reached, further search calls return an error result instead of executing. With native provider search, forwarded only to Anthropic (as `max_uses`); other native search providers ignore it                                                                                                                                                                                                                                |
| `max_total_results`   | integer   | —              | Maximum total results across all search calls in a single request. Useful for controlling cost and context size in agentic loops                                                                                                                                                                                                                                                                                                                                                                       |
| `search_context_size` | string    | —              | How much context to retrieve: `low`, `medium`, or `high`. For Exa, pins a fixed per-result character cap (5K/15K/30K); when omitted, Exa picks adaptively (\~2-4K per result). For Parallel, controls total characters across all results (defaults to `medium`). For Perplexity, maps directly to the Search API's native `search_context_size` parameter. Ignored with native provider search and Firecrawl. Overridden by `max_characters` when both are set                                        |
| `max_characters`      | integer   | —              | Exact maximum characters of content per result (1–100,000). Applies to Exa, Parallel, and Perplexity engines; ignored with native provider search and Firecrawl. For Exa, caps highlight content per result. For Parallel, caps excerpt content per result (default 1,500 when omitted). For Perplexity, converted to a token budget via `max_tokens_per_page` and trimmed to the exact character cap. When both `max_characters` and `search_context_size` are set, `max_characters` takes precedence |
| `user_location`       | object    | —              | Approximate user location for location-biased results. Currently only supported by native provider search; ignored with Exa, Firecrawl, Parallel, and Perplexity (see below)                                                                                                                                                                                                                                                                                                                           |
| `allowed_domains`     | string\[] | —              | Limit results to these domains. Supported by Exa, Firecrawl, Parallel, Perplexity, and most native providers (see [domain filtering](#domain-filtering))                                                                                                                                                                                                                                                                                                                                               |
| `excluded_domains`    | string\[] | —              | Exclude results from these domains. Supported by Exa, Firecrawl, Parallel, Perplexity, and some native providers (see [domain filtering](#domain-filtering))                                                                                                                                                                                                                                                                                                                                           |

### User Location

Pass an approximate user location to bias search results geographically:

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "user_location": {
      "type": "approximate",
      "city": "San Francisco",
      "region": "California",
      "country": "US",
      "timezone": "America/Los_Angeles"
    }
  }
}
```

All fields within `user_location` are optional.

## Native Search Providers

When `engine` is `"auto"` (the default) or `"native"`, OpenRouter uses the provider's built-in search for supported models. The following providers have native web search:

- **[OpenAI](https://platform.openai.com/docs/guides/tools/web-search)** — GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-5 and later, o3, o3 Pro, o4-mini
- **[Anthropic](https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool)** — Claude 3.5 Haiku, Claude 3.7 Sonnet, Claude 4 and later (all Opus/Sonnet variants)
- **[Google](https://ai.google.dev/gemini-api/docs/grounding)** — Gemini 3 Flash, Gemini 3 Pro, Gemini 3.1 Flash/Lite, Gemini 3.5 Flash
- **[SpaceXAI](https://docs.x.ai/docs/guides/web-search)** — Grok 4 and later (includes both web search and X search)
- **[Perplexity](https://docs.perplexity.ai/api-reference/chat-completions-post)** — all Perplexity models (search is core to their API)

<Note>
  Older OpenAI models — including GPT-4o, GPT-4o Mini, and GPT-4 Turbo — do **not** support native web search. If you set `engine: "native"` with these models, the server tool will fall back to Exa search. Use `engine: "auto"` (or omit the field) for equivalent behavior.
</Note>

You can check whether a specific model supports native search on its [model page](https://openrouter.ai/models) — look for the "Web Search" capability badge. For models without native search, set `engine` to one of the other supported options ([Exa](https://exa.ai), [Firecrawl](https://firecrawl.dev), [Parallel](https://parallel.ai), or [Perplexity](https://docs.perplexity.ai)) — or leave it as `"auto"` to default to Exa.

## Engine Selection

The web search server tool supports multiple search engines:

- **`auto`** (default): Uses native search if the provider supports it, otherwise falls back to Exa
- **`native`**: Prefers the provider's built-in web search; falls back to Exa if the model doesn't support native search
- **`exa`**: Uses [Exa](https://exa.ai)'s search API, which combines keyword and embeddings-based search. Returns Exa [highlights](https://docs.exa.ai/reference/contents-retrieval-with-exa-api#highlights) — excerpts drawn from each page that are most relevant to the search query — rather than truncated page text. See the [Exa](#exa) section below.
- **`firecrawl`**: Uses [Firecrawl](https://firecrawl.dev)'s search API (BYOK — bring your own key)
- **`parallel`**: Uses [Parallel](https://parallel.ai)'s search API
- **`perplexity`**: Uses the [Perplexity](https://docs.perplexity.ai/api-reference/search-post) Search API for ranked web results with domain filtering, context size control, and `max_characters` support

### Engine Capabilities

| Feature                  | Exa         | Firecrawl       | Parallel    | Perplexity  | Native             |
| ------------------------ | ----------- | --------------- | ----------- | ----------- | ------------------ |
| **Domain filtering**     | Yes         | Yes             | Yes         | Yes\*\*\*   | Varies by provider |
| **Context size control** | Yes\*       | No              | Yes\*\*     | Yes         | No                 |
| **API key**              | Server-side | BYOK (your key) | Server-side | Server-side | Provider-handled   |

<small>
  *\* Exa: limit applies **per result***

_\*\* Parallel: limit applies as a **total across all results**_

_\*\*\* Perplexity: `allowed_domains` and `excluded_domains` are mutually exclusive — when both are provided, `allowed_domains` takes precedence_
</small>

### Exa

OpenRouter requests Exa [highlights](https://docs.exa.ai/reference/contents-retrieval-with-exa-api#highlights) for each result rather than the `text` content option. Highlights are extractive excerpts drawn directly from the page that Exa selects as most relevant to the search query, typically yielding higher-quality context per token than truncated page text for agentic web tooling.

Exa's `mode` controls search latency and depth. The default remains `auto`:

| Mode             | Approximate latency | Request cost |
| ---------------- | ------------------- | ------------ |
| `instant`        | \~250 ms            | \$0.007      |
| `fast`           | \~450 ms            | \$0.007      |
| `auto` (default) | \~1 second          | \$0.007      |
| `deep-lite`      | \~4 seconds         | \$0.012      |
| `deep`           | \~4–15 seconds      | \$0.012      |
| `deep-reasoning` | \~12–40 seconds     | \$0.015      |

By default, Exa selects an adaptive highlight size per query and document — typically \~2,000–4,000 characters per result. You can control the per-result character budget in two ways:

**Coarse presets via `search_context_size`** — maps to Exa's `contents.highlights.maxCharacters`:

- `low` — 5,000 characters per result
- `medium` — 15,000 characters per result
- `high` — 30,000 characters per result

**Exact value via `max_characters`** — pass any integer (1–100,000) to set a precise per-result content budget. Supported by Exa, Parallel, and Perplexity. When both `max_characters` and `search_context_size` are set, `max_characters` takes precedence.

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "engine": "exa",
    "max_characters": 2000
  }
}
```

When neither `max_characters` nor `search_context_size` is set, OpenRouter lets Exa pick the highlight size adaptively and Parallel uses its default of 1,500 characters per result. The selected excerpts are returned to the model on each result and surfaced to API callers via `url_citation` annotations. Within a single result, excerpts that come from different parts of the page are separated by Exa's `[...]` markers, so the `content` field of a `url_citation` annotation may look like:

```lines theme={null}
First excerpt drawn from the page.
[...]
Second excerpt drawn from elsewhere in the same page.
[...]
Third excerpt.
```

### Firecrawl (BYOK)

Firecrawl uses your own API key. To set it up:

1. Go to your [OpenRouter plugin settings](https://openrouter.ai/settings/plugins) and select Firecrawl as the web search engine
2. Accept the [Firecrawl Terms of Service](https://www.firecrawl.dev/terms-of-service) — this creates a Firecrawl account linked to your email
3. Your account starts with **10,000 free credits** (credits expire after 3 months)

Firecrawl searches use your Firecrawl credits directly — no additional charge from OpenRouter. Each search costs 2 credits per 10 results, plus 5 credits per result scraped (1 base scrape + 4 for [highlights extraction](https://docs.firecrawl.dev/features/scrape#output-formats)). For example, a search returning 5 results uses 27 Firecrawl credits (2 search + 5×5 scrape). See [Firecrawl pricing](https://www.firecrawl.dev/pricing) for details.

Firecrawl supports domain filtering (`allowed_domains` / `excluded_domains`), but they are mutually exclusive — you cannot use both in the same request.

### Parallel

[Parallel](https://parallel.ai) supports domain filtering and context size control (`search_context_size`). Set `mode` to choose the provider mode; OpenRouter uses `basic` by default and sends it explicitly.

| Mode              | Latency     | Request cost           | Language availability  |
| ----------------- | ----------- | ---------------------- | ---------------------- |
| `turbo`           | \~200 ms    | \$1 per 1,000 requests | English and Japanese   |
| `basic` (default) | \~1 second  | \$5 per 1,000 requests | Broad language support |
| `advanced`        | \~3 seconds | \$5 per 1,000 requests | Broad language support |

Each mode includes up to 10 results. Additional results cost \$1 per 1,000 results.

### Perplexity

[Perplexity](https://docs.perplexity.ai/api-reference/search-post) returns ranked web results (titles, URLs, snippets) without LLM synthesis. It supports domain filtering (`allowed_domains` / `excluded_domains`, mutually exclusive), `search_context_size`, and `max_characters`. Uses OpenRouter credits at \$0.005 per request.

## Domain Filtering

Restrict which domains appear in search results using `allowed_domains` and `excluded_domains`:

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "allowed_domains": ["arxiv.org", "nature.com"],
    "excluded_domains": ["reddit.com"]
  }
}
```

| Engine                 | `allowed_domains` | `excluded_domains` | Notes                                                                                                                      |
| ---------------------- | :---------------: | :----------------: | -------------------------------------------------------------------------------------------------------------------------- |
| **Exa**                |        Yes        |        Yes         | Both can be used simultaneously                                                                                            |
| **Parallel**           |        Yes        |        Yes         | Mutually exclusive                                                                                                         |
| **Firecrawl**          |        Yes        |        Yes         | Mutually exclusive                                                                                                         |
| **Perplexity**         |        Yes        |        Yes         | Mutually exclusive (when both provided, `allowed_domains` wins)                                                            |
| **Native (Anthropic)** |        Yes        |        Yes         | Mutually exclusive                                                                                                         |
| **Native (OpenAI)**    |        Yes        |         No         | `excluded_domains` silently ignored                                                                                        |
| **Native (Google)**    |        No         |         No         | Not supported. With `engine: "auto"`, falls back to Exa when filters are set. With `engine: "native"`, returns a 400 error |
| **Native (SpaceXAI)**  |        Yes        |        Yes         | Mutually exclusive                                                                                                         |

## Controlling Total Results

When the model searches multiple times in a single request, use `max_total_results` to cap the cumulative number of results:

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "max_results": 5,
    "max_total_results": 15
  }
}
```

Once the limit is reached, subsequent search calls return a message telling the model the limit was hit instead of performing another search. This is useful for controlling cost and context window usage in agentic loops.

## Limiting the Number of Searches

To hard-cap how many searches the model may perform in a single request, set `max_uses` in the tool's `parameters` (parity with Anthropic's native web search `max_uses`):

```json lines theme={null}
{
  "type": "openrouter:web_search",
  "parameters": {
    "max_uses": 3
  }
}
```

Once the limit is reached, subsequent search calls return a message telling the model the limit was hit instead of performing another search. With native provider search, the value is forwarded only to Anthropic (as its native `max_uses`); other native search providers have no equivalent parameter and ignore it.

Each search also consumes one step of the request's overall server-tool budget, shared across all server tools. Set the top-level `max_tool_calls` request field (a sibling of `messages` and `tools`, not a tool parameter) to bound that budget:

```json lines theme={null}
{
  "model": "openai/gpt-5.2",
  "messages": [...],
  "tools": [{ "type": "openrouter:web_search" }],
  "max_tool_calls": 5
}
```

When omitted, the budget defaults to **30** steps, which is also the maximum. For finer control (spend caps, custom stop conditions), use `stop_server_tools_when`, which overrides `max_tool_calls` entirely. See [Tool Call Limits](/docs/guides/features/server-tools#tool-call-limits) for how budgets work across all server tools.

## Works with the Responses API

The web search server tool also works with the Responses API:

<Template
data={{
API_KEY_REF,
MODEL: 'openai/gpt-5.2'
}}

>

  <CodeGroup>
    ```typescript title="TypeScript" lines theme={null}
    const response = await fetch('https://openrouter.ai/api/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer {{API_KEY_REF}}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        input: 'What is the current price of Bitcoin?',
        tools: [
          { type: 'openrouter:web_search', parameters: { max_results: 3 } }
        ]
      }),
    });

    const data = await response.json();
    console.log(data);
    ```

    ```python title="Python" lines theme={null}
    import requests

    response = requests.post(
      "https://openrouter.ai/api/v1/responses",
      headers={
        "Authorization": f"Bearer {{API_KEY_REF}}",
        "Content-Type": "application/json",
      },
      json={
        "model": "{{MODEL}}",
        "input": "What is the current price of Bitcoin?",
        "tools": [
          {"type": "openrouter:web_search", "parameters": {"max_results": 3}}
        ]
      }
    )

    data = response.json()
    print(data)
    ```

  </CodeGroup>
</Template>

## Usage Tracking

Web search usage is reported in the response `usage` object:

```json lines theme={null}
{
  "usage": {
    "input_tokens": 105,
    "output_tokens": 250,
    "server_tool_use": {
      "web_search_requests": 2
    }
  }
}
```

The `web_search_requests` field counts the total number of search queries the model made during the request.

## Pricing

| Engine         | Pricing                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Exa**        | Instant/Fast/Auto: \$0.007 per request; Deep Lite/Deep: \$0.012; Deep Reasoning: \$0.015. Includes up to 10 results, then \$0.001 per additional result                                                                                                                                                                                                                                    |
| **Parallel**   | Turbo: \$0.001/request; Basic or Advanced: \$0.005/request. Includes up to 10 results, then \$0.001 per additional result                                                                                                                                                                                                                                                                  |
| **Perplexity** | \$0.005 per request using OpenRouter credits                                                                                                                                                                                                                                                                                                                                               |
| **Firecrawl**  | Uses your Firecrawl credits directly — no OpenRouter charge. 2 credits per 10 results (search) + 5 credits per result (1 scrape + 4 highlights). See [Firecrawl pricing](https://www.firecrawl.dev/pricing)                                                                                                                                                                                |
| **Native**     | Passed through from the provider ([OpenAI](https://platform.openai.com/docs/pricing#built-in-tools), [Anthropic](https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool#usage-and-pricing), [Google](https://ai.google.dev/pricing), [Perplexity](https://docs.perplexity.ai/getting-started/pricing), [SpaceXAI](https://docs.x.ai/docs/models#tool-invocation-costs)) |

All pricing is in addition to standard LLM token costs for processing the search result content.

## Migrating from the Web Search Plugin

<Note>
  The [web search plugin](/docs/guides/features/plugins/web-search) (`plugins: [{ id: "web" }]`) and the [`:online` variant](/docs/guides/routing/model-variants/online) are deprecated. Use the `openrouter:web_search` server tool instead.
</Note>

The key differences:

|                           | Web Search Plugin (deprecated)               | Web Search Server Tool                             |
| ------------------------- | -------------------------------------------- | -------------------------------------------------- |
| **How to enable**         | `plugins: [{ id: "web" }]`                   | `tools: [{ type: "openrouter:web_search" }]`       |
| **Who decides to search** | Always searches once                         | Model decides when/whether to search               |
| **Call frequency**        | Once per request                             | 0 to N times per request                           |
| **Engine options**        | Native, Exa, Firecrawl, Parallel, Perplexity | Auto, Native, Exa, Firecrawl, Parallel, Perplexity |
| **Domain filtering**      | Yes (Exa, Parallel, Perplexity, some native) | Yes (Exa, Parallel, Perplexity, most native)       |
| **Context size control**  | Via `web_search_options`                     | Via `search_context_size` parameter                |
| **Total results cap**     | No                                           | Yes (`max_total_results`)                          |
| **Pricing**               | Varies by engine                             | Varies by engine (same rates)                      |

### Migration example

```json lines theme={null}
// Before (deprecated)
{
  "model": "openai/gpt-5.2",
  "messages": [...],
  "plugins": [{ "id": "web", "max_results": 3 }]
}

// After
{
  "model": "openai/gpt-5.2",
  "messages": [...],
  "tools": [
    { "type": "openrouter:web_search", "parameters": { "max_results": 3 } }
  ]
}
```

```json expandable lines theme={null}
// Before (deprecated) — engine and domain filtering
{
  "model": "openai/gpt-5.2",
  "messages": [...],
  "plugins": [{
    "id": "web",
    "engine": "exa",
    "max_results": 5,
    "include_domains": ["arxiv.org"]
  }]
}

// After
{
  "model": "openai/gpt-5.2",
  "messages": [...],
  "tools": [{
    "type": "openrouter:web_search",
    "parameters": {
      "engine": "exa",
      "max_results": 5,
      "allowed_domains": ["arxiv.org"]
    }
  }]
}
```

```json lines theme={null}
// Before (deprecated) — :online variant
{
  "model": "openai/gpt-5.2:online"
}

// After
{
  "model": "openai/gpt-5.2",
  "tools": [{ "type": "openrouter:web_search" }]
}
```

## Next Steps

- [Server Tools Overview](/docs/guides/features/server-tools) — Learn about server tools
- [Datetime](/docs/guides/features/server-tools/datetime) — Get the current date and time
- [Tool Calling](/docs/guides/features/tool-calling) — Learn about user-defined tool calling

> ## Documentation Index
>
> Fetch the complete documentation index at: https://openrouter.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Web Fetch

> Give any model the ability to fetch content from URLs

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

export const API_KEY_REF = '<OPENROUTER_API_KEY>';

<Badge color="blue">Beta</Badge>

<Note>
  **Beta**

Server tools are currently in beta. The API and behavior may change.
</Note>

The `openrouter:web_fetch` server tool gives any model the ability to fetch
content from a specific URL. When the model needs to read a web page or PDF
document, it calls the tool with the URL. OpenRouter fetches and extracts the
content, returning text that the model can use in its response.

## How It Works

1. You include `{ "type": "openrouter:web_fetch" }` in your `tools` array.
2. Based on the user's prompt, the model decides whether it needs to fetch a
   URL and generates the request.
3. OpenRouter fetches the URL using the configured engine (defaults to `auto`,
   which uses native provider fetch when available or falls back to
   [Exa](https://exa.ai)).
4. The page content (text, title, and URL) is returned to the model.
5. The model incorporates the fetched content into its response. It may fetch
   multiple URLs in a single request if needed.

## Quick Start

<Template
data={{
API_KEY_REF,
MODEL: 'openai/gpt-5.2'
}}

>

  <CodeGroup>
    ```typescript title="TypeScript" expandable lines theme={null}
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer {{API_KEY_REF}}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        messages: [
          {
            role: 'user',
            content: 'Summarize the content at https://example.com/article'
          }
        ],
        tools: [
          { type: 'openrouter:web_fetch' }
        ]
      }),
    });

    const data = await response.json();
    console.log(data.choices[0].message.content);
    ```

    ```python title="Python" expandable lines theme={null}
    import requests

    response = requests.post(
      "https://openrouter.ai/api/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {{API_KEY_REF}}",
        "Content-Type": "application/json",
      },
      json={
        "model": "{{MODEL}}",
        "messages": [
          {
            "role": "user",
            "content": "Summarize the content at https://example.com/article"
          }
        ],
        "tools": [
          {"type": "openrouter:web_fetch"}
        ]
      }
    )

    data = response.json()
    print(data["choices"][0]["message"]["content"])
    ```

    ```bash title="cURL" lines theme={null}
    curl https://openrouter.ai/api/v1/chat/completions \
      -H "Authorization: Bearer {{API_KEY_REF}}" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "{{MODEL}}",
        "messages": [
          {
            "role": "user",
            "content": "Summarize the content at https://example.com/article"
          }
        ],
        "tools": [
          {"type": "openrouter:web_fetch"}
        ]
      }'
    ```

  </CodeGroup>
</Template>

## Configuration

The web fetch tool accepts optional `parameters` to customize behavior:

```json lines theme={null}
{
  "type": "openrouter:web_fetch",
  "parameters": {
    "engine": "exa",
    "max_uses": 10,
    "max_content_tokens": 100000,
    "allowed_domains": ["docs.example.com"],
    "blocked_domains": ["private.example.com"]
  }
}
```

| Parameter            | Type      | Default | Description                                                                            |
| -------------------- | --------- | ------- | -------------------------------------------------------------------------------------- |
| `engine`             | string    | `auto`  | Fetch engine to use: `auto`, `native`, `exa`, `openrouter`, `firecrawl`, or `parallel` |
| `max_uses`           | integer   | —       | Maximum fetches per request. Once exceeded, the tool returns an error                  |
| `max_content_tokens` | integer   | —       | Maximum content length in approximate tokens. Content exceeding this is truncated      |
| `allowed_domains`    | string\[] | —       | Only fetch from these domains                                                          |
| `blocked_domains`    | string\[] | —       | Never fetch from these domains                                                         |

## Engine Selection

The web fetch server tool supports multiple fetch engines:

- **`auto`** (default): Uses native fetch if the provider supports it,
  otherwise falls back to Exa
- **`native`**: Forces the provider's built-in web fetch
- **`exa`**: Uses [Exa](https://exa.ai)'s Contents API to extract page content
  (supports BYOK)
- **`openrouter`**: Uses direct HTTP fetch with content extraction
- **`firecrawl`**: Uses [Firecrawl](https://firecrawl.dev)'s scrape API
  (BYOK — bring your own key)
- **`parallel`**: Uses [Parallel](https://parallel.ai)'s extract API for
  high-quality content extraction

### Engine Capabilities

| Feature              | Exa                 | Parallel    | Firecrawl       | OpenRouter  | Native           |
| -------------------- | ------------------- | ----------- | --------------- | ----------- | ---------------- |
| **Domain filtering** | Yes                 | Yes         | Yes             | Yes         | Varies           |
| **Token truncation** | Yes                 | Yes         | Yes             | Yes         | No               |
| **API key**          | Server-side or BYOK | Server-side | BYOK (your key) | Server-side | Provider-handled |
| **Hard limit**       | None                | None        | None            | 50/request  | 50/request       |

### Firecrawl (BYOK)

Firecrawl uses your own API key. To set it up:

1. Go to your [OpenRouter plugin settings](https://openrouter.ai/settings/plugins)
   and configure your Firecrawl API key
2. Your Firecrawl account is billed separately from OpenRouter

### Hard Limits

To prevent runaway costs:

- **Exa engine**: No hard limit (billed via API credits)
- **Parallel engine**: No hard limit (billed via API credits)
- **Firecrawl engine**: No hard limit (uses your Firecrawl credits)
- **OpenRouter/native engines**: Hard limit of 50 fetches per request

## Domain Filtering

Restrict which domains can be fetched using `allowed_domains` and
`blocked_domains`:

```json lines theme={null}
{
  "type": "openrouter:web_fetch",
  "parameters": {
    "allowed_domains": ["docs.example.com", "api.example.com"],
    "blocked_domains": ["internal.example.com"]
  }
}
```

When `allowed_domains` is set, only URLs from those domains will be fetched.
When `blocked_domains` is set, URLs from those domains will be rejected.

## Content Truncation

Use `max_content_tokens` to limit the amount of content returned:

```json lines theme={null}
{
  "type": "openrouter:web_fetch",
  "parameters": {
    "max_content_tokens": 50000
  }
}
```

Content exceeding this limit is truncated. This is useful for controlling
context window usage when fetching large pages.

## Works with the Responses API

The web fetch server tool also works with the Responses API:

<Template
data={{
API_KEY_REF,
MODEL: 'openai/gpt-5.2'
}}

>

  <CodeGroup>
    ```typescript title="TypeScript" lines theme={null}
    const response = await fetch('https://openrouter.ai/api/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer {{API_KEY_REF}}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        input: 'What does the documentation at https://example.com/docs say?',
        tools: [
          { type: 'openrouter:web_fetch', parameters: { max_content_tokens: 50000 } }
        ]
      }),
    });

    const data = await response.json();
    console.log(data);
    ```

    ```python title="Python" lines theme={null}
    import requests

    response = requests.post(
      "https://openrouter.ai/api/v1/responses",
      headers={
        "Authorization": f"Bearer {{API_KEY_REF}}",
        "Content-Type": "application/json",
      },
      json={
        "model": "{{MODEL}}",
        "input": "What does the documentation at https://example.com/docs say?",
        "tools": [
          {"type": "openrouter:web_fetch", "parameters": {"max_content_tokens": 50000}}
        ]
      }
    )

    data = response.json()
    print(data)
    ```

  </CodeGroup>
</Template>

## Response Format

When the model calls the web fetch tool, it receives a response like:

```json lines theme={null}
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "content": "The full text content of the page...",
  "status": "completed",
  "retrieved_at": "2025-07-15T14:30:00.000Z"
}
```

If the fetch fails, the response includes an error:

```json lines theme={null}
{
  "url": "https://example.com/404",
  "status": "failed",
  "error": "HTTP 404: Page not found"
}
```

## Pricing

| Engine         | Pricing                                                     |
| -------------- | ----------------------------------------------------------- |
| **Exa**        | \$1 per 1,000 fetches                                       |
| **Parallel**   | \$1 per 1,000 fetches                                       |
| **Firecrawl**  | Uses your Firecrawl credits directly — no OpenRouter charge |
| **OpenRouter** | Free                                                        |
| **Native**     | Passed through from the provider                            |

All pricing is in addition to standard LLM token costs for processing the
fetched content.

## Next Steps

- [Server Tools Overview](/docs/guides/features/server-tools) — Learn about
  server tools
- [Web Search](/docs/guides/features/server-tools/web-search) — Search the web
  for real-time information
- [Datetime](/docs/guides/features/server-tools/datetime) — Get the current
  date and time
- [Tool Calling](/docs/guides/features/tool-calling) — Learn about user-defined
  tool calling
