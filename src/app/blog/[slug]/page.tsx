"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import BlogArticleBody from "@/components/site/BlogArticleBody";
import SiteHeader from "@/components/site/SiteHeader";
import { Copy, Link2 } from "lucide-react";

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function sortPosts(posts: BlogPost[]) {
  return [...posts].sort((a, b) => {
    const aDate = new Date(a.publishDate || 0).getTime();
    const bDate = new Date(b.publishDate || 0).getTime();
    return bDate - aDate;
  });
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.48H15.2c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M18.9 2H22l-6.77 7.73L23.2 22h-6.25l-4.89-7.03L5.9 22H2.8l7.24-8.27L.8 2h6.4l4.42 6.37L18.9 2Zm-1.1 18h1.73L6.26 3.9H4.4L17.8 20Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.97 1.97 0 0 0 3.28 5c0 1.08.88 1.95 1.95 1.95h.02A1.96 1.96 0 1 0 5.25 3ZM20.44 12.66c0-3.36-1.79-4.92-4.18-4.92-1.93 0-2.8 1.06-3.28 1.81V8.5H9.6c.04.7 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.13-.92.27-.68.89-1.38 1.94-1.38 1.37 0 1.92 1.04 1.92 2.56V20H20.4l.04-7.34Z" />
    </svg>
  );
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "blogPosts"), orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: BlogPost[] = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BlogPost, "id">),
          }))
          .filter((post) => post.isPublished && post.slug);

        setPosts(sortPosts(rows));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading public blog article:", error);
        setPosts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const post = useMemo(() => {
    return posts.find((item) => item.slug === slug) || null;
  }, [posts, slug]);

  const facebookShare = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    : "#";

  const twitterShare = shareUrl
    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        shareUrl
      )}&text=${encodeURIComponent(post?.title || "")}`
    : "#";

  const linkedInShare = shareUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl
      )}`
    : "#";

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFeedback("Copied");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    } catch (error) {
      console.error("Could not copy link:", error);
      setCopyFeedback("Failed");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#06132d_0%,#040914_40%,#03070f_100%)] text-white">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-6 pb-20 pt-[150px] md:px-8">
          <div className="h-12 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="mt-4 h-6 w-1/3 animate-pulse rounded bg-white/5" />
          <div className="mt-8 h-[320px] animate-pulse rounded-[10px] bg-white/5" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#06132d_0%,#040914_40%,#03070f_100%)] text-white">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-6 pb-20 pt-[150px] md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200/70">
            FRDA Blog
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Article not found</h1>
          <p className="mt-4 text-base leading-8 text-zinc-300">
            This article may have been removed or is not yet published.
          </p>
          <Link
            href="/blog"
            className="mt-6 inline-flex text-sm font-medium text-blue-300 underline underline-offset-4 transition hover:text-blue-200"
          >
            Back to blog
          </Link>
        </div>
      </div>
    );
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

            <div className="flex items-center gap-3">
              <a
                href={facebookShare}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                title="Share on Facebook"
                className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white"
              >
                <FacebookIcon />
              </a>

              <a
                href={twitterShare}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                title="Share on X"
                className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white"
              >
                <XIcon />
              </a>

              <a
                href={linkedInShare}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on LinkedIn"
                title="Share on LinkedIn"
                className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white"
              >
                <LinkedInIcon />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy article link"
                title={copyFeedback || "Copy article link"}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center text-white/85 transition hover:text-white"
              >
                {copyFeedback === "Copied" ? (
                  <Copy className="h-4 w-4" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </button>
            </div>
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