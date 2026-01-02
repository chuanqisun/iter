Grounding with Google Search connects the Gemini model to real-time web content and works with all available languages. This allows Gemini to provide more accurate answers and cite verifiable sources beyond its knowledge cutoff.

Grounding helps you build applications that can:

- **Increase factual accuracy:**Reduce model hallucinations by basing responses on real-world information.
- **Access real-time information:**Answer questions about recent events and topics.
- **Provide citations:**Build user trust by showing the sources for the model's claims.

### Python

    from google import genai
    from google.genai import types

    client = genai.Client()

    grounding_tool = types.Tool(
        google_search=types.GoogleSearch()
    )

    config = types.GenerateContentConfig(
        tools=[grounding_tool]
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Who won the euro 2024?",
        config=config,
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    const groundingTool = {
      googleSearch: {},
    };

    const config = {
      tools: [groundingTool],
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Who won the euro 2024?",
      config,
    });

    console.log(response.text);

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {"text": "Who won the euro 2024?"}
            ]
          }
        ],
        "tools": [
          {
            "google_search": {}
          }
        ]
      }'

You can learn more by trying the[Search tool notebook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Search_Grounding.ipynb).

## How grounding with Google Search works

When you enable the`google_search`tool, the model handles the entire workflow of searching, processing, and citing information automatically.

![grounding-overview](https://ai.google.dev/static/gemini-api/docs/images/google-search-tool-overview.png)

1. **User Prompt:** Your application sends a user's prompt to the Gemini API with the`google_search`tool enabled.
2. **Prompt Analysis:**The model analyzes the prompt and determines if a Google Search can improve the answer.
3. **Google Search:**If needed, the model automatically generates one or multiple search queries and executes them.
4. **Search Results Processing:**The model processes the search results, synthesizes the information, and formulates a response.
5. **Grounded Response:** The API returns a final, user-friendly response that is grounded in the search results. This response includes the model's text answer and`groundingMetadata`with the search queries, web results, and citations.

## Understanding the grounding response

When a response is successfully grounded, the response includes a`groundingMetadata`field. This structured data is essential for verifying claims and building a rich citation experience in your application.

    {
      "candidates": [
        {
          "content": {
            "parts": [
              {
                "text": "Spain won Euro 2024, defeating England 2-1 in the final. This victory marks Spain's record fourth European Championship title."
              }
            ],
            "role": "model"
          },
          "groundingMetadata": {
            "webSearchQueries": [
              "UEFA Euro 2024 winner",
              "who won euro 2024"
            ],
            "searchEntryPoint": {
              "renderedContent": "<!-- HTML and CSS for the search widget -->"
            },
            "groundingChunks": [
              {"web": {"uri": "https://vertexaisearch.cloud.google.com.....", "title": "aljazeera.com"}},
              {"web": {"uri": "https://vertexaisearch.cloud.google.com.....", "title": "uefa.com"}}
            ],
            "groundingSupports": [
              {
                "segment": {"startIndex": 0, "endIndex": 85, "text": "Spain won Euro 2024, defeatin..."},
                "groundingChunkIndices": [0]
              },
              {
                "segment": {"startIndex": 86, "endIndex": 210, "text": "This victory marks Spain's..."},
                "groundingChunkIndices": [0, 1]
              }
            ]
          }
        }
      ]
    }

The Gemini API returns the following information with the`groundingMetadata`:

- `webSearchQueries`: Array of the search queries used. This is useful for debugging and understanding the model's reasoning process.
- `searchEntryPoint`: Contains the HTML and CSS to render the required Search Suggestions. Full usage requirements are detailed in the[Terms of Service](https://ai.google.dev/gemini-api/terms#grounding-with-google-search).
- `groundingChunks`: Array of objects containing the web sources (`uri`and`title`).
- `groundingSupports`: Array of chunks to connect model response`text`to the sources in`groundingChunks`. Each chunk links a text`segment`(defined by`startIndex`and`endIndex`) to one or more`groundingChunkIndices`. This is the key to building inline citations.

Grounding with Google Search can also be used in combination with the[URL context tool](https://ai.google.dev/gemini-api/docs/url-context)to ground responses in both public web data and the specific URLs you provide.

## Attributing sources with inline citations

The API returns structured citation data, giving you complete control over how you display sources in your user interface. You can use the`groundingSupports`and`groundingChunks`fields to link the model's statements directly to their sources. Here is a common pattern for processing the metadata to create a response with inline, clickable citations.

### Python

    def add_citations(response):
        text = response.text
        supports = response.candidates[0].grounding_metadata.grounding_supports
        chunks = response.candidates[0].grounding_metadata.grounding_chunks

        # Sort supports by end_index in descending order to avoid shifting issues when inserting.
        sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)

        for support in sorted_supports:
            end_index = support.segment.end_index
            if support.grounding_chunk_indices:
                # Create citation string like [1](link1)[2](link2)
                citation_links = []
                for i in support.grounding_chunk_indices:
                    if i < len(chunks):
                        uri = chunks[i].web.uri
                        citation_links.append(f"[{i + 1}]({uri})")

                citation_string = ", ".join(citation_links)
                text = text[:end_index] + citation_string + text[end_index:]

        return text

    # Assuming response with grounding metadata
    text_with_citations = add_citations(response)
    print(text_with_citations)

### JavaScript

    function addCitations(response) {
        let text = response.text;
        const supports = response.candidates[0]?.groundingMetadata?.groundingSupports;
        const chunks = response.candidates[0]?.groundingMetadata?.groundingChunks;

        // Sort supports by end_index in descending order to avoid shifting issues when inserting.
        const sortedSupports = [...supports].sort(
            (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0),
        );

        for (const support of sortedSupports) {
            const endIndex = support.segment?.endIndex;
            if (endIndex === undefined || !support.groundingChunkIndices?.length) {
            continue;
            }

            const citationLinks = support.groundingChunkIndices
            .map(i => {
                const uri = chunks[i]?.web?.uri;
                if (uri) {
                return `[${i + 1}](${uri})`;
                }
                return null;
            })
            .filter(Boolean);

            if (citationLinks.length > 0) {
            const citationString = citationLinks.join(", ");
            text = text.slice(0, endIndex) + citationString + text.slice(endIndex);
            }
        }

        return text;
    }

    const textWithCitations = addCitations(response);
    console.log(textWithCitations);

The new response with inline citations will look like this:

    Spain won Euro 2024, defeating England 2-1 in the final.[1](https:/...), [2](https:/...), [4](https:/...), [5](https:/...) This victory marks Spain's record-breaking fourth European Championship title.[5]((https:/...), [2](https:/...), [3](https:/...), [4](https:/...)

## Pricing

When you use Grounding with Google Search with Gemini 3, your project is billed for each search query that the model decides to execute. If the model decides to execute multiple search queries to answer a single prompt (for example, searching for`"UEFA Euro 2024 winner"`and`"Spain vs England Euro 2024 final
score"`within the same API call), this counts as two billable uses of the tool for that request. This only applies to Gemini 3 models; when you use search grounding with Gemini 2.5 or older models, your project is billed per prompt.

For detailed pricing information, see the[Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing).
| **Note:** Gemini 3 billing for Grounding with Google Search will start January 5, 2026.

## Supported models

Experimental and Preview models are not included. You can find their capabilities on the[model overview](https://ai.google.dev/gemini-api/docs/models)page.

| Model                 | Grounding with Google Search |
| --------------------- | ---------------------------- |
| Gemini 2.5 Pro        | ✔️                           |
| Gemini 2.5 Flash      | ✔️                           |
| Gemini 2.5 Flash-Lite | ✔️                           |
| Gemini 2.0 Flash      | ✔️                           |
| Gemini 1.5 Pro        | ✔️                           |
| Gemini 1.5 Flash      | ✔️                           |

| **Note:** Older models use a`google_search_retrieval`tool. For all current models, use the`google_search`tool as shown in the examples.

## Supported tools combinations

You can use Grounding with Google Search with other tools like[code execution](https://ai.google.dev/gemini-api/docs/code-execution)and[URL context](https://ai.google.dev/gemini-api/docs/url-context)to power more complex use cases.

## Grounding with Gemini 1.5 Models (Legacy)

While the`google_search`tool is recommended for Gemini 2.0 and later, Gemini 1.5 supports a legacy tool named`google_search_retrieval`. This tool provides a`dynamic`mode that allows the model to decide whether to perform a search based on its confidence that the prompt requires fresh information. If the model's confidence is above a`dynamic_threshold`you set (a value between 0.0 and 1.0), it will perform a search.

### Python

    # Note: This is a legacy approach for Gemini 1.5 models.
    # The 'google_search' tool is recommended for all new development.
    import os
    from google import genai
    from google.genai import types

    client = genai.Client()

    retrieval_tool = types.Tool(
        google_search_retrieval=types.GoogleSearchRetrieval(
            dynamic_retrieval_config=types.DynamicRetrievalConfig(
                mode=types.DynamicRetrievalConfigMode.MODE_DYNAMIC,
                dynamic_threshold=0.7 # Only search if confidence > 70%
            )
        )
    )

    config = types.GenerateContentConfig(
        tools=[retrieval_tool]
    )

    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents="Who won the euro 2024?",
        config=config,
    )
    print(response.text)
    if not response.candidates[0].grounding_metadata:
      print("\nModel answered from its own knowledge.")

### JavaScript

    // Note: This is a legacy approach for Gemini 1.5 models.
    // The 'googleSearch' tool is recommended for all new development.
    import { GoogleGenAI, DynamicRetrievalConfigMode } from "@google/genai";

    const ai = new GoogleGenAI({});

    const retrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalConfigMode.MODE_DYNAMIC,
          dynamicThreshold: 0.7, // Only search if confidence > 70%
        },
      },
    };

    const config = {
      tools: [retrievalTool],
    };

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Who won the euro 2024?",
      config,
    });

    console.log(response.text);
    if (!response.candidates?.[0]?.groundingMetadata) {
      console.log("\nModel answered from its own knowledge.");
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \

      -H "Content-Type: application/json" \
      -X POST \
      -d '{
        "contents": [
          {"parts": [{"text": "Who won the euro 2024?"}]}
        ],
        "tools": [{
          "google_search_retrieval": {
            "dynamic_retrieval_config": {
              "mode": "MODE_DYNAMIC",
              "dynamic_threshold": 0.7
            }
          }
        }]
      }'

## What's next

- Try the[Grounding with Google Search in the Gemini API Cookbook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Search_Grounding.ipynb).
- Learn about other available tools, like[Function Calling](https://ai.google.dev/gemini-api/docs/function-calling).
- Learn how to augment prompts with specific URLs using the[URL context tool](https://ai.google.dev/gemini-api/docs/url-context).
