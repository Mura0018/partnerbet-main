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

async function getNews(slug: string) {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("football_news")
    .select("*, categories(name, slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const news = await getNews(slug);
  if (!news) return { title: "Yangilik topilmadi" };
  return {
    title: news.seo_title || news.title,
    description: news.seo_description || news.excerpt || undefined,
    openGraph: {
      title: news.seo_title || news.title,
      description: news.seo_description || news.excerpt || undefined,
      images: news.cover_url ? [news.cover_url] : undefined,
      type: "article",
    },
  };
}

export default async function FootballNewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const news = await getNews(slug);
  if (!news) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: news.title,
    description: news.excerpt || undefined,
    image: news.cover_url || undefined,
    datePublished: news.published_at || undefined,
    dateModified: news.updated_at || news.published_at || undefined,
  };

  return (
    <div className="min-h-screen bg-bg text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <ViewTracker table="football_news" id={news.id} />
      <PublicHeader active="/football" />

      <article className="max-w-4xl mx-auto px-5 md:px-8 py-10 animate-fade-in-up">
        <Breadcrumbs items={[{ label: "Football Center", href: "/football" }, { label: news.title }]} />
        <div className="flex items-center gap-2">
          {news.categories?.name && <span className="text-[12px] text-accent font-semibold">{news.categories.name}</span>}
          {news.league && <span className="text-[12px] text-[#5b6f85]">· {news.league}</span>}
        </div>
        <h1 className="text-[28px] md:text-[36px] font-extrabold mt-2 leading-tight">{news.title}</h1>
        <div className="flex items-center gap-4 mt-3 text-[12px] text-[#5b6f85]">
          {news.published_at && <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(news.published_at).toLocaleDateString()}</span>}
          <span className="flex items-center gap-1.5"><Eye size={13} /> {news.view_count ?? 0}</span>
        </div>

        {news.cover_url && <img src={news.cover_url} alt={news.title} className="w-full rounded-2xl mt-6 border border-white/10" />}

        <div className="mt-8">
          <RichTextRenderer html={news.content} />
        </div>
      </article>
      <PublicFooter />
    </div>
  );
}
