"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";

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

type BlogShareButtonsProps = {
  title: string;
};

export default function BlogShareButtons({ title }: BlogShareButtonsProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  const facebookShare = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    : "#";

  const twitterShare = shareUrl
    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`
    : "#";

  const linkedInShare = shareUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
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

  return (
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
  );
}