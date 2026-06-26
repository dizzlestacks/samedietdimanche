import { Resend } from "resend";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = "Yardees <notifications@yardees.net>";

function getBaseUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  const deployUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DOMAINS?.split(",")[0];
  if (deployUrl) return `https://${deployUrl}`;
  return "https://www.yardees.net";
}

const BASE_URL = getBaseUrl();
// Brand colors — match site exactly (HSL 130 65% 34% green, HSL 40 65% 50% gold from index.css)
const BRAND_COLOR = "#1e8f31";
const BRAND_COLOR_DARK = "#177026";
const BRAND_GOLD = "#d29b2d";

// Font stacks — match site (Outfit display, DM Sans body). Web fonts loaded
// via <link> in <head> work in Apple Mail, iOS Mail, Gmail web, Yahoo.
// Outlook strips them and falls back to the safe sans-serif stack — that's fine.
const HF = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const BF = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function emailWrapper(content: string, preheader: string = ""): string {
  const logoUrl = `${BASE_URL}/yardees-logo.png`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>YARDEES</title>
  <!-- Brand fonts (Outfit + DM Sans). Apple Mail / iOS Mail / Gmail web load these. Outlook falls back to system sans-serif. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f1ea;font-family:${BF};color:#2d2a26;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1ea;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece8df;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:${BRAND_COLOR};padding:40px 32px 36px;">
              <img src="${logoUrl}" alt="YARDEES" width="56" height="56" style="display:block;margin:0 auto 16px;border-radius:14px;background:#ffffff;padding:6px;" />
              <h1 style="font-family:${HF};color:#ffffff;margin:0;font-size:26px;letter-spacing:6px;font-weight:600;text-transform:uppercase;line-height:1.2;">YARDEES</h1>
              <p style="font-family:${BF};color:rgba(255,255,255,0.72);margin:10px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:400;">Second Hand Never Looked This Good</p>
            </td>
          </tr>
          <!-- Gold accent bar -->
          <tr><td style="height:3px;background-color:${BRAND_GOLD};line-height:3px;font-size:0;">&nbsp;</td></tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 44px 32px;font-family:${BF};color:#2d2a26;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#faf8f3;padding:28px 44px 32px;border-top:1px solid #eee9de;text-align:center;">
              <p style="font-family:${BF};color:#8a857d;font-size:12px;margin:0 0 14px;line-height:1.6;">
                You received this email because you have an account on YARDEES.
              </p>
              <p style="margin:0 0 16px;font-family:${BF};font-size:12px;">
                <a href="${BASE_URL}/dashboard" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">Account</a>
                <span style="color:#d8d4cc;margin:0 10px;">|</span>
                <a href="${BASE_URL}/privacy" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">Privacy</a>
                <span style="color:#d8d4cc;margin:0 10px;">|</span>
                <a href="${BASE_URL}/contact" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">Support</a>
              </p>
              <p style="font-family:${BF};color:#b0aa9f;font-size:11px;margin:0;letter-spacing:0.5px;">
                &copy; ${year} YARDEES &nbsp;&middot;&nbsp; <a href="${BASE_URL}" style="color:#b0aa9f;text-decoration:none;">yardees.net</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr><td align="center"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${BRAND_COLOR}" style="border-radius:8px;background-color:${BRAND_COLOR};"><a href="${url}" target="_blank" style="color:#ffffff;padding:14px 38px;text-decoration:none;display:inline-block;font-family:${BF};font-weight:600;font-size:14px;letter-spacing:0.5px;border-radius:8px;mso-padding-alt:0;">${text}</a></td></tr></table></td></tr></table>`;
}

function infoCard(content: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td style="background-color:#faf8f3;border:1px solid #ece8df;border-left:3px solid ${BRAND_COLOR};padding:22px 26px;border-radius:8px;font-family:${BF};color:#2d2a26;">${content}</td></tr></table>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:${HF};color:#1c1a17;margin:0 0 12px;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:-0.01em;">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="font-family:${BF};color:#4a463f;margin:0 0 14px;font-size:15px;line-height:1.65;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="font-family:${BF};color:#8a857d;margin:18px 0 0;font-size:13px;line-height:1.6;">${text}</p>`;
}

async function canSendEmail(userId: string): Promise<{ user: any; canSend: boolean }> {
  const user = await authStorage.getUser(userId);
  if (!user || !user.email) return { user: null, canSend: false };
  if (user.emailNotifications === false) return { user, canSend: false };
  return { user, canSend: true };
}

const messageNotificationDebounce = new Map<string, number>();
const DEBOUNCE_INTERVAL = 60 * 60 * 1000;

export async function sendMessageNotification(receiverId: string, senderId: string, listingId: number | null, content: string) {
  if (!resend) return;

  const debounceKey = `${senderId}:${receiverId}:${listingId ?? "none"}`;
  const now = Date.now();
  const lastSent = messageNotificationDebounce.get(debounceKey);
  if (lastSent && now - lastSent < DEBOUNCE_INTERVAL) return;

  try {
    const { user: receiver, canSend } = await canSendEmail(receiverId);
    if (!canSend) return;

    const sender = await authStorage.getUser(senderId);
    const listing = listingId ? await storage.getListing(listingId) : null;
    const listingTitle = listing ? ` regarding "${listing.title}"` : "";

    await resend.emails.send({
      from: FROM_EMAIL,
      to: receiver.email,
      subject: `New message from ${sender?.displayName || "a user"}${listingTitle}`,
      html: emailWrapper(`
        ${heading("You have a new message")}
        ${paragraph(`<strong style="color:#1c1a17;">${sender?.displayName || "Someone"}</strong> just sent you a message${listing ? ` about <strong style="color:#1c1a17;">${listing.title}</strong>` : ""}.`)}
        ${infoCard(`<p style="margin:0;color:#3d3a35;line-height:1.65;font-style:italic;">&ldquo;${content}&rdquo;</p>`)}
        ${button("Reply now", `${BASE_URL}/messages`)}
      `, `${sender?.displayName || "Someone"} sent you a message on YARDEES`),
    });

    messageNotificationDebounce.set(debounceKey, now);
  } catch (error) {
    console.error("Failed to send message notification email:", error);
  }
}

export async function sendOfferNotification(sellerId: string, listingTitle: string, offerAmount: number, currency: string, buyerName: string) {
  if (!resend) return;

  try {
    const { user: seller, canSend } = await canSendEmail(sellerId);
    if (!canSend) return;

    const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(offerAmount / 100);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: seller.email,
      subject: `New offer on "${listingTitle}" — ${formattedAmount}`,
      html: emailWrapper(`
        ${heading("You received a new offer")}
        ${paragraph(`<strong style="color:#1c1a17;">${buyerName}</strong> just made an offer on <strong style="color:#1c1a17;">${listingTitle}</strong>.`)}
        ${infoCard(`<p style="margin:0 0 4px;color:#8a857d;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;text-align:center;">Offer amount</p><p style="font-family:${HF};font-size:34px;font-weight:600;color:${BRAND_COLOR};margin:0;text-align:center;letter-spacing:-0.01em;">${formattedAmount}</p>`)}
        ${button("Review offer", `${BASE_URL}/offers`)}
      `, `${buyerName} offered ${formattedAmount} on ${listingTitle}`),
    });
  } catch (error) {
    console.error("Failed to send offer notification email:", error);
  }
}

export async function sendBoostExpiryNotification(userId: string, listingId: number, listingTitle: string) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(userId);
    if (!canSend) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Boost expired for "${listingTitle}"`,
      html: emailWrapper(`
        ${heading("Your boost has expired")}
        ${paragraph(`The boost on <strong style="color:#1c1a17;">${listingTitle}</strong> has ended. Re-boost it to keep your listing at the top of search results and reach more buyers.`)}
        ${button("Re-boost listing", `${BASE_URL}/boost/${listingId}`)}
      `, `Boost expired on ${listingTitle}`),
    });
  } catch (error) {
    console.error("Failed to send boost expiry notification email:", error);
  }
}

export async function sendSearchAlert(userId: string, listingId: number, searchLabel: string) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(userId);
    if (!canSend) return;

    const listing = await storage.getListing(listingId);
    if (!listing) return;

    const formattedPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency || "USD" }).format(listing.price / 100);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `New match for your saved search: ${searchLabel}`,
      html: emailWrapper(`
        ${heading("A new match for your search")}
        ${paragraph(`We found a fresh listing that matches your saved search <strong style="color:#1c1a17;">&ldquo;${searchLabel}&rdquo;</strong>.`)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border:1px solid #ece8df;border-radius:12px;overflow:hidden;background:#ffffff;">
          ${listing.photos?.[0] ? `<tr><td style="padding:0;"><img src="${listing.photos[0]}" alt="${listing.title}" width="600" style="display:block;width:100%;max-width:512px;height:auto;border:0;" /></td></tr>` : ""}
          <tr><td style="padding:20px 24px 22px;">
            <h3 style="font-family:${HF};margin:0 0 6px;color:#1c1a17;font-size:20px;font-weight:600;line-height:1.3;">${listing.title}</h3>
            <p style="font-family:${BF};color:${BRAND_COLOR};font-weight:700;font-size:20px;margin:0 0 8px;letter-spacing:-0.01em;">${formattedPrice}</p>
            <p style="font-family:${BF};color:#8a857d;font-size:13px;margin:0;">${[listing.city, listing.country].filter(Boolean).join(", ")}</p>
          </td></tr>
        </table>
        ${button("View listing", `${BASE_URL}/listing/${listing.id}`)}
      `, `New match for ${searchLabel}: ${listing.title}`),
    });
  } catch (error) {
    console.error("Failed to send search alert email:", error);
  }
}

export async function sendVerificationEmail(userId: string, token: string) {
  if (!resend) return;

  try {
    const user = await authStorage.getUser(userId);
    if (!user || !user.email) return;

    const verifyUrl = `${BASE_URL}/api/verify-email/${token}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "Verify your YARDEES email address",
      html: emailWrapper(`
        ${heading("Confirm your email address")}
        ${paragraph(`Hi ${user.displayName || "there"},`)}
        ${paragraph(`Welcome to YARDEES. Please confirm your email address to unlock messaging, offers, and your full account.`)}
        ${button("Verify email", verifyUrl)}
        ${muted("If you didn't create a YARDEES account, you can safely ignore this email.")}
      `, "Confirm your email to activate your YARDEES account"),
    });
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }
}

export async function sendPasswordResetEmail(userId: string, token: string) {
  if (!resend) return;

  try {
    const user = await authStorage.getUser(userId);
    if (!user || !user.email) return;

    const resetUrl = `${BASE_URL}/reset-password/${token}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "Reset your YARDEES password",
      html: emailWrapper(`
        ${heading("Reset your password")}
        ${paragraph(`Hi ${user.displayName || "there"},`)}
        ${paragraph(`We received a request to reset your YARDEES password. Click below to set a new one.`)}
        ${button("Reset password", resetUrl)}
        ${muted("This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email — your password won't change.")}
      `, "Reset your YARDEES password"),
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
}

export async function sendWelcomeEmail(userId: string) {
  if (!resend) return;

  try {
    const user = await authStorage.getUser(userId);
    if (!user || !user.email) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "Welcome to YARDEES! 🎉",
      html: emailWrapper(`
        ${heading(`Welcome, ${user.displayName || "friend"}`)}
        ${paragraph(`You're in. YARDEES is the world's marketplace for yard sales, thrift shops, and pre-loved finds — where second hand never looked this good.`)}
        ${infoCard(`
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="padding:8px 0;color:#2d2a26;font-family:${BF};font-size:15px;line-height:1.55;"><span style="color:${BRAND_COLOR};font-weight:700;margin-right:10px;">&rarr;</span> <strong>Browse</strong> local yard sales and thrift finds</td></tr>
            <tr><td style="padding:8px 0;color:#2d2a26;font-family:${BF};font-size:15px;line-height:1.55;"><span style="color:${BRAND_COLOR};font-weight:700;margin-right:10px;">&rarr;</span> <strong>List items</strong> in minutes with photos and pricing</td></tr>
            <tr><td style="padding:8px 0;color:#2d2a26;font-family:${BF};font-size:15px;line-height:1.55;"><span style="color:${BRAND_COLOR};font-weight:700;margin-right:10px;">&rarr;</span> <strong>Message</strong> buyers and sellers in real time</td></tr>
            <tr><td style="padding:8px 0;color:#2d2a26;font-family:${BF};font-size:15px;line-height:1.55;"><span style="color:${BRAND_COLOR};font-weight:700;margin-right:10px;">&rarr;</span> <strong>Discover</strong> nearby thrift shops on the map</td></tr>
          </table>
        `)}
        ${button("Start browsing", BASE_URL)}
      `, "Welcome to YARDEES — second hand never looked this good"),
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendListingSoldNotification(sellerId: string, listingTitle: string, listingId: number) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(sellerId);
    if (!canSend) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Your listing "${listingTitle}" has been marked as sold!`,
      html: emailWrapper(`
        ${heading("Congratulations — it's sold")}
        ${paragraph(`Your listing <strong style="color:#1c1a17;">${listingTitle}</strong> has been marked as sold. Nicely done.`)}
        ${paragraph(`Track this sale and manage your other listings from your dashboard.`)}
        ${button("Open dashboard", `${BASE_URL}/dashboard`)}
      `, `${listingTitle} sold on YARDEES`),
    });
  } catch (error) {
    console.error("Failed to send listing sold notification:", error);
  }
}

export async function sendReviewNotification(sellerId: string, reviewerName: string, rating: number, listingTitle: string) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(sellerId);
    if (!canSend) return;

    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `New ${rating}-star review on "${listingTitle}"`,
      html: emailWrapper(`
        ${heading("You received a new review")}
        ${paragraph(`<strong style="color:#1c1a17;">${reviewerName}</strong> left feedback on <strong style="color:#1c1a17;">${listingTitle}</strong>.`)}
        ${infoCard(`<p style="font-size:30px;color:${BRAND_GOLD};margin:0;text-align:center;letter-spacing:6px;line-height:1;">${stars}</p><p style="margin:10px 0 0;color:#8a857d;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-align:center;font-family:${BF};">${rating} of 5 stars</p>`)}
        ${button("View your profile", `${BASE_URL}/seller/${sellerId}`)}
      `, `${reviewerName} left a ${rating}-star review on ${listingTitle}`),
    });
  } catch (error) {
    console.error("Failed to send review notification:", error);
  }
}

export async function sendVerificationStatusEmail(userId: string, status: "approved" | "rejected" | "expired", note?: string) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(userId);
    if (!canSend) return;

    const isApproved = status === "approved";
    const statusText = isApproved ? "Approved" : "Not Approved";
    const statusColor = isApproved ? BRAND_COLOR : "#ef4444";

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Verification ${statusText} — YARDEES`,
      html: emailWrapper(`
        ${heading(`Verification ${statusText.toLowerCase()}`)}
        ${paragraph(`Hi ${user.displayName || "there"},`)}
        ${paragraph(`Your identity verification request has been <strong style="color:${statusColor};">${status}</strong>.`)}
        ${isApproved
          ? paragraph(`Your profile now displays a verified badge — buyers will know they're dealing with a trusted seller.`)
          : paragraph(`Unfortunately we couldn't verify your identity at this time. You're welcome to submit a new request.`)}
        ${note ? infoCard(`<p style="margin:0 0 4px;color:#8a857d;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:${BF};">Reviewer note</p><p style="margin:0;color:#2d2a26;line-height:1.6;font-family:${BF};">${note}</p>`) : ""}
        ${button("Open dashboard", `${BASE_URL}/dashboard`)}
      `, `Your YARDEES verification was ${status}`),
    });
  } catch (error) {
    console.error("Failed to send verification status email:", error);
  }
}

export async function sendOrderStatusEmail(userId: string, orderId: number, newStatus: string, listingTitle: string) {
  if (!resend) return;

  try {
    const { user, canSend } = await canSendEmail(userId);
    if (!canSend) return;

    const statusLabels: Record<string, string> = {
      confirmed: "Order Confirmed",
      shipped: "Item Shipped",
      delivered: "Item Delivered",
      cancelled: "Order Cancelled",
    };

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Order update: ${statusLabels[newStatus] || newStatus} — "${listingTitle}"`,
      html: emailWrapper(`
        ${heading(statusLabels[newStatus] || newStatus)}
        ${paragraph(`Your order for <strong style="color:#1c1a17;">${listingTitle}</strong> has been updated.`)}
        ${infoCard(`<p style="margin:0 0 4px;color:#8a857d;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;text-align:center;font-family:${BF};">Current status</p><p style="margin:0;font-family:${HF};font-weight:600;color:${BRAND_COLOR};font-size:22px;text-align:center;letter-spacing:-0.01em;">${statusLabels[newStatus] || newStatus}</p>`)}
        ${button("View order", `${BASE_URL}/orders`)}
      `, `Order update for ${listingTitle}`),
    });
  } catch (error) {
    console.error("Failed to send order status email:", error);
  }
}

const SUPPORT_EMAIL = "support@yardees.net";

export async function sendFeedbackToSupport(feedback: { type: string; message: string; email?: string }) {
  if (!resend) return;
  try {
    const typeLabel = feedback.type === "bug" ? "Bug Report" : feedback.type === "feature" ? "Feature Request" : "General Feedback";
    await resend.emails.send({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      subject: `[YARDEES ${typeLabel}] New feedback received`,
      html: emailWrapper(`
        ${heading(`New ${typeLabel.toLowerCase()}`)}
        ${infoCard(`
          <p style="margin:0 0 12px;color:#2d2a26;font-family:${BF};font-size:14px;"><strong style="color:#1c1a17;">Type:</strong> ${typeLabel}</p>
          <p style="margin:0 0 12px;color:#2d2a26;font-family:${BF};font-size:14px;"><strong style="color:#1c1a17;">From:</strong> ${feedback.email || "Anonymous"}</p>
          <p style="margin:0 0 6px;color:#1c1a17;font-family:${BF};font-size:14px;"><strong>Message</strong></p>
          <p style="margin:0;color:#3d3a35;white-space:pre-wrap;line-height:1.65;font-family:${BF};font-size:14px;">${feedback.message}</p>
        `)}
      `, `New ${typeLabel.toLowerCase()} on YARDEES`),
    });
  } catch (error) {
    console.error("Failed to send feedback email:", error);
  }
}
