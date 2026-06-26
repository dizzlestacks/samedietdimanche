import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, MessageSquare, HelpCircle, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useOGMeta({
    title: "Contact Us — Get in Touch with YARDEES",
    description: "Contact the YARDEES team for support, feedback, partnership inquiries, or general questions. We're here to help.",
    url: `${window.location.origin}/contact`,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "general",
          message: `[Contact Form]\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
        }),
      });
      if (res.ok) {
        toast({ title: "Message sent! We'll get back to you soon." });
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        toast({ title: "Failed to send message. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-contact">
      <Navbar />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="gap-2" data-testid="link-contact-back">
                <ArrowLeft className="w-4 h-4" />
                {t("common.back", "Back")}
              </Button>
            </Link>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3 font-display" data-testid="text-contact-title">
              Contact Us
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have a question, suggestion, or need help? We're here for you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <Card data-testid="card-contact-email">
              <CardContent className="pt-6 text-center">
                <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Email Us</h3>
                <a href="mailto:support@yardees.net" className="text-sm text-primary hover:underline">
                  support@yardees.net
                </a>
              </CardContent>
            </Card>
            <Card data-testid="card-contact-help">
              <CardContent className="pt-6 text-center">
                <HelpCircle className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Help Center</h3>
                <Link href="/help" className="text-sm text-primary hover:underline">
                  Browse FAQs & Guides
                </Link>
              </CardContent>
            </Card>
            <Card data-testid="card-contact-response">
              <CardContent className="pt-6 text-center">
                <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Response Time</h3>
                <p className="text-sm text-muted-foreground">Within 24-48 hours</p>
              </CardContent>
            </Card>
          </div>

          <Card className="max-w-2xl mx-auto" data-testid="card-contact-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Send Us a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Your Name</label>
                    <Input
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Subject</label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger data-testid="select-contact-subject">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Question</SelectItem>
                      <SelectItem value="support">Technical Support</SelectItem>
                      <SelectItem value="account">Account Issue</SelectItem>
                      <SelectItem value="payment">Payment & Billing</SelectItem>
                      <SelectItem value="report">Report a Problem</SelectItem>
                      <SelectItem value="feedback">Feedback & Suggestions</SelectItem>
                      <SelectItem value="partnership">Partnership Inquiry</SelectItem>
                      <SelectItem value="press">Press & Media</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Message</label>
                  <Textarea
                    placeholder="Tell us how we can help..."
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    data-testid="input-contact-message"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending} data-testid="button-contact-submit">
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-10 text-center">
            <Card className="bg-muted/30 border-dashed max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <Shield className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Trust & Safety</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  If you need to report a listing, user, or safety concern, please use the report feature on the listing or user profile page, or contact us directly at{" "}
                  <a href="mailto:support@yardees.net" className="text-primary hover:underline">support@yardees.net</a>.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
