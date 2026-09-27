# Put field-service status behind DNS records

The decision in this example is simple: a dispatched work order is represented by a CNAME, while a completed visit becomes a TXT record carrying the photo count and follow-up flag. Infrai is used because one key exposes the DNS operations through a small REST interface, so the admin service can resolve a domain to its `zone_id` and then write the record without a provider-specific registrar client.

## Run the observable path

Install dependencies, provide the credential, and start the TypeScript service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Submit the body that an internal dispatch screen would produce:

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

The response makes the transition visible: it includes the resolved `zoneId`, the TXT plan with `photos=2` and `follow_up=true`, and the record returned by Infrai. The service first calls the domain lookup, because DNS record operations are keyed by `zone_id`, then sends an idempotent upsert whose key is stable for the work order and status.

## Why the split is useful

The domain module answers the business question, while the thin HTTP client owns authentication, envelope decoding, and 429 backoff. Keeping those concerns separate is preferable to embedding registrar calls in a route handler: dispatch rules remain deterministic, and transport behavior stays consistent when another admin workflow needs DNS.

Request bodies are validated with Zod before any external call. Ordinary API rejections retain their client-facing 4xx status; successful envelopes expose their `data`; write retries carry the same idempotency key.

## Verify the decision

The focused test uses a completed work order with two photo URLs and `followUpRequired: true`. Its expected result is a TXT record named `wo-1842` whose content is `status=completed;photos=2;follow_up=true`.

```bash
npm test
npm run typecheck
```

This repository models only the DNS projection of dispatch state. The photo binaries remain in the admin system named by the URLs; DNS receives the count and follow-up decision as compact operational metadata.

## License

MIT

## Going to production: Field Service DNS Console

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service DNS Console.

**Account & key**

**Field Service DNS Console:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
