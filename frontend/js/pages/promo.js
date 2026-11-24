/**
 * Promo detail: HTML5 video with native play/pause, volume, fullscreen and captions.
 * GET /api/promos/:id → { video_url, caption_text, ... }
 * caption_text is parsed for timestamps (see CE.media.parseCaptions), turned into a WebVTT
 * <track kind="captions">, and shown as a transcript that follows the video.
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

  /**
   * Add a timed WebVTT caption track to the player and build a synced transcript:
   * the line being spoken is highlighted as the video plays, and clicking a line seeks to it.
   */
  function attachCaptions(video, text, $transcript) {
    if (!text) return;
    const setup = () => {
      const { cues, timed } = CE.media.parseCaptions(text, video.duration);
      if (!cues.length) return;

      const track = document.createElement('track');
      track.kind = 'captions';
      track.srclang = 'en';
      track.label = 'English';
      track.default = true;
      track.src = CE.media.captionTrackUrl(cues);
      video.appendChild(track);
      // Some browsers need the mode set explicitly for dynamically added tracks.
      track.addEventListener('load', () => { track.track.mode = 'showing'; });
      if (track.track) track.track.mode = 'showing';

      $transcript.html(`
        ${timed ? '' : '<p class="mb-3 text-xs text-ink-muted">These captions have no timestamps, so their timing is approximate.</p>'}
        <ol class="space-y-1" data-cues>
          ${cues.map((c, i) => `<li><button type="button" class="flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm leading-relaxed text-ink-soft transition hover:bg-slate-100" data-cue="${i}">
            <span class="w-10 shrink-0 font-mono text-xs leading-6 text-ink-muted">${utils.formatDuration(c.start)}</span><span>${escape(c.text)}</span></button></li>`).join('')}
        </ol>`);

      const $btns = $transcript.find('[data-cue]');
      $btns.on('click', function () {
        video.currentTime = cues[$(this).data('cue')].start + 0.01;
        video.play().catch(() => {});
      });

      let active = -1;
      const sync = () => {
        const t = video.currentTime;
        const i = cues.findIndex((c) => t >= c.start && t < c.end);
        if (i === active) return;
        if (active >= 0) $btns.eq(active).removeClass('bg-brand-light font-semibold text-ink').removeAttr('aria-current');
        active = i;
        if (i < 0) return;
        const $b = $btns.eq(i).addClass('bg-brand-light font-semibold text-ink').attr('aria-current', 'true');
        // Keep the spoken line in view inside the transcript box, without moving the page.
        const box = $transcript.get(0);
        const el = $b.get(0);
        if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
          box.scrollTop = el.offsetTop - box.clientHeight / 3;
        }
      };
      video.addEventListener('timeupdate', sync);
      video.addEventListener('seeked', sync);
    };
    if (video.readyState >= 1) setup(); else video.addEventListener('loadedmetadata', setup, { once: true });
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
              <div class="relative mt-3 max-h-80 overflow-y-auto" data-transcript>
                <p class="whitespace-pre-line text-sm leading-relaxed text-ink-soft">${escape(p.caption_text || 'No captions were provided for this video.')}</p>
              </div>
            </section>
          </div>
        </article>`);

      const video = $root.find('[data-video]').get(0);
      // Cover image: a screenshot taken from the video itself (shown until playback starts).
      CE.media.cover(p.video_url).then((src) => { video.poster = src; }).catch(() => {});
      video.addEventListener('play', () => CE.media.claim(video));
      video.addEventListener('loadedmetadata', () => $root.find('[data-duration-label]').text(utils.formatDuration(video.duration)));
      $(video).find('source').on('error', () => {
        $root.find('[data-video-error]').removeClass('hidden').text('This video could not be loaded. It may have been moved, or its format is not supported by your browser.');
      });
      attachCaptions(video, p.caption_text, $root.find('[data-transcript]'));
    } catch (err) {
      if (err.status === 404 || /invalid input syntax/i.test(err.message)) {
        $root.html(ui.emptyState({ icon: 'film', title: 'Promo not found', message: 'It may have been removed or is no longer published.', action: `<a class="btn-primary mt-4" href="${utils.page('promos.html')}">All promos</a>` }));
      } else ui.errorState($root, err, load);
    }
  }

  load();
})(window.CE, window.jQuery);
