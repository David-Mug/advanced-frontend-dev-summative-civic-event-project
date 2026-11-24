/**
 * Promo detail: HTML5 video with native play/pause, volume, fullscreen and captions.
 * GET /api/promos/:id → { video_url, caption_text, ... }
 * caption_text is converted into a WebVTT <track kind="captions" srclang="en" label="English">.
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
  const $root = $('#promo-detail');

  if (!id) {
    $root.html(ui.emptyState({ icon: 'film', title: 'No promo selected', action: `<a class="btn-primary mt-4" href="${utils.page('promos.html')}">All promos</a>` }));
    return;
  }

  function attachCaptions(video, text) {
    if (!text) return;
    const add = () => {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.srclang = 'en';
      track.label = 'English';
      track.default = true;
      track.src = CE.media.captionTrackUrl(text, video.duration);
      video.appendChild(track);
      // Some browsers need the mode set explicitly for dynamically added tracks.
      track.addEventListener('load', () => { track.track.mode = 'showing'; });
      if (track.track) track.track.mode = 'showing';
    };
    if (video.readyState >= 1) add(); else video.addEventListener('loadedmetadata', add, { once: true });
  }

  async function load() {
    $root.html(`<div aria-hidden="true"><div class="skeleton aspect-video w-full rounded-2xl"></div><div class="mt-6 card card-pad">${ui.skeleton.lines(5)}</div></div>`);
    try {
      const res = await CE.api.promos.get(id);
      const p = res.data;
      // Normal users must not access unpublished promos via direct links.
      if (!isAdmin && !p.published) throw new CE.api.ApiError(404, 'Not found');
      document.title = `${p.title} · CivicEvents+`;

      $root.html(`
        <article aria-labelledby="promo-title" class="grid gap-6 xl:grid-cols-3">
          <div class="xl:col-span-2">
            <div class="media-frame shadow-card">
              <video class="absolute inset-0 h-full w-full bg-black" controls preload="metadata" playsinline aria-label="Promotional video: ${escape(p.title)}" data-video>
                <source src="${escape(p.video_url)}">
                Your browser does not support HTML5 video. <a href="${escape(p.video_url)}">Download the video</a> instead.
              </video>
            </div>
            <p class="mt-3 flex items-center gap-2 text-xs text-ink-muted">${icon('captions', 'h-4 w-4')} Captions are on by default — use the CC button in the player to turn them off.</p>
            <p class="mt-2 hidden rounded-xl bg-red-50 p-3 text-sm text-danger" data-video-error role="alert"></p>
          </div>
          <div class="space-y-6">
            <section class="card card-pad">
              <div class="flex flex-wrap items-center gap-2"><span class="badge-blue">${icon('film', 'h-3.5 w-3.5')} Promo</span>${isAdmin ? ui.statusBadge(p.published) : ''}</div>
              <h1 id="promo-title" class="mt-3 font-heading text-2xl font-extrabold">${escape(p.title)}</h1>
              <p class="mt-1 text-xs text-ink-muted">Added <time datetime="${escape(p.created_at)}">${escape(utils.formatDate(p.created_at))}</time> · <span data-duration-label>--:--</span></p>
              <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">${escape(p.description || '')}</p>
              ${isAdmin ? `<a href="${utils.page('admin-promos.html')}" class="btn-outline btn-sm mt-5">${icon('edit', 'h-4 w-4')} Manage promos</a>` : ''}
            </section>
            <section class="card card-pad" aria-labelledby="transcript-title">
              <h2 id="transcript-title" class="section-title">Caption transcript</h2>
              <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">${escape(p.caption_text || 'No captions were provided for this video.')}</p>
            </section>
          </div>
        </article>`);

      const video = $root.find('[data-video]').get(0);
      video.addEventListener('play', () => CE.media.claim(video));
      video.addEventListener('loadedmetadata', () => $root.find('[data-duration-label]').text(utils.formatDuration(video.duration)));
      $(video).find('source').on('error', () => {
        $root.find('[data-video-error]').removeClass('hidden').text('This video could not be loaded. It may have been moved, or its format is not supported by your browser.');
      });
      attachCaptions(video, p.caption_text);
    } catch (err) {
      if (err.status === 404 || /invalid input syntax/i.test(err.message)) {
        $root.html(ui.emptyState({ icon: 'film', title: 'Promo not found', message: 'It may have been removed or is no longer published.', action: `<a class="btn-primary mt-4" href="${utils.page('promos.html')}">All promos</a>` }));
      } else ui.errorState($root, err, load);
    }
  }

  load();
})(window.CE, window.jQuery);
