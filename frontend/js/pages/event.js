/**
 * Event details page.
 *   GET  /events/:id
 *   Users : POST /event-registrations/register | cancel, GET my-registrations,
 *           POST /event-feedback, PUT /event-feedback/:id, GET /event-feedback/my-feedback
 *   Admins: GET /event-registrations/event/:id/attendees, GET /event-feedback/event/:id
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user; admin-only panels are rendered only when isAdmin.
  if (!CE.layout.boot(null)) return;

  const { ui, utils, components } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const isAdmin = CE.auth.isAdmin();
  const eventId = utils.param('id');
  const $root = $('#event-detail');

  let event = null;

  if (isAdmin) $('[data-back]').attr('href', utils.page('admin-events.html')).html(icon('arrowLeft', 'h-5 w-5') + 'Events management');

  if (!eventId) {
    $root.html(ui.emptyState({ icon: 'calendar', title: 'No event selected', message: 'Choose an event from the list to see its details.', action: `<a class="btn-primary mt-4" href="${utils.page('events.html')}">Browse events</a>` }));
    return;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function skeleton() {
    $root.html(`<div aria-hidden="true"><div class="skeleton aspect-[21/9] w-full rounded-3xl"></div>
      <div class="mt-8 grid gap-6 lg:grid-cols-3"><div class="card card-pad lg:col-span-2">${ui.skeleton.lines(8)}</div><div class="card card-pad">${ui.skeleton.lines(6)}</div></div></div>`);
  }

  function shell(e) {
    const status = utils.eventStatus(e);
    const img = e.metadata && e.metadata.image_url;
    document.title = `${e.title} · CivicEvents+`;
    return `
      <article aria-labelledby="event-title">
        <header class="relative overflow-hidden rounded-3xl bg-brand-deep shadow-card">
          ${img ? `<img src="${escape(img)}" alt="${escape(e.title)}" class="absolute inset-0 h-full w-full object-cover" data-fallback="absolute inset-0">` : '<div class="hero-pattern absolute inset-0 opacity-60" aria-hidden="true"></div>'}
          <div class="relative bg-gradient-to-t from-brand-deep via-brand-deep/85 to-transparent px-5 pb-8 pt-40 sm:px-10 sm:pt-64">
            <div class="flex flex-wrap gap-2">${ui.eventTimingBadge(e)}${isAdmin ? ui.statusBadge(e.published) : ''}</div>
            <h1 id="event-title" class="mt-3 max-w-3xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">${escape(e.title)}</h1>
            <p class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-base font-medium text-white">
              <span class="inline-flex items-center gap-2">${icon('calendar', 'h-5 w-5 text-accent')}${escape(utils.formatDate(e.starts_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>
              <span class="inline-flex items-center gap-2">${icon('mapPin', 'h-5 w-5 text-accent')}${escape(e.location || 'Location to be announced')}</span>
            </p>
          </div>
        </header>


        <div class="mt-8 grid gap-6 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-2">
            <section class="card card-pad" aria-labelledby="about-title">
              <h2 id="about-title" class="section-title">About this event</h2>
              <p class="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">${escape(e.description || 'No description provided.')}</p>
            </section>
            <section class="card card-pad" aria-labelledby="feedback-title" id="feedback-section">
              <h2 id="feedback-title" class="section-title">${isAdmin ? 'Resident feedback' : 'Your feedback'}</h2>
              <div class="mt-4" data-feedback>${ui.skeleton.lines(4)}</div>
            </section>
          </div>

          <aside class="space-y-6" aria-label="Event information">
            <section class="card card-pad" aria-labelledby="when-title">
              <h2 id="when-title" class="section-title">Date &amp; location</h2>
              <dl class="mt-4 space-y-4 text-sm">
                <div class="flex gap-3"><dt class="text-brand">${icon('calendar')}<span class="sr-only">Starts</span></dt><dd><span class="block font-semibold text-ink">Starts</span>${escape(utils.formatDateTime(e.starts_at))}</dd></div>
                <div class="flex gap-3"><dt class="text-brand">${icon('clock')}<span class="sr-only">Ends</span></dt><dd><span class="block font-semibold text-ink">Ends</span>${escape(utils.formatDateTime(e.ends_at))}</dd></div>
                <div class="flex gap-3"><dt class="text-brand">${icon('mapPin')}<span class="sr-only">Location</span></dt><dd><span class="block font-semibold text-ink">${escape(e.location || 'To be announced')}</span>
                  ${e.location ? `<a href="${utils.mapsUrl(e.location)}" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1 font-semibold">Open in Google Maps ${icon('external', 'h-3.5 w-3.5')}<span class="sr-only">(opens in a new tab)</span></a>` : ''}</dd></div>
              </dl>
              ${status !== 'past' ? `<button type="button" class="btn-outline mt-5 w-full" data-ics>${icon('calendarCheck', 'h-4 w-4')} Add to calendar</button>` : ''}
            </section>
            <section class="card card-pad" aria-labelledby="reg-title" data-registration>
              <h2 id="reg-title" class="section-title">${isAdmin ? 'Registrations' : 'Registration'}</h2>
              <div class="mt-4" data-reg-body>${ui.skeleton.lines(3)}</div>
            </section>
          </aside>
        </div>
      </article>`;
  }

  // ------------------------------------------------------------------
  // Registration (users)
  // ------------------------------------------------------------------
  async function renderRegistration() {
    const $body = $root.find('[data-reg-body]');
    const status = utils.eventStatus(event);
    try {
      const res = await CE.api.registrations.mine();
      const reg = (res.data || []).find((r) => r.event_id === event.id);

      if (reg && reg.status === 'registered') {
        $body.html(`
          <div class="rounded-xl bg-green-50 p-4 ring-1 ring-inset ring-green-200">
            <p class="flex items-center gap-2 font-semibold text-success-text">${icon('checkCircle')} You're registered</p>
            <p class="mt-1 text-sm text-ink-soft">Registered ${escape(utils.timeAgo(reg.created_at))}. We'll see you there!</p>
          </div>
          ${status !== 'past' ? `<button type="button" class="btn-outline mt-4 w-full text-danger hover:border-danger hover:text-danger" data-cancel-reg>${icon('xCircle', 'h-4 w-4')} Cancel registration</button>` : ''}`);
      } else if (reg && reg.status === 'cancelled') {
        $body.html(`<div class="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-line">
            <p class="font-semibold text-ink">Registration cancelled</p>
            <p class="mt-1 text-sm text-ink-soft">You cancelled ${escape(utils.timeAgo(reg.updated_at))}. The registration API does not support re-registering for the same event after cancelling.</p>
          </div>`);
      } else if (status === 'past') {
        $body.html('<p class="text-sm text-ink-soft">This event has ended, so registration is closed.</p>');
      } else {
        $body.html(`<p class="text-sm text-ink-soft">Reserve your place — it's free. You can cancel any time before the event.</p>
          <button type="button" class="btn-accent mt-4 w-full" data-register-detail>${icon('ticket', 'h-4 w-4')} Register for this event</button>`);
      }
    } catch (err) {
      ui.errorState($body, err, renderRegistration);
    }
  }

  $root.on('click', '[data-register-detail]', async function () {
    const $btn = $(this);
    ui.setLoading($btn, true, 'Registering…');
    try {
      await CE.api.registrations.register(event.id);
      ui.toast('success', `You're registered for “${event.title}”.`, 'Registration confirmed');
      renderRegistration();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  });

  $root.on('click', '[data-cancel-reg]', async function () {
    const ok = await ui.confirm({
      title: 'Cancel your registration?',
      message: `You will no longer be registered for “${event.title}”. The API does not allow registering again for the same event afterwards.`,
      confirmText: 'Cancel registration',
      danger: true,
    });
    if (!ok) return;
    const $btn = $(this);
    ui.setLoading($btn, true, 'Cancelling…');
    try {
      await CE.api.registrations.cancel(event.id);
      ui.toast('success', 'Your registration has been cancelled.', 'Registration cancelled');
      renderRegistration();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  });

  // ------------------------------------------------------------------
  // Attendees (admin)
  // ------------------------------------------------------------------
  async function renderAttendees() {
    const $body = $root.find('[data-reg-body]');
    try {
      const res = await CE.api.registrations.attendees(event.id);
      const list = res.data || [];
      $body.html(`
        <p class="font-heading text-3xl font-extrabold text-ink">${list.length}</p>
        <p class="text-sm text-ink-soft">${list.length === 1 ? 'resident registered' : 'residents registered'}</p>
        ${list.length ? `<ul class="mt-4 max-h-72 divide-y divide-line overflow-y-auto">${list.map((a) => `
          <li class="flex items-center gap-3 py-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand-deep" aria-hidden="true">${escape(utils.initials(a.full_name))}</span>
            <span class="min-w-0"><span class="block truncate text-sm font-semibold">${escape(a.full_name)}</span><span class="block truncate text-xs text-ink-muted">${escape(a.email)}</span></span>
          </li>`).join('')}</ul>` : ''}
        <div class="mt-5 flex gap-2 border-t border-line pt-4">
          <a class="btn-outline btn-sm flex-1" href="${utils.page('event-form.html', { id: event.id })}">${icon('edit', 'h-4 w-4')} Edit</a>
          <button type="button" class="btn-sm btn flex-1 text-danger hover:bg-red-50" data-delete-event="${escape(event.id)}" data-title="${escape(event.title)}">${icon('trash', 'h-4 w-4')} Delete</button>
        </div>`);
    } catch (err) {
      ui.errorState($body, err, renderAttendees);
    }
  }

  // ------------------------------------------------------------------
  // Feedback
  // ------------------------------------------------------------------
  function feedbackForm(existing) {
    const rating = existing ? existing.rating : 0;
    return `<form data-feedback-form class="space-y-5" novalidate>
        <div data-form-alert aria-live="assertive"></div>
        <fieldset data-field>
          <legend class="form-label">How would you rate this event? <span class="text-danger" aria-hidden="true">*</span></legend>
          <div class="flex items-center gap-1" data-stars id="rating">
            ${[1, 2, 3, 4, 5].map((n) => `
              <input type="radio" class="peer sr-only" name="rating" id="rating-${n}" value="${n}" ${n === rating ? 'checked' : ''}>
              <label for="rating-${n}" class="star-btn cursor-pointer ${n <= rating ? 'is-lit' : ''}" data-star="${n}">
                ${icon('star', 'h-8 w-8')}<span class="sr-only">${n} star${n > 1 ? 's' : ''}</span>
              </label>`).join('')}
            <span class="ml-2 text-sm font-semibold text-ink-soft" data-rating-label aria-hidden="true">${rating ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating] : ''}</span>
          </div>
        </fieldset>
        <div>
          <label for="comment" class="form-label">Comment <span class="text-danger" aria-hidden="true">*</span></label>
          <textarea id="comment" name="comment" rows="4" class="form-input" maxlength="1000" placeholder="What went well? What could be better?" aria-describedby="comment-count">${escape(existing ? existing.comment || '' : '')}</textarea>
          <p id="comment-count" class="form-hint text-right">0 / 1000</p>
        </div>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          ${existing ? '<button type="button" class="btn-outline" data-cancel-edit>Cancel</button>' : ''}
          <button type="submit" class="btn-primary">${icon('send', 'h-4 w-4')} ${existing ? 'Update feedback' : 'Submit feedback'}</button>
        </div>
      </form>`;
  }

  function feedbackSummary(fb) {
    return `<div class="rounded-xl bg-brand-light/60 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">${ui.stars(fb.rating, 'h-5 w-5')}<span class="text-sm font-semibold">${fb.rating}/5</span></div>
          <span class="text-xs text-ink-muted">Submitted ${escape(utils.timeAgo(fb.created_at))}${fb.updated_at && fb.updated_at !== fb.created_at ? ' · edited' : ''}</span>
        </div>
        <p class="mt-3 whitespace-pre-line text-sm text-ink">${escape(fb.comment || '')}</p>
      </div>
      <p class="mt-3 text-xs text-ink-muted">You can submit one review per event. Feedback is shared with the organisers.</p>
      <button type="button" class="btn-outline btn-sm mt-3" data-edit-feedback>${icon('edit', 'h-4 w-4')} Edit my feedback</button>`;
  }

  let myFeedback = null;

  async function renderUserFeedback() {
    const $fb = $root.find('[data-feedback]');
    try {
      const res = await CE.api.feedback.mine();
      myFeedback = (res.data || []).find((f) => f.event_id === event.id) || null;
      $fb.html(myFeedback ? feedbackSummary(myFeedback) : `<p class="mb-4 text-sm text-ink-soft">Attended this event? Rate it and help organisers improve future events.</p>${feedbackForm(null)}`);
      updateCount();
    } catch (err) {
      ui.errorState($fb, err, renderUserFeedback);
    }
  }

  function updateCount() {
    const len = ($root.find('#comment').val() || '').length;
    $root.find('#comment-count').text(`${len} / 1000`);
  }

  function paintStars(value) {
    $root.find('[data-star]').each(function () { $(this).toggleClass('is-lit', Number($(this).data('star')) <= value); });
    $root.find('[data-rating-label]').text(value ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][value] : '');
  }

  $root.on('input', '#comment', updateCount);
  $root.on('change', 'input[name=rating]', function () {
    paintStars(Number(this.value));
    ui.clearFieldError($root.find('#rating'));
  });
  $root.on('mouseenter', '[data-star]', function () { paintStars(Number($(this).data('star'))); });
  $root.on('mouseleave', '[data-stars]', () => paintStars(Number($root.find('input[name=rating]:checked').val()) || 0));
  $root.on('click', '[data-edit-feedback]', () => {
    $root.find('[data-feedback]').html(feedbackForm(myFeedback));
    updateCount();
    $root.find('input[name=rating]:checked').trigger('focus');
  });
  $root.on('click', '[data-cancel-edit]', renderUserFeedback);

  $root.on('submit', '[data-feedback-form]', async function (e) {
    e.preventDefault();
    const $form = $(this);
    ui.clearFormErrors($form);
    const rating = Number($form.find('input[name=rating]:checked').val());
    const comment = $form.find('#comment').val().trim();
    const errors = {};
    if (!rating || rating < 1 || rating > 5) errors.rating = 'Please choose a rating from 1 to 5 stars.';
    if (!comment) errors.comment = 'Please add a short comment.';
    else if (comment.length < 3) errors.comment = 'Comment must be at least 3 characters.';
    if (Object.keys(errors).length) {
      if (errors.rating) ui.fieldError($form.find('#rating'), errors.rating);
      if (errors.comment) ui.fieldError($form.find('#comment'), errors.comment);
      $form.find(errors.rating ? 'input[name=rating]' : '#comment').first().trigger('focus');
      return;
    }
    const $btn = $form.find('[type=submit]');
    ui.setLoading($btn, true, 'Saving…');
    try {
      if (myFeedback) await CE.api.feedback.update(myFeedback.id, { rating, comment });
      else await CE.api.feedback.create({ event_id: event.id, rating, comment });
      ui.toast('success', 'Thank you — your feedback has been saved.', myFeedback ? 'Feedback updated' : 'Feedback submitted');
      renderUserFeedback();
    } catch (err) {
      ui.setLoading($btn, false);
      // UNIQUE(user_id, event_id) → backend responds 409 "Duplicate entry"
      ui.formAlert($form, 'error', err.status === 409 ? 'You have already submitted feedback for this event. Refresh to edit it.' : err.message);
    }
  });

  async function renderAdminFeedback() {
    const $fb = $root.find('[data-feedback]');
    try {
      const res = await CE.api.feedback.forEvent(event.id);
      const list = res.data || [];
      if (!list.length) {
        $fb.html(ui.emptyState({ icon: 'star', title: 'No feedback yet', message: 'Ratings from residents will appear here.', className: 'border-0 py-8' }));
        return;
      }
      const avg = list.reduce((s, f) => s + Number(f.rating || 0), 0) / list.length;
      const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: list.filter((f) => Number(f.rating) === n).length }));
      $fb.html(`
        <div class="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
          <div class="text-center sm:pr-6">
            <p class="font-heading text-5xl font-extrabold text-ink">${avg.toFixed(1)}</p>
            <div class="mt-1">${ui.stars(avg, 'h-5 w-5')}</div>
            <p class="mt-1 text-xs text-ink-muted">Average of ${utils.plural(list.length, 'review')}</p>
          </div>
          <ul class="space-y-1.5" aria-label="Rating distribution">${dist.map((d) => `
            <li class="flex items-center gap-3 text-xs"><span class="w-10 font-semibold">${d.n} star</span>
              <span class="progress flex-1" aria-hidden="true"><span style="width:${(d.c / list.length) * 100}%" class="!bg-accent"></span></span>
              <span class="w-8 text-right tabular-nums text-ink-soft">${d.c}</span><span class="sr-only">${utils.plural(d.c, 'review')}</span></li>`).join('')}
          </ul>
        </div>
        <ul class="mt-6 divide-y divide-line border-t border-line">${list.map((f) => `
          <li class="py-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold">${escape(f.full_name)}</p>
              <span class="flex items-center gap-2">${ui.stars(f.rating)}<span class="text-xs text-ink-muted">${escape(utils.timeAgo(f.created_at))}</span></span>
            </div>
            <p class="mt-1.5 whitespace-pre-line text-sm text-ink-soft">${escape(f.comment || '')}</p>
          </li>`).join('')}</ul>`);
    } catch (err) {
      ui.errorState($fb, err, renderAdminFeedback);
    }
  }

  // ------------------------------------------------------------------
  // Add to calendar (.ics generated client-side from the event data)
  // ------------------------------------------------------------------
  $root.on('click', '[data-ics]', () => {
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s) => String(s || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CivicEvents+//EN', 'BEGIN:VEVENT',
      `UID:${event.id}@civicevents`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(event.starts_at)}`,
      `DTEND:${stamp(event.ends_at || event.starts_at)}`, `SUMMARY:${esc(event.title)}`, `LOCATION:${esc(event.location)}`,
      `DESCRIPTION:${esc(event.description)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = event.title.replace(/[^\w]+/g, '-').toLowerCase() + '.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    ui.toast('success', 'Calendar file downloaded.');
  });

  components.bindEventActions($root, () => { window.location.href = utils.page('admin-events.html'); });

  // ------------------------------------------------------------------
  async function load() {
    skeleton();
    try {
      const res = await CE.api.events.get(eventId);
      event = res.data;
      // Normal users must not see unpublished events, even via a direct link.
      if (!isAdmin && !event.published) throw new CE.api.ApiError(404, 'Event not found');
      $root.html(shell(event));
      if (isAdmin) { renderAttendees(); renderAdminFeedback(); } else { renderRegistration(); renderUserFeedback(); }
    } catch (err) {
      // A malformed id reaches Postgres as an invalid uuid and comes back as a 500
      if (err.status === 404 || /invalid input syntax/i.test(err.message)) {
        $root.html(ui.emptyState({ icon: 'calendar', title: 'Event not found', message: 'This event may have been removed or is no longer available.', action: `<a class="btn-primary mt-4" href="${utils.page('events.html')}">Browse events</a>` }));
      } else {
        ui.errorState($root, err, load);
      }
    }
  }

  load();
})(window.CE, window.jQuery);
