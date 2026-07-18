// Shared password-strength validation — imported by BOTH the client-side
// forms (instant feedback) and the server-side API routes (register /
// reset-password / change-password), so the rule can never be bypassed by
// skipping the UI.

const COMMON_PASSWORDS = new Set([
  "password", "password1", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "letmein1", "welcome1", "admin1234",
  "iloveyou1", "passw0rd", "partnerbet", "football1", "changeme1",
]);

export type PasswordCheck = {
  valid: boolean;
  score: 0 | 1 | 2 | 3; // 0=too weak to submit, 1=weak, 2=medium, 3=strong
  failedRules: string[]; // i18n key suffixes, e.g. "tooShort"
};

export function checkPasswordStrength(password: string, email?: string): PasswordCheck {
  const failed: string[] = [];

  if (password.length < 10) failed.push("tooShort");
  if (!/[A-Z]/.test(password)) failed.push("needUpper");
  if (!/[a-z]/.test(password)) failed.push("needLower");
  if (!/[0-9]/.test(password)) failed.push("needDigit");
  if (!/[^A-Za-z0-9]/.test(password)) failed.push("needSymbol");

  const lower = password.toLowerCase();
  const isCommon = COMMON_PASSWORDS.has(lower) || (email && lower === email.toLowerCase());
  if (isCommon) failed.push("tooCommon");

  const rulesPassed = 5 - failed.filter((f) => f !== "tooCommon").length;
  let score: PasswordCheck["score"] = 0;
  if (failed.length === 0) score = 3;
  else if (rulesPassed >= 4 && !isCommon) score = 2;
  else if (rulesPassed >= 2) score = 1;

  return {
    valid: failed.length === 0,
    score,
    failedRules: failed,
  };
}
