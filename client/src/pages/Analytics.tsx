import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Heart, MessageSquare, BarChart3, TrendingUp, Package } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Listing } from "@shared/schema";

interface OverviewData {
  totalViews: number;
  totalListings: number;
  totalFavorites: number;
  totalMessages: number;
}

interface ViewsDataPoint {
  date: string;
  views: number;
}

interface ListingPerformance {
  listing: Listing;
  detailedViews: number;
  favorites: number;
  messages: number;
}

export default function Analytics() {
  const { t } = useTranslation();
  useOGMeta({ title: "Seller Analytics", description: "View your listing performance and analytics on YARDEES.", url: `${window.location.origin}/analytics` });
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      window.location.href = "/login";
    }
  }, [user, isAuthLoading]);

  const { data: overview, isLoading: isOverviewLoading } = useQuery<OverviewData>({
    queryKey: ["/api/analytics/overview"],
    enabled: !!user,
  });

  const { data: viewsOverTime, isLoading: isViewsLoading } = useQuery<ViewsDataPoint[]>({
    queryKey: ["/api/analytics/views-over-time"],
    enabled: !!user,
  });

  const { data: listingsData, isLoading: isListingsLoading } = useQuery<ListingPerformance[]>({
    queryKey: ["/api/analytics/listings"],
    enabled: !!user,
  });

  if (isAuthLoading) return null;

  const overviewCards = [
    { label: t("analytics.totalViews"), value: overview?.totalViews ?? 0, icon: Eye, testId: "stat-total-views" },
    { label: t("analytics.totalListings"), value: overview?.totalListings ?? 0, icon: Package, testId: "stat-total-listings" },
    { label: t("analytics.totalFavorites"), value: overview?.totalFavorites ?? 0, icon: Heart, testId: "stat-total-favorites" },
    { label: t("analytics.totalMessages"), value: overview?.totalMessages ?? 0, icon: MessageSquare, testId: "stat-total-messages" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold gradient-text flex items-center gap-3" data-testid="text-analytics-title">
            <BarChart3 className="w-8 h-8 text-primary" />
            {t("analytics.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="overview-cards">
          {overviewCards.map((card) => (
            <Card key={card.testId}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isOverviewLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid={card.testId}>
                    {card.value.toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t("analytics.viewsOverTime")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isViewsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : viewsOverTime && viewsOverTime.length > 0 ? (
              <div data-testid="chart-views-over-time" className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={viewsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val: string) => {
                        const d = new Date(val + "T00:00:00");
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(val: string) => {
                        const d = new Date(val + "T00:00:00");
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(128, 90%, 40%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground" data-testid="text-no-views-data">
                {t("analytics.noViewsData")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-primary" />
              {t("analytics.perListingPerformance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isListingsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : listingsData && listingsData.length > 0 ? (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <Table data-testid="table-listing-performance">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">{t("form.title")}</TableHead>
                    <TableHead className="text-right">{t("analytics.views")}</TableHead>
                    <TableHead className="text-right">{t("analytics.favorites")}</TableHead>
                    <TableHead className="text-right">{t("nav.messages")}</TableHead>
                    <TableHead className="text-right">{t("analytics.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listingsData.map((item) => (
                    <TableRow key={item.listing.id} data-testid={`row-listing-${item.listing.id}`}>
                      <TableCell>
                        <Link href={`/listing/${item.listing.id}`}>
                          <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`link-listing-${item.listing.id}`}>
                            {item.listing.title}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-views-${item.listing.id}`}>
                        {item.detailedViews.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-favorites-${item.listing.id}`}>
                        {item.favorites.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-messages-${item.listing.id}`}>
                        {item.messages.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.listing.isSold ? (
                          <Badge variant="secondary" data-testid={`badge-status-${item.listing.id}`}>{t("analytics.sold")}</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-white" data-testid={`badge-status-${item.listing.id}`}>{t("dashboard.active")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground" data-testid="text-no-listings">
                {t("analytics.noListingData")}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
