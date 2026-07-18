"use client";

import React, { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Link as LinkIcon,
  Image as ImageIcon, Undo, Redo, Heading2, Heading3, Loader2,
} from "lucide-react";
import { uploadImage } from "@/lib/media/upload";
import { sanitizeRichText } from "@/lib/editor/sanitize";

function ToolbarButton({
  onClick, active, disabled, children, label,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? "bg-accent/20 text-accent" : "text-muted hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [uploadingImage, setUploadingImage] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Image,
      Placeholder.configure({ placeholder: "Matnni shu yerga yozing…" }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(sanitizeRichText(editor.getHTML())),
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[220px] px-4 py-3",
      },
    },
  });

  const insertImage = useCallback(async (file: File) => {
    if (!editor) return;
    setUploadingImage(true);
    try {
      const media = await uploadImage(file);
      editor.chain().focus().setImage({ src: media.publicUrl }).run();
    } catch {
      // Upload failures are surfaced by uploadImage's own error handling
      // elsewhere in the form; the editor simply doesn't insert anything.
    } finally {
      setUploadingImage(false);
    }
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Havola URL manzili:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div className="rounded-lg border border-white/10 bg-white/5 h-64 animate-pulse" />;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 px-2 py-1.5 bg-black/20">
        <ToolbarButton label="Qalin" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
        <ToolbarButton label="Kursiv" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
        <ToolbarButton label="Chizilgan" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolbarButton>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolbarButton label="Sarlavha 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolbarButton>
        <ToolbarButton label="Sarlavha 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolbarButton>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolbarButton label="Ro'yxat" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
        <ToolbarButton label="Raqamli ro'yxat" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
        <ToolbarButton label="Iqtibos" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></ToolbarButton>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolbarButton label="Havola" active={editor.isActive("link")} onClick={setLink}><LinkIcon size={14} /></ToolbarButton>
        <label className="p-1.5 rounded-md text-muted hover:bg-white/10 hover:text-white cursor-pointer" title="Rasm qo'shish">
          {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingImage}
            onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])} />
        </label>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolbarButton label="Bekor qilish" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo size={14} /></ToolbarButton>
        <ToolbarButton label="Qaytarish" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo size={14} /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
