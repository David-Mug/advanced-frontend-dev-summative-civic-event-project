/**
 * Media helpers: accessible custom audio player, WebVTT caption generation for promos,
 * lazy video thumbnails and audio duration probing.
 */
(function (CE, $) {
  'use strict';

  const { escape, formatDuration } = CE.utils;
  const icon = CE.icon;

  /** Only one player plays at a time across the page. */
  let activeMedia = null;
  function claim(el) {
    if (activeMedia && activeMedia !== el && !activeMedia.paused) activeMedia.pause();
    activeMedia = el;
  }

  const durationCache = new Map();

  const media = {
    /** Resolve an audio/video file's duration (seconds) by loading only its metadata. */
    probeDuration(url, kind = 'audio') {
      if (durationCache.has(url)) return durationCache.get(url);
      const p = new Promise((resolve) => {
        const el = document.createElement(kind);
        el.preload = 'metadata';
        el.onloadedmetadata = () => resolve(el.duration);
        el.onerror = () => resolve(NaN);
        el.src = url;
      });
      durationCache.set(url, p);
      return p;
    },

    /**
     * Build an accessible audio player around an HTML5 <audio> element.
     * Controls: play/pause, ±10s, seek slider, current/total time, mute, volume, speed.
     * @param {jQuery} $host container
     * @param {{ src: string, title: string, compact?: boolean }} o
     */
    audioPlayer($host, o) {
      const uid = 'ap-' + Math.random().toString(36).slice(2, 8);
      $host.html(`
        <div class="rounded-2xl border border-line bg-white p-4 ${o.compact ? '' : 'sm:p-5'}" role="group" aria-label="Audio player: ${escape(o.title)}">
          <audio id="${uid}" preload="metadata" src="${escape(o.src)}"></audio>
          <div class="flex items-center gap-3 sm:gap-4">
            ${o.compact ? '' : `<button type="button" class="btn-icon hidden sm:inline-flex" data-skip="-10" aria-label="Rewind 10 seconds">${icon('rewind', 'h-4 w-4')}</button>`}
            <button type="button" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-strong text-white shadow-lift transition hover:bg-brand-deep" data-play aria-label="Play ${escape(o.title)}">${icon('play', 'h-5 w-5 translate-x-[1px]')}</button>
            ${o.compact ? '' : `<button type="button" class="btn-icon hidden sm:inline-flex" data-skip="10" aria-label="Forward 10 seconds">${icon('forward', 'h-4 w-4')}</button>`}
            <div class="min-w-0 flex-1">
              <label for="${uid}-seek" class="sr-only">Seek position</label>
              <input id="${uid}-seek" type="range" class="range" min="0" max="100" step="0.1" value="0" data-seek aria-valuetext="0:00 of unknown duration">
              <div class="mt-1.5 flex justify-between text-xs font-medium tabular-nums text-ink-soft">
                <span data-current aria-label="Current time">0:00</span><span data-total aria-label="Total duration">--:--</span>
              </div>
            </div>
            <button type="button" class="btn-icon" data-mute aria-label="Mute" aria-pressed="false">${icon('volume', 'h-5 w-5')}</button>
            ${o.compact ? '' : `
            <div class="hidden w-24 md:block"><label for="${uid}-vol" class="sr-only">Volume</label><input id="${uid}-vol" type="range" class="range" min="0" max="1" step="0.05" value="1" data-volume></div>
            <label for="${uid}-rate" class="sr-only">Playback speed</label>
            <select id="${uid}-rate" class="hidden rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold sm:block" data-rate>
              <option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
            </select>`}
          </div>
          <p class="mt-2 hidden text-xs text-danger" data-media-error role="alert"></p>
        </div>`);

      const audio = $host.find('audio').get(0);
      const $play = $host.find('[data-play]');
      const $seek = $host.find('[data-seek]');
      let seeking = false;

      const sync = () => {
        const d = audio.duration;
        const t = audio.currentTime;
        $host.find('[data-current]').text(formatDuration(t));
        if (Number.isFinite(d)) $host.find('[data-total]').text(formatDuration(d));
        if (!seeking && Number.isFinite(d) && d > 0) $seek.val((t / d) * 100);
        $seek.attr('aria-valuetext', `${formatDuration(t)} of ${Number.isFinite(d) ? formatDuration(d) : 'unknown duration'}`);
      };

      const setPlaying = (playing) => {
        $play.html(icon(playing ? 'pause' : 'play', 'h-5 w-5' + (playing ? '' : ' translate-x-[1px]')))
          .attr('aria-label', (playing ? 'Pause ' : 'Play ') + o.title);
      };

      $play.on('click', () => {
        if (audio.paused) { claim(audio); audio.play().catch(() => {}); } else audio.pause();
      });
      $host.find('[data-skip]').on('click', function () {
        audio.currentTime = Math.max(0, Math.min((audio.duration || 0), audio.currentTime + Number($(this).data('skip'))));
      });
      $seek.on('input', () => {
        seeking = true;
        if (Number.isFinite(audio.duration)) audio.currentTime = ($seek.val() / 100) * audio.duration;
      }).on('change', () => { seeking = false; });
      $host.find('[data-mute]').on('click', function () {
        audio.muted = !audio.muted;
        $(this).html(icon(audio.muted ? 'volumeX' : 'volume', 'h-5 w-5')).attr({ 'aria-pressed': String(audio.muted), 'aria-label': audio.muted ? 'Unmute' : 'Mute' });
      });
      $host.find('[data-volume]').on('input', function () { audio.volume = Number(this.value); });
      $host.find('[data-rate]').on('change', function () { audio.playbackRate = Number(this.value); });

      $(audio).on('loadedmetadata timeupdate durationchange', sync)
        .on('play', () => setPlaying(true))
        .on('pause ended', () => setPlaying(false))
        .on('error', () => {
          $host.find('[data-media-error]').removeClass('hidden').text('This audio file could not be loaded. It may have been moved or the server is unavailable.');
          $play.prop('disabled', true).addClass('opacity-50');
        });

      return audio;
    },

    /**
     * The backend stores promo captions as plain text (promos.caption_text) rather than a
     * caption file. Convert it into a WebVTT track: sentences are spread evenly across the
     * video's duration so they appear as timed captions in the native player.
     * @returns {string} blob: URL usable as <track src>
     */
    captionTrackUrl(text, durationSeconds) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      const sentences = (clean.match(/[^.!?]+[.!?]*/g) || [clean]).map((s) => s.trim()).filter(Boolean);
      const total = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : Math.max(4, sentences.length * 4);
      const slice = total / Math.max(1, sentences.length);
      const ts = (sec) => {
        const ms = Math.max(0, Math.round(sec * 1000));
        const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
        const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
        return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
      };
      const cues = sentences.map((s, i) => `${i + 1}\n${ts(i * slice)} --> ${ts((i + 1) * slice)}\n${s.replace(/-->/g, '→')}`);
      const vtt = 'WEBVTT\n\n' + cues.join('\n\n') + '\n';
      return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    },

    /**
     * Lazy-load promo thumbnails: set the <video data-src> only when it scrolls into view,
     * and load metadata only (the first frame acts as the thumbnail).
     */
    lazyThumbnails($scope) {
      const els = $scope.find('video[data-src]').toArray();
      const load = (el) => {
        el.src = el.dataset.src + '#t=0.5';
        el.removeAttribute('data-src');
        el.addEventListener('error', () => $(el).replaceWith(`<div class="absolute inset-0 flex items-center justify-center bg-brand-deep text-white">${icon('film', 'h-10 w-10')}</div>`));
      };
      if (!('IntersectionObserver' in window)) { els.forEach(load); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { load(en.target); io.unobserve(en.target); } });
      }, { rootMargin: '200px' });
      els.forEach((el) => io.observe(el));
    },

    claim,
  };

  CE.media = media;
})(window.CE, window.jQuery);
