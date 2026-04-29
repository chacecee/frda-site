"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

type RichTextEditorProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

function ToolbarButton({
    active,
    disabled,
    onClick,
    children,
    title,
}: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
}) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex min-h-9 items-center justify-center rounded-[5px] border px-3 py-2 text-sm font-semibold transition ${active
                    ? "border-blue-400/50 bg-blue-500/20 text-blue-100"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900 hover:text-white"
                } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
        >
            {children}
        </button>
    );
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = "Write the article body here...",
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3],
                },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                HTMLAttributes: {
                    rel: "noopener noreferrer",
                    target: "_blank",
                },
            }),
        ],
        content: value || "",
        editorProps: {
            attributes: {
                class:
                    "min-h-[360px] rounded-b-[8px] border-x border-b border-zinc-700 bg-zinc-950/60 px-4 py-4 text-sm leading-7 text-zinc-100 outline-none prose-editor",
            },
        },
        onUpdate({ editor }) {
            onChange(editor.getHTML());
        },
        immediatelyRender: false,
    });

    useEffect(() => {
        if (!editor) return;

        const currentHtml = editor.getHTML();
        const nextHtml = value || "";

        if (currentHtml !== nextHtml) {
            editor.commands.setContent(nextHtml, { emitUpdate: false });
        }
    }, [editor, value]);

    function setLink() {
        if (!editor) return;

        const previousUrl = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Enter the link URL:", previousUrl || "https://");

        if (url === null) return;

        const trimmedUrl = url.trim();

        if (!trimmedUrl) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: trimmedUrl })
            .run();
    }

    if (!editor) {
        return (
            <div
                className="min-h-[360px] border border-zinc-700 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-500"
                style={{ borderRadius: 8 }}
            >
                Loading editor...
            </div>
        );
    }

    return (
        <div>
            <div
                className="flex flex-wrap gap-2 border border-zinc-700 bg-zinc-900/80 p-3"
                style={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
            >
                <ToolbarButton
                    title="Bold"
                    active={editor.isActive("bold")}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    B
                </ToolbarButton>

                <ToolbarButton
                    title="Italic"
                    active={editor.isActive("italic")}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <span className="italic">I</span>
                </ToolbarButton>

                <ToolbarButton
                    title="Underline"
                    active={editor.isActive("underline")}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                    <span className="underline">U</span>
                </ToolbarButton>

                <ToolbarButton
                    title="Add or edit link"
                    active={editor.isActive("link")}
                    onClick={setLink}
                >
                    Link
                </ToolbarButton>

                <ToolbarButton
                    title="Remove link"
                    disabled={!editor.isActive("link")}
                    onClick={() => editor.chain().focus().unsetLink().run()}
                >
                    Unlink
                </ToolbarButton>

                <ToolbarButton
                    title="Bullet list"
                    active={editor.isActive("bulletList")}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    • List
                </ToolbarButton>

                <ToolbarButton
                    title="Numbered list"
                    active={editor.isActive("orderedList")}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    1. List
                </ToolbarButton>

                <ToolbarButton
                    title="Quote"
                    active={editor.isActive("blockquote")}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    Quote
                </ToolbarButton>

                <ToolbarButton
                    title="Heading"
                    active={editor.isActive("heading", { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    H2
                </ToolbarButton>

                <ToolbarButton
                    title="Subheading"
                    active={editor.isActive("heading", { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    H3
                </ToolbarButton>

                <ToolbarButton
                    title="Undo"
                    disabled={!editor.can().undo()}
                    onClick={() => editor.chain().focus().undo().run()}
                >
                    Undo
                </ToolbarButton>

                <ToolbarButton
                    title="Redo"
                    disabled={!editor.can().redo()}
                    onClick={() => editor.chain().focus().redo().run()}
                >
                    Redo
                </ToolbarButton>
            </div>

            <div className="relative">
                <EditorContent editor={editor} />

                {!editor.getText().trim() ? (
                    <p className="pointer-events-none absolute left-4 top-4 text-sm text-zinc-600">
                        {placeholder}
                    </p>
                ) : null}
            </div>

            <style jsx global>{`
        .prose-editor p {
          margin: 0 0 1rem;
        }

        .prose-editor h2 {
          margin: 1.5rem 0 0.75rem;
          font-size: 1.45rem;
          font-weight: 700;
          color: #ffffff;
        }

        .prose-editor h3 {
          margin: 1.25rem 0 0.65rem;
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff;
        }

        .prose-editor ul {
          margin: 0 0 1rem 1.4rem;
          list-style: disc;
        }

        .prose-editor ol {
          margin: 0 0 1rem 1.4rem;
          list-style: decimal;
        }

        .prose-editor blockquote {
          margin: 1rem 0;
          border-left: 4px solid rgba(96, 165, 250, 0.8);
          padding-left: 1rem;
          color: #d4d4d8;
        }

        .prose-editor a {
          color: #93c5fd;
          text-decoration: underline;
          text-underline-offset: 4px;
        }
      `}</style>
        </div>
    );
}