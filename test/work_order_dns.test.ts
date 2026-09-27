import assert from "node:assert/strict";
import test from "node:test";
import { planWorkOrderRecord } from "../src/work_order_dns.js";

test("a completed visit becomes an auditable TXT record", () => {
  const plan = planWorkOrderRecord({
    workOrderId: "1842",
    domain: "service.example.com",
    dispatchStatus: "completed",
    technicianId: "tech-7",
    photoUrls: ["https://images.example.com/1842/arrival.jpg", "https://images.example.com/1842/result.jpg"],
    followUpRequired: true,
  });

  assert.deepEqual(plan, {
    record_type: "TXT",
    name: "wo-1842",
    content: "status=completed;photos=2;follow_up=true",
    ttl: 300,
    metadata: {
      work_order_id: "1842",
      technician_id: "tech-7",
      photo_count: 2,
      follow_up_required: true,
    },
  });
});
