/**
 * Create / edit event (admin only).
 *   POST /api/events      multipart/form-data, file field "image"
 *   PUT  /api/events/:id  multipart/form-data, file field "image" (optional)
 * The uploaded image's public URL is stored by the backend in metadata.image_url.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only. The backend enforces authorize(['admin']) as well.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils, validate } = CE;
  const eventId = utils.param('id');
  const $form = $('#event-form');
  const $preview = $form.find('[data-preview]');
  const $submit = $form.find('[data-submit]');
  let existing = null;
  let previewUrl = null;
  let dirty = false;

  function showPreview(src, alt) {
    $preview.html(`<img src="${utils.escape(src)}" alt="${utils.escape(alt || 'Selected event image preview')}" class="aspect-[16/9] w-full object-cover">`);
  }

  function updateDescCount() {
    $('#description-count').text(`${$('#description').val().length} / 5000`);
  }

  // Default schedule for new events: tomorrow 10:00–12:00 local time
  function defaults() {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600e3);
    $('#starts_at').val(utils.toLocalInput(start.toISOString()));
    $('#ends_at').val(utils.toLocalInput(end.toISOString()));
  }

  async function loadExisting() {
    $('[data-form-title]').text('Edit event');
    $('[data-form-sub]').text('Update the details residents see. Changes are visible immediately.');
    $submit.text('Save changes');
    document.title = 'Edit event · CivicEvents+';
    $form.find('input, textarea, button').prop('disabled', true);
    try {
      const res = await CE.api.events.get(eventId);
      existing = res.data;
      $('#title').val(existing.title);
      $('#description').val(existing.description || '');
      $('#location').val(existing.location || '');
      $('#starts_at').val(utils.toLocalInput(existing.starts_at));
      $('#ends_at').val(utils.toLocalInput(existing.ends_at));
      $('[data-publish-note]').html(`This event is currently <strong>${existing.published ? 'published' : 'not published'}</strong>. The events API does not accept a publish/unpublish setting, so visibility cannot be changed from this form.`);
      if (existing.metadata && existing.metadata.image_url) {
        showPreview(existing.metadata.image_url, 'Current image for ' + existing.title);
        $('[data-file-label]').text('Replace image');
      }
      updateDescCount();
    } catch (err) {
      ui.formAlert($form, 'error', err.status === 404 ? 'This event no longer exists.' : err.message);
      return;
    } finally {
      $form.find('input, textarea, button').prop('disabled', false);
    }
  }

  // Image selection → validate type/size like the backend (2 MB, jpg/jpeg/png/gif) and preview.
  $('#image').on('change', function () {
    const file = this.files[0];
    const $input = $(this);
    ui.clearFieldError($input);
    if (!file) return;
    const error = ui.validateFile(file, 'image');
    if (error) {
      ui.fieldError($input, error);
      $input.val('');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    showPreview(previewUrl, 'Preview of ' + file.name);
    $('[data-file-label]').text(`${file.name} (${utils.formatBytes(file.size)})`);
    dirty = true;
  });

  $('#description').on('input', updateDescCount);
  $form.on('input', '.form-input', function () { ui.clearFieldError($(this)); dirty = true; });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  function collectErrors() {
    const errors = {};
    const title = $('#title').val().trim();
    const desc = $('#description').val().trim();
    const loc = $('#location').val().trim();
    const start = $('#starts_at').val();
    const end = $('#ends_at').val();
    if (!title) errors.title = 'Title is required.';
    else if (title.length < 3) errors.title = 'Title must be at least 3 characters.';
    const descErr = validate.required(desc, 'Description');
    if (descErr) errors.description = descErr;
    if (!loc) errors.location = 'Location is required.';
    if (!start) errors.starts_at = 'Start date and time are required.';
    if (!end) errors.ends_at = 'End date and time are required.';
    if (start && end && new Date(end) <= new Date(start)) errors.ends_at = 'The event must end after it starts.';
    // New events must start in the future; edits may keep their original (possibly past) date.
    if (!existing && start && new Date(start) < new Date()) errors.starts_at = 'Start time must be in the future.';
    return errors;
  }

  $form.on('submit', async (e) => {
    e.preventDefault();
    ui.clearFormErrors($form);
    if (!ui.applyErrors($form, collectErrors())) return;

    const fd = new FormData();
    fd.append('title', $('#title').val().trim());
    fd.append('description', $('#description').val().trim());
    fd.append('location', $('#location').val().trim());
    // datetime-local is local time → send ISO with timezone so the API stores the right instant
    fd.append('starts_at', new Date($('#starts_at').val()).toISOString());
    fd.append('ends_at', new Date($('#ends_at').val()).toISOString());
    const file = $('#image')[0].files[0];
    if (file) fd.append('image', file); // exact multipart field name expected by multer

    const progress = file ? ui.progressBar($form.find('[data-upload-progress]')) : null;
    ui.setLoading($submit, true, existing ? 'Saving…' : 'Creating…');
    try {
      const res = existing
        ? await CE.api.events.update(eventId, fd, progress && progress.update)
        : await CE.api.events.create(fd, progress && progress.update);
      dirty = false;
      CE.auth.flash('success', existing ? `“${res.data.title}” was updated.` : `“${res.data.title}” was created and residents were notified.`);
      window.location.href = utils.page('event.html', { id: res.data.id });
    } catch (err) {
      ui.setLoading($submit, false);
      if (progress) progress.done();
      ui.formAlert($form, 'error', err.message);
      ui.toast('error', err.message, existing ? 'Could not save event' : 'Could not create event');
      $form.find('[data-form-alert]')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  if (eventId) loadExisting(); else defaults();
})(window.CE, window.jQuery);
