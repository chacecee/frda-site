"use client";

import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type BlogArticleBodyProps = {
  body: string;
};

function looksLikeHtml(value: string) {
  const trimmed = value.trim();

  return (
    /<\/?[a-z][\s\S]*>/i.test(trimmed) ||
    trimmed.includes("&lt;p&gt;") ||
    trimmed.includes("&lt;h2&gt;") ||
    trimmed.includes("&lt;ul&gt;") ||
    trimmed.includes("&lt;ol&gt;") ||
    trimmed.includes("&lt;blockquote&gt;")
  );
}

function decodeEscapedHtml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");
}

function BlogHtmlStyles() {
  return (
    <style jsx global>{`
      .blog-html-body p {
        margin-bottom: 1.5rem;
        font-size: 1rem;
        line-height: 2rem;
        color: #d4d4d8;
      }

      .blog-html-body h2 {
        margin: 2.5rem 0 1rem;
        font-size: 1.875rem;
        font-weight: 700;
        line-height: 1.2;
        color: #ffffff;
      }

      .blog-html-body h3 {
        margin: 2rem 0 1rem;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.25;
        color: #ffffff;
      }

      .blog-html-body strong,
      .blog-html-body b {
        font-weight: 700;
        color: #ffffff;
      }

      .blog-html-body em,
      .blog-html-body i {
        font-style: italic;
        color: #e4e4e7;
      }

      .blog-html-body u {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .blog-html-body a {
        color: #93c5fd;
        text-decoration: underline;
        text-underline-offset: 4px;
        transition: color 150ms ease;
      }

      .blog-html-body a:hover {
        color: #bfdbfe;
      }

      .blog-html-body ul {
        margin: 0 0 1.5rem 1.5rem;
        list-style: disc;
        color: #d4d4d8;
      }

      .blog-html-body ol {
        margin: 0 0 1.5rem 1.5rem;
        list-style: decimal;
        color: #d4d4d8;
      }

      .blog-html-body li {
        margin-bottom: 0.5rem;
        line-height: 2rem;
      }

      .blog-html-body blockquote {
        margin-bottom: 1.5rem;
        border-left: 4px solid #60a5fa;
        padding-left: 1rem;
        color: #d4d4d8;
      }

      .blog-html-body hr {
        margin: 2rem 0;
        border: 0;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
    `}</style>
  );
}

export default function BlogArticleBody({ body }: BlogArticleBodyProps) {
  if (looksLikeHtml(body)) {
    const htmlToRender = body.includes("&lt;") ? decodeEscapedHtml(body) : body;

    const safeHtml = DOMPurify.sanitize(htmlToRender, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "h2",
        "h3",
        "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });

    return (
      <>
        <BlogHtmlStyles />
        <div
          className="blog-html-body max-w-none text-zinc-300"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </>
    );
  }

  return (
    <div className="max-w-none text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-10 mb-4 text-4xl font-semibold leading-tight text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 mb-4 text-3xl font-semibold leading-tight text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 mb-4 text-2xl font-semibold leading-tight text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-6 whitespace-pre-line text-base leading-8 text-zinc-300">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-200">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 underline underline-offset-4 transition hover:text-blue-200"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-6 ml-6 list-disc space-y-2 text-base leading-8 text-zinc-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-6 ml-6 list-decimal space-y-2 text-base leading-8 text-zinc-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-6 border-l-4 border-blue-400 pl-4 text-base leading-8 text-zinc-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-white/10" />,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}