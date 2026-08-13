# OpenAI, xAI

```jsonl
{"type":"response.output_text.delta","content_index":0,"delta":" locations","item_id":"msg_0f265eff3e91d539006a7d1d4ad1b081a1b71e649e30d92ac2","logprobs":[],"obfuscation":"OVYv9J","output_index":1,"sequence_number":29}
{"type":"response.output_text.delta","content_index":0,"delta":".","item_id":"msg_0f265eff3e91d539006a7d1d4ad1b081a1b71e649e30d92ac2","logprobs":[],"obfuscation":"7seexU4HDlDyEgo","output_index":1,"sequence_number":30}

...(omitted)

{"type":"response.output_text.delta","content_index":0,"delta":"**What I did:** searched","item_id":"msg_0f265eff3e91d539006a7d1d59374c81a18ab8f6dc3df5043d","logprobs":[],"obfuscation":"HBlOQb8p","output_index":7,"sequence_number":55}
{"type":"response.output_text.delta","content_index":0,"delta":" for nearby ramen shops and checked","item_id":"msg_0f265eff3e91d539006a7d1d59374c81a18ab8f6dc3df5043d","logprobs":[],"obfuscation":"6VsSDpYVWfSwr","output_index":7,"sequence_number":56}
```

# Anthropic

```jsonl
{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"I'll help you find 3 good ramen places near Boston. Let me search for current, well-reviewed options in the area."}     }

...(omitted)

{"type":"content_block_delta","index":4,"delta":{"type":"text_delta","text":"##"}  }
{"type":"content_block_delta","index":4,"delta":{"type":"text_delta","text":" What I needed to do:\nFind current, reputable ramen spots in the Boston area with good reviews,"}              }
```

# Gemini

```jsonl
{"candidates": [{"content": {"parts": [{"text": " find top-rated ramen spots in the Boston area along with their notable specialties and general locations.\n\nWhat I need to do: Perform"}],"role": "model"},"index": 0}],"usageMetadata": {"promptTokenCount": 38,"candidatesTokenCount": 59,"totalTokenCount": 443,"promptTokensDetails": [{"modality": "TEXT","tokenCount": 38}],"thoughtsTokenCount": 346,"serviceTier": "standard"},"modelVersion": "gemini-3.6-flash","responseId": "fx99aoLYMPDg_uMP3cTFyAU"}
{"candidates": [{"content": {"parts": [{"text": " a search for the best and most popular ramen restaurants in and around Boston.\n\nLet's start the search."}],"role": "model"},"index": 0}],"usageMetadata": {"promptTokenCount": 38,"candidatesTokenCount": 82,"totalTokenCount": 466,"promptTokensDetails": [{"modality": "TEXT","tokenCount": 38}],"thoughtsTokenCount": 346,"serviceTier": "standard"},"modelVersion": "gemini-3.6-flash","responseId": "fx99aoLYMPDg_uMP3cTFyAU"}

...(omitted)

{"candidates": [{"content": {"parts": [{"text": "Here are 3 top-rated ramen spots in and near Boston, each offering a distinct style and experience:\n\n### "}],"role": "model"},"index": 0}],"usageMetadata": {"promptTokenCount": 38,"candidatesTokenCount": 25,"totalTokenCount": 241,"promptTokensDetails": [{"modality": "TEXT","tokenCount": 38}],"thoughtsTokenCount": 178,"serviceTier": "standard"},"modelVersion": "gemini-3.6-flash","responseId": "fx99aoLYMPDg_uMP3cTFyAU"}
{"candidates": [{"content": {"parts": [{"text": "1. **Ganko Ittetsu Ramen** *(Brookline / Coolidge Corner)*\n* **Style / Specialty:** Sapporo-style ramen"}],"role": "model"},"index": 0}],"usageMetadata": {"promptTokenCount": 38,"candidatesTokenCount": 54,"totalTokenCount": 270,"promptTokensDetails": [{"modality": "TEXT","tokenCount": 38}],"thoughtsTokenCount": 178,"serviceTier": "standard"},"modelVersion": "gemini-3.6-flash","responseId": "fx99aoLYMPDg_uMP3cTFyAU"}
```
