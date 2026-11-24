/**
 * Notifications: bell badge, slide-over drawer and helpers shared with the inbox page.
 *
 * Data comes from GET /api/notifications, which the backend already filters to
 * broadcast notifications (recipient_id IS NULL) plus those addressed to the current user.
 *
 * Read state: the backend has a `read` column but exposes no endpoint to change it, so
 * "read" is tracked per user in this browser (localStorage) on top of the server flag.
 * This is documented in frontend/README.md → Known limitations.
 */
(function (CE, $) {
  'use strict';

  const { escape, page, timeAgo } = CE.utils;
  const icon = CE.icon;

  const TYPE_META = {
    event: { icon: 'calendar', label: 'Event', cls: 'bg-brand-light text-brand-strong' },
    announcement: { icon: 'megaphone', label: 'Announcement', cls: 'bg-accent-soft text-ink' },
    promo: { icon: 'film', label: 'Promo', cls: 'bg-brand-light text-brand-deep' },
    system: { icon: 'info', label: 'System', cls: 'bg-slate-100 text-ink-soft' },
  };

  function storageKey() {
    const user = CE.auth.getUser();
    return CE.config.STORAGE_KEYS.SEEN_NOTIFICATIONS + ':' + (user ? user.id : 'anon');
  }

  function readSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey()) || '[]')); } catch (_) { return new Set(); }
  }

  function writeSeen(set) {
    try { localStorage.setItem(storageKey(), JSON.stringify(Array.from(set).slice(-500))); } catch (_) { /* ignore */ }
  }

  let items = [];

  const notifications = {
    TYPE_META,

    typeMeta(type) {
      return TYPE_META[type] || TYPE_META.system;
    },

    isUnread(n) {
      return !n.read && !readSeen().has(n.id);
    },

    /** Link to the resource a notification is about, using its metadata. */
    linkFor(n) {
      const m = n.metadata || {};
      if (m.event_id) return { href: page('event.html', { id: m.event_id }), label: 'View event' };
      if (m.announcement_id) return { href: page('announcement.html', { id: m.announcement_id }), label: 'Listen now' };
      if (m.promo_id) return { href: page('promo.html', { id: m.promo_id }), label: 'Watch promo' };
      return null;
    },

    async load(force) {
      if (force) CE.api.clearCache();
      const res = await CE.api.notifications.list();
      items = res.data || [];
      notifications.updateBadge();
      return items;
    },

    unreadCount() {
      return items.filter(notifications.isUnread).length;
    },

    markRead(ids) {
      const seen = readSeen();
      ids.forEach((id) => seen.add(id));
      writeSeen(seen);
      notifications.updateBadge();
    },

    markAllRead() {
      notifications.markRead(items.map((n) => n.id));
    },

    updateBadge() {
      const count = notifications.unreadCount();
      const $badge = $('[data-bell-count]');
      $badge.text(count > 99 ? '99+' : count).prop('hidden', count === 0);
      $('[data-bell]').attr('aria-label', count ? `Notifications, ${count} unread` : 'Notifications, none unread');
      $(document).trigger('ce:notifications', [items]);
    },

    /**
     * Markup for one notification row, used by the drawer and the inbox page.
     * @param {object} opts { full: show full message, actions: extra button html }
     */
    itemHtml(n, opts = {}) {
      const meta = notifications.typeMeta(n.type);
      const link = notifications.linkFor(n);
      const unread = notifications.isUnread(n);
      return `<li class="group relative flex flex-wrap gap-3 rounded-xl p-3 transition hover:bg-brand-light/60 ${unread ? 'bg-brand-light/40' : ''}" data-id="${escape(n.id)}">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.cls}">${icon(meta.icon, 'h-5 w-5')}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="font-semibold leading-snug text-ink">${escape(n.title)}</p>
              ${unread ? '<span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent ring-2 ring-white" aria-hidden="true"></span><span class="sr-only">Unread.</span>' : ''}
            </div>
            <p class="mt-0.5 text-sm text-ink-soft ${opts.full ? '' : 'line-clamp-2'}">${escape(n.message)}</p>
            <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span class="font-semibold">${escape(meta.label)}</span><span aria-hidden="true">•</span>
              <time datetime="${escape(n.created_at)}" title="${escape(CE.utils.formatDateTime(n.created_at))}">${escape(timeAgo(n.created_at))}</time>
              ${link ? `<span aria-hidden="true">•</span><a class="font-semibold" href="${escape(link.href)}" data-open="${escape(n.id)}">${escape(link.label)}</a>` : ''}
            </p>
          </div>
          ${opts.actions ? `<div class="flex w-full justify-end sm:w-auto sm:self-center">${opts.actions}</div>` : ''}
        </li>`;
    },

    // -------------------------------------------------------------
    // Drawer
    // -------------------------------------------------------------
    openDrawer() {
      const opener = document.activeElement;
      const $root = $(`
        <div id="notif-drawer-root">
          <div class="overlay" data-close></div>
          <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="notif-drawer-title">
            <div class="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 id="notif-drawer-title" class="font-heading text-lg font-bold">Notifications</h2>
                <p class="text-xs text-ink-muted" data-drawer-sub>Loading…</p>
              </div>
              <button type="button" class="btn-icon" data-close aria-label="Close notifications">${icon('x')}</button>
            </div>
            <div class="flex-1 overflow-y-auto px-3 py-3" data-list aria-live="polite">${CE.ui.skeleton.lines(6)}</div>
            <div class="flex gap-2 border-t border-line px-5 py-4">
              <button type="button" class="btn-outline flex-1" data-mark-all>${icon('check', 'h-4 w-4')} Mark all read</button>
              <a class="btn-primary flex-1" href="${page('notifications.html')}">View all</a>
            </div>
          </aside>
        </div>`);

      function close() {
        $(document).off('keydown.drawer');
        $root.remove();
        $('body').removeClass('overflow-hidden');
        if (opener && opener.focus) opener.focus();
      }

      function render() {
        const list = items.slice(0, 15);
        const unread = notifications.unreadCount();
        $root.find('[data-drawer-sub]').text(unread ? `${unread} unread` : 'You are all caught up');
        if (!list.length) {
          $root.find('[data-list]').html(CE.ui.emptyState({ icon: 'bell', title: 'No notifications yet', message: 'New events, announcements and promos will appear here.', className: 'border-0' }));
          return;
        }
        $root.find('[data-list]').html(`<ul class="space-y-1">${list.map((n) => notifications.itemHtml(n)).join('')}</ul>`);
      }

      $root.on('click', '[data-close]', close);
      $root.on('click', '[data-open]', function () { notifications.markRead([String($(this).data('open'))]); });
      $root.on('click', '[data-mark-all]', () => {
        notifications.markAllRead();
        render();
        CE.ui.announce('All notifications marked as read.');
      });
      $(document).on('keydown.drawer', (e) => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
          const f = $root.find('a[href], button:not([disabled])').filter(':visible').toArray();
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });

      $('body').append($root).addClass('overflow-hidden');
      $root.find('[data-close].btn-icon').trigger('focus');

      notifications.load(true).then(render).catch((err) => {
        CE.ui.errorState($root.find('[data-list]'), err, () => notifications.load(true).then(render));
      });
    },

    /** Called once by the layout: initial badge + light polling while the tab is visible. */
    init() {
      notifications.load().catch(() => { /* badge stays hidden; pages show their own errors */ });
      setInterval(() => {
        if (document.visibilityState === 'visible' && CE.auth.isAuthenticated()) notifications.load(true).catch(() => {});
      }, 60000);
    },
  };

  CE.notifications = notifications;
})(window.CE, window.jQuery);
