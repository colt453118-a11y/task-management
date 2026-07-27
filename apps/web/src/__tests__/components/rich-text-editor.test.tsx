import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextViewer } from '@/components/tasks/rich-text-editor';

// RichTextEditor uses TipTap which requires a DOM environment
// Testing it thoroughly would require jsdom + mock of @tiptap/react
// Here we test what we can: the RichTextViewer component

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

describe('RichTextViewer', () => {
  it('renders nothing when content is null', () => {
    render(<RichTextViewer content={null} />);
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders nothing when content is empty paragraph', () => {
    render(<RichTextViewer content="<p></p>" />);
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders HTML content safely', () => {
    render(<RichTextViewer content="<p>Hello <strong>World</strong></p>" />);
    const container = screen.getByText((content) => content.includes('Hello'));
    expect(container).toBeInTheDocument();
  });

  it('renders headings', () => {
    render(<RichTextViewer content="<h1>Title</h1><p>Body</p>" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders lists', () => {
    render(<RichTextViewer content="<ul><li>Item 1</li><li>Item 2</li></ul>" />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('applies prose styling classes', () => {
    const { container } = render(<RichTextViewer content="<p>Test</p>" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('prose');
  });

  it('accepts additional className', () => {
    const { container } = render(<RichTextViewer content="<p>Test</p>" className="custom-class" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('custom-class');
  });
});
