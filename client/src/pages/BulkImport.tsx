import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";

interface ParsedRow {
  title: string;
  description: string;
  price: string;
  category: string;
  condition: string;
  currency: string;
  city: string;
  country: string;
}

interface ImportResult {
  created: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const cols = ["title", "description", "price", "category", "condition", "currency", "city", "country"];
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    cols.forEach((col) => {
      const idx = headers.indexOf(col);
      row[col] = idx >= 0 ? values[idx] || "" : "";
    });
    return row as unknown as ParsedRow;
  });
}

export default function BulkImport() {
  const { t } = useTranslation();
  useOGMeta({ title: "Bulk Import", description: "Import multiple listings at once via CSV on YARDEES.", url: `${window.location.origin}/bulk-import` });
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/listings/bulk-import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Import failed" }));
        throw new Error(err.message || "Import failed");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: t("bulkImport.importComplete"),
        description: t("bulkImport.importSummary", { created: data.created, failed: data.failed }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("bulkImport.importFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3 flex-wrap" data-testid="text-page-title">
            <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
            {t("bulkImport.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("bulkImport.subtitle")}
          </p>
        </div>

        <Card className="p-6 md:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <a href="/api/listings/bulk-import/template" download>
              <Button variant="outline" data-testid="button-download-template">
                <Download className="mr-2 h-4 w-4" />
                {t("bulkImport.downloadTemplate")}
              </Button>
            </a>

            <div className="flex items-center gap-3 flex-wrap">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="max-w-xs"
                data-testid="input-csv-file"
              />
            </div>
          </div>

          {selectedFile && preview.length > 0 && !result && (
            <div className="mb-4">
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                data-testid="button-import-all"
              >
                {importMutation.isPending ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    {t("bulkImport.importing")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("bulkImport.importAll", { count: preview.length })}
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {result && (
          <Card className="p-6 md:p-8 mb-6" data-testid="card-import-results">
            <h2 className="text-xl font-semibold mb-4 text-foreground">{t("bulkImport.importResults")}</h2>
            <div className="flex items-center gap-6 mb-4 flex-wrap">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-created-count">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{t("bulkImport.listingsCreated", { count: result.created })}</span>
              </div>
              <div className="flex items-center gap-2 text-destructive" data-testid="text-failed-count">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">{t("bulkImport.failedCount", { count: result.failed })}</span>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("bulkImport.row")}</TableHead>
                      <TableHead>{t("bulkImport.error")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i} data-testid={`row-error-${i}`}>
                        <TableCell className="font-medium">{err.row}</TableCell>
                        <TableCell className="text-destructive">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {preview.length > 0 && (
          <Card className="p-6 md:p-8" data-testid="card-preview-table">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {t("bulkImport.preview", { count: preview.length })}
            </h2>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.title")}</TableHead>
                    <TableHead>{t("form.description")}</TableHead>
                    <TableHead>{t("form.price")}</TableHead>
                    <TableHead>{t("form.category")}</TableHead>
                    <TableHead>{t("form.condition")}</TableHead>
                    <TableHead>{t("form.currency")}</TableHead>
                    <TableHead>{t("form.city")}</TableHead>
                    <TableHead>{t("form.country")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i} data-testid={`row-preview-${i}`}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                      <TableCell>{row.price}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.condition}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell>{row.city}</TableCell>
                      <TableCell>{row.country}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
