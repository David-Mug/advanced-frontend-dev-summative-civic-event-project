/**
 * Notifications management (admin).
 *   GET    /api/notifications
 *   DELETE /api/notifications/:id
 * The backend has no create endpoint — broadcasts are generated automatically when
 * events, announcements and promos are created or published.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const N = CE.notifications;
  const PAGE_SIZE = 12;
  const $host = $('#table-host');
  let items = [];
  let current = 1;

  const columns = [
    {
      label: 'Notification',
      render: (n) => {
        const meta = N.typeMeta(n.type);
        return `<div class="flex items-start gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.cls}">${icon(meta.icon, 'h-4 w-4')}</span>
            <span class="min-w-0"><span class="block font-semibold">${escape(n.title)}</span><span class="line-clamp-2 block max-w-md text-xs text-ink-soft">${escape(n.message)}</span></span>
          </div>`;
      },
    },
    { label: 'Type', render: (n) => `<span class="badge-gray capitalize">${escape(n.type)}</span>` },
    { label: 'Audience', render: (n) => (n.recipient_id ? '<span class="badge-blue">Direct</span>' : `<span class="badge-yellow">${icon('globe', 'h-3 w-3')} Broadcast</span>`) },
    { label: 'Sent', render: (n) => `<time class="whitespace-nowrap" datetime="${escape(n.created_at)}" title="${escape(utils.formatDateTime(n.created_at))}">${escape(utils.timeAgo(n.created_at))}</time>` },
  ];

  const actions = (n) => {
    const link = N.linkFor(n);
    return `${link ? `<a href="${link.href}" class="btn-ghost btn-sm" aria-label="Open related item for ${escape(n.title)}">${icon('external', 'h-4 w-4')}<span class="md:sr-only">Open</span></a>` : ''}
      <button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-delete="${escape(n.id)}" aria-label="Delete notification ${escape(n.title)}">${icon('trash', 'h-4 w-4')}<span class="md:sr-only">Delete</span></button>`;
  };

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const type = $('#type-filter').val();
    const list = items.filter((n) => (!q || `${n.title} ${n.message}`.toLowerCase().includes(q)) && (type === 'all' || n.type === type));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    current = Math.min(current, pages);
    const slice = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    $('#results-count').text(utils.plural(list.length, 'notification'));
    $host.html(slice.length
      ? ui.dataTable(columns, slice, { caption: 'Notifications', actions })
      : `<div class="p-6">${ui.emptyState({ icon: 'bell', title: items.length ? 'No matching notifications' : 'No notifications yet', className: 'border-0' })}</div>`);
    ui.pagination($('#pagination'), current, pages, (p) => { current = p; render(); });
  }

  async function load(force) {
    $host.html(ui.tableSkeleton(4));
    try {
      items = await N.load(force);
      render();
    } catch (err) {
      ui.errorState($host, err, () => load(true));
    }
  }

  $host.on('click', '[data-delete]', async function () {
    const n = items.find((x) => x.id === String($(this).data('delete')));
    const ok = await ui.confirm({ title: 'Delete notification?', message: `“${n.title}” will be removed for every resident.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await CE.api.notifications.remove(n.id);
      ui.toast('success', 'Notification deleted.');
      load(true);
    } catch (err) {
      ui.toast('error', err.message);
    }
  });

  $('#refresh').on('click', () => load(true));
  $('#q').on('input', utils.debounce(() => { current = 1; render(); }, 200));
  $('#type-filter').on('change', () => { current = 1; render(); });
  load(true);
})(window.CE, window.jQuery);
