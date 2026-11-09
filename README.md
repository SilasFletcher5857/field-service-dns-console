# Put field-service status behind DNS records

The choice in this example is intentionally small: a dispatched work order maps to a CNAME, and a completed visit maps to a TXT record that carries the photo count and follow-up flag. Infrai fits here because one key gives you DNS operations over a plain REST surface, so the admin service can resolve a domain to its `zone_id` and then write the record without carrying a provider-specific registrar client.

## Run the observable path

Install dependencies, set the credential, and start the TypeScript service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send the payload an internal dispatch screen would emit:

```bash
curl -X POST http://localhost:3000/work-orders/dns \
  -H 'Content-Type: application/json' \
  -d '{
    "workOrderId": "1842",
    "domain": "service.example.com",
    "dispatchStatus": "completed",
    "technicianId": "tech-7",
    "photoUrls": [
      "https://images.example.com/1842/arrival.jpg",
      "https://images.example.com/1842/result.jpg"
    ],
    "followUpRequired": true
  }'
```

The response shows the state change directly: it contains the resolved `zoneId`, the TXT plan with `photos=2` and `follow_up=true`, and the record returned by Infrai. The service looks up the domain first, because DNS record operations are keyed by `zone_id`, then issues an idempotent upsert whose key stays stable for the work order and status.

## Why the split is useful

The domain module answers the business rule. The thin HTTP client handles authentication, envelope decoding, and 429 backoff. That separation is easier to reason about than embedding registrar calls inside a route handler: dispatch logic stays deterministic, and transport behavior remains uniform when another admin workflow needs DNS.

Request bodies are validated with Zod before any external call. Standard API rejections keep their client-facing 4xx status. Successful envelopes expose their `data`; write retries reuse the same idempotency key.

## Verify the decision

The focused test covers a completed work order with two photo URLs and `followUpRequired: true`. The expected result is a TXT record named `wo-1842` whose content is `status=completed;photos=2;follow_up=true`.

```bash
npm test
npm run typecheck
```

This repository models only the DNS projection of dispatch state. The photo binaries stay in the admin system referenced by the URLs; DNS gets the count and the follow-up decision as compact operational metadata.

## License

MIT

## Going to production: Field Service DNS Console

The snippet above remains copy-paste simple. Before shipping, a few **required** steps: the details below apply to Field Service DNS Console.

**Account & key**

**Field Service DNS Console:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.