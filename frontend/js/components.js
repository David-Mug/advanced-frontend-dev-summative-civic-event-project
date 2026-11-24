/**
 * Reusable card / tile templates shared across pages.
 * All API text goes through escape() before it reaches the DOM.
 */
(function (CE, $) {
  'use strict';

  const { escape, page, formatDate, formatTime, formatDateTime } = CE.utils;
  const icon = CE.icon;
  const ui = CE.ui;

  /** Calendar-style date chip. */
  function dateChip(iso, cls) {
    const d = new Date(iso);
    const valid = !Number.isNaN(d.getTime());
    return `<span class="${cls || ''} flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center shadow-card" aria-hidden="true">
        <span class="text-[0.65rem] font-bold uppercase tracking-wide text-brand-strong">${valid ? d.toLocaleDateString(undefined, { month: 'short' }) : '—'}</span>
        <span class="font-heading text-xl font-extrabold leading-none text-ink">${valid ? d.getDate() : ''}</span>
      </span>`;
  }

  function eventImage(event, cls) {
    const url = event.metadata && event.metadata.image_url;
    if (!url) return ui.imagePlaceholder(event.title, cls);
    return `<img src="${escape(url)}" alt="${escape(event.title)}" loading="lazy" decoding="async" class="${cls || 'aspect-[16/9]'} w-full object-cover" data-fallback="${cls || 'aspect-[16/9]'}">`;
  }

  const components = {
    dateChip,
    eventImage,

    /**
     * Event card.
     * @param {object} e  event row from GET /api/events
     * @param {object} o  { isAdmin, registration } — registration from my-registrations (users only)
     */
    eventCard(e, o = {}) {
      const detail = page('event.html', { id: e.id });
      const reg = o.registration;
      const isRegistered = reg && reg.status === 'registered';
      const status = CE.utils.eventStatus(e);
      let actions;
      if (o.isAdmin) {
        // Admin-only controls (rendered only when the signed-in role is admin)
        actions = `<a href="${page('event-form.html', { id: e.id })}" class="btn-outline btn-sm" aria-label="Edit ${escape(e.title)}">${icon('edit', 'h-4 w-4')} Edit</a>
          <button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-delete-event="${escape(e.id)}" data-title="${escape(e.title)}" aria-label="Delete ${escape(e.title)}">${icon('trash', 'h-4 w-4')} Delete</button>`;
      } else if (isRegistered) {
        actions = `<span class="badge-green px-3 py-1.5">${icon('check', 'h-3.5 w-3.5')} Registered</span>`;
      } else if (status === 'past') {
        actions = '<span class="text-xs font-medium text-ink-muted">Registration closed</span>';
      } else if (reg && reg.status === 'cancelled') {
        actions = '<span class="badge-gray px-3 py-1.5">Cancelled</span>';
      } else {
        actions = `<button type="button" class="btn-accent btn-sm" data-register="${escape(e.id)}" data-title="${escape(e.title)}" aria-label="Register for ${escape(e.title)}">${icon('ticket', 'h-4 w-4')} Register</button>`;
      }

      return `<article class="card card-hover group flex flex-col overflow-hidden" aria-labelledby="ev-${escape(e.id)}">
          <div class="relative">
            <a href="${detail}" tabindex="-1" aria-hidden="true" class="block overflow-hidden">${eventImage(e, 'aspect-[16/9]')}</a>
            <div class="absolute left-3 top-3">${dateChip(e.starts_at)}</div>
            <div class="absolute right-3 top-3 flex flex-col items-end gap-1.5">${ui.eventTimingBadge(e)}${o.isAdmin ? ui.statusBadge(e.published) : ''}</div>
          </div>
          <div class="flex flex-1 flex-col p-5">
            <h3 id="ev-${escape(e.id)}" class="font-heading text-lg font-bold leading-snug"><a href="${detail}" class="text-ink no-underline hover:text-brand-strong">${escape(e.title)}</a></h3>
            <ul class="mt-3 space-y-1.5 text-sm text-ink-soft">
              <li class="flex items-center gap-2">${icon('clock', 'h-4 w-4 text-brand')}<span><span class="sr-only">When: </span>${escape(formatDate(e.starts_at))} · ${escape(formatTime(e.starts_at))}</span></li>
              <li class="flex items-center gap-2">${icon('mapPin', 'h-4 w-4 text-brand')}<span class="truncate"><span class="sr-only">Where: </span>${escape(e.location || 'Location to be announced')}</span></li>
            </ul>
            <p class="mt-3 line-clamp-2 text-sm text-ink-soft">${escape(e.description || 'No description provided.')}</p>
            <div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
              <a href="${detail}" class="inline-flex items-center gap-1 text-sm font-semibold no-underline hover:underline">View details ${icon('arrowRight', 'h-4 w-4')}<span class="sr-only"> for ${escape(e.title)}</span></a>
              <div class="flex flex-wrap items-center gap-2">${actions}</div>
            </div>
          </div>
        </article>`;
    },

    /** Compact list row for an event (dashboards, registrations). */
    eventRow(e, extra) {
      return `<li class="flex items-center gap-4 rounded-xl p-3 transition hover:bg-brand-light/60">
          ${dateChip(e.starts_at, 'border border-line shadow-none')}
          <div class="min-w-0 flex-1">
            <a href="${page('event.html', { id: e.id || e.event_id })}" class="block truncate font-semibold text-ink no-underline hover:text-brand-strong">${escape(e.title)}</a>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-soft"><span>${escape(formatDateTime(e.starts_at))}</span><span class="truncate">${escape(e.location || '')}</span></p>
          </div>
          ${extra || ''}
        </li>`;
    },

    /** Announcement card with optional inline player slot. */
    announcementCard(a, o = {}) {
      return `<article class="card card-pad card-hover flex flex-col" aria-labelledby="an-${escape(a.id)}">
          <div class="flex items-start gap-4">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-ink">${icon('megaphone', 'h-6 w-6')}</span>
            <div class="min-w-0 flex-1">
              <h3 id="an-${escape(a.id)}" class="font-heading text-base font-bold leading-snug"><a class="text-ink no-underline hover:text-brand-strong" href="${page('announcement.html', { id: a.id })}">${escape(a.title)}</a></h3>
              <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                <span class="inline-flex items-center gap-1">${icon('calendar', 'h-3.5 w-3.5')}<time datetime="${escape(a.created_at)}">${escape(formatDate(a.created_at))}</time></span>
                <span class="inline-flex items-center gap-1">${icon('clock', 'h-3.5 w-3.5')}<span data-duration="${escape(a.audio_url)}">--:--</span></span>
                ${o.isAdmin ? ui.statusBadge(a.published) : ''}
              </p>
            </div>
          </div>
          <div class="mt-4" data-player-slot="${escape(a.id)}"></div>
          <div class="mt-auto flex items-center justify-between gap-2 pt-4">
            <button type="button" class="btn-primary btn-sm" data-play-inline="${escape(a.id)}" aria-label="Play ${escape(a.title)}">${icon('play', 'h-4 w-4')} Play</button>
            <a class="text-sm font-semibold no-underline hover:underline" href="${page('announcement.html', { id: a.id })}">Details<span class="sr-only"> for ${escape(a.title)}</span></a>
          </div>
        </article>`;
    },

    /** Promo card with lazy video thumbnail. */
    promoCard(p, o = {}) {
      const href = page('promo.html', { id: p.id });
      return `<article class="card card-hover group flex flex-col overflow-hidden" aria-labelledby="pr-${escape(p.id)}">
          <a href="${href}" class="relative block aspect-video overflow-hidden bg-brand-deep" aria-label="Watch ${escape(p.title)}">
            <video class="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]" data-src="${escape(p.video_url)}" preload="none" muted playsinline aria-hidden="true" tabindex="-1"></video>
            <span class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
              <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-brand-strong shadow-lift transition group-hover:scale-110">${icon('play', 'h-6 w-6 translate-x-[2px]')}</span>
            </span>
            <span class="absolute bottom-3 left-3 badge bg-black/60 text-white">${icon('captions', 'h-3.5 w-3.5')} CC</span>
            ${o.isAdmin ? `<span class="absolute right-3 top-3">${ui.statusBadge(p.published)}</span>` : ''}
          </a>
          <div class="flex flex-1 flex-col p-5">
            <h3 id="pr-${escape(p.id)}" class="font-heading text-base font-bold leading-snug"><a class="text-ink no-underline hover:text-brand-strong" href="${href}">${escape(p.title)}</a></h3>
            <p class="mt-2 line-clamp-2 text-sm text-ink-soft">${escape(p.description || '')}</p>
            <p class="mt-auto pt-4 text-xs text-ink-muted">Added <time datetime="${escape(p.created_at)}">${escape(formatDate(p.created_at))}</time></p>
          </div>
        </article>`;
    },

    /** Dashboard statistic tile. */
    statCard(o) {
      return `<div class="card card-pad">
          <div class="flex items-start justify-between">
            <span class="flex h-11 w-11 items-center justify-center rounded-xl ${o.tone === 'yellow' ? 'bg-accent text-ink' : 'bg-brand-light text-brand-strong'}">${icon(o.icon, 'h-5 w-5')}</span>
            ${o.href ? `<a href="${o.href}" class="text-xs font-semibold no-underline hover:underline">View<span class="sr-only"> ${escape(o.label)}</span></a>` : ''}
          </div>
          <p class="mt-4 font-heading text-3xl font-extrabold tabular-nums text-ink">${escape(o.value)}</p>
          <p class="mt-1 text-sm font-medium text-ink-soft">${escape(o.label)}</p>
          ${o.sub ? `<p class="mt-2 text-xs text-ink-muted">${o.sub}</p>` : ''}
        </div>`;
    },

    /**
     * Delegated handlers for event card buttons:
     *   [data-register]     → POST /event-registrations/register (users)
     *   [data-delete-event] → confirm + DELETE /events/:id (admins)
     * @param {jQuery} $scope
     * @param {() => void} onChange  re-render after a successful change
     */
    bindEventActions($scope, onChange) {
      $scope.on('click', '[data-register]', async function () {
        const $btn = $(this);
        ui.setLoading($btn, true, 'Registering…');
        try {
          await CE.api.registrations.register(String($btn.data('register')));
          ui.toast('success', `You're registered for “${$btn.data('title')}”.`, 'Registration confirmed');
          onChange();
        } catch (err) {
          ui.setLoading($btn, false);
          ui.toast('error', err.status === 409
            ? 'You already have a registration for this event (including previously cancelled ones, which the API does not allow re-opening).'
            : err.message);
        }
      });

      $scope.on('click', '[data-delete-event]', async function () {
        const $btn = $(this);
        const title = $btn.data('title');
        const ok = await ui.confirm({
          title: 'Delete this event?',
          message: `“${title}” will be permanently deleted. This cannot be undone.`,
          confirmText: 'Delete event',
          danger: true,
        });
        if (!ok) return;
        ui.setLoading($btn, true, 'Deleting…');
        try {
          await CE.api.events.remove(String($btn.data('delete-event')));
          ui.toast('success', `“${title}” was deleted.`, 'Event deleted');
          onChange();
        } catch (err) {
          ui.setLoading($btn, false);
          // event_registrations.event_id has no ON DELETE CASCADE, so Postgres blocks the delete
          ui.toast('error', /foreign key/i.test(err.message)
            ? 'This event has registrations, so the database will not allow it to be deleted.'
            : err.message);
        }
      });
    },

    /** Fill every [data-duration] element by probing the audio metadata. */
    hydrateDurations($scope) {
      $scope.find('[data-duration]').each(function () {
        const $el = $(this);
        CE.media.probeDuration($el.data('duration')).then((d) => $el.text(Number.isFinite(d) ? CE.utils.formatDuration(d) : 'Unavailable'));
      });
    },
  };

  // Broken image → branded placeholder (error events don't bubble, so listen in capture phase)
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.hasAttribute('data-fallback')) {
      img.outerHTML = ui.imagePlaceholder(img.alt || 'Image', img.dataset.fallback);
    }
  }, true);

  CE.components = components;
})(window.CE, window.jQuery);
