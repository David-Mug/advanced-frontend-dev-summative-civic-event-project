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
     * Turn promos.caption_text (stored as plain text by the backend) into timed cues.
     * Understands, in order of preference:
     *   1. SRT / WebVTT cue lines:   00:00:05,000 --> 00:00:09,500
     *   2. Timestamped lines:        0:05 text · [0:05] text · 1:02:03 - text
     *      (YouTube transcripts pasted as "0:1111 seconds…" are handled too, and
     *       YouTube "Chapter N: …" lines are skipped)
     *   3. Plain text with no times: sentences spread evenly across the video (approximate).
     * @returns {{cues: Array<{start:number,end:number,text:string}>, timed: boolean}}
     */
    parseCaptions(text, durationSeconds) {
      const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
      const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
      const toSec = (t) => t.replace(',', '.').split(':').reduce((acc, n) => acc * 60 + parseFloat(n), 0);
      const finish = (cues) => {
        cues.sort((a, b) => a.start - b.start);
        cues.forEach((c, i) => {
          if (c.end == null || c.end <= c.start) {
            const next = cues[i + 1] ? cues[i + 1].start : (dur || c.start + 5);
            c.end = Math.max(c.start + 0.5, next);
          }
        });
        return cues.filter((c) => c.text);
      };

      // 1. SRT / WebVTT
      const ARROW = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;
      if (ARROW.test(raw)) {
        const cues = [];
        raw.split(/\n{2,}/).forEach((block) => {
          const lines = block.split('\n');
          const i = lines.findIndex((l) => ARROW.test(l));
          if (i < 0) return;
          const [a, b] = lines[i].split('-->').map((x) => toSec(x.trim().split(/\s/)[0]));
          cues.push({ start: a, end: b, text: lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim() });
        });
        return { cues: finish(cues), timed: true };
      }

      // 2. Lines that start with a timestamp
      const LINE = /^\[?\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\)?\s*(?:\d+\s*(?:hours?|minutes?|seconds?)(?:,\s*\d+\s*(?:minutes?|seconds?))*)?\s*[-–—:]?\s*(.*)$/i;
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.some((l) => LINE.test(l))) {
        const cues = [];
        lines.forEach((l) => {
          if (/^chapter\s+\d+\s*:/i.test(l)) return; // YouTube chapter headings, not speech
          const m = l.match(LINE);
          if (m) cues.push({ start: toSec(m[1]), end: null, text: m[2].trim() });
          else if (cues.length) cues[cues.length - 1].text = `${cues[cues.length - 1].text} ${l}`.trim();
        });
        return { cues: finish(cues), timed: true };
      }

      // 3. Plain text: spread sentences evenly
      const clean = raw.replace(/\s+/g, ' ');
      const sentences = (clean.match(/[^.!?]+[.!?]*/g) || [clean]).map((x) => x.trim()).filter(Boolean);
      const total = dur || Math.max(4, sentences.length * 4);
      const slice = total / Math.max(1, sentences.length);
      return { cues: sentences.map((t, i) => ({ start: i * slice, end: (i + 1) * slice, text: t })), timed: false };
    },

    /** Build a WebVTT blob: URL (for <track src>) from parsed cues. */
    captionTrackUrl(cues) {
      const ts = (sec) => {
        const ms = Math.max(0, Math.round(sec * 1000));
        const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
        const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
        return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
      };
      const body = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.replace(/-->/g, '→')}`);
      return URL.createObjectURL(new Blob(['WEBVTT\n\n' + body.join('\n\n') + '\n'], { type: 'text/vtt' }));
    },

    /**
     * Make a cover image for a promo by taking a screenshot of the video in the browser.
     * The backend stores no thumbnail for promos, so a few frames (15%, 30%, 50% of the way
     * in) are sampled and the first one that isn't near-black is used — many videos open on
     * a dark fade-in. The JPEG is cached per video URL in localStorage, so it is made once.
     * Requires the video to be served with CORS (the API uses cors() for /uploads).
     * @returns {Promise<string>} data: URL of a JPEG
     */
    cover(url) {
      if (!url) return Promise.reject(new Error('No video'));
      if (coverJobs.has(url)) return coverJobs.get(url);
      const key = 'ce-cover:' + url;
      let cached = null;
      try { cached = localStorage.getItem(key); } catch (e) { /* storage unavailable */ }
      const job = cached ? Promise.resolve(cached) : queueCover(() => captureCover(url)).then((dataUrl) => {
        try { localStorage.setItem(key, dataUrl); } catch (e) { /* full or blocked: fine, just not cached */ }
        return dataUrl;
      });
      job.catch(() => coverJobs.delete(url)); // allow a retry on a later page view
      coverJobs.set(url, job);
      return job;
    },

    /** Screenshot a frame from any video URL (including a local blob: URL) without caching it. */
    captureFrame(url) {
      return queueCover(() => captureCover(url));
    },

    /**
     * Lazy-load promo covers: when a <video data-src> placeholder scrolls into view, replace it
     * with an <img> screenshot of the video. Falls back to the video's own frame, then an icon.
     */
    lazyThumbnails($scope) {
      const els = $scope.find('video[data-src]').toArray();
      const load = (el) => {
        const url = el.dataset.src;
        el.removeAttribute('data-src');
        media.cover(url).then((src) => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.className = el.className;
          img.setAttribute('aria-hidden', 'true');
          el.replaceWith(img);
        }).catch(() => {
          el.src = url + '#t=1';
          el.addEventListener('error', () => $(el).replaceWith(`<div class="absolute inset-0 flex items-center justify-center bg-brand-deep text-white">${icon('film', 'h-10 w-10')}</div>`));
        });
      };
      if (!('IntersectionObserver' in window)) { els.forEach(load); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { load(en.target); io.unobserve(en.target); } });
      }, { rootMargin: '200px' });
      els.forEach((el) => io.observe(el));
    },

    claim,
  };

  // ---------------------------------------------------------------
  // Video cover screenshots (used by media.cover)
  // ---------------------------------------------------------------
  const coverJobs = new Map();
  let coverActive = 0;
  const coverQueue = [];
  /** Run at most 2 captures at once so a page of cards doesn't download every video together. */
  function queueCover(task) {
    return new Promise((resolve, reject) => {
      const run = () => {
        coverActive += 1;
        task().then(resolve, reject).finally(() => {
          coverActive -= 1;
          if (coverQueue.length) coverQueue.shift()();
        });
      };
      if (coverActive < 2) run(); else coverQueue.push(run);
    });
  }

  function captureCover(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous'; // needed so the canvas can be read back
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let points = [];
      let best = null;
      const timer = setTimeout(() => finish(new Error('Timed out')), 20000);

      function finish(err) {
        clearTimeout(timer);
        v.removeAttribute('src');
        v.load();
        if (best) resolve(best.dataUrl); else reject(err || new Error('No frame'));
      }
      function grab() {
        const w = 640;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        // Average brightness over a coarse grid of pixels.
        const data = ctx.getImageData(0, 0, w, h).data;
        let sum = 0; let n = 0;
        for (let i = 0; i < data.length; i += 4 * 97) { sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n += 1; }
        const lum = sum / Math.max(1, n);
        if (!best || lum > best.lum) best = { lum, dataUrl: canvas.toDataURL('image/jpeg', 0.8) };
        return lum;
      }
      v.addEventListener('loadedmetadata', () => {
        const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 2;
        points = [0.15, 0.3, 0.5].map((f) => Math.min(d - 0.1, Math.max(0.1, d * f)));
        v.currentTime = points.shift();
      });
      v.addEventListener('seeked', () => {
        try {
          const lum = grab();
          if (lum > 40 || !points.length) finish(); else v.currentTime = points.shift();
        } catch (e) { finish(e); } // e.g. canvas tainted when CORS is missing
      });
      v.addEventListener('error', () => finish(new Error('Video failed to load')));
      v.src = url;
    });
  }

  CE.media = media;
})(window.CE, window.jQuery);
