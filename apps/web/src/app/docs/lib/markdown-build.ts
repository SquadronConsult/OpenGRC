import type { DocPaper } from '../papers/types';

/** Full document as a single Markdown string (for copy / export). */
export function buildFullPaperMarkdown(paper: DocPaper): string {
  const lines: string[] = [`# ${paper.title}`, ''];

  if (paper.subtitle.trim()) {
    lines.push(`_${paper.subtitle}_`, '');
  }

  lines.push(paper.preamble.trim(), '');

  for (const s of paper.sections) {
    lines.push(`## ${s.title}`, '', s.body.trim(), '');
  }

  return lines.join('\n').trim();
}

/** One section for copy (includes ## title). */
export function buildSectionMarkdown(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}`;
}
