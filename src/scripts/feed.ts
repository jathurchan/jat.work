// Blog feed: client-side topic filter + free-text search + progressive
// "load more" pagination. Topic and search compose with AND.

export function initFilters() {
  const ftabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.ftab'));
  const grid = document.getElementById('jw-worklist');
  const cards = Array.from(document.querySelectorAll<HTMLElement>('#jw-worklist .lab-card'));
  const count = document.getElementById('jw-labcount');
  const moreBtn = document.getElementById('jw-loadmore') as HTMLButtonElement | null;
  const search = document.getElementById('jw-search') as HTMLInputElement | null;
  const noResults = document.getElementById('jw-noresults');
  if (cards.length === 0) return;

  const PAGE_SIZE = Number(grid?.dataset.pageSize) || 6;
  let filter = 'all';
  let query = '';
  let shown = PAGE_SIZE;

  // Precompute a lowercase haystack per card so search stays cheap on every
  // keystroke. Uses the card's whole text (so a series card matches any of its
  // listed part titles) plus its tags.
  const haystacks = new WeakMap<HTMLElement, string>();
  cards.forEach((card) => {
    haystacks.set(card, `${card.textContent ?? ''} ${card.dataset.tags ?? ''}`.toLowerCase());
  });
  // A card can stand for several posts (a series card lists N parts); count by
  // that so the "N posts" tally reflects articles, not cards.
  const postsIn = (card: HTMLElement) => Number(card.dataset.count) || 1;

  const tagsOf = (card: HTMLElement): string[] => {
    try {
      return JSON.parse(card.dataset.tags || '[]');
    } catch {
      return [];
    }
  };
  const matchesTopic = (card: HTMLElement) => filter === 'all' || tagsOf(card).includes(filter);
  const matchesQuery = (card: HTMLElement) =>
    query === '' || (haystacks.get(card) ?? '').includes(query);
  const matches = (card: HTMLElement) => matchesTopic(card) && matchesQuery(card);

  function render(animate = true) {
    let matchedCards = 0; // visible card slots (paginate by these)
    let matchedPosts = 0; // articles represented (series card counts its parts)
    cards.forEach((card) => {
      if (!matches(card)) {
        card.style.display = 'none';
        return;
      }
      matchedCards++;
      matchedPosts += postsIn(card);
      const visible = matchedCards <= shown;
      card.style.display = visible ? '' : 'none';
      if (visible && animate) {
        card.style.opacity = '0';
        requestAnimationFrame(() => {
          card.style.transition = 'opacity .35s ease';
          card.style.opacity = '1';
        });
      }
    });

    if (count) count.textContent = `${matchedPosts} ${matchedPosts === 1 ? 'post' : 'posts'}`;

    if (noResults) {
      noResults.hidden = matchedPosts > 0;
      if (matchedPosts === 0) {
        // Topic-aware, inviting empty state — an empty topic reads as "coming
        // soon", not "broken".
        const activeLabel = ftabs.find((t) => t.getAttribute('aria-pressed') === 'true')?.textContent?.trim();
        noResults.textContent = query
          ? `No posts match “${query}” — try another topic or clear the search.`
          : filter !== 'all' && activeLabel
            ? `No ${activeLabel} posts yet — they're on the way. Try another topic in the meantime.`
            : 'No posts yet — check back soon.';
      }
    }

    if (moreBtn) {
      const remaining = Math.max(0, matchedCards - shown);
      moreBtn.hidden = remaining <= 0;
      const label = moreBtn.querySelector('.lab-more-label');
      if (label) label.textContent = `Load more posts (${remaining})`;
    }
  }

  ftabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      filter = tab.dataset.filter || 'all';
      shown = PAGE_SIZE;
      ftabs.forEach((t) => t.setAttribute('aria-pressed', t === tab ? 'true' : 'false'));
      render();
    }),
  );

  search?.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    shown = PAGE_SIZE;
    render();
  });

  moreBtn?.addEventListener('click', () => {
    shown += PAGE_SIZE;
    render();
  });

  render(false); // initial paint, no fade
}
