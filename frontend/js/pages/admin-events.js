/**
 * Events management table (admin).
 *   GET    /api/events                                 (all events, incl. unpublished)
 *   GET    /api/event-registrations/event/:id/attendees (registrants modal)
 *   DELETE /api/events/:id
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils, components } = CE;
  const { escape, page } = utils;
  const icon = CE.icon;
  const PAGE_SIZE = 10;
  const $host = $('#table-host');
  let events = [];
  let current = 1;

  const columns = [
    {
      label: 'Event',
      render: (e) => `<div class="flex items-center gap-3">
          <div class="h-11 w-16 shrink-0 overflow-hidden rounded-lg">${components.eventImage(e, 'h-11 w-16')}</div>
          <a href="${page('event.html', { id: e.id })}" class="font-semibold text-ink no-underline hover:text-brand-strong">${escape(e.title)}</a>
        </div>`,
    },
    { label: 'Starts', render: (e) => `<span class="whitespace-nowrap">${escape(utils.formatDateTime(e.starts_at))}</span>` },
    { label: 'Location', render: (e) => `<span class="line-clamp-2 max-w-[14rem]">${escape(e.location || '—')}</span>` },
    { label: 'Timing', render: (e) => ui.eventTimingBadge(e) },
    { label: 'Status', render: (e) => ui.statusBadge(e.published) },
  ];

  const actions = (e) => `
    <button type="button" class="btn-ghost btn-sm" data-attendees="${escape(e.id)}" data-title="${escape(e.title)}" aria-label="View registrants for ${escape(e.title)}">${icon('users', 'h-4 w-4')}<span class="md:sr-only">Registrants</span></button>
    <a href="${page('event-form.html', { id: e.id })}" class="btn-ghost btn-sm" aria-label="Edit ${escape(e.title)}">${icon('edit', 'h-4 w-4')}<span class="md:sr-only">Edit</span></a>
    <button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-delete-event="${escape(e.id)}" data-title="${escape(e.title)}" aria-label="Delete ${escape(e.title)}">${icon('trash', 'h-4 w-4')}<span class="md:sr-only">Delete</span></button>`;

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const when = $('#when').val();
    const list = events.filter((e) => (!q || `${e.title} ${e.location || ''}`.toLowerCase().includes(q))
      && (when === 'all' || utils.eventStatus(e) === when));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    current = Math.min(current, pages);
    const slice = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    $('#results-count').text(`${utils.plural(list.length, 'event')}${q || when !== 'all' ? ' match your filters' : ' in total'}`);
    $host.html(slice.length
      ? ui.dataTable(columns, slice, { caption: 'Events', actions })
      : `<div class="p-6">${ui.emptyState({ icon: 'calendar', title: events.length ? 'No matching events' : 'No events yet', message: events.length ? 'Try another search or timing filter.' : 'Create your first civic event.', action: events.length ? '' : `<a class="btn-primary mt-4" href="${page('event-form.html')}">Create event</a>`, className: 'border-0' })}</div>`);
    ui.pagination($('#pagination'), current, pages, (p) => { current = p; render(); });
  }

  async function load() {
    $host.html(ui.tableSkeleton(5));
    try {
      const res = await CE.api.events.list();
      events = (res.data || []).slice().sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      render();
    } catch (err) {
      ui.errorState($host, err, load);
    }
  }

  // Registrants modal
  $host.on('click', '[data-attendees]', async function () {
    const title = $(this).data('title');
    const m = ui.modal({ title: `Registrants · ${title}`, body: ui.skeleton.lines(5), size: 'lg', footer: '<button type="button" class="btn-primary" data-close>Close</button>' });
    try {
      const res = await CE.api.registrations.attendees(String($(this).data('attendees')));
      const list = res.data || [];
      m.$panel.find('[data-body]').html(list.length
        ? `<p class="mb-3 text-sm text-ink-soft">${utils.plural(list.length, 'resident')} registered.</p>
           <div class="table-wrap rounded-xl border border-line"><table class="table !min-w-0"><caption class="sr-only">Registrants</caption>
             <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Registered</th></tr></thead>
             <tbody>${list.map((a) => `<tr><td class="font-semibold">${escape(a.full_name)}</td><td class="break-all">${escape(a.email)}</td><td class="whitespace-nowrap text-ink-soft">${escape(utils.formatDate(a.created_at))}</td></tr>`).join('')}</tbody></table></div>`
        : ui.emptyState({ icon: 'users', title: 'No registrants yet', message: 'Residents who register will be listed here.', className: 'border-0 py-6' }));
    } catch (err) {
      ui.errorState(m.$panel.find('[data-body]'), err);
    }
  });

  components.bindEventActions($host, () => { CE.api.clearCache(); load(); });
  $('#q').on('input', utils.debounce(() => { current = 1; render(); }, 200));
  $('#when').on('change', () => { current = 1; render(); });
  load();
})(window.CE, window.jQuery);
