import DOMPurify from "isomorphic-dompurify";

// Sanitizes rich-text HTML before it is (a) saved to the database and
// (b) rendered publicly — two layers of defense. Content authors are
// trusted staff accounts (posts.manage / football_news.manage, enforced
// by RLS), not anonymous public input, but sanitizing anyway is cheap
// insurance against a compromised admin session, a buggy paste, or a
// future contributor role with narrower trust.
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "img",
      "hr", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class"],
  });
}
