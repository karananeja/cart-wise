import { z } from 'zod';

/** Brief §20 event set. The API rejects anything else. */
export const ANALYTICS_EVENTS = [
  'product_viewed',
  'search_performed',
  'search_no_results',
  'filter_applied',
  'wishlist_added',
  'wishlist_removed',
  'cart_item_added',
  'cart_item_removed',
  'checkout_started',
  'address_added',
  'payment_started',
  'payment_failed',
  'payment_completed',
  'order_created',
  'order_cancelled',
  'recommendation_clicked',
  'delivery_check_performed',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const propertyValue = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

export const analyticsEventSchema = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  properties: z
    .record(z.string().max(50), propertyValue)
    .refine((p) => Object.keys(p).length <= 20, 'Too many properties'),
  visitorId: z.string().min(8).max(64),
  occurredAt: z.iso.datetime(),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50),
});
