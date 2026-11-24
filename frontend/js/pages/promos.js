/**
 * Promo gallery (GET /api/promos). Users see published promos only.
 * Thumbnails are lazy-loaded video frames (metadata only).
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user.
  if (!CE.layout.boot(null)) return;

  const { ui, utils, components } = CE;
  const isAdmin = CE.auth.isAdmin();
  const PAGE_SIZE = CE.config.PAGE_SIZE;
  const $grid = $('#promos-grid');
  let items = [];
  let page = 1;

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const list = items.filter((p) => !q || `${p.title} ${p.description || ''}`.toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#results-count').text(q ? `${utils.plural(list.length, 'promo')} match “${$('#q').val().trim()}”` : utils.plural(list.length, 'promo'));
    $grid.attr('aria-busy', 'false').html(slice.length
      ? slice.map((p) => components.promoCard(p, { isAdmin })).join('')
      : `<div class="sm:col-span-2 lg:col-span-3">${ui.emptyState({ icon: 'film', title: q ? 'No matching promos' : 'No promos yet', message: q ? 'Try a different search term.' : 'Community videos will appear here once published.' })}</div>`);
    CE.media.lazyThumbnails($grid);
    ui.pagination($('#pagination'), page, pages, (p) => { page = p; render(); $grid.find('h3 a').first().trigger('focus'); });
  }

  async function load() {
    $grid.attr('aria-busy', 'true').html(ui.skeleton.cards(6));
    try {
      const res = await CE.api.promos.list();
      items = (res.data || []).filter((p) => isAdmin || p.published);
      render();
    } catch (err) {
      ui.errorState($grid, err, load);
    }
  }

  $('#q').on('input', utils.debounce(() => { page = 1; render(); }, 200));
  load();
})(window.CE, window.jQuery);
