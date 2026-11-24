/**
 * Centralised API client.
 *
 * - One base URL (CE.config.API_BASE_URL)
 * - Bearer token attached automatically to protected requests
 * - JSON requests via fetch(); multipart uploads via jQuery AJAX so we get upload progress
 * - Consistent ApiError objects (status, message, field errors)
 * - 401 on a protected request → session cleared and redirect to login
 * - Short-lived GET cache in sessionStorage, invalidated by any write
 *
 * Every endpoint used by the app is listed at the bottom of this file, and each one
 * matches a route in backend/src/routes/*.routes.js.
 */
(function (CE, $) {
  'use strict';

  const CACHE_KEY = 'ce_api_cache';

  class ApiError extends Error {
    constructor(status, message, errors, body) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors || [];
      this.body = body;
    }
  }

  function messageFrom(body, status) {
    if (body && Array.isArray(body.errors) && body.errors.length) {
      return body.errors.map((e) => e.message || e.msg).filter(Boolean).join(' ');
    }
    if (body && body.message) {
      // Postgres unique violations are mapped to 409 "Duplicate entry" by the backend
      return body.message;
    }
    if (status === 0) return 'Cannot reach the CivicEvents+ server. Check that the backend is running and try again.';
    if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';
    return 'Request failed (' + status + ').';
  }

  // ---------------- GET cache ----------------
  function readCache() {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch (_) { return {}; }
  }
  function writeCache(cache) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) { /* quota or blocked */ }
  }
  function cacheKey(path) {
    const user = CE.auth.getUser();
    return (user ? user.id : 'anon') + ' ' + path;
  }

  function handleAuthFailure(status, useAuth) {
    if (status === 401 && useAuth) CE.auth.handleUnauthorized();
  }

  /**
   * Core JSON request.
   * @param {string} method
   * @param {string} path        e.g. "/events"
   * @param {object} [body]
   * @param {object} [opts]      { auth = true, cache = seconds (GET only) }
   */
  async function request(method, path, body, opts) {
    const options = Object.assign({ auth: true, cache: 0 }, opts);
    const key = cacheKey(path);

    if (method === 'GET' && options.cache) {
      const hit = readCache()[key];
      if (hit && hit.expires > Date.now()) return hit.data;
    }

    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth) {
      const token = CE.auth.getToken();
      if (token) headers.Authorization = 'Bearer ' + token;
    }

    let response;
    try {
      response = await fetch(CE.config.API_BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError(0, messageFrom(null, 0));
    }

    let data = null;
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = { message: text }; }
    }

    if (!response.ok) {
      handleAuthFailure(response.status, options.auth);
      throw new ApiError(response.status, messageFrom(data, response.status), data && data.errors, data);
    }

    if (method === 'GET' && options.cache) {
      const cache = readCache();
      cache[key] = { data, expires: Date.now() + options.cache * 1000 };
      writeCache(cache);
    } else if (method !== 'GET') {
      api.clearCache(); // any write may change what lists/dashboards show
    }
    return data;
  }

  /**
   * Multipart upload with progress (jQuery AJAX → XHR upload events).
   * @param {'POST'|'PUT'} method
   * @param {string} path
   * @param {FormData} formData
   * @param {(percent:number)=>void} [onProgress]
   */
  function upload(method, path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: CE.config.API_BASE_URL + path,
        method,
        data: formData,
        processData: false,
        contentType: false, // let the browser set the multipart boundary
        dataType: 'json',
        headers: { Authorization: 'Bearer ' + (CE.auth.getToken() || '') },
        xhr() {
          const xhr = $.ajaxSettings.xhr();
          if (xhr.upload && onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
          }
          return xhr;
        },
      })
        .done((data) => {
          api.clearCache();
          resolve(data);
        })
        .fail((xhr) => {
          const body = xhr.responseJSON || (xhr.responseText ? { message: xhr.responseText.slice(0, 200) } : null);
          handleAuthFailure(xhr.status, true);
          reject(new ApiError(xhr.status, messageFrom(body, xhr.status), body && body.errors, body));
        });
    });
  }

  const api = {
    ApiError,
    request,
    upload,
    get: (path, opts) => request('GET', path, undefined, opts),
    post: (path, body, opts) => request('POST', path, body || {}, opts),
    put: (path, body, opts) => request('PUT', path, body || {}, opts),
    patch: (path, body, opts) => request('PATCH', path, body, opts),
    del: (path, opts) => request('DELETE', path, undefined, opts),
    clearCache() {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) { /* ignore */ }
    },
  };

  const id = (v) => encodeURIComponent(v);

  // ------------------------------------------------------------------
  // Endpoint map (all verified against backend/src/routes)
  // ------------------------------------------------------------------
  api.events = {
    list: () => api.get('/events', { cache: 30 }),                         // GET    /api/events
    get: (eventId) => api.get('/events/' + id(eventId)),                    // GET    /api/events/:id
    create: (fd, onP) => upload('POST', '/events', fd, onP),               // POST   /api/events   (multipart, field "image")
    update: (eventId, fd, onP) => upload('PUT', '/events/' + id(eventId), fd, onP), // PUT /api/events/:id
    remove: (eventId) => api.del('/events/' + id(eventId)),                 // DELETE /api/events/:id
  };

  api.registrations = {
    register: (eventId) => api.post('/event-registrations/register', { event_id: eventId }),
    cancel: (eventId) => api.post('/event-registrations/cancel', { event_id: eventId }),
    mine: () => api.get('/event-registrations/my-registrations'),
    attendees: (eventId) => api.get('/event-registrations/event/' + id(eventId) + '/attendees'), // admin
  };

  api.feedback = {
    create: (payload) => api.post('/event-feedback', payload),             // { event_id, rating, comment }
    update: (feedbackId, payload) => api.put('/event-feedback/' + id(feedbackId), payload),
    mine: () => api.get('/event-feedback/my-feedback'),
    forEvent: (eventId) => api.get('/event-feedback/event/' + id(eventId)), // admin
  };

  api.announcements = {
    list: (params) => api.get('/announcements?' + new URLSearchParams(params || { page: 1, limit: 100 }), { cache: 30 }),
    get: (aid) => api.get('/announcements/' + id(aid)),
    create: (fd, onP) => upload('POST', '/announcements', fd, onP),        // multipart, field "audio"
    update: (aid, payload) => api.put('/announcements/' + id(aid), payload), // { title, published }
    publish: (aid) => api.patch('/announcements/' + id(aid) + '/publish'),
    unpublish: (aid) => api.patch('/announcements/' + id(aid) + '/unpublish'),
    remove: (aid) => api.del('/announcements/' + id(aid)),
  };

  api.promos = {
    list: (params) => api.get('/promos?' + new URLSearchParams(params || { page: 1, limit: 100 }), { cache: 30 }),
    get: (pid) => api.get('/promos/' + id(pid)),
    create: (fd, onP) => upload('POST', '/promos', fd, onP),               // multipart, field "video"
    update: (pid, fd, onP) => upload('PUT', '/promos/' + id(pid), fd, onP),
    publish: (pid) => api.patch('/promos/' + id(pid) + '/publish'),
    unpublish: (pid) => api.patch('/promos/' + id(pid) + '/unpublish'),
    remove: (pid) => api.del('/promos/' + id(pid)),
  };

  api.notifications = {
    list: () => api.get('/notifications', { cache: 20 }),
    get: (nid) => api.get('/notifications/' + id(nid)),
    remove: (nid) => api.del('/notifications/' + id(nid)),                 // admin
  };

  api.users = {
    list: (page, limit) => api.get('/users?' + new URLSearchParams({ page, limit })), // admin
    get: (uid) => api.get('/users/' + id(uid)),                            // admin
    enable: (uid) => api.patch('/users/' + id(uid) + '/enable'),           // admin
    disable: (uid) => api.patch('/users/' + id(uid) + '/disable'),         // admin
    me: () => api.get('/users/profile/me'),
    updateMe: (payload) => api.patch('/users/profile/me', payload),        // { full_name?, email? } only
  };

  api.dashboard = {
    admin: () => api.get('/dashboard/admin'),
    me: () => api.get('/dashboard/me'),
  };

  CE.api = api;
})(window.CE, window.jQuery);
