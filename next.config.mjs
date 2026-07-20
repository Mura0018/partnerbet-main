/** @type {import('next').NextConfig} */

// Restricts next/image's remote image optimizer to only the domains this
// project actually serves images from. The codebase currently renders
// images via plain <img> tags everywhere (not next/image), so this has no
// effect today — but a wildcard hostname ("**") is a real SSRF-adjacent
// risk the moment next/image IS adopted, so it's fixed now rather than
// left as a landmine for later.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
  serverExternalPackages: ["jsdom", "isomorphic-dompurify"],
};

export default nextConfig;
