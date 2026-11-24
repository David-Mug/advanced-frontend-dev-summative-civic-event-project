/**
 * Login and sign-up pages.
 * POST /api/auth/login  → { data: { token, user } }
 * POST /api/auth/signup → 201 { data: { id, full_name, email, role } }
 */
(function (CE, $) {
  'use strict';

  // Already signed in? Go straight to the right dashboard.
  if (CE.auth.redirectIfAuthenticated()) return;

  const { ui, validate } = CE;

  const wordmark = (light) => `${CE.logo('h-9 w-auto', light)}<span class="font-heading text-xl font-extrabold ${light ? 'text-white' : 'text-ink'}">Civic<span class="${light ? 'text-accent' : 'text-brand'}">Events+</span></span>`;
  $('[data-brand]').html(wordmark(false));
  $('[data-brand-light]').html(wordmark(true));
  ui.bindPasswordToggles($(document));

  const flash = CE.auth.consumeFlash();
  if (flash) ui.toast(flash.type, flash.message);

  // Clear a field's error as soon as the user edits it.
  $('form').on('input', '.form-input', function () { ui.clearFieldError($(this)); });

  // ------------------------------------------------------------------
  // Login
  // ------------------------------------------------------------------
  const $login = $('#login-form');
  if ($login.length) {
    const prefill = CE.utils.param('email');
    if (prefill) { $('#email').val(prefill); $('#password').trigger('focus'); }

    $login.on('submit', async function (e) {
      e.preventDefault();
      ui.clearFormErrors($login);
      const email = $('#email').val().trim();
      const password = $('#password').val();
      const errors = {};
      const emailErr = validate.email(email);
      if (emailErr) errors.email = emailErr;
      if (!password) errors.password = 'Password is required.';
      if (!ui.applyErrors($login, errors)) return;

      const $btn = $login.find('[type=submit]');
      ui.setLoading($btn, true, 'Signing in…');
      try {
        const user = await CE.auth.login(email, password);
        CE.auth.flash('success', `Welcome back, ${user.full_name.split(' ')[0]}!`);
        // Only follow ?next= to a page inside the app (prevents open redirects),
        // and never send a normal user to an admin page.
        const next = CE.utils.param('next') || '';
        const isAppPage = /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(next);
        const allowed = isAppPage && (user.role === 'admin' || !next.startsWith('admin-'));
        window.location.href = allowed ? CE.config.APP_ROOT + 'pages/' + next : CE.auth.homeUrl();
      } catch (err) {
        ui.setLoading($btn, false);
        const msg = err.status === 401 ? 'The email or password you entered is incorrect.' : err.message;
        ui.formAlert($login, 'error', msg);
        $('#password').val('').trigger('focus');
      }
    });
  }

  // ------------------------------------------------------------------
  // Sign-up
  // ------------------------------------------------------------------
  const $signup = $('#signup-form');
  if ($signup.length) {
    const $rules = $signup.find('[data-rules]');
    const STRENGTH_COLORS = ['bg-danger', 'bg-danger', 'bg-accent', 'bg-brand', 'bg-success'];

    $rules.html(validate.PASSWORD_RULES.map((r) => `<li class="flex items-center gap-1.5 text-ink-muted" data-rule="${r.id}"><span data-mark>${CE.icon('xCircle', 'h-3.5 w-3.5')}</span><span>${r.label}</span><span class="sr-only" data-state>— not met</span></li>`).join(''));

    function renderStrength() {
      const pw = $('#password').val();
      validate.PASSWORD_RULES.forEach((r) => {
        const ok = r.test(pw);
        const $li = $rules.find(`[data-rule="${r.id}"]`);
        $li.toggleClass('text-success-text', ok).toggleClass('text-ink-muted', !ok);
        $li.find('[data-mark]').html(CE.icon(ok ? 'checkCircle' : 'xCircle', 'h-3.5 w-3.5'));
        $li.find('[data-state]').text(ok ? '— met' : '— not met');
      });
      const s = validate.passwordStrength(pw);
      $signup.find('[data-strength-bars] span').each(function (i) {
        this.className = 'h-1.5 flex-1 rounded-full transition ' + (pw && i < Math.max(1, s.score) ? STRENGTH_COLORS[s.score] : 'bg-slate-200');
      });
      $signup.find('[data-strength-label]').text(s.label ? 'Strength: ' + s.label : '');
    }
    $('#password').on('input', renderStrength);
    renderStrength();

    $signup.on('submit', async function (e) {
      e.preventDefault();
      ui.clearFormErrors($signup);
      const data = {
        full_name: $('#full_name').val().trim(),
        email: $('#email').val().trim(),
        password: $('#password').val(),
      };
      const confirm = $('#confirm_password').val();
      const errors = {};
      const nameErr = validate.fullName(data.full_name);
      const emailErr = validate.email(data.email);
      const pwErr = validate.password(data.password);
      if (nameErr) errors.full_name = nameErr;
      if (emailErr) errors.email = emailErr;
      if (pwErr) errors.password = pwErr;
      if (!confirm) errors.confirm_password = 'Please confirm your password.';
      else if (confirm !== data.password) errors.confirm_password = 'Passwords do not match.';
      if (!ui.applyErrors($signup, errors)) return;

      const $btn = $signup.find('[type=submit]');
      ui.setLoading($btn, true, 'Creating account…');
      try {
        await CE.auth.signup(data);
        CE.auth.flash('success', 'Your account was created. Please sign in.');
        ui.toast('success', 'Account created! Redirecting you to sign in…');
        setTimeout(() => { window.location.href = CE.utils.page('login.html', { email: data.email }); }, 1200);
      } catch (err) {
        ui.setLoading($btn, false);
        if (err.status === 409) {
          ui.fieldError($('#email'), 'An account with this email already exists. Try signing in instead.');
          $('#email').trigger('focus');
        } else {
          ui.formAlert($signup, 'error', err.message);
        }
      }
    });
  }
})(window.CE, window.jQuery);
