import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bug, Lightbulb, MessageSquare, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "./PageLoader";

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "feedback"]),
  message: z.string().min(10, "Please provide at least 10 characters"),
  email: z.string().email().optional().or(z.literal("")),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const TYPE_CONFIG = {
  bug: { icon: Bug, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800" },
  feature: { icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800" },
  feedback: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
};

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: "feedback", message: "", email: "" },
  });

  const selectedType = form.watch("type");

  const mutation = useMutation({
    mutationFn: (data: FeedbackFormData) => apiRequest("POST", "/api/feedback", data),
    onSuccess: () => {
      toast({ title: t("feedback.successTitle"), description: t("feedback.successMessage") });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("feedback.errorTitle"), description: t("feedback.errorMessage"), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-feedback">
        <DialogHeader>
          <DialogTitle>{t("feedback.title")}</DialogTitle>
          <DialogDescription>{t("feedback.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("feedback.typeLabel")}</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {(["bug", "feature", "feedback"] as const).map((type) => {
                      const config = TYPE_CONFIG[type];
                      const Icon = config.icon;
                      const isSelected = field.value === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? `${config.bg} ${config.border} ring-1 ring-offset-1 ring-current ${config.color}`
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          data-testid={`button-feedback-type-${type}`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? config.color : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${isSelected ? "" : "text-muted-foreground"}`}>
                            {t(`feedback.type.${type}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("feedback.messageLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t(`feedback.placeholder.${selectedType}`)}
                      rows={4}
                      data-testid="input-feedback-message"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("feedback.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("feedback.emailPlaceholder")}
                      data-testid="input-feedback-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={mutation.isPending}
              data-testid="button-submit-feedback"
            >
              {mutation.isPending ? (
                <ButtonLoader />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t("feedback.submit")}
                </>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
