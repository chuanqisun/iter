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
{"index":1,"delta":{"text":" Boston\". From the top results, I will select 3 popular spots, gather details about their locations and signature dishes, and then summarize the","type":"text"},"event_type":"step.delta"}
{"index":1,"delta":{"text":" findings for you.\n\nLet's begin the search.","type":"text"},"event_type":"step.delta"}

...(omitted)

{"index":5,"delta":{"text":"Here is a summary of 3 highly recommended ramen","type":"text"},"event_type":"step.delta"}
{"index":5,"delta":{"text":" places in and around the Boston area based on popular local consensus:\n\n### 1. **Ganko Ittetsu Ramen","type":"text"},"event_type":"step.delta"}
```
