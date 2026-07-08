'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
} from 'lucide-react';

// ─── Toolbar Button ──────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        isActive
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
          : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────

function ToolbarDivider() {
  return (
    <div className="mx-0.5 h-5 w-px bg-surface-200 dark:bg-surface-700" />
  );
}

// ─── Editor Component ────────────────────────────────────────

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write something...',
  className,
  minHeight = '150px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none min-h-[150px] px-4 py-3',
          'text-surface-900 dark:text-surface-100',
          '[&_:first-child]:mt-0',
          'prose-headings:text-surface-900 dark:prose-headings:text-surface-100',
          'prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3',
          'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
          'prose-p:my-1.5 prose-p:leading-relaxed',
          'prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-0.5',
          'prose-code:rounded prose-code:bg-surface-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal dark:prose-code:bg-surface-800',
          'prose-blockquote:border-l-brand-500 prose-blockquote:bg-brand-50/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r dark:prose-blockquote:bg-brand-950/20',
          '[&_p.is-editor-empty:first-child::before]:text-surface-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:h-0',
        ),
      },
    },
    immediatelyRender: false,
  });

  // Sync external content changes into the editor
  useEffect(() => {
    if (editor && content) {
      const currentHtml = editor.getHTML();
      if (content !== currentHtml) {
        editor.commands.setContent(content, false);
      }
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900',
          className,
        )}
        style={{ minHeight }}
      >
        <div className="flex items-center justify-center h-full text-sm text-surface-400">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900 overflow-hidden',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-surface-200 bg-surface-50/50 px-2 py-1.5 dark:border-surface-700 dark:bg-surface-800/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── Read-only Viewer ────────────────────────────────────────

interface RichTextViewerProps {
  content: string | null;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  if (!content || content === '<p></p>') {
    return (
      <p className={cn('text-sm text-surface-400 italic', className)}>
        No description provided.
      </p>
    );
  }

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none',
        'text-surface-700 dark:text-surface-300',
        'prose-headings:text-surface-900 dark:prose-headings:text-surface-100',
        'prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2',
        'prose-h1:text-lg prose-h2:text-base prose-h3:text-sm',
        'prose-p:my-1 prose-p:leading-relaxed',
        'prose-ul:my-1.5 prose-ol:my-1.5',
        'prose-li:my-0.5',
        'prose-code:rounded prose-code:bg-surface-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal dark:prose-code:bg-surface-800',
        'prose-blockquote:border-l-brand-500 prose-blockquote:bg-brand-50/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r dark:prose-blockquote:bg-brand-950/10',
        'prose-strong:text-surface-900 dark:prose-strong:text-surface-100',
        'prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  );
}
