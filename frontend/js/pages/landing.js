/** Public landing page: hydrate icons and swap CTAs for signed-in visitors. */
(function (CE, $) {
  'use strict';

  $('[data-brand]').html(`${CE.logo('h-8 w-auto')}<span class="font-heading text-lg font-extrabold text-ink">Civic<span class="text-brand">Events+</span></span>`);
  $('[data-icon]').each(function () {
    $(this).html(CE.icon($(this).data('icon'), $(this).data('size') || 'h-5 w-5'));
  });
  $('[data-year]').text(new Date().getFullYear());

  if (CE.auth.isAuthenticated()) {
    const user = CE.auth.getUser();
    const home = CE.auth.homeUrl();
    $('[data-landing-actions]').html(`<a href="${home}" class="btn-primary">Go to ${user.role === 'admin' ? 'admin dashboard' : 'my dashboard'}</a>`);
    $('[data-hero-actions]').html(`<a href="${home}" class="btn-primary px-6 text-base">Welcome back, ${CE.utils.escape(user.full_name.split(' ')[0])} ${CE.icon('arrowRight')}</a>`);
    $('[data-cta]').attr('href', home).text('Open CivicEvents+');
  }
})(window.CE, window.jQuery);
