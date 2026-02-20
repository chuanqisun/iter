The URL context tool lets you provide additional context to the models in the
form of URLs. By including URLs in your request, the model will access
the content from those pages (as long as it's not a URL type listed in the
[limitations section](https://ai.google.dev/gemini-api/docs/url-context#limitations)) to inform
and enhance its response.

The URL context tool is useful for tasks like the following:

- **Extract Data**: Pull specific info like prices, names, or key findings from multiple URLs.
- **Compare Documents**: Analyze multiple reports, articles, or PDFs to identify differences and track trends.
- **Synthesize \& Create Content**: Combine information from several source URLs to generate accurate summaries, blog posts, or reports.
- **Analyze Code \& Docs**: Point to a GitHub repository or technical documentation to explain code, generate setup instructions, or answer questions.

The following example shows how to compare two recipes from different websites.

### Python

    from google import genai
    from google.genai.types import Tool, GenerateContentConfig

    client = genai.Client()
    model_id = "gemini-3-flash-preview"

    tools = [
      {"url_context": {}},
    ]

    url1 = "https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592"
    url2 = "https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/"

    response = client.models.generate_content(
        model=model_id,
        contents=f"Compare the ingredients and cooking times from the recipes at {url1} and {url2}",
        config=GenerateContentConfig(
            tools=tools,
        )
    )

    for each in response.candidates[0].content.parts:
        print(each.text)

    # For verification, you can inspect the metadata to see which URLs the model retrieved
    print(response.candidates[0].url_context_metadata)

### Javascript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            "Compare the ingredients and cooking times from the recipes at https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592 and https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/",
        ],
        config: {
          tools: [{urlContext: {}}],
        },
      });
      console.log(response.text);

      // For verification, you can inspect the metadata to see which URLs the model retrieved
      console.log(response.candidates[0].urlContextMetadata)
    }

    await main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
          "contents": [
              {
                  "parts": [
                      {"text": "Compare the ingredients and cooking times from the recipes at https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592 and https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/"}
                  ]
              }
          ],
          "tools": [
              {
                  "url_context": {}
              }
          ]
      }' > result.json

    cat result.json

## How it works

The URL Context tool uses a two-step retrieval process to
balance speed, cost, and access to fresh data. When you provide a URL, the tool
first attempts to fetch the content from an internal index cache. This acts as a
highly optimized cache. If a URL is not available in the index (for example, if
it's a very new page), the tool automatically falls back to do a live fetch.
This directly accesses the URL to retrieve its content in real-time.

## Combining with other tools

You can combine the URL context tool with other tools to create more powerful
workflows.

### Grounding with search

When both URL context and
[Grounding with Google Search](https://ai.google.dev/gemini-api/docs/grounding) are enabled,
the model can use its search capabilities to find
relevant information online and then use the URL context tool to get a more
in-depth understanding of the pages it finds. This approach is powerful for
prompts that require both broad searching and deep analysis of specific pages.

### Python

    from google import genai
    from google.genai.types import Tool, GenerateContentConfig, GoogleSearch, UrlContext

    client = genai.Client()
    model_id = "gemini-3-flash-preview"

    tools = [
          {"url_context": {}},
          {"google_search": {}}
      ]

    response = client.models.generate_content(
        model=model_id,
        contents="Give me three day events schedule based on YOUR_URL. Also let me know what needs to taken care of considering weather and commute.",
        config=GenerateContentConfig(
            tools=tools,
        )
    )

    for each in response.candidates[0].content.parts:
        print(each.text)
    # get URLs retrieved for context
    print(response.candidates[0].url_context_metadata)

### Javascript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            "Give me three day events schedule based on YOUR_URL. Also let me know what needs to taken care of considering weather and commute.",
        ],
        config: {
          tools: [
            {urlContext: {}},
            {googleSearch: {}}
            ],
        },
      });
      console.log(response.text);
      // To get URLs retrieved for context
      console.log(response.candidates[0].urlContextMetadata)
    }

    await main();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
          "contents": [
              {
                  "parts": [
                      {"text": "Give me three day events schedule based on YOUR_URL. Also let me know what needs to taken care of considering weather and commute."}
                  ]
              }
          ],
          "tools": [
              {
                  "url_context": {}
              },
              {
                  "google_search": {}
              }
          ]
      }' > result.json

    cat result.json

## Understanding the response

When the model uses the URL context tool, the response includes a
`url_context_metadata` object. This object lists the URLs the model retrieved
content from and the status of each retrieval attempt, which is useful for
verification and debugging.

The following is an example of that part of the response
(parts of the response have been omitted for brevity):

    {
      "candidates": [
        {
          "content": {
            "parts": [
              {
                "text": "... \n"
              }
            ],
            "role": "model"
          },
          ...
          "url_context_metadata": {
            "url_metadata": [
              {
                "retrieved_url": "https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592",
                "url_retrieval_status": "URL_RETRIEVAL_STATUS_SUCCESS"
              },
              {
                "retrieved_url": "https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/",
                "url_retrieval_status": "URL_RETRIEVAL_STATUS_SUCCESS"
              }
            ]
          }
        }
    }

For complete detail about this object , see the
[`UrlContextMetadata` API reference](https://ai.google.dev/api/generate-content#UrlContextMetadata).

### Safety checks

The system performs a content moderation check on the URL to confirm
they meet safety standards. If the URL you provided fails this check, you will
get an `url_retrieval_status` of `URL_RETRIEVAL_STATUS_UNSAFE`.

### Token count

The content retrieved from the URLs you specify in your prompt is counted
as part of the input tokens. You can see the token count for your prompt and
tools usage in the [`usage_metadata`](https://ai.google.dev/api/generate-content#UsageMetadata)
object of the model output. The following is an example output:

    'usage_metadata': {
      'candidates_token_count': 45,
      'prompt_token_count': 27,
      'prompt_tokens_details': [{'modality': <MediaModality.TEXT: 'TEXT'>,
        'token_count': 27}],
      'thoughts_token_count': 31,
      'tool_use_prompt_token_count': 10309,
      'tool_use_prompt_tokens_details': [{'modality': <MediaModality.TEXT: 'TEXT'>,
        'token_count': 10309}],
      'total_token_count': 10412
      }

Price per token depends on the model used, see the
[pricing](https://ai.google.dev/gemini-api/docs/pricing) page for details.

## Supported models

| Model                                                                                         | URL Context |
| --------------------------------------------------------------------------------------------- | ----------- |
| [Gemini 3.1 Pro Preview](https://ai.google.dev/gemini-api/docs/gemini-3.1-pro-preview)        | ✔️          |
| [Gemini 3 Pro Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-preview)     | ✔️          |
| [Gemini 3 Flash Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview) | ✔️          |
| [Gemini 2.5 Pro](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro)                 | ✔️          |
| [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash)             | ✔️          |
| [Gemini 2.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite)   | ✔️          |

## Best Practices

- **Provide specific URLs**: For the best results, provide direct URLs to the content you want the model to analyze. The model will only retrieve content from the URLs you provide, not any content from nested links.
- **Check for accessibility**: Verify that the URLs you provide don't lead to pages that require a login or are behind a paywall.
- **Use the complete URL**: Provide the full URL, including the protocol (e.g., https://www.google.com instead of just google.com).

## Limitations

- Function calling: Tool use (URL Context, Grounding with Google Search, etc) with function calling is currently unsupported.
- Request limit: The tool can process up to 20 URLs per request.
- URL content size: The maximum size for content retrieved from a single URL is 34MB.
- Public accessibility: The URLs must be publicly accessible on the web. Localhost addresses (e.g., localhost, 127.0.0.1), private networks, and tunneling services (e.g., ngrok, pinggy) are not supported.

### Supported and unsupported content types

The tool can extract content from URLs with the following content types:

- Text (text/html, application/json, text/plain, text/xml, text/css, text/javascript , text/csv, text/rtf)
- Image (image/png, image/jpeg, image/bmp, image/webp)
- PDF (application/pdf)

The following content types are **not** supported:

- Paywalled content
- YouTube videos (See [video understanding](https://ai.google.dev/gemini-api/docs/video-understanding#youtube) to learn how to process YouTube URLs)
- Google workspace files like Google docs or spreadsheets
- Video and audio files

## What's next

- Explore the [URL context cookbook](https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Grounding.ipynb#url-context) for more examples.
