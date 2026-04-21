"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error("Error loading public blog posts:", error);
        setPosts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const featuredPost = useMemo(() => posts[0] || null, [posts]);
  const remainingPosts = useMemo(() => posts.slice(1), [posts]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#06132d_0%,#040914_40%,#03070f_100%)] text-white">
      <SiteHeader />

      <section className="relative overflow-hidden px-6 pb-16 pt-[140px] md:px-8 md:pb-20 md:pt-[170px]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(113,92,255,0.10),transparent_30%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(54,189,248,0.08),transparent_20%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(236,72,153,0.06),transparent_22%)]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
            FRDA Blog
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.12] text-white md:text-[46px]">
            News, updates, and perspectives from FRDA
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300">
            Follow FRDA updates, community developments, public statements, and
            relevant issues affecting Filipino Roblox developers.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20 md:px-8 md:pb-28">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-[360px] animate-pulse rounded-[10px] bg-white/5" />
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded bg-white/5" />
                <div className="h-6 animate-pulse rounded bg-white/5" />
                <div className="h-24 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[10px] border border-white/10 bg-[#08111d]/80 p-8">
              <h2 className="text-2xl font-semibold text-white">No articles yet</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Blog posts will appear here once published from the portal.
              </p>
            </div>
          ) : (
            <>
              {featuredPost ? (
                <article className="mb-12 overflow-hidden rounded-[10px] border border-white/8 bg-[#08111d]/85">
                  <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="overflow-hidden bg-[#0b1422]">
                      {featuredPost.featuredImageUrl ? (
                        <img
                          src={featuredPost.featuredImageUrl}
                          alt={featuredPost.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex min-h-[280px] h-full items-center justify-center text-zinc-500">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-6 md:p-8">
                      <div className="flex flex-wrap items-center gap-2">
                        {featuredPost.category ? (
                          <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-blue-200">
                            {featuredPost.category}
                          </span>
                        ) : null}

                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                          Latest
                        </span>
                      </div>

                      <Link
                        href={`/blog/${featuredPost.slug}`}
                        className="mt-5 block text-2xl font-semibold leading-tight text-white transition hover:text-blue-300 md:text-3xl"
                      >
                        {featuredPost.title}
                      </Link>

                      <p className="mt-3 text-sm text-zinc-400">
                        By {featuredPost.author} · {featuredPost.publishDate}
                      </p>

                      <p className="mt-5 text-sm leading-7 text-zinc-300 md:text-base md:leading-8">
                        {featuredPost.excerpt}
                      </p>

                      <Link
                        href={`/blog/${featuredPost.slug}`}
                        className="mt-6 inline-flex items-center rounded-[5px] border border-blue-400/30 bg-blue-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-blue-400"
                      >
                        Read Article
                      </Link>
                    </div>
                  </div>
                </article>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {remainingPosts.map((post) => (
                  <article
                    key={post.id}
                    className="overflow-hidden rounded-[10px] border border-white/8 bg-[#08111d]/85"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-[#0b1422]">
                      {post.featuredImageUrl ? (
                        <img
                          src={post.featuredImageUrl}
                          alt={post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.category ? (
                          <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-blue-200">
                            {post.category}
                          </span>
                        ) : null}
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="mt-4 block text-xl font-semibold leading-tight text-white transition hover:text-blue-300"
                      >
                        {post.title}
                      </Link>

                      <p className="mt-2 text-sm text-zinc-400">
                        By {post.author} · {post.publishDate}
                      </p>

                      <p className="mt-4 line-clamp-4 text-sm leading-7 text-zinc-300">
                        {post.excerpt}
                      </p>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="mt-5 inline-flex text-sm font-medium text-blue-300 underline underline-offset-4 transition hover:text-blue-200"
                      >
                        Read article
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}