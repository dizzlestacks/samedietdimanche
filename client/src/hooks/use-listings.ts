import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api, buildUrl, type ListingInput, type ListingUpdateInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { getCachedListings, getCachedListing, cacheListings } from "@/lib/offlineStorage";
import { isSaleEventType } from "@shared/schema";

const PAGE_SIZE = 24;

function applyOfflineFilters(listings: any[], filters: Record<string, any>): any[] {
  let result = filters.includeSold ? [...listings] : listings.filter((l: any) => !l.isSold);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((l: any) =>
      l.title?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q)
    );
  }
  if (filters.category) result = result.filter((l: any) => l.category === filters.category);
  if (filters.country) result = result.filter((l: any) => l.country === filters.country);
  if (filters.city) result = result.filter((l: any) => l.city === filters.city);
  if (filters.listingType) {
    if (filters.listingType === "sale_event") {
      result = result.filter((l: any) => isSaleEventType(l.listingType));
    } else {
      result = result.filter((l: any) => l.listingType === filters.listingType);
    }
  }
  if (filters.condition) result = result.filter((l: any) => l.condition === filters.condition);
  if (filters.isShop) result = result.filter((l: any) => l.isShop === true);
  if (filters.freeOnly) result = result.filter((l: any) => l.price === 0 || l.isDonation);
  if (filters.minPrice) result = result.filter((l: any) => l.price >= Number(filters.minPrice));
  if (filters.maxPrice) result = result.filter((l: any) => l.price <= Number(filters.maxPrice));
  if (filters.userId) result = result.filter((l: any) => l.userId === filters.userId);

  if (filters.sort === "price_asc") result.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
  else if (filters.sort === "price_desc") result.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
  else if (filters.sort === "boosted") result.sort((a: any, b: any) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  else result.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return result;
}

export function useListingsPaginated(filters?: {
  search?: string;
  category?: string;
  listingType?: string;
  country?: string;
  city?: string;
  isShop?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "boosted";
  userId?: string;
  freeOnly?: boolean;
  condition?: string;
  includeSold?: boolean;
  includeExpired?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
}) {
  const { page = 1, ...rest } = filters || {};
  const offset = (page - 1) * PAGE_SIZE;

  const queryString = new URLSearchParams(
    Object.entries(rest).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== "") acc[key] = String(val);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return useQuery({
    queryKey: [api.listings.list.path, "paginated", queryString, page],
    queryFn: async () => {
      const separator = queryString ? "&" : "";
      const url = `${api.listings.list.path}?${queryString}${separator}limit=${PAGE_SIZE}&offset=${offset}`;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch listings");
        const data = await res.json() as { items: any[]; total: number; hasMore: boolean };
        if (data.items?.length > 0) {
          cacheListings(data.items).catch(() => {});
        }
        return { ...data, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(data.total / PAGE_SIZE) };
      } catch (err) {
        if (!navigator.onLine && page === 1) {
          const cached = await getCachedListings();
          if (cached.length > 0) {
            const filtered = applyOfflineFilters(cached, rest);
            return { items: filtered, total: filtered.length, hasMore: false, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
          }
        }
        throw err;
      }
    },
    placeholderData: (prev) => prev,
  });
}

export function useListings(filters?: {
  search?: string;
  category?: string;
  listingType?: string;
  country?: string;
  city?: string;
  isShop?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "boosted";
  userId?: string;
  freeOnly?: boolean;
  condition?: string;
  includeSold?: boolean;
  includeExpired?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
}) {
  const queryString = new URLSearchParams(
    Object.entries(filters || {}).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== "") acc[key] = String(val);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return useInfiniteQuery({
    queryKey: [api.listings.list.path, queryString],
    queryFn: async ({ pageParam = 0 }) => {
      const separator = queryString ? "&" : "";
      const url = `${api.listings.list.path}?${queryString}${separator}limit=${PAGE_SIZE}&offset=${pageParam}`;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch listings");
        const data = await res.json() as { items: any[]; total: number; hasMore: boolean };
        if (data.items?.length > 0) {
          cacheListings(data.items).catch(() => {});
        }
        return data;
      } catch (err) {
        if (!navigator.onLine && pageParam === 0) {
          const cached = await getCachedListings();
          if (cached.length > 0) {
            const filtered = applyOfflineFilters(cached, filters || {});
            return { items: filtered, total: filtered.length, hasMore: false, offline: true };
          }
        }
        throw err;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.items.length, 0);
    },
  });
}

export function useAllListings(filters?: {
  search?: string;
  category?: string;
  userId?: string;
  includeSold?: boolean;
  includeExpired?: boolean;
  [key: string]: any;
}) {
  const queryString = new URLSearchParams(
    Object.entries(filters || {}).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== "") acc[key] = String(val);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return useQuery({
    queryKey: [api.listings.list.path, "all", queryString],
    queryFn: async () => {
      const separator = queryString ? "&" : "";
      const url = `${api.listings.list.path}?${queryString}${separator}limit=100&offset=0`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json() as { items: any[]; total: number; hasMore: boolean };
      return data.items;
    },
  });
}

export function useListing(id: number) {
  return useQuery({
    queryKey: [api.listings.get.path, id],
    queryFn: async () => {
      try {
        const url = buildUrl(api.listings.get.path, { id });
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch listing");
        const data = await res.json();
        cacheListings([data]).catch(() => {});
        return api.listings.get.responses[200].parse(data);
      } catch (err) {
        if (!navigator.onLine) {
          const cached = await getCachedListing(id);
          if (cached) return cached;
        }
        throw err;
      }
    },
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ListingInput) => {
      // Validate with schema before sending (double check)
      const validated = api.listings.create.input.parse(data);
      
      const res = await fetch(api.listings.create.path, {
        method: api.listings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        const error = await res.json();
        throw new Error(error.message || "Failed to create listing");
      }
      return api.listings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.listings.list.path] });
      toast({
        title: "Success!",
        description: "Your item has been listed for sale.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & ListingUpdateInput) => {
      const validated = api.listings.update.input.parse(updates);
      const url = buildUrl(api.listings.update.path, { id });
      
      const res = await fetch(url, {
        method: api.listings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update listing");
      return api.listings.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.listings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.listings.get.path, variables.id] });
      toast({
        title: "Updated!",
        description: "Your listing has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.listings.delete.path, { id });
      const res = await fetch(url, { 
        method: api.listings.delete.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete listing");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.listings.list.path] });
      toast({
        title: "Deleted",
        description: "Your listing has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
