export const sectionIcons: Record<string, string> = {
  'featured': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />',
  'toolkit': '<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />',
  'experience': '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
  'writing': '<path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M14 6l4 4" />',
};

// One small line-icon per topic, reusing the pillar glyphs from the hero so a
// post reads in the same visual language across the feed cards and the post
// pages. Shared so the feed and the in-post series rail never drift.
export const topicIcons: Record<string, string> = {
  cloud:
    '<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4 4 0 0 0 7 19h10.5Z"/>',
  systems:
    '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.4 6.5 16M12 7.4 17.5 16M7 18h10"/>',
  ai:
    '<path d="M12 3l1.8 4.9L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.1L12 3Z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/>',
  // career — a rising trend line into an arrowhead (growth, the climb)
  career:
    '<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
};
