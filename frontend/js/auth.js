/**
 * Centralised authentication state.
 *
 * Storage strategy: the JWT and the user profile are kept in sessionStorage, so they are
 * scoped to one browser tab and cleared when it closes. sessionStorage is still readable by
 * any script on the page, so the app never injects unescaped API data into the DOM (see
 * CE.utils.escape) to limit XSS exposure. An httpOnly cookie would be stronger but the
 * provided backend issues bearer tokens in the JSON body only.
 *
 * ROLE-BASED ACCESS (frontend side) lives here:
 *   - CE.auth.requireAuth()      → redirect anonymous visitors to the login page
 *   - CE.auth.requireRole(role)  → redirect users whose role does not match
 *   - CE.auth.isAdmin()          → used by templates to hide/show admin-only controls
 * These checks are UX only. The real security boundary is the backend's
 * `authenticate` + `authorize(['admin'])` middleware (backend/src/middlewares/auth.middleware.js).
 */
(function (CE) {
  'use strict';

  const KEYS = CE.config.STORAGE_KEYS;

  function store() {
    try { return window.sessionStorage; } catch (_) { return null; }
  }

  /** Decode the JWT payload (no verification — that is the server's job) to read `exp`. */
  function decodeToken(token) {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch (_) {
      return null;
    }
  }

  let expiryTimer = null;

  const auth = {
    getToken() {
      const s = store();
      return s ? s.getItem(KEYS.TOKEN) : null;
    },

    getUser() {
      const s = store();
      try { return s ? JSON.parse(s.getItem(KEYS.USER) || 'null') : null; } catch (_) { return null; }
    },

    setSession(token, user) {
      const s = store();
      if (!s) return;
      s.setItem(KEYS.TOKEN, token);
      s.setItem(KEYS.USER, JSON.stringify(user));
    },

    /** Keep the cached profile in sync after a profile update. */
    updateUser(patch) {
      const user = Object.assign({}, auth.getUser(), patch);
      const s = store();
      if (s) s.setItem(KEYS.USER, JSON.stringify(user));
      return user;
    },

    clearSession() {
      const s = store();
      if (!s) return;
      s.removeItem(KEYS.TOKEN);
      s.removeItem(KEYS.USER);
      CE.api && CE.api.clearCache();
    },

    /** Seconds since epoch at which the token expires, or null. */
    tokenExpiry() {
      const token = auth.getToken();
      const payload = token && decodeToken(token);
      return payload && payload.exp ? payload.exp : null;
    },

    isTokenExpired() {
      const exp = auth.tokenExpiry();
      return !exp || exp * 1000 <= Date.now();
    },

    isAuthenticated() {
      return Boolean(auth.getToken() && auth.getUser() && !auth.isTokenExpired());
    },

    role() {
      const user = auth.getUser();
      return user ? user.role : null;
    },

    isAdmin() {
      return auth.role() === 'admin';
    },

    /** Landing page after login depends on the role. */
    homeUrl() {
      return CE.utils.page(auth.isAdmin() ? 'admin-dashboard.html' : 'dashboard.html');
    },

    /** One-shot message shown on the next page (e.g. "Session expired"). */
    flash(type, message) {
      const s = store();
      if (s) s.setItem(KEYS.FLASH, JSON.stringify({ type, message }));
    },

    consumeFlash() {
      const s = store();
      if (!s) return null;
      const raw = s.getItem(KEYS.FLASH);
      s.removeItem(KEYS.FLASH);
      try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
    },

    /** Redirect to login, remembering where the user was going. */
    redirectToLogin(reason) {
      if (reason) auth.flash('info', reason);
      const here = window.location.pathname.split('/').pop() + window.location.search;
      window.location.replace(CE.utils.page('login.html', { next: here }));
    },

    /** Called by the API layer on any 401 from a protected endpoint. */
    handleUnauthorized() {
      auth.clearSession();
      auth.redirectToLogin('Your session has expired. Please sign in again.');
    },

    // ------------------------------------------------------------------
    // ROLE GUARDS — call at the top of every protected page script.
    // ------------------------------------------------------------------

    /** Guard: page needs any signed-in user. Returns false (and redirects) otherwise. */
    requireAuth() {
      if (!auth.getToken()) {
        auth.redirectToLogin('Please sign in to continue.');
        return false;
      }
      if (auth.isTokenExpired()) {
        auth.clearSession();
        auth.redirectToLogin('Your session has expired. Please sign in again.');
        return false;
      }
      auth.scheduleExpiryLogout();
      return true;
    },

    /**
     * Guard: page is restricted to one role ('admin' or 'user').
     * Admins hitting a user-only page go to their dashboard and vice versa,
     * so typing a URL directly never shows controls the role cannot use.
     */
    requireRole(role) {
      if (!auth.requireAuth()) return false;
      if (auth.role() !== role) {
        auth.flash('error', role === 'admin'
          ? 'That page is only available to administrators.'
          : 'That page is only available to community members.');
        window.location.replace(auth.homeUrl());
        return false;
      }
      return true;
    },

    /** Guard: login/signup pages bounce already signed-in users to their home. */
    redirectIfAuthenticated() {
      if (auth.isAuthenticated()) {
        window.location.replace(auth.homeUrl());
        return true;
      }
      return false;
    },

    /** Log the user out automatically the moment the JWT expires (backend uses 1h tokens). */
    scheduleExpiryLogout() {
      clearTimeout(expiryTimer);
      const exp = auth.tokenExpiry();
      if (!exp) return;
      const ms = exp * 1000 - Date.now();
      // setTimeout overflows beyond ~24.8 days; tokens here live 1h.
      if (ms > 0 && ms < 2147483647) expiryTimer = setTimeout(auth.handleUnauthorized, ms);
    },

    // ------------------------------------------------------------------
    // API-backed actions
    // ------------------------------------------------------------------

    async login(email, password) {
      const res = await CE.api.post('/auth/login', { email, password }, { auth: false });
      auth.setSession(res.data.token, res.data.user);
      return res.data.user;
    },

    /** Role is intentionally never sent — new accounts are always created as normal users. */
    signup({ full_name, email, password }) {
      return CE.api.post('/auth/signup', { full_name, email, password }, { auth: false });
    },

    logout() {
      auth.clearSession();
      auth.flash('success', 'You have been signed out.');
      window.location.href = CE.utils.page('login.html');
    },
  };

  CE.auth = auth;
})(window.CE);
