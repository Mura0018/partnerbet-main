import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, Eye } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { RichTextRenderer } from "@/lib/editor/RichTextRenderer";
import { ViewTracker } from "@/lib/ViewTracker";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Breadcrumbs } from "@/lib/ui/Breadcrumbs";

async function getPost(slug: string) {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("posts")
    .select("*, categories(name, slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Maqola topilmadi" };
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    keywords: post.seo_keywords ?? undefined,
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      images: post.cover_url ? [post.cover_url] : undefined,
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const supabase = createPublicServerClient();
  const [{ data: tagRows }, { data: relatedPosts }] = await Promise.all([
    supabase.from("post_tags").select("tags(id, name, slug)").eq("post_id", post.id),
    post.category_id
      ? supabase.from("posts").select("id, title, slug, cover_url").eq("category_id", post.category_id).eq("status", "published").neq("id", post.id).limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_url || undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
  };

  return (
    <div className="min-h-screen bg-bg text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <ViewTracker table="posts" id={post.id} />
      <PublicHeader active="/blog" />

      <article className="max-w-4xl mx-auto px-5 md:px-8 py-10 animate-fade-in-up">
        <Breadcrumbs items={[{ label: "Blog", href: "/blog" }, { label: post.title }]} />
        {post.categories?.name && (
          <Link href={`/blog?category=${post.categories.slug}`} className="text-[12px] text-accent font-semibold">{post.categories.name}</Link>
        )}
        <h1 className="text-[28px] md:text-[36px] font-extrabold mt-2 leading-tight">{post.title}</h1>
        <div className="flex items-center gap-4 mt-3 text-[12px] text-[#5b6f85]">
          {post.published_at && (
            <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(post.published_at).toLocaleDateString()}</span>
          )}
          <span className="flex items-center gap-1.5"><Eye size={13} /> {post.view_count ?? 0}</span>
        </div>

        {post.cover_url && <img src={post.cover_url} alt={post.title} className="w-full rounded-2xl mt-6 border border-white/10" />}

        <div className="mt-8">
          <RichTextRenderer html={post.content} />
        </div>

        {tagRows && tagRows.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8">
            {tagRows.map((row: any) => row.tags && (
              <Link key={row.tags.id} href={`/blog?tag=${row.tags.slug}`} className="px-3 py-1 rounded-full text-[11px] border border-white/10 text-muted hover:border-accent/30 hover:text-accent">
                #{row.tags.name}
              </Link>
            ))}
          </div>
        )}

        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/5">
            <h2 className="text-[16px] font-bold mb-4">O'xshash maqolalar</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {relatedPosts.map((p: any) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-accent/30 transition">
                  {p.cover_url && <img src={p.cover_url} alt="" className="w-full h-28 object-cover" />}
                  <div className="p-3 text-[13px] font-medium line-clamp-2">{p.title}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
      <PublicFooter />
    </div>
  );
}
