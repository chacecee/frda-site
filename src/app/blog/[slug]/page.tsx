import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import BlogArticleBody from "@/components/site/BlogArticleBody";
import BlogShareButtons from "@/components/site/BlogShareButtons";
import SiteHeader from "@/components/site/SiteHeader";

type BlogPost = {
    id: string;
    title: string;
    slug: string;
    category?: string;
    author: string;
    publishDate: string;
    excerpt: string;
    featuredImageUrl?: string;
    featuredImageCaption?: string;
    body: string;
    isPublished: boolean;
    showOnHomepage: boolean;
};

const SITE_URL = "https://frdaph.org";

async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const snapshot = await adminDb
        .collection("blogPosts")
        .where("slug", "==", slug)
        .where("isPublished", "==", true)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    return {
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlogPost, "id">),
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPublishedBlogPostBySlug(slug);

    if (!post) {
        return {
            title: "Article not found",
            description: "This article may have been removed or is not yet published.",
        };
    }

    const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
    const title = `${post.title} | FRDA Blog`;
    const description = post.excerpt || "Read the latest updates from FRDA.";
    const imageUrl = post.featuredImageUrl || `${SITE_URL}/frda-logo.png`;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            type: "article",
            url: canonicalUrl,
            title,
            description,
            siteName: "FRDA",
            images: [
                {
                    url: imageUrl,
                    alt: post.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
        other: {
            "article:published_time": post.publishDate,
            "article:author": post.author,
        },
    };
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPublishedBlogPostBySlug(slug);

    if (!post) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#06132d_0%,#040914_40%,#03070f_100%)] text-white">
            <SiteHeader />

            <article className="mx-auto max-w-5xl px-6 pb-20 pt-[150px] md:px-8">
                <Link
                    href="/blog"
                    className="text-sm font-medium text-blue-300 underline underline-offset-4 transition hover:text-blue-200"
                >
                    ← Back to blog
                </Link>

                <header className="mt-8">
                    <div className="flex flex-wrap items-center gap-2">
                        {post.category ? (
                            <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-blue-200">
                                {post.category}
                            </span>
                        ) : null}
                    </div>

                    <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">
                        {post.title}
                    </h1>

                    <div className="mt-6 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-zinc-400 md:text-base">
                            By {post.author} · {post.publishDate}
                        </p>

                        <BlogShareButtons title={post.title} />
                    </div>
                </header>

                {post.featuredImageUrl ? (
                    <figure className="mt-10">
                        <div className="overflow-hidden rounded-[10px] border border-white/8 bg-[#0b1422]">
                            <img
                                src={post.featuredImageUrl}
                                alt={post.title}
                                className="h-full w-full object-cover"
                            />
                        </div>

                        {post.featuredImageCaption ? (
                            <figcaption className="mt-3 text-sm leading-6 text-zinc-500">
                                {post.featuredImageCaption}
                            </figcaption>
                        ) : null}
                    </figure>
                ) : null}

                <div className="mt-12">
                    <BlogArticleBody body={post.body} />
                </div>
            </article>
        </div>
    );
}