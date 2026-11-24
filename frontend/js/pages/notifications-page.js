/**
 * Notifications inbox (GET /api/notifications) with type/unread filters,
 * detail view (GET /api/notifications/:id) and local read tracking.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user.
  if (!CE.layout.boot(null)) return;

  const { ui, utils } = CE;
  const N = CE.notifications;
  const PAGE_SIZE = 12;
  const $list = $('#notifications-list');
  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'event', label: 'Events' },
    { id: 'announcement', label: 'Announcements' },
    { id: 'promo', label: 'Promos' },
    { id: 'system', label: 'System' },
  ];
  let items = [];
  let filter = 'all';
  let page = 1;

  function renderFilters() {
    $('#filters').html(FILTERS.map((f) => {
      const count = f.id === 'all' ? items.length : f.id === 'unread' ? items.filter(N.isUnread).length : items.filter((n) => n.type === f.id).length;
      const active = f.id === filter;
      return `<button type="button" class="btn btn-sm ${active ? 'bg-brand-strong text-white' : 'border border-line bg-white text-ink hover:border-brand'}" data-filter="${f.id}" aria-pressed="${active}">${f.label}<span class="rounded-full ${active ? 'bg-white/20' : 'bg-brand-light'} px-1.5 text-[0.7rem]">${count}</span></button>`;
    }).join(''));
  }

  function render() {
    renderFilters();
    const list = items.filter((n) => (filter === 'all' ? true : filter === 'unread' ? N.isUnread(n) : n.type === filter));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $list.attr('aria-busy', 'false').html(slice.length
      ? `<ul class="divide-y divide-line">${slice.map((n) => N.itemHtml(n, { full: true, actions: `<button type="button" class="btn-ghost btn-sm" data-details="${utils.escape(n.id)}">Details<span class="sr-only"> for ${utils.escape(n.title)}</span></button>` })).join('')}</ul>`
      : ui.emptyState({ icon: 'bell', title: filter === 'unread' ? 'No unread notifications' : 'Nothing here yet', message: filter === 'unread' ? 'You are all caught up.' : 'Notifications about new events, announcements and promos will appear here.', className: 'border-0' }));
    ui.pagination($('#pagination'), page, pages, (p) => { page = p; render(); });
  }

  async function load(force) {
    $list.attr('aria-busy', 'true').html(`<div class="p-3">${ui.skeleton.lines(8)}</div>`);
    try {
      items = await N.load(force);
      render();
    } catch (err) {
      ui.errorState($list, err, () => load(true));
    }
  }

  async function showDetails(id) {
    const m = ui.modal({ title: 'Notification', body: ui.skeleton.lines(4), footer: '<button type="button" class="btn-primary" data-close>Close</button>' });
    try {
      const res = await CE.api.notifications.get(id);
      const n = res.data;
      const meta = N.typeMeta(n.type);
      const link = N.linkFor(n);
      m.$panel.find('[data-body]').html(`
        <div class="flex items-start gap-4">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.cls}">${CE.icon(meta.icon, 'h-6 w-6')}</span>
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-muted">${utils.escape(meta.label)}</p>
            <h3 class="mt-1 font-heading text-lg font-bold">${utils.escape(n.title)}</h3>
            <p class="mt-2 text-sm leading-relaxed text-ink-soft">${utils.escape(n.message)}</p>
            <p class="mt-3 text-xs text-ink-muted">Sent ${utils.escape(utils.formatDateTime(n.created_at))} · ${n.recipient_id ? 'Sent to you directly' : 'Broadcast to everyone'}</p>
            ${link ? `<a href="${link.href}" class="btn-primary btn-sm mt-4">${utils.escape(link.label)} ${CE.icon('arrowRight', 'h-4 w-4')}</a>` : ''}
          </div>
        </div>`);
      N.markRead([n.id]);
      render();
    } catch (err) {
      m.$panel.find('[data-body]').html(`<p class="text-sm text-danger" role="alert">${utils.escape(err.message)}</p>`);
    }
  }

  $('#filters').on('click', '[data-filter]', function () { filter = $(this).data('filter'); page = 1; render(); });
  $list.on('click', '[data-details]', function () { showDetails(String($(this).data('details'))); });
  $list.on('click', '[data-open]', function () { N.markRead([String($(this).data('open'))]); });
  $('#mark-all').on('click', () => { N.markAllRead(); render(); ui.toast('success', 'All notifications marked as read.'); });
  $('#refresh').on('click', () => load(true));

  load(true);
})(window.CE, window.jQuery);
