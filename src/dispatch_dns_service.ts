import { createServer } from "node:http";
import { InfraiDnsClient, InfraiError } from "./infrai_dns_client.js";
import { planWorkOrderRecord, workOrderSchema } from "./work_order_dns.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiDnsClient(apiKey);

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-orders/dns") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const parsed = workOrderSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      send(response, 400, { error: "Invalid work order", issues: parsed.error.issues });
      return;
    }

    const plan = planWorkOrderRecord(parsed.data);
    const zoneId = await client.getZoneId(parsed.data.domain);
    const record = await client.upsertRecord(
      zoneId,
      plan,
      `work-order:${parsed.data.workOrderId}:${parsed.data.dispatchStatus}`,
    );
    send(response, 200, { workOrderId: parsed.data.workOrderId, zoneId, plan, record });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, detail: error.detail });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Field-service DNS admin listening on http://localhost:${port}`));
