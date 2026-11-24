/**
 * Normal-user home dashboard.
 * Data: GET /dashboard/me, /events, /event-registrations/my-registrations, /announcements, /promos
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: community-member page; admins are redirected to the admin dashboard.
  if (!CE.layout.boot('user')) return;

  const { ui, components, utils } = CE;
  const user = CE.auth.getUser();

  $('#greeting').text(`Welcome back, ${user.full_name.split(' ')[0]}`);
  $('[data-today]').text(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));

  const $stats = $('#stats');
  const $mine = $('#my-upcoming');
  const $ann = $('#latest-announcements');
  const $upcoming = $('#upcoming-events');
  const $promos = $('#promos');

  function renderStats(stats) {
    const unread = CE.notifications.unreadCount();
    $stats.attr('aria-busy', 'false').html([
      components.statCard({ icon: 'ticket', label: 'Event registrations', value: utils.num(stats.registrations.total_registered_events), href: utils.page('registrations.html') }),
      components.statCard({ icon: 'star', label: 'Feedback given', value: utils.num(stats.feedbacks.total_feedbacks), tone: 'yellow' }),
      `<div data-unread-tile>${components.statCard({ icon: 'bell', label: 'Unread notifications', value: unread, href: utils.page('notifications.html') })}</div>`,
      components.statCard({ icon: 'megaphone', label: 'Announcements', value: utils.num(stats.announcements.total_announcements), href: utils.page('announcements.html'), tone: 'yellow' }),
    ].join(''));
  }

  // Keep the unread tile in sync with the bell as notifications load.
  $(document).on('ce:notifications', () => {
    $('[data-unread-tile]').html(components.statCard({ icon: 'bell', label: 'Unread notifications', value: CE.notifications.unreadCount(), href: utils.page('notifications.html') }));
  });

  async function load() {
    $stats.html(ui.skeleton.stats(4));
    $mine.html(ui.skeleton.lines(5));
    $ann.html(ui.skeleton.lines(5));
    $upcoming.html(ui.skeleton.cards(3));
    $promos.html(ui.skeleton.cards(3));

    const [statsR, eventsR, regsR, annR, promosR] = await Promise.allSettled([
      CE.api.dashboard.me(),
      CE.api.events.list(),
      CE.api.registrations.mine(),
      CE.api.announcements.list(),
      CE.api.promos.list(),
    ]);

    // Stats
    if (statsR.status === 'fulfilled') renderStats(statsR.value.data);
    else ui.errorState($stats, statsR.reason, load);

    // Events + registrations
    if (eventsR.status === 'fulfilled') {
      const events = (eventsR.value.data || []).filter((e) => e.published);
      const regs = regsR.status === 'fulfilled' ? regsR.value.data || [] : [];
      const regByEvent = new Map(regs.map((r) => [r.event_id, r]));
      const byId = new Map(events.map((e) => [e.id, e]));

      const mine = regs
        .filter((r) => r.status === 'registered' && new Date(r.ends_at || r.starts_at) >= new Date())
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
        .slice(0, 4);
      $mine.html(mine.length
        ? `<ul class="space-y-1">${mine.map((r) => components.eventRow(Object.assign({}, byId.get(r.event_id) || {}, r, { id: r.event_id }), `<span class="badge-green hidden sm:inline-flex">${CE.icon('check', 'h-3 w-3')} Going</span>`)).join('')}</ul>`
        : ui.emptyState({ icon: 'ticket', title: 'No upcoming registrations', message: 'Register for an event and it will show up here.', action: `<a href="${utils.page('events.html')}" class="btn-primary btn-sm mt-4">Browse events</a>`, className: 'border-0 py-8' }));

      const suggestions = events
        .filter((e) => utils.eventStatus(e) !== 'past' && !(regByEvent.get(e.id) && regByEvent.get(e.id).status === 'registered'))
        .slice(0, 3);
      $upcoming.attr('aria-busy', 'false').html(suggestions.length
        ? suggestions.map((e) => components.eventCard(e, { registration: regByEvent.get(e.id) })).join('')
        : `<div class="sm:col-span-2 lg:col-span-3">${ui.emptyState({ icon: 'calendar', title: 'You are all caught up', message: 'There are no other upcoming events right now. Check back soon.' })}</div>`);
    } else {
      ui.errorState($mine, eventsR.reason, load);
      ui.errorState($upcoming, eventsR.reason, load);
    }

    // Announcements
    if (annR.status === 'fulfilled') {
      const list = (annR.value.data || []).filter((a) => a.published).slice(0, 4);
      $ann.html(list.length
        ? `<ul class="space-y-1">${list.map((a) => `<li><a href="${utils.page('announcement.html', { id: a.id })}" class="flex items-center gap-3 rounded-xl p-2.5 text-ink no-underline transition hover:bg-brand-light/60">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">${CE.icon('play', 'h-4 w-4')}</span>
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">${utils.escape(a.title)}</span><span class="text-xs text-ink-muted">${utils.escape(utils.timeAgo(a.created_at))}</span></span>
            </a></li>`).join('')}</ul>`
        : ui.emptyState({ icon: 'megaphone', title: 'No announcements yet', className: 'border-0 py-8' }));
    } else ui.errorState($ann, annR.reason, load);

    // Promos
    if (promosR.status === 'fulfilled') {
      const list = (promosR.value.data || []).filter((p) => p.published).slice(0, 3);
      $promos.attr('aria-busy', 'false').html(list.length
        ? list.map((p) => components.promoCard(p)).join('')
        : `<div class="sm:col-span-2 lg:col-span-3">${ui.emptyState({ icon: 'film', title: 'No promos yet', message: 'Community videos will appear here once published.' })}</div>`);
      CE.media.lazyThumbnails($promos);
    } else ui.errorState($promos, promosR.reason, load);
  }

  components.bindEventActions($upcoming, load);
  load();
})(window.CE, window.jQuery);
