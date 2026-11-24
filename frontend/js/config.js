/**
 * Global configuration for the CivicEvents+ frontend.
 *
 * Every module hangs off the single `window.CE` namespace (classic scripts, no build step),
 * so pages work from any static file server.
 */
(function () {
  'use strict';

  // Resolve the frontend root folder from this script's own URL (".../js/config.js"),
  // so links work the same from index.html and from pages/*.html.
  const scriptSrc = document.currentScript && document.currentScript.src;
  const appRoot = scriptSrc ? scriptSrc.replace(/js\/config\.js(\?.*)?$/, '') : './';

  // The API origin can be overridden without editing code:
  //   localStorage.setItem('ce_api_base', 'http://192.168.1.10:4000')
  let apiOrigin = 'http://localhost:4000';
  try {
    apiOrigin = localStorage.getItem('ce_api_base') || apiOrigin;
  } catch (_) { /* storage blocked — use default */ }

  window.CE = window.CE || {};
  window.CE.config = Object.freeze({
    APP_NAME: 'CivicEvents+',
    API_ORIGIN: apiOrigin,
    API_BASE_URL: apiOrigin + '/api',
    APP_ROOT: appRoot,
    STORAGE_KEYS: Object.freeze({
      TOKEN: 'ce_token',
      USER: 'ce_user',
      FLASH: 'ce_flash',
      SEEN_NOTIFICATIONS: 'ce_seen_notifications', // prefix; suffixed with the user id
    }),
    PAGE_SIZE: 9,
    UPLOAD_LIMITS: Object.freeze({
      // Mirrors backend/src/middlewares/upload.middleware.js
      image: { maxBytes: 2 * 1024 * 1024, exts: ['jpg', 'jpeg', 'png', 'gif'] },
      audio: { maxBytes: 5 * 1024 * 1024, exts: ['mp3', 'wav', 'm4a', 'ogg'] },
      video: { maxBytes: 100 * 1024 * 1024, exts: ['mp4', 'mov', 'avi', 'mkv'] },
    }),
  });
})();
