# Streaming

Inception API supports real-time output

- **Streaming:** Get responses block-by-block for real-time feedback—ideal for chat and live applications.

```
curl https://api.inceptionlabs.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer INCEPTION_API_KEY" \
    -d '{
      "model": "mercury",
      "messages": [
        {"role": "user", "content": "What is a diffusion model?"}
      ],
      "max_tokens": 1000,
      "stream": true
    }'
```

Response example (not in javascript)

```
with requests.post(API_URL, headers=headers, json=payload, stream=True) as response:
    for line in response.iter_lines(decode_unicode=True):
        if line:
            try:
                text = json.loads(line[6:])['choices'][0]['delta']['content']
                clear_output(wait=True)
                display(text)
                time.sleep(delay)
            except:
                pass
```
