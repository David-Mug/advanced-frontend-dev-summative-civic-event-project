/**
 * Application shell: header, role-aware navigation, admin sidebar, mobile drawer,
 * profile dropdown and footer. Every protected page calls CE.layout.init().
 *
 * ROLE-BASED NAVIGATION: the link lists below are chosen by CE.auth.role(), so normal users
 * never see admin links and admins get the management sidebar. Pages still enforce their own
 * guard (CE.auth.requireRole / requireAuth) because hiding links alone is not access control.
 */
(function (CE, $) {
  'use strict';

  const { escape, page, initials } = CE.utils;
  const icon = CE.icon;

  // Normal-user navigation
  const USER_NAV = [
    { href: 'dashboard.html', label: 'Home', icon: 'home' },
    { href: 'events.html', label: 'Events', icon: 'calendar', match: ['event.html'] },
    { href: 'announcements.html', label: 'Announcements', icon: 'megaphone', match: ['announcement.html'] },
    { href: 'promos.html', label: 'Promos', icon: 'film', match: ['promo.html'] },
    { href: 'registrations.html', label: 'My Registrations', icon: 'ticket' },
  ];

  // Administrator navigation (sidebar)
  const ADMIN_NAV = [
    {
      group: 'Manage',
      items: [
        { href: 'admin-dashboard.html', label: 'Dashboard', icon: 'dashboard' },
        { href: 'admin-events.html', label: 'Events', icon: 'calendar', match: ['event-form.html'] },
        { href: 'admin-announcements.html', label: 'Announcements', icon: 'megaphone' },
        { href: 'admin-promos.html', label: 'Promos', icon: 'film' },
        { href: 'admin-users.html', label: 'Users', icon: 'users' },
        { href: 'admin-notifications.html', label: 'Notifications', icon: 'bell' },
      ],
    },
    {
      group: 'Community view',
      items: [
        { href: 'events.html', label: 'Browse events', icon: 'globe', match: ['event.html'] },
        { href: 'announcements.html', label: 'Announcement feed', icon: 'mic', match: ['announcement.html'] },
        { href: 'promos.html', label: 'Promo gallery', icon: 'play', match: ['promo.html'] },
      ],
    },
  ];

  function isActive(item, current) {
    return item.href === current || (item.match || []).includes(current);
  }

  function aria(item, current) {
    return isActive(item, current) ? 'aria-current="page"' : '';
  }

  function brand() {
    const home = CE.auth.isAuthenticated() ? CE.auth.homeUrl() : page('index.html');
    return `<a href="${home}" class="flex items-center gap-2.5 no-underline" aria-label="${CE.config.APP_NAME} home">
        ${CE.logo('h-7 w-auto sm:h-8')}
        <span class="font-heading text-lg font-extrabold text-ink">Civic<span class="text-brand">Events</span><span class="text-brand">+</span></span>
      </a>`;
  }

  function userNavLinks(current, cls) {
    return USER_NAV.map((i) => `<a href="${page(i.href)}" class="${cls}" ${aria(i, current)}>${cls === 'side-link' ? icon(i.icon) : ''}${i.label}</a>`).join('');
  }

  function adminSideLinks(current) {
    return ADMIN_NAV.map((g) => `
      <div>
        <p class="px-3 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-muted">${g.group}</p>
        <div class="space-y-1">${g.items.map((i) => `<a href="${page(i.href)}" class="side-link" ${aria(i, current)}>${icon(i.icon)}<span>${i.label}</span></a>`).join('')}</div>
      </div>`).join('');
  }

  function header(user, current) {
    const admin = user.role === 'admin';
    return `
      <header class="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur" role="banner">
        <div class="${admin ? 'px-4 sm:px-6' : 'container-page'} flex h-16 items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <button type="button" class="btn-icon ${admin ? 'lg:hidden' : 'md:hidden'}" data-mobile-nav aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-nav">${icon('menu')}</button>
            ${brand()}
            ${admin ? '<span class="badge-yellow ml-1 hidden sm:inline-flex">Admin</span>' : ''}
          </div>
          ${admin ? '' : `<nav class="hidden items-center gap-1 md:flex" aria-label="Main">${userNavLinks(current, 'nav-link')}</nav>`}
          <div class="flex items-center gap-1 sm:gap-2">
            <button type="button" class="btn-icon relative" data-bell aria-label="Notifications" aria-haspopup="dialog">
              ${icon('bell')}
              <span class="absolute right-1 top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold leading-[1.15rem] text-ink ring-2 ring-white" data-bell-count hidden>0</span>
            </button>
            <div class="relative" data-profile>
              <button type="button" class="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-brand-light" data-profile-btn aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white" aria-hidden="true">${escape(initials(user.full_name))}</span>
                <span class="hidden max-w-[9rem] truncate text-left text-sm font-semibold sm:block">${escape(user.full_name)}</span>
                ${icon('chevronDown', 'h-4 w-4 text-ink-muted')}
                <span class="sr-only">Account menu</span>
              </button>
              <div id="profile-menu" class="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-lift" role="menu" aria-label="Account" hidden>
                <div class="border-b border-line px-3 pb-3 pt-1">
                  <p class="truncate text-sm font-semibold">${escape(user.full_name)}</p>
                  <p class="truncate text-xs text-ink-muted">${escape(user.email)}</p>
                  <span class="${admin ? 'badge-yellow' : 'badge-blue'} mt-2 capitalize">${escape(user.role)}</span>
                </div>
                <div class="pt-2">
                  <a role="menuitem" class="menu-item" href="${page('profile.html')}">${icon('user', 'h-4 w-4')} My profile</a>
                  ${admin ? '' : `<a role="menuitem" class="menu-item" href="${page('registrations.html')}">${icon('ticket', 'h-4 w-4')} My registrations</a>`}
                  <a role="menuitem" class="menu-item" href="${page('notifications.html')}">${icon('inbox', 'h-4 w-4')} Notifications</a>
                  ${admin ? `<a role="menuitem" class="menu-item" href="${page('admin-dashboard.html')}">${icon('dashboard', 'h-4 w-4')} Admin dashboard</a>` : ''}
                  <button type="button" role="menuitem" class="menu-item text-danger hover:text-danger" data-logout>${icon('logout', 'h-4 w-4')} Sign out</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>`;
  }

  function footer() {
    const year = new Date().getFullYear();
    return `
      <footer class="mt-16 border-t border-line bg-white" role="contentinfo">
        <div class="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div class="lg:col-span-2">
            ${brand()}
            <p class="mt-3 max-w-md text-sm text-ink-soft">Connecting residents with the civic life of their community — events, public announcements and local initiatives in one accessible place.</p>
          </div>
          <div>
            <h2 class="text-sm font-bold">Explore</h2>
            <ul class="mt-3 space-y-2 text-sm">
              <li><a href="${page('events.html')}">Events</a></li>
              <li><a href="${page('announcements.html')}">Announcements</a></li>
              <li><a href="${page('promos.html')}">Promos</a></li>
              <li><a href="${page('notifications.html')}">Notifications</a></li>
            </ul>
          </div>
          <div>
            <h2 class="text-sm font-bold">Help</h2>
            <ul class="mt-3 space-y-2 text-sm">
              <li><a href="${page('profile.html')}">Account settings</a></li>
              <li><button type="button" class="font-medium text-brand-strong hover:underline" data-help>Accessibility &amp; keyboard help</button></li>
            </ul>
          </div>
        </div>
        <div class="border-t border-line">
          <p class="container-page py-4 text-xs text-ink-muted">© ${year} ${CE.config.APP_NAME}. Built for accessible civic participation.</p>
        </div>
      </footer>`;
  }

  function showHelp() {
    CE.ui.modal({
      title: 'Accessibility & keyboard help',
      body: `<div class="space-y-4 text-sm text-ink-soft">
          <p>${CE.config.APP_NAME} is designed to meet WCAG 2.1 AA. Everything can be used with a keyboard or screen reader.</p>
          <ul class="space-y-2">
            <li><kbd class="rounded border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Tab</kbd> / <kbd class="rounded border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Shift + Tab</kbd> move between controls.</li>
            <li><kbd class="rounded border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> or <kbd class="rounded border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Space</kbd> activate buttons and links.</li>
            <li><kbd class="rounded border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> closes dialogs, menus and drawers.</li>
            <li>Use the “Skip to main content” link at the top of each page to bypass navigation.</li>
            <li>Promo videos include captions; announcement players have labelled controls.</li>
          </ul>
          <p>Animations are reduced automatically if your device asks for reduced motion.</p>
        </div>`,
      footer: '<button type="button" class="btn-primary" data-close>Got it</button>',
    });
  }

  function mobileNav(user, current) {
    const opener = document.activeElement;
    const admin = user.role === 'admin';
    const $root = $(`
      <div id="mobile-nav">
        <div class="overlay" data-close></div>
        <aside class="drawer-left" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div class="flex items-center justify-between border-b border-line px-4 py-3">${brand()}<button type="button" class="btn-icon" data-close aria-label="Close navigation menu">${icon('x')}</button></div>
          <nav class="flex-1 space-y-6 overflow-y-auto p-4" aria-label="Main">
            ${admin ? adminSideLinks(current) : `<div class="space-y-1">${userNavLinks(current, 'side-link')}</div>`}
            <div class="space-y-1 border-t border-line pt-4">
              <a class="side-link" href="${page('notifications.html')}" ${current === 'notifications.html' ? 'aria-current="page"' : ''}>${icon('bell')} Notifications</a>
              <a class="side-link" href="${page('profile.html')}" ${current === 'profile.html' ? 'aria-current="page"' : ''}>${icon('user')} My profile</a>
              <button type="button" class="side-link w-full text-danger" data-logout>${icon('logout')} Sign out</button>
            </div>
          </nav>
        </aside>
      </div>`);
    const close = () => {
      $(document).off('keydown.mnav');
      $root.remove();
      $('body').removeClass('overflow-hidden');
      $('[data-mobile-nav]').attr('aria-expanded', 'false');
      if (opener && opener.focus) opener.focus();
    };
    $root.on('click', '[data-close]', close);
    $(document).on('keydown.mnav', (e) => { if (e.key === 'Escape') close(); });
    $('body').append($root).addClass('overflow-hidden');
    $('[data-mobile-nav]').attr('aria-expanded', 'true');
    $root.find('.btn-icon[data-close]').trigger('focus');
  }

  function bindProfileMenu() {
    const $btn = $('[data-profile-btn]');
    const $menu = $('#profile-menu');
    const items = () => $menu.find('[role="menuitem"]').toArray();
    const open = (focusFirst) => {
      $menu.prop('hidden', false);
      $btn.attr('aria-expanded', 'true');
      if (focusFirst) items()[0].focus();
    };
    const close = (refocus) => {
      $menu.prop('hidden', true);
      $btn.attr('aria-expanded', 'false');
      if (refocus) $btn.trigger('focus');
    };
    $btn.on('click', () => ($menu.prop('hidden') ? open(false) : close(false)));
    $btn.on('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
    });
    $menu.on('keydown', (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      if (e.key === 'Tab') close(false);
    });
    $(document).on('click', (e) => { if (!$(e.target).closest('[data-profile]').length) close(false); });
  }

  /** Replace <span data-icon="name"> placeholders in static HTML with SVG icons. */
  function hydrateIcons(scope) {
    $(scope).find('[data-icon]').each(function () {
      $(this).html(icon($(this).data('icon'), $(this).data('size') || 'h-5 w-5')).removeAttr('data-icon');
    });
  }

  const layout = {
    hydrateIcons,

    /**
     * Page bootstrap used by every protected page script.
     * ROLE GUARD: `role` = 'admin' | 'user' restricts the page to that role,
     * `null` allows any signed-in user. Returns false when the visitor was redirected.
     */
    boot(role) {
      const allowed = role ? CE.auth.requireRole(role) : CE.auth.requireAuth();
      if (!allowed) return false;
      layout.init();
      hydrateIcons(document.body);
      // Elements marked data-admin-only are removed from the DOM for normal users.
      if (CE.auth.isAdmin()) $('[data-admin-only]').prop('hidden', false);
      else $('[data-admin-only]').remove();
      return true;
    },

    /**
     * Render the shell around the page's <main id="main">.
     * Call only after a role guard has passed.
     */
    init() {
      const user = CE.auth.getUser();
      const current = CE.utils.currentPage();
      const $main = $('#main');
      $main.attr('tabindex', '-1');

      $('body').prepend('<a href="#main" class="skip-link">Skip to main content</a>');

      if (user.role === 'admin') {
        // Admin layout: header + sticky sidebar + content
        $main.addClass('min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8');
        $main.wrap('<div class="flex"></div>');
        $main.before(`<aside class="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line bg-white px-4 py-6 lg:block" aria-label="Administration">
            <nav class="space-y-6" aria-label="Admin">${adminSideLinks(current)}</nav>
          </aside>`);
        $main.parent().before(header(user, current));
        $main.parent().after(footer());
      } else {
        $main.addClass('container-page py-6 sm:py-8');
        $main.before(header(user, current));
        $main.after(footer());
      }

      bindProfileMenu();
      $(document).on('click', '[data-logout]', () => CE.auth.logout());
      $(document).on('click', '[data-bell]', () => CE.notifications.openDrawer());
      $(document).on('click', '[data-mobile-nav]', () => mobileNav(user, current));
      $(document).on('click', '[data-help]', showHelp);

      CE.notifications.init();

      const flash = CE.auth.consumeFlash();
      if (flash) CE.ui.toast(flash.type, flash.message);
    },
  };

  CE.layout = layout;
})(window.CE, window.jQuery);
