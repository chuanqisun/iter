Grounding with Google Search connects the Gemini model to real-time web content
and works with all available languages. This allows
Gemini to provide more accurate answers and cite verifiable sources beyond its
knowledge cutoff.

Grounding helps you build applications that can:

- **Increase factual accuracy:** Reduce model hallucinations by basing responses on real-world information.
- **Access real-time information:** Answer questions about recent events and topics.
- **Provide citations:** Build user trust by showing the sources for the
  model's claims.

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3.6-flash",
        input="Who won the euro 2024?",
        tools=[{"type": "google_search"}]
    )

    print(interaction.output_text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: "gemini-3.6-flash",
        input: "Who won the euro 2024?",
        tools: [{ type: "google_search" }]
    });

    console.log(interaction.output_text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.6-flash",
        "input": "Who won the euro 2024?",
        "tools": [{"type": "google_search"}]
      }'

## How grounding with Google Search works

When you enable the `google_search` tool, the model handles the entire workflow
of searching, processing, and citing information automatically.

![grounding-overview](https://ai.google.dev/static/gemini-api/docs/images/google-search-tool-overview.png)

1. **User Prompt:** Your application sends a user's prompt to the Gemini API with the `google_search` tool enabled.
2. **Prompt Analysis:** The model analyzes the prompt and determines if a Google Search can improve the answer.
3. **Google Search:** If needed, the model automatically generates one or multiple search queries and executes them.
4. **Search Results Processing:** The model processes the search results, synthesizes the information, and formulates a response.
5. **Grounded Response:** The API returns a final, user-friendly response that is grounded in the search results. This response includes the model's text answer with inline `annotations` containing the citations, as well as `google_search_call` and `google_search_result` steps with the search queries and search suggestions.

## Understanding the grounding response

When a response is successfully grounded, the model's text output includes
inline `annotations` directly on the text content block. These annotations
provide citation information linking parts of the response to their sources.

    {
      "steps": [
        {
          "type": "thought",
          "summary": [
            {
              "type": "text",
              "text": "The user is asking for the winner of Euro 2024. I need to search for the result of the Euro 2024 final."
            }
          ],
          "signature": "CoMDAXLI2nynRYojJIy6B1Jh9os2crpWLfB0..."
        },
        {
          "type": "google_search_call",
          "arguments": {
            "queries": ["UEFA Euro 2024 winner"]
          }
        },
        {
          "type": "google_search_result",
          "call_id": "search_001",
          "result": [
            {
              "search_suggestions": "<!-- HTML and CSS for the search widget -->"
            }
          ]
        },
        {
          "type": "model_output",
          "content": [
            {
              "type": "text",
              "text": "Spain won Euro 2024, defeating England 2-1 in the final. This victory marks Spain's record fourth European Championship title.",
              "annotations": [
                {
                  "type": "url_citation",
                  "url": "https://www.aljazeera.com/sports/euro-2024-final",
                  "title": "aljazeera.com",
                  "start_index": 0,
                  "end_index": 56
                },
                {
                  "type": "url_citation",
                  "url": "https://www.uefa.com/euro2024/news/spain-wins-euro-2024",
                  "title": "uefa.com",
                  "start_index": 57,
                  "end_index": 124
                }
              ]
            }
          ]
        }
      ]
    }

The key fields in the response:

- `google_search_call` : Contains the search `queries` the model executed.
- `google_search_result` : Contains `search_suggestions`, an HTML snippet for rendering search suggestions in your UI. Full usage requirements are detailed in the [Terms of Service](https://ai.google.dev/gemini-api/terms#grounding-with-google-search).
- `text` with `annotations` : The model's synthesized answer with inline citations. Each `url_citation` annotation links a text segment (defined by `start_index` and `end_index`) to a source URL. This is the key to building inline citations.

Grounding with Google Search can also be used in combination with the [URL
context tool](https://ai.google.dev/gemini-api/docs/url-context) to ground responses in
both public web data and the specific URLs you provide.

## Attributing sources with inline citations

The API returns inline `url_citation` annotations on the text content block,
giving you complete control over how you display sources in your user interface.
Each annotation includes `start_index` and `end_index` to identify which part
of the text it cites. Here's how to extract and display them.

### Python

    for step in interaction.steps:
        if step.type == "model_output":
            for content_block in step.content:
                if content_block.type == "text":
                    print(content_block.text)
                    if content_block.annotations:
                        print("\nCitations:")
                        for annotation in content_block.annotations:
                            if annotation.type == "url_citation":
                                cited_text = content_block.text[annotation.start_index:annotation.end_index]
                                print(f"  [{annotation.title}]({annotation.url})")
                                print(f"    Cited text: \"{cited_text}\"")

### JavaScript

    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        for (const contentBlock of step.content) {
          if (contentBlock.type === 'text') {
            console.log(contentBlock.text);
            if (contentBlock.annotations) {
              console.log("\nCitations:");
              for (const annotation of contentBlock.annotations) {
                if (annotation.type === 'url_citation') {
                  const citedText = contentBlock.text.slice(annotation.startIndex, annotation.endIndex);
                  console.log(`  [${annotation.title}](${annotation.url})`);
                  console.log(`    Cited text: "${citedText}"`);
                }
              }
            }
          }
        }
      }
    }

The output will show the text followed by its citations:

    Spain won Euro 2024, defeating England 2-1 in the final. This victory marks Spain's record fourth European Championship title.

    Citations:
      [aljazeera.com](https://www.aljazeera.com/sports/euro-2024-final)
        Cited text: "Spain won Euro 2024, defeating England 2-1 in the final."
      [uefa.com](https://www.uefa.com/euro2024/news/spain-wins-euro-2024)
        Cited text: "This victory marks Spain's record fourth European Championship title."

## Pricing

When you use Grounding with Google Search with Gemini 3, your project is billed
for each search query that the model decides to execute. If the model decides to
execute multiple search queries to answer a single prompt (for example,
searching for `"UEFA Euro 2024 winner"` and `"Spain vs England Euro 2024 final
score"` within the same API call), this counts as two billable uses of the tool
for that request. For billing purposes, we ignore the empty web search queries
when counting unique queries. This billing model only applies to Gemini 3
models; when you use search grounding with Gemini 2.5 or older models, your
project is billed per prompt.

For detailed pricing information, see the [Gemini API pricing
page](https://ai.google.dev/gemini-api/docs/pricing).

## Supported models

You can find full capabilities on the [model
overview](https://ai.google.dev/gemini-api/docs/models) page.

| Model                          | Grounding with Google Search |
| ------------------------------ | ---------------------------- |
| Gemini 3.6 Flash               | ✔️                           |
| Gemini 3.5 Flash-Lite          | ✔️                           |
| Gemini 3.5 Flash               | ✔️                           |
| Gemini 3.1 Flash Image Preview | ✔️                           |
| Gemini 3.1 Pro Preview         | ✔️                           |
| Gemini 3 Pro Image Preview     | ✔️                           |
| Gemini 3 Flash Preview         | ✔️                           |
| Gemini 2.5 Pro                 | ✔️                           |
| Gemini 2.5 Flash               | ✔️                           |
| Gemini 2.5 Flash-Lite          | ✔️                           |
| Gemini 2.0 Flash               | ✔️                           |

> [!NOTE]
> **Note:** Older models use a `google_search_retrieval` tool. For all current models, use the `google_search` tool as shown in the examples.

## Supported tool combinations

You can use Grounding with Google Search with other tools like
[code execution](https://ai.google.dev/gemini-api/docs/code-execution),
[URL context](https://ai.google.dev/gemini-api/docs/url-context), and
[Grounding with Google Maps](https://ai.google.dev/gemini-api/docs/maps-grounding) (supported on
Gemini 3.5 Flash and later models) to power more complex use cases. Gemini 3
models also support combining these built-in tools with custom tools (function
calling). Learn more on the
[tool combinations](https://ai.google.dev/gemini-api/docs/tool-combination) page.

## What's next

- Learn about other available tools, like [Function Calling](https://ai.google.dev/gemini-api/docs/function-calling).
- Learn how to augment prompts with specific URLs using the [URL context tool](https://ai.google.dev/gemini-api/docs/url-context).

# Example trace

```jsonl
event: interaction.created
data: {"interaction":{"id":"v1_ChdSaVI5YXZpb0tyZkxfdU1Qd2NMYWlRURIXUmlSOWF2aW9LcmZMX3VNUHdjTGFpUVE","status":"in_progress","object":"interaction","model":"gemini-3.6-flash"},"event_type":"interaction.created"}

event: interaction.status_update
data: {"interaction_id":"v1_ChdSaVI5YXZpb0tyZkxfdU1Qd2NMYWlRURIXUmlSOWF2aW9LcmZMX3VNUHdjTGFpUVE","status":"in_progress","event_type":"interaction.status_update"}

event: step.start
data: {"index":0,"step":{"id":"call_96083","signature":"","type":"google_search_call"},"event_type":"step.start"}

event: step.delta
data: {"index":0,"delta":{"signature":"EoUICoIICAIS/QcBEU0yD62H1dF86+oMIJXR7jqgowCf7aLL6WVjDo/0KdK/SZqRPuUrVoMNby2JrUrBVisb9ZaMkywERFMCkPgmQamyeWZqQDP2DwrvkysEhrXyZudTCCjPCw2pWv1cLf9YGmhwwCuMhzY4K0fprjDYJIPVYYgCv1RAyc00SEkzwaafiEU/ITpeoor+AdEcV26WL+FaYcuL+mTw6rQuqIjrafuRDZrqp3RCY1YX7TvX/y5HweDLgsAJy54wcyK4NBs3E2dG4Yd9XLWHwsZddlj3PFCexDpLpVE8tnGLB/VZ6XlBUscbIsE8vCoWkf/Ar5eYyffle27dGqPg1q8Hdo1AbdgOvGmXUxWGZTziICDgMv9cnIljqSijWOABLA9fAoZhnEkfX444U4kwOe8CS9pv9GbUBw4iytYmlS6McJnNT4gOl+t8BqUQuuDHT5GnmRcIeEiCFOkom4iINwyMVK8ykpq5dQN14kmTEtXFz/9h9BBY2a+kQUffq78cbG9nkDtRmo5pwr79FAG83W9VSo2MqEJGYFXum5eawH5dwWz/yK8msRghoD7u6EX/gbuoG0csZ046GO9Ub1b6/jE+gZdTnKiz9Q0ilSrZQ9uCMXsnAQnRZLc/UB+o7QbXZ/WE7/GwJqCq4a4sW1juOMjMK052+S3IhNFphNAUzbiYUJLDj4OrnQ6VgOkzcAeERAywaNkf/7eJhaged5g6XvFTxYJnjTPIs6Xc/EDvkHdAFiFygkoSclXTCv6f56faSNth8bhmMTka6xkCDM8kbsjpxztVa9vwTrXIlQ34uYngRUA9CbpRuSnxWwC0QPzEU2OO6oY+aMon8L36thyraHKqUF+Ib4nwqHdTxxGh5cy6M5yh8WgNo7t26MdftpUK2ywHysxFOAazHrFsU+8y8+aaN4i83VPevPmtwjhorlpA9WTGlSgxvTi4euCD3Qt08zfmxMu00qZPKl1plMBAbz7meM9PAoWQGT0w3jh4LPF4ra3H1BQUxwwQV2a+HHs61cSJX5xdcxn08i08YtBAAumAkDW0Rg5nUWlsMqleUBi2z8CThLzMps9/hc0hi2pP+vna0Au07OAmBxg9v32dngvtY8H7cUTzXVNDhGNkjOkWrvcX61KKZiunh0JP4UHXTR45cZvJTkSNvXEGvSsfqhsSVaNyBWwHYd0YBsD7z3wVeXsnYRKpAbN60lLL9MXRFLsP0IVg+++KujJMzSNsjJ8jpK5iGQMGEOg30P8aGL1y2I1fRMeCfOdS1f+G6rirtVlHkvodlTt/7KYktCyiikdcUAfmDctQKQ5+zGI0FkWEGCbPZqndCX3MOCSCRoBS1CadKlDEJY4krtqNZzH8dfgq","type":"google_search_call","arguments":{"queries":["best ramen spots boston","top ramen in boston eater infatuation"]}},"event_type":"step.delta"}

event: step.stop
data: {"index":0,"event_type":"step.stop"}

event: step.start
data: {"index":1,"step":{"call_id":"call_96083","signature":"","type":"google_search_result"},"event_type":"step.start"}

event: step.delta
data: {"index":1,"delta":{"signature":"EoukAQqHpAEIAhKBpAEBEU0yD6erNsqQrQWfqTXuS/UzLaTv9GTlrJ0szQPbOV3xn8G3SuHpxoW9B...(omitted)","type":"google_search_result","result":[{"search_suggestions":"<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class=\"container\">\n  <div class=\"headline\">\n    <svg class=\"logo-light\" width=\"18\" height=\"18\" viewBox=\"9 9 35 35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z\" fill=\"#4285F4\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z\" fill=\"#34A853\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z\" fill=\"#FBBC05\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z\" fill=\"#EA4335\"/>\n    </svg>\n    <svg class=\"logo-dark\" width=\"18\" height=\"18\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"24\" cy=\"23\" fill=\"#FFF\" r=\"22\"/>\n      <path d=\"M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z\" fill=\"#4285F4\"/>\n      <path d=\"M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z\" fill=\"#34A853\"/>\n      <path d=\"M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z\" fill=\"#FBBC05\"/>\n      <path d=\"M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z\" fill=\"#EA4335\"/>\n    </svg>\n    <div class=\"gradient-container\"><div class=\"gradient\"></div></div>\n  </div>\n  <div class=\"carousel\">\n<a class=\"chip\" href=\"https://www.google.com/search?q=top+ramen+in+boston+eater+infatuation&client=app-vertex-grounding&safesearch=active\">top ramen in boston eater infatuation</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=best+ramen+spots+boston&client=app-vertex-grounding&safesearch=active\">best ramen spots boston</a>\n  </div>\n</div>"}],"is_error":false},"event_type":"step.delta"}

event: step.stop
data: {"index":1,"event_type":"step.stop"}

event: step.start
data: {"index":2,"step":{"type":"thought"},"event_type":"step.start"}

event: step.delta
data: {"index":2,"delta":{"signature":"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","type":"thought_signature"},"event_type":"step.delta"}

event: step.stop
data: {"index":2,"event_type":"step.stop"}

event: step.start
data: {"index":3,"step":{"type":"model_output"},"event_type":"step.start"}

event: step.delta
data: {"index":3,"delta":{"text":"Here are the top 3 consensus ramen spots in the Greater Boston area, along with what makes each unique:\n\n---","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"\n\n### 1. **Ganko Ittetsu Ramen** (Brookline)\n* **Style:** Sapporo-style","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" Wok-Fired Ramen\n* **Known For:** Deeply flavorful, complex broths where the ingredients are stir","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"-fried in a wok with garlic and lard before adding broth, giving it an authentic smoky profile. \n* **Must","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"-Try:** **Ganko Miso** or **Spicy Sesame Ramen**\n* **Vibe:** Tucked inside the Coolidge","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" Corner Arcade, it's a cozy, intimate spot with limited seating. \n\n---\n\n### 2. **Yume Wo","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" Katare** (Porter Square / Cambridge)\n* **Style:** Jiro-style Ramen (Heavy, garlic-forward","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":", rich pork broth)\n* **Known For:** Massive portions, thick chewy noodles, giant pork chashu chunks, and its","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" unique culture—guests are encouraged to stand up and share their dreams with the room after finishing their bowl.\n* **Must","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"-Try:** **Pork Ramen** (add extra garlic and fat depending on your preference)\n* **Vibe:** Expect a","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" line out the door. It’s an interactive, high-energy dining experience rather than a traditional sit-down dinner","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":".\n\n---\n\n### 3. **Hokkaido Ramen Santouka** (Back Bay & Harvard Square)\n","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"* **Style:** Hokkaido-style Tonkotsu/Shio\n* **Known For:** Exceptionally smooth, mild","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" white tonkotsu broth that is simmered for hours, paired with tender, melt-in-your-mouth *","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"toroniku* (pork cheek).\n* **Must-Try:** **Tokusen Toroniku Ramen** (Sh","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"io broth base with pork cheek served on the side)\n* **Vibe:** Modern, efficient, and consistent Japanese","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":" chain quality right in the heart of the city.\n\n---\n\n### 🌟 Honorable Mentions\n* **Tora Ramen** (","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"Chinatown) – Outstanding rich Tokyo-style tonkotsu broth in an intimate setting (cash only)","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":".\n* **Tsurumen Davis** (Somerville) – High-end Osaka-style broth made with meticulous care and daily limit bowls","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":".\n* **Isshindo Ramen** (Allston) – Highly rated spot in All","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"text":"ston known for spicy miso and rich tonkotsu broth.","type":"text"},"event_type":"step.delta"}

event: step.delta
data: {"index":3,"delta":{"annotations":[{"start_index":1565,"end_index":1704,"url":"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbyLd3ATIBPLyGE9NdT8N5wRXQYVGf4MDgBSpv3NFvPR9IhsBfkOrDQQL24g0M4ekZp_hKLrBg6STCoqifycde4tpWvKhH_-h3uQ9qpRKh1tMkhBYu-3WG1EzNV-Pz4-KEz_SlbrmgZ5UVbq_w","title":"meetboston.com","type":"url_citation"},{"start_index":1706,"end_index":1818,"url":"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAZEZZjhV_VDz3kpDLdzgXWlnmRcO0oWRmTLTTESCnCE048-upALCseseOH-COheip6cvFoxIta3DtSf0WMDxZheLlvJSPHFA5IxIYUAwO1kuM-9CJICG4gaVYke9SW8KI","title":"youtube.com","type":"url_citation"},{"start_index":1820,"end_index":1928,"url":"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEm3_HMIXcKEbUutHpIy6DLirNHegLiUUQZZQGtQxv2jY4FP3ONWhmGENcfTWFRv1rpq-FpS7cThJu_g6bBU-mwHoof6AjbLNqjIFOE0MdLxIahmtFAvI8fF8jLgWY_10j3","title":"sachaeats.com","type":"url_citation"},{"start_index":1820,"end_index":1928,"url":"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFgVECBydfWe6lEe2d8rjQPHldv8K0fjDG1ilgWk9yFgaug2CSGDfO68revyXX0wwUM6VVcfuXBcDhutKT8iPtAI9ZKgL7q1HprhmebSU6nfTLi0rhtSDLw_30SCel32FsoEpnepB0E6WySB-tNEFJrsy4M","title":"tastingtable.com","type":"url_citation"}],"type":"text_annotation_delta"},"event_type":"step.delta"}

event: step.stop
data: {"index":3,"event_type":"step.stop"}

event: interaction.completed
data: {"interaction":{"id":"v1_ChdSaVI5YXZpb0tyZkxfdU1Qd2NMYWlRURIXUmlSOWF2aW9LcmZMX3VNUHdjTGFpUVE","status":"completed","usage":{"total_tokens":1241,"total_input_tokens":171,"input_tokens_by_modality":[{"modality":"text","tokens":171}],"total_cached_tokens":0,"total_output_tokens":537,"total_tool_use_tokens":0,"total_thought_tokens":533,"grounding_tool_count":[{"type":"google_search","count":2}],"raw_prompt_token":7000},"created":"2026-08-13T01:56:30Z","updated":"2026-08-13T01:56:30Z","service_tier":"standard","object":"interaction","model":"gemini-3.6-flash"},"event_type":"interaction.completed"}

event: done
data: [DONE]
```
