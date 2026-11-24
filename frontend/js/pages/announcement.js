/**
 * Announcement detail: full audio player (GET /api/announcements/:id).
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user.
  if (!CE.layout.boot(null)) return;

  const { ui, utils } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const isAdmin = CE.auth.isAdmin();
  const id = utils.param('id');
  const $root = $('#announcement-detail');

  if (!id) {
    $root.html(ui.emptyState({ icon: 'megaphone', title: 'No announcement selected', action: `<a class="btn-primary mt-4" href="${utils.page('announcements.html')}">All announcements</a>` }));
    return;
  }

  async function load() {
    $root.html(`<div class="card card-pad" aria-hidden="true">${ui.skeleton.lines(6)}</div>`);
    try {
      const res = await CE.api.announcements.get(id);
      const a = res.data;
      // Normal users must not access unpublished announcements via direct links.
      if (!isAdmin && !a.published) throw new CE.api.ApiError(404, 'Not found');
      document.title = `${a.title} · CivicEvents+`;

      $root.html(`
        <article class="mx-auto max-w-3xl" aria-labelledby="ann-title">
          <div class="card overflow-hidden">
            <div class="hero-pattern bg-brand-light px-6 py-10 sm:px-10">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-ink shadow-card">${icon('megaphone', 'h-7 w-7')}</span>
              <p class="eyebrow mt-6">Audio announcement</p>
              <h1 id="ann-title" class="mt-2 font-heading text-2xl font-extrabold sm:text-3xl">${escape(a.title)}</h1>
              <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
                <span class="inline-flex items-center gap-1.5">${icon('calendar', 'h-4 w-4')}Published <time datetime="${escape(a.created_at)}">${escape(utils.formatDateTime(a.created_at))}</time></span>
                <span class="inline-flex items-center gap-1.5">${icon('clock', 'h-4 w-4')}Duration <span data-total-label>loading…</span></span>
                ${isAdmin ? ui.statusBadge(a.published) : ''}
              </p>
            </div>
            <div class="p-6 sm:p-10">
              <div data-player></div>
              <section class="mt-8" aria-labelledby="transcript-title">
                <h2 id="transcript-title" class="section-title">Transcript</h2>
                <p class="mt-2 text-sm text-ink-soft">A written transcript has not been provided for this announcement. If you need this information in another format, please contact your local civic office.</p>
              </section>
              <div class="mt-8 flex flex-wrap gap-2 border-t border-line pt-6">
                <a href="${escape(a.audio_url)}" target="_blank" rel="noopener" class="btn-outline btn-sm">${icon('external', 'h-4 w-4')} Open audio file<span class="sr-only"> (opens in a new tab)</span></a>
                ${isAdmin ? `<a href="${utils.page('admin-announcements.html')}" class="btn-ghost btn-sm">${icon('edit', 'h-4 w-4')} Manage announcements</a>` : ''}
              </div>
            </div>
          </div>
        </article>`);

      const audio = CE.media.audioPlayer($root.find('[data-player]'), { src: a.audio_url, title: a.title });
      $(audio).on('loadedmetadata', () => $root.find('[data-total-label]').text(utils.formatDuration(audio.duration)))
        .on('error', () => $root.find('[data-total-label]').text('unavailable'));
    } catch (err) {
      if (err.status === 404 || /invalid input syntax/i.test(err.message)) {
        $root.html(ui.emptyState({ icon: 'megaphone', title: 'Announcement not found', message: 'It may have been removed or is no longer published.', action: `<a class="btn-primary mt-4" href="${utils.page('announcements.html')}">All announcements</a>` }));
      } else ui.errorState($root, err, load);
    }
  }

  load();
})(window.CE, window.jQuery);
