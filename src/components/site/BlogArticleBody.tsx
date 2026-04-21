"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

type BlogArticleBodyProps = {
  body: string;
};

export default function BlogArticleBody({ body }: BlogArticleBodyProps) {
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