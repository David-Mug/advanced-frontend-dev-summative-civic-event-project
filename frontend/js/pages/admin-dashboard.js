/**
 * Admin dashboard — every number comes from the backend:
 *   GET /api/dashboard/admin  (users, events, registrations, feedback, promos, announcements,
 *                              notifications, user_growth)
 *   GET /api/dashboard/me     (unread notification count for this admin, per the server's read flag)
 *   GET /api/events           (recently added events)
 *   GET /api/notifications    (recent activity feed)
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only (backend: authorize(['admin']) on /dashboard/admin).
  if (!CE.layout.boot('admin')) return;

  const { ui, utils, components, charts } = CE;
  const { num, page, escape } = utils;

  function monthLabel(ym) {
    const [y, m] = String(ym).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  /** Fill in months with zero sign-ups so the 6-month axis is continuous. */
  function lastSixMonths(growth) {
    const map = new Map(growth.map((g) => [g.month, num(g.new_users)]));
    const rows = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
      rows.push({ label: monthLabel(key), value: map.get(key) || 0 });
    }
    return rows;
  }

  async function load() {
    const $kpis = $('#kpis').html(ui.skeleton.stats(8)).attr('aria-busy', 'true');
    ['#growth-chart', '#events-chart', '#content-chart', '#recent-events', '#activity'].forEach((s) => $(s).html(ui.skeleton.lines(5)));

    const [statsR, meR, eventsR, notifR] = await Promise.allSettled([
      CE.api.dashboard.admin(), CE.api.dashboard.me(), CE.api.events.list(), CE.api.notifications.list(),
    ]);

    if (statsR.status === 'fulfilled') {
      const s = statsR.value.data;
      const unread = meR.status === 'fulfilled' ? num(meR.value.data.notifications.unread_notifications) : null;
      const totalEvents = num(s.events.total_events);
      const upcoming = num(s.events.upcoming_events);
      const past = num(s.events.past_events);
      $kpis.attr('aria-busy', 'false').html([
        components.statCard({ icon: 'calendar', label: 'Total events', value: totalEvents, href: page('admin-events.html'), sub: `${upcoming} upcoming · ${past} past` }),
        components.statCard({ icon: 'users', label: 'Total users', value: num(s.users.total_users), href: page('admin-users.html'), tone: 'yellow', sub: `${num(s.users.active_users)} active · ${num(s.users.inactive_users)} disabled` }),
        components.statCard({ icon: 'ticket', label: 'Total registrations', value: num(s.registrations.total_registrations) }),
        components.statCard({ icon: 'film', label: 'Total promos', value: num(s.promos.total_promos), href: page('admin-promos.html'), tone: 'yellow' }),
        components.statCard({ icon: 'megaphone', label: 'Announcements', value: num(s.announcements.total_announcements), href: page('admin-announcements.html') }),
        components.statCard({ icon: 'star', label: 'Feedback received', value: num(s.feedbacks.total_feedback), tone: 'yellow' }),
        components.statCard({ icon: 'bell', label: 'Notifications sent', value: num(s.notifications.total_notifications), href: page('admin-notifications.html') }),
        components.statCard({ icon: 'inbox', label: 'Unread notifications', value: unread === null ? '—' : unread, tone: 'yellow', sub: 'Based on the server’s read flag' }),
      ].join(''));

      charts.columns($('#growth-chart'), lastSixMonths(s.user_growth || []), { valueLabel: 'New users', labelHeader: 'Month' });
      charts.bars($('#events-chart'), [
        { label: 'Upcoming', value: upcoming },
        { label: 'Happening now', value: Math.max(0, totalEvents - upcoming - past) },
        { label: 'Past', value: past },
      ], { valueLabel: 'Events', labelHeader: 'Timing' });
      charts.bars($('#content-chart'), [
        { label: 'Registrations', value: num(s.registrations.total_registrations) },
        { label: 'Notifications', value: num(s.notifications.total_notifications), href: page('admin-notifications.html') },
        { label: 'Feedback', value: num(s.feedbacks.total_feedback) },
        { label: 'Announcements', value: num(s.announcements.total_announcements), href: page('admin-announcements.html') },
        { label: 'Promos', value: num(s.promos.total_promos), href: page('admin-promos.html') },
      ], { valueLabel: 'Total', labelHeader: 'Type' });
    } else {
      ui.errorState($kpis, statsR.reason, load);
      ['#growth-chart', '#events-chart', '#content-chart'].forEach((sel) => $(sel).empty());
    }

    if (eventsR.status === 'fulfilled') {
      const recent = (eventsR.value.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      $('#recent-events').html(recent.length
        ? `<ul class="-mx-3 space-y-1">${recent.map((e) => components.eventRow(e)).join('')}</ul>`
        : ui.emptyState({ icon: 'calendar', title: 'No events yet', action: `<a class="btn-primary btn-sm mt-4" href="${page('event-form.html')}">Create event</a>`, className: 'border-0 py-8' }));
    } else ui.errorState($('#recent-events'), eventsR.reason, load);

    if (notifR.status === 'fulfilled') {
      const list = (notifR.value.data || []).slice(0, 6);
      $('#activity').html(list.length
        ? `<ol class="relative space-y-4 border-l-2 border-brand-light pl-5">${list.map((n) => {
          const meta = CE.notifications.typeMeta(n.type);
          return `<li class="relative">
              <span class="absolute -left-[1.85rem] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${meta.cls}">${CE.icon(meta.icon, 'h-3.5 w-3.5')}</span>
              <p class="text-sm font-semibold leading-snug">${escape(n.title)}</p>
              <p class="line-clamp-2 text-xs text-ink-soft">${escape(n.message)}</p>
              <time class="text-[0.7rem] text-ink-muted" datetime="${escape(n.created_at)}">${escape(utils.timeAgo(n.created_at))}</time>
            </li>`;
        }).join('')}</ol>`
        : ui.emptyState({ icon: 'activity', title: 'No activity yet', className: 'border-0 py-8' }));
    } else ui.errorState($('#activity'), notifR.reason, load);
  }

  load();
})(window.CE, window.jQuery);
