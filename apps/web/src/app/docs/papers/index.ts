import type { DocPaper, DocPaperSlug } from './types';
import { openGrcPaper } from './opengrc-paper';
import { controlsPaper } from './controls-paper';

export type { DocPaper, DocPaperSlug, DocSection } from './types';

export const papers: DocPaper[] = [openGrcPaper, controlsPaper];

export const paperBySlug: Record<DocPaperSlug, DocPaper> = {
  opengrc: openGrcPaper,
  controls: controlsPaper,
};

export function getPaper(slug: string | null | undefined): DocPaper {
  if (slug === 'controls') return controlsPaper;
  return openGrcPaper;
}
