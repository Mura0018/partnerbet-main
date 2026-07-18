import { sanitizeRichText } from "@/lib/editor/sanitize";

// Public-facing renderer for rich-text content saved by RichTextEditor.
// Sanitizes again at render time (in addition to save-time sanitization)
// as a second layer of defense before using dangerouslySetInnerHTML.
export function RichTextRenderer({ html, className = "" }: { html: string; className?: string }) {
  const clean = sanitizeRichText(html);
  return (
    <div
      className={`prose prose-invert prose-sm md:prose-base max-w-none prose-a:text-accent prose-img:rounded-xl ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
