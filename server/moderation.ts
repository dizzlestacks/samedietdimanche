const SPAM_SCAM_WORDS = [
  "wire transfer", "western union", "moneygram", "send money",
  "nigerian prince", "lottery winner", "you have won",
  "click here now", "act now", "limited time offer",
  "free money", "make money fast", "get rich quick",
  "cash only no questions", "untraceable", "offshore account",
  "bitcoin only", "crypto only", "gift card payment",
  "advance fee", "processing fee required",
  "guaranteed income", "no risk", "risk free",
  "double your money", "investment opportunity",
  "work from home", "be your own boss",
  "multi level marketing", "mlm opportunity",
  "pay shipping only", "just pay shipping",
  "too good to be true",
  "send me your bank", "bank account number",
  "social security", "ssn", "credit card number",
  "account password", "login credentials",
  "phishing", "malware", "virus link",
  "replica", "counterfeit", "knockoff brand",
  "stolen goods", "fell off a truck",
];

const OFFENSIVE_WORDS = [
  "hate speech", "racial slur",
  "kill yourself", "kys",
  "go die",
];

const SUSPICIOUS_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b.*\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /https?:\/\/bit\.ly\//i,
  /https?:\/\/tinyurl\.com\//i,
  /https?:\/\/t\.co\//i,
  /whatsapp\.me/i,
  /telegram\.me/i,
  /\+\d{1,3}\s?\d{6,}/,
];

export interface ModerationResult {
  isClean: boolean;
  flaggedWords: string[];
  severity: "none" | "low" | "medium" | "high";
}

export function moderateContent(text: string): ModerationResult {
  if (!text || typeof text !== "string") {
    return { isClean: true, flaggedWords: [], severity: "none" };
  }

  const normalized = text.toLowerCase().trim();
  const flaggedWords: string[] = [];

  for (const word of OFFENSIVE_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      flaggedWords.push(word);
    }
  }

  if (flaggedWords.length > 0) {
    return { isClean: false, flaggedWords, severity: "high" };
  }

  for (const word of SPAM_SCAM_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      flaggedWords.push(word);
    }
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      flaggedWords.push(`pattern:${match[0].substring(0, 30)}`);
    }
  }

  if (flaggedWords.length === 0) {
    return { isClean: true, flaggedWords: [], severity: "none" };
  }

  const severity = flaggedWords.length >= 3 ? "high" : flaggedWords.length >= 2 ? "medium" : "low";

  return { isClean: false, flaggedWords, severity };
}
