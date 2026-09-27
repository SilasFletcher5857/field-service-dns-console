import { z } from "zod";

export const workOrderSchema = z.object({
  workOrderId: z.string().min(1),
  domain: z.string().min(1),
  dispatchStatus: z.enum(["dispatched", "completed"]),
  technicianId: z.string().min(1),
  photoUrls: z.array(z.string().url()).max(20),
  followUpRequired: z.boolean(),
});

export type WorkOrder = z.infer<typeof workOrderSchema>;

export type DnsRecordPlan = {
  record_type: "CNAME" | "TXT";
  name: string;
  content: string;
  ttl: number;
  metadata: Record<string, string | number | boolean>;
};

export function planWorkOrderRecord(order: WorkOrder): DnsRecordPlan {
  const metadata = {
    work_order_id: order.workOrderId,
    technician_id: order.technicianId,
    photo_count: order.photoUrls.length,
    follow_up_required: order.followUpRequired,
  };

  if (order.dispatchStatus === "dispatched") {
    return {
      record_type: "CNAME",
      name: `wo-${order.workOrderId}`,
      content: "dispatch.field.example",
      ttl: 300,
      metadata,
    };
  }

  return {
    record_type: "TXT",
    name: `wo-${order.workOrderId}`,
    content: `status=completed;photos=${order.photoUrls.length};follow_up=${order.followUpRequired}`,
    ttl: 300,
    metadata,
  };
}
