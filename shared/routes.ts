import { z } from 'zod';
import { insertListingSchema, listings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  listings: {
    list: {
      method: 'GET' as const,
      path: '/api/listings' as const,
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        listingType: z.enum(["yard_sale", "individual"]).optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        isShop: z.coerce.boolean().optional(),
        isBoosted: z.coerce.boolean().optional(),
        sort: z.enum(["newest", "price_asc", "price_desc", "boosted"]).optional(),
        userId: z.string().optional(),
        freeOnly: z.coerce.boolean().optional(),
        condition: z.string().optional(),
        includeSold: z.coerce.boolean().optional(),
        includeExpired: z.coerce.boolean().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof listings.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/listings/:id' as const,
      responses: {
        200: z.custom<typeof listings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/listings' as const,
      input: insertListingSchema,
      responses: {
        201: z.custom<typeof listings.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/listings/:id' as const,
      input: insertListingSchema.partial(),
      responses: {
        200: z.custom<typeof listings.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/listings/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    boost: {
      method: 'POST' as const,
      path: '/api/listings/:id/boost' as const,
      responses: {
        200: z.object({ checkoutUrl: z.string() }),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ListingInput = z.infer<typeof api.listings.create.input>;
export type ListingUpdateInput = z.infer<typeof api.listings.update.input>;
export type ListingResponse = z.infer<typeof api.listings.create.responses[201]>;
export type ListingsListResponse = z.infer<typeof api.listings.list.responses[200]>;
