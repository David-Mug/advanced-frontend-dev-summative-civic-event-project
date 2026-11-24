/**
 * Small, dependency-free helpers shared by every page.
 */
(function (CE) {
  'use strict';

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const utils = {
    /** Escape any API-provided text before inserting it into HTML templates. */
    escape(value) {
      return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
    },

    /** Build a URL to another frontend page, e.g. page('event.html', { id }). */
    page(name, params) {
      const path = name === 'index.html' ? CE.config.APP_ROOT + 'index.html' : CE.config.APP_ROOT + 'pages/' + name;
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return path + query;
    },

    /** Name of the current page file, e.g. "events.html". */
    currentPage() {
      const file = window.location.pathname.split('/').pop();
      return file || 'index.html';
    },

    param(name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    formatDate(iso, opts) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatTime(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    },

    formatDateTime(iso) {
      if (!iso) return '—';
      return utils.formatDate(iso) + ' · ' + utils.formatTime(iso);
    },

    /** "3 hours ago" style label using Intl.RelativeTimeFormat. */
    timeAgo(iso) {
      if (!iso) return '';
      const diff = (new Date(iso).getTime() - Date.now()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
      for (const [unit, secs] of units) {
        if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
      }
      return 'just now';
    },

    /** Seconds → "m:ss" (or "h:mm:ss"). */
    formatDuration(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      const m = Math.floor((seconds / 60) % 60);
      const h = Math.floor(seconds / 3600);
      return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    },

    formatBytes(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return (bytes / 1024 ** i).toFixed(i ? 1 : 0) + ' ' + units[i];
    },

    /** ISO string → value for <input type="datetime-local"> in the user's local time. */
    toLocalInput(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    initials(name) {
      return String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    },

    debounce(fn, wait) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    fileExt(name) {
      return String(name || '').split('.').pop().toLowerCase();
    },

    mapsUrl(location) {
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location || '');
    },

    /** Event timing state used for badges and filters. */
    eventStatus(event) {
      const now = Date.now();
      const start = new Date(event.starts_at).getTime();
      const end = new Date(event.ends_at || event.starts_at).getTime();
      if (end < now) return 'past';
      if (start <= now && end >= now) return 'live';
      return 'upcoming';
    },

    /** Backend counts arrive as strings ("12"); normalise to numbers. */
    num(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    plural(n, word) {
      return `${n} ${word}${n === 1 ? '' : 's'}`;
    },
  };

  CE.utils = utils;
})(window.CE);
