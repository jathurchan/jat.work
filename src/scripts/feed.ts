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

  // Precompute a lowercase haystack per card (title + blurb + tags) so search
  // stays cheap on every keystroke.
  const haystacks = new WeakMap<HTMLElement, string>();
  cards.forEach((card) => {
    const title = card.querySelector('.lab-card-title')?.textContent ?? '';
    const blurb = card.querySelector('.lab-card-blurb')?.textContent ?? '';
    haystacks.set(card, `${title} ${blurb} ${card.dataset.tags ?? ''}`.toLowerCase());
  });

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
    let matched = 0;
    cards.forEach((card) => {
      if (!matches(card)) {
        card.style.display = 'none';
        return;
      }
      matched++;
      const visible = matched <= shown;
      card.style.display = visible ? '' : 'none';
      if (visible && animate) {
        card.style.opacity = '0';
        requestAnimationFrame(() => {
          card.style.transition = 'opacity .35s ease';
          card.style.opacity = '1';
        });
      }
    });

    if (count) count.textContent = `${matched} ${matched === 1 ? 'post' : 'posts'}`;
    if (noResults) noResults.hidden = matched > 0;

    if (moreBtn) {
      const remaining = Math.max(0, matched - shown);
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
