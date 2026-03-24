export type DocPaperSlug = 'opengrc' | 'controls';

export type DocSection = {
  id: string;
  title: string;
  /** Markdown body (no leading #/## — title is added for display & copy). */
  body: string;
};

export type DocPaper = {
  slug: DocPaperSlug;
  title: string;
  /** Short subtitle shown under the title */
  subtitle: string;
  /** Optional front matter as markdown (executive summary, no H1) */
  preamble: string;
  sections: DocSection[];
};
