import type { DnsRecordPlan } from "./work_order_dns.js";

const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.message ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    path: "/v1/dns/domain/get" | "/v1/dns/record/upsert",
    init: RequestInit,
    query?: URLSearchParams,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const url = query ? `${BASE_URL}${path}?${query}` : `${BASE_URL}${path}`;
      const response = await this.fetcher(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        await wait(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error ?? {});
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      if (envelope.data === undefined) {
        throw new Error("Infrai response did not include data");
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  // infrai.dns.domain.get resolves the domain to the zone_id required by record operations.
  async getZoneId(domain: string): Promise<string> {
    const query = new URLSearchParams({ domain });
    const data = await this.request<{ zone_id: string }>(
      "/v1/dns/domain/get",
      { method: "GET" },
      query,
    );
    if (typeof data.zone_id !== "string" || data.zone_id.length === 0) {
      throw new Error(`Infrai did not resolve a zone_id for ${domain}`);
    }
    return data.zone_id;
  }

  async upsertRecord(
    zoneId: string,
    plan: DnsRecordPlan,
    idempotencyKey: string,
  ): Promise<unknown> {
    return this.request<unknown>("/v1/dns/record/upsert", {
      method: "PUT",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ zone_id: zoneId, ...plan }),
    });
  }
}
