/**
 * Profile page.
 *   GET   /api/users/profile/me
 *   PATCH /api/users/profile/me  { full_name?, email? }
 * Role and account status are displayed read-only and are never sent; the backend also
 * rejects `role` / `is_active` in this payload.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user (each user edits only their own profile).
  if (!CE.layout.boot(null)) return;

  const { ui, utils, validate } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const $form = $('#profile-form');
  const $summary = $('#profile-summary');
  let profile = null;

  function renderSummary(p) {
    const admin = p.role === 'admin';
    $summary.html(`
      <div class="flex flex-col items-center text-center">
        <span class="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand font-heading text-2xl font-extrabold text-white shadow-lift" aria-hidden="true">${escape(utils.initials(p.full_name))}</span>
        <p class="mt-4 font-heading text-xl font-bold">${escape(p.full_name)}</p>
        <p class="text-sm text-ink-soft">${escape(p.email)}</p>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <span class="${admin ? 'badge-yellow' : 'badge-blue'} capitalize">${icon(admin ? 'shield' : 'user', 'h-3.5 w-3.5')} ${escape(p.role)}</span>
          ${p.is_active ? `<span class="badge-green">${icon('check', 'h-3 w-3')} Active</span>` : '<span class="badge-red">Disabled</span>'}
        </div>
      </div>
      <dl class="mt-6 space-y-3 border-t border-line pt-5 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-ink-soft">Member since</dt><dd class="font-medium">${escape(utils.formatDate(p.created_at, { day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-ink-soft">Last updated</dt><dd class="font-medium">${escape(utils.timeAgo(p.updated_at))}</dd></div>
      </dl>`);
  }

  function fill(p) {
    $('#full_name').val(p.full_name);
    $('#email').val(p.email);
    $('#role').val(p.role);
    $('#status').val(p.is_active ? 'Active' : 'Disabled');
  }

  async function load() {
    $summary.html(ui.skeleton.lines(6));
    $form.find('input, button').prop('disabled', true);
    try {
      const res = await CE.api.users.me();
      profile = res.data;
      renderSummary(profile);
      fill(profile);
    } catch (err) {
      ui.errorState($summary, err, load);
    } finally {
      $form.find('input, button').prop('disabled', false);
    }
  }

  $form.on('input', '.form-input', function () { ui.clearFieldError($(this)); });
  $form.on('reset', (e) => {
    e.preventDefault();
    ui.clearFormErrors($form);
    if (profile) fill(profile);
  });

  $form.on('submit', async (e) => {
    e.preventDefault();
    ui.clearFormErrors($form);
    const full_name = $('#full_name').val().trim();
    const email = $('#email').val().trim();
    const errors = {};
    const nErr = validate.fullName(full_name);
    const eErr = validate.email(email);
    if (nErr) errors.full_name = nErr;
    if (eErr) errors.email = eErr;
    if (!ui.applyErrors($form, errors)) return;

    // Only send fields that actually changed — role/status are never part of the payload.
    const payload = {};
    if (full_name !== profile.full_name) payload.full_name = full_name;
    if (email.toLowerCase() !== String(profile.email).toLowerCase()) payload.email = email;
    if (!Object.keys(payload).length) {
      ui.toast('info', 'There are no changes to save.', 'Nothing to update');
      return;
    }

    const $btn = $form.find('[type=submit]');
    ui.setLoading($btn, true, 'Saving…');
    try {
      const res = await CE.api.users.updateMe(payload);
      profile = res.data;
      CE.auth.updateUser({ full_name: profile.full_name, email: profile.email });
      renderSummary(profile);
      fill(profile);
      // Refresh the name shown in the header menu
      $('[data-profile-btn] .truncate, #profile-menu .truncate.text-sm').text(profile.full_name);
      $('#profile-menu .truncate.text-xs').text(profile.email);
      ui.formAlert($form, 'success', 'Your profile has been updated.');
      ui.toast('success', 'Your profile has been updated.', 'Profile saved');
    } catch (err) {
      if (err.status === 409) {
        ui.fieldError($('#email'), 'This email is already used by another account. Please use a different one.');
        $('#email').trigger('focus');
      } else {
        ui.formAlert($form, 'error', err.message);
      }
    } finally {
      ui.setLoading($btn, false);
    }
  });

  load();
})(window.CE, window.jQuery);
