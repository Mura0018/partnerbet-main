import Link from "next/link";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";

export const metadata = { title: "Blog" };
export const revalidate = 0;

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { category, tag } = await searchParams;
  const supabase = createPublicServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("content_type", "post")
    .is("deleted_at", null)
    .order("name");

  let query = supabase
    .from("posts")
    .select("id, title, slug, excerpt, cover_url, published_at, category_id, categories(name, slug)")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(30);

  if (category) {
    const match = categories?.find((c) => c.slug === category);
    if (match) query = query.eq("category_id", match.id);
  }

  let posts = (await query).data ?? [];

  if (tag) {
    const { data: tagRow } = await supabase.from("tags").select("id").eq("slug", tag).maybeSingle();
    if (tagRow) {
      const { data: postTagRows } = await supabase.from("post_tags").select("post_id").eq("tag_id", tagRow.id);
      const ids = new Set((postTagRows ?? []).map((r) => r.post_id));
      posts = posts.filter((p) => ids.has(p.id));
    }
  }

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/blog" />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        <h1 className="text-[28px] font-extrabold mb-6">Blog</h1>

        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href="/blog" className={`px-3 py-1.5 rounded-full text-[12px] border ${!category ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>Barchasi</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/blog?category=${c.slug}`} className={`px-3 py-1.5 rounded-full text-[12px] border ${category === c.slug ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center text-[13px] text-muted">
            Hozircha maqola yo'q.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {posts.map((p: any, i: number) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="card-premium rounded-2xl overflow-hidden block stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
                {p.cover_url && <img src={p.cover_url} alt={p.title} className="w-full h-40 object-cover" />}
                <div className="p-4">
                  {p.categories?.name && <span className="text-[11px] text-accent font-semibold">{p.categories.name}</span>}
                  <div className="font-semibold text-[15px] mt-1 line-clamp-2">{p.title}</div>
                  {p.excerpt && <p className="text-[12px] text-muted mt-1.5 line-clamp-2">{p.excerpt}</p>}
                  <div className="flex items-center justify-between mt-3">
                    {p.published_at && <p className="text-[11px] text-muted">{new Date(p.published_at).toLocaleDateString()}</p>}
                    <span className="text-[11px] font-semibold text-accent">Read News →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
