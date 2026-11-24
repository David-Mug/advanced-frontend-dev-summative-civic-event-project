/**
 * My registrations (normal users).
 *   GET  /api/event-registrations/my-registrations  → rows with event title/date/location + status
 *   POST /api/event-registrations/cancel            → { event_id }
 * Event images are joined client-side from GET /api/events (metadata.image_url).
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: community members only.
  if (!CE.layout.boot('user')) return;

  const { ui, utils, components } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const $list = $('#registrations-list');
  let regs = [];
  let eventsById = new Map();
  let tab = utils.param('tab') || 'upcoming';

  function bucket(r) {
    if (r.status === 'cancelled') return 'cancelled';
    return new Date(r.ends_at || r.starts_at) < new Date() ? 'past' : 'upcoming';
  }

  function renderTabs() {
    $('#tabs [data-tab]').each(function () {
      const id = $(this).data('tab');
      const active = id === tab;
      const count = regs.filter((r) => bucket(r) === id).length;
      $(this).attr({ 'aria-selected': String(active), tabindex: active ? '0' : '-1' })
        .toggleClass('bg-brand-strong text-white', active)
        .toggleClass('border border-line bg-white text-ink hover:border-brand', !active)
        .html(`${id[0].toUpperCase() + id.slice(1)} <span class="rounded-full ${active ? 'bg-white/20' : 'bg-brand-light'} px-1.5 text-[0.7rem]">${count}</span>`);
    });
    $list.attr('aria-labelledby', 'tab-' + tab);
  }

  function card(r) {
    const e = eventsById.get(r.event_id) || { id: r.event_id, title: r.title, metadata: {} };
    const b = bucket(r);
    const badge = b === 'cancelled' ? '<span class="badge-gray">Cancelled</span>' : b === 'past' ? '<span class="badge-blue">Attended</span>' : `<span class="badge-green">${icon('check', 'h-3 w-3')} Registered</span>`;
    return `<article class="card flex flex-col overflow-hidden sm:flex-row" aria-labelledby="reg-${escape(r.id)}">
        <div class="sm:w-56 sm:shrink-0">${components.eventImage(Object.assign({}, e, { title: r.title }), 'aspect-[16/9] sm:aspect-auto sm:h-full')}</div>
        <div class="flex flex-1 flex-col p-5">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <h2 id="reg-${escape(r.id)}" class="font-heading text-lg font-bold"><a class="text-ink no-underline hover:text-brand-strong" href="${utils.page('event.html', { id: r.event_id })}">${escape(r.title)}</a></h2>
            ${badge}
          </div>
          <ul class="mt-3 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
            <li class="flex items-center gap-2">${icon('calendar', 'h-4 w-4 text-brand')}${escape(utils.formatDate(r.starts_at))}</li>
            <li class="flex items-center gap-2">${icon('clock', 'h-4 w-4 text-brand')}${escape(utils.formatTime(r.starts_at))} – ${escape(utils.formatTime(r.ends_at))}</li>
            <li class="flex items-center gap-2 sm:col-span-2">${icon('mapPin', 'h-4 w-4 text-brand')}${escape(r.location || 'To be announced')}</li>
          </ul>
          <p class="mt-3 text-xs text-ink-muted">${b === 'cancelled' ? 'Cancelled ' + escape(utils.timeAgo(r.updated_at)) : 'Registered ' + escape(utils.timeAgo(r.created_at))}</p>
          <div class="mt-auto flex flex-wrap gap-2 pt-4">
            <a class="btn-outline btn-sm" href="${utils.page('event.html', { id: r.event_id })}">${b === 'past' ? `${icon('star', 'h-4 w-4')} Leave feedback` : 'View event'}</a>
            ${b === 'upcoming' ? `<button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-cancel="${escape(r.event_id)}" data-title="${escape(r.title)}">${icon('xCircle', 'h-4 w-4')} Cancel registration</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function render() {
    renderTabs();
    const list = regs.filter((r) => bucket(r) === tab)
      .sort((a, b) => (tab === 'upcoming' ? 1 : -1) * (new Date(a.starts_at) - new Date(b.starts_at)));
    const empty = {
      upcoming: { title: 'No upcoming registrations', message: 'Find an event you are interested in and register in one click.', action: `<a href="${utils.page('events.html')}" class="btn-primary mt-4">Browse events</a>` },
      past: { title: 'No past events yet', message: 'Events you attended will appear here so you can leave feedback.' },
      cancelled: { title: 'No cancelled registrations', message: 'Registrations you cancel will be listed here.' },
    }[tab];
    $list.attr('aria-busy', 'false').html(list.length ? `<div class="space-y-4">${list.map(card).join('')}</div>` : ui.emptyState(Object.assign({ icon: 'ticket' }, empty)));
  }

  async function load() {
    $list.attr('aria-busy', 'true').html(`<div class="space-y-4">${ui.skeleton.cards(3, false)}</div>`);
    try {
      const [regsRes, eventsRes] = await Promise.all([CE.api.registrations.mine(), CE.api.events.list().catch(() => ({ data: [] }))]);
      regs = regsRes.data || [];
      eventsById = new Map((eventsRes.data || []).map((e) => [e.id, e]));
      render();
    } catch (err) {
      ui.errorState($list, err, load);
    }
  }

  // Keyboard support for the tab list (Left/Right/Home/End)
  $('#tabs').on('click', '[data-tab]', function () { tab = $(this).data('tab'); render(); });
  $('#tabs').on('keydown', '[data-tab]', function (e) {
    const tabs = $('#tabs [data-tab]').toArray();
    let i = tabs.indexOf(this);
    if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = tabs.length - 1;
    else return;
    e.preventDefault();
    tab = $(tabs[i]).data('tab');
    render();
    tabs[i].focus();
  });

  $list.on('click', '[data-cancel]', async function () {
    const $btn = $(this);
    const ok = await ui.confirm({
      title: 'Cancel registration?',
      message: `You will no longer be registered for “${$btn.data('title')}”. The API does not allow registering again for the same event afterwards.`,
      confirmText: 'Cancel registration',
      danger: true,
    });
    if (!ok) return;
    ui.setLoading($btn, true, 'Cancelling…');
    try {
      await CE.api.registrations.cancel(String($btn.data('cancel')));
      ui.toast('success', `Your registration for “${$btn.data('title')}” was cancelled.`, 'Registration cancelled');
      load();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  });

  load();
})(window.CE, window.jQuery);
