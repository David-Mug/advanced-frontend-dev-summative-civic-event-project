/**
 * Announcements management (admin).
 *   GET    /api/announcements
 *   POST   /api/announcements             multipart, file field "audio", { title, published }
 *   PUT    /api/announcements/:id         { title, published }  (the API ignores new audio on update)
 *   PATCH  /api/announcements/:id/publish | /unpublish
 *   DELETE /api/announcements/:id
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils, components } = CE;
  const { escape, page } = utils;
  const icon = CE.icon;
  const $host = $('#table-host');
  let items = [];

  const columns = [
    {
      label: 'Announcement',
      render: (a) => `<div class="flex items-center gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-ink">${icon('megaphone', 'h-5 w-5')}</span>
          <a href="${page('announcement.html', { id: a.id })}" class="font-semibold text-ink no-underline hover:text-brand-strong">${escape(a.title)}</a>
        </div>`,
    },
    { label: 'Duration', render: (a) => `<span class="tabular-nums" data-duration="${escape(a.audio_url)}">--:--</span>` },
    { label: 'Created', render: (a) => `<span class="whitespace-nowrap">${escape(utils.formatDate(a.created_at))}</span>` },
    { label: 'Status', render: (a) => ui.statusBadge(a.published) },
  ];

  const actions = (a) => `
    <button type="button" class="btn-ghost btn-sm" data-preview="${escape(a.id)}" aria-label="Listen to ${escape(a.title)}">${icon('play', 'h-4 w-4')}<span class="md:sr-only">Listen</span></button>
    <button type="button" class="btn-ghost btn-sm" data-toggle="${escape(a.id)}" aria-label="${a.published ? 'Unpublish' : 'Publish'} ${escape(a.title)}">${icon(a.published ? 'eyeOff' : 'eye', 'h-4 w-4')}<span>${a.published ? 'Unpublish' : 'Publish'}</span></button>
    <button type="button" class="btn-ghost btn-sm" data-edit="${escape(a.id)}" aria-label="Edit ${escape(a.title)}">${icon('edit', 'h-4 w-4')}<span class="md:sr-only">Edit</span></button>
    <button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-delete="${escape(a.id)}" aria-label="Delete ${escape(a.title)}">${icon('trash', 'h-4 w-4')}<span class="md:sr-only">Delete</span></button>`;

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const st = $('#status-filter').val();
    const list = items.filter((a) => (!q || a.title.toLowerCase().includes(q))
      && (st === 'all' || (st === 'published' ? a.published : !a.published)));
    $('#results-count').text(`${utils.plural(list.length, 'announcement')} · ${items.filter((a) => a.published).length} published`);
    $host.html(list.length
      ? ui.dataTable(columns, list, { caption: 'Announcements', actions })
      : `<div class="p-6">${ui.emptyState({ icon: 'megaphone', title: items.length ? 'No matching announcements' : 'No announcements yet', message: items.length ? 'Try another search or status.' : 'Upload your first audio announcement.', action: items.length ? '' : `<button type="button" class="btn-primary mt-4" data-create>${icon('plus', 'h-4 w-4')} New announcement</button>`, className: 'border-0' })}</div>`);
    components.hydrateDurations($host);
  }

  async function load() {
    $host.html(ui.tableSkeleton(5));
    try {
      const res = await CE.api.announcements.list();
      items = res.data || [];
      render();
    } catch (err) {
      ui.errorState($host, err, load);
    }
  }

  const find = (id) => items.find((a) => a.id === String(id));

  // ---------------- Create ----------------
  function openCreate() {
    let previewAudio = null;
    const m = ui.modal({
      onClose: () => previewAudio && previewAudio.pause(),
      title: 'New audio announcement',
      body: `<form id="ann-create" class="space-y-5" novalidate>
          <div data-form-alert aria-live="assertive"></div>
          <div>
            <label for="ann-title" class="form-label">Title <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="ann-title" name="title" class="form-input" maxlength="200" required autofocus>
          </div>
          <div data-field>
            <span class="form-label" id="ann-audio-label">Audio file <span class="text-danger" aria-hidden="true">*</span></span>
            <input id="ann-audio" name="audio" type="file" accept=".mp3,.wav,.m4a,.ogg,audio/*" class="sr-only" aria-labelledby="ann-audio-label">
            <label for="ann-audio" class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-brand-light/50 px-4 py-6 text-center transition hover:border-brand">
              <span class="text-brand">${icon('upload', 'h-6 w-6')}</span>
              <span class="text-sm font-semibold text-ink" data-file-name>Choose an audio file</span>
              <span class="text-xs text-ink-muted">MP3, WAV, M4A or OGG · up to 5 MB</span>
            </label>
          </div>
          <div data-audio-preview></div>
          <label class="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" name="published" class="mt-1 h-4 w-4 accent-brand-strong" checked>
            <span><span class="block text-sm font-semibold">Publish immediately</span><span class="text-xs text-ink-soft">Residents can listen right away. Unchecked saves it as a draft.</span></span>
          </label>
          <div data-upload-progress></div>
        </form>`,
      footer: '<button type="button" class="btn-outline" data-close>Cancel</button><button type="submit" form="ann-create" class="btn-primary">Upload announcement</button>',
    });
    const $form = m.$panel.find('form');
    let previewUrl = null;

    $form.on('change', '#ann-audio', function () {
      const file = this.files[0];
      ui.clearFieldError($(this));
      if (!file) return;
      const err = ui.validateFile(file, 'audio');
      if (err) { ui.fieldError($(this), err); this.value = ''; $form.find('[data-file-name]').text('Choose an audio file'); return; }
      $form.find('[data-file-name]').text(`${file.name} (${utils.formatBytes(file.size)})`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      previewAudio = CE.media.audioPlayer($form.find('[data-audio-preview]'), { src: previewUrl, title: 'Preview of ' + file.name, compact: true });
    });
    $form.on('input', '#ann-title', function () { ui.clearFieldError($(this)); });

    $form.on('submit', async (e) => {
      e.preventDefault();
      ui.clearFormErrors($form);
      const title = $form.find('#ann-title').val().trim();
      const file = $form.find('#ann-audio')[0].files[0];
      const errors = {};
      if (!title) errors.title = 'Title is required.';
      if (!file) errors.audio = 'Please choose an audio file to upload.';
      if (!ui.applyErrors($form, errors)) return;

      const fd = new FormData();
      fd.append('title', title);
      fd.append('published', $form.find('[name=published]').is(':checked') ? 'true' : 'false');
      fd.append('audio', file); // exact multipart field name expected by multer
      const $btn = m.$panel.find('[type=submit]');
      const progress = ui.progressBar($form.find('[data-upload-progress]'));
      ui.setLoading($btn, true, 'Uploading…');
      try {
        await CE.api.announcements.create(fd, progress.update);
        m.close();
        ui.toast('success', `“${title}” was uploaded.`, 'Announcement created');
        load();
      } catch (err) {
        progress.done();
        ui.setLoading($btn, false);
        ui.formAlert($form, 'error', err.message);
      }
    });
  }

  // ---------------- Edit ----------------
  function openEdit(a) {
    const m = ui.modal({
      title: 'Edit announcement',
      body: `<form id="ann-edit" class="space-y-5" novalidate>
          <div data-form-alert aria-live="assertive"></div>
          <div>
            <label for="ann-edit-title" class="form-label">Title <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="ann-edit-title" name="title" class="form-input" maxlength="200" value="${escape(a.title)}" required autofocus>
          </div>
          <label class="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" name="published" class="mt-1 h-4 w-4 accent-brand-strong" ${a.published ? 'checked' : ''}>
            <span><span class="block text-sm font-semibold">Published</span><span class="text-xs text-ink-soft">Visible to residents in the announcement feed.</span></span>
          </label>
          <p class="flex items-start gap-2 rounded-xl bg-brand-light/60 p-3 text-xs text-ink-soft">${icon('info', 'h-4 w-4 shrink-0 text-brand-strong')} The announcements API keeps the original audio file when updating. To replace the audio, upload a new announcement and delete this one.</p>
        </form>`,
      footer: '<button type="button" class="btn-outline" data-close>Cancel</button><button type="submit" form="ann-edit" class="btn-primary">Save changes</button>',
    });
    const $form = m.$panel.find('form');
    $form.on('submit', async (e) => {
      e.preventDefault();
      ui.clearFormErrors($form);
      const title = $form.find('[name=title]').val().trim();
      if (!ui.applyErrors($form, title ? {} : { title: 'Title is required.' })) return;
      const $btn = m.$panel.find('[type=submit]');
      ui.setLoading($btn, true, 'Saving…');
      try {
        await CE.api.announcements.update(a.id, { title, published: $form.find('[name=published]').is(':checked') });
        m.close();
        ui.toast('success', 'Announcement updated.');
        load();
      } catch (err) {
        ui.setLoading($btn, false);
        ui.formAlert($form, 'error', err.message);
      }
    });
  }

  // ---------------- Row actions ----------------
  $host.on('click', '[data-preview]', function () {
    const a = find($(this).data('preview'));
    let audio = null;
    // Detached <audio> keeps playing, so stop it explicitly when the dialog closes.
    const m = ui.modal({ title: a.title, body: '<div data-player></div>', footer: '<button type="button" class="btn-primary" data-close>Close</button>', onClose: () => audio && audio.pause() });
    audio = CE.media.audioPlayer(m.$panel.find('[data-player]'), { src: a.audio_url, title: a.title });
    m.$panel.find('[data-play]').trigger('focus');
  });

  $host.on('click', '[data-toggle]', async function () {
    const a = find($(this).data('toggle'));
    const $btn = $(this);
    ui.setLoading($btn, true, a.published ? 'Unpublishing…' : 'Publishing…');
    try {
      if (a.published) await CE.api.announcements.unpublish(a.id); else await CE.api.announcements.publish(a.id);
      ui.toast('success', a.published ? `“${a.title}” is now hidden from residents.` : `“${a.title}” is live and residents were notified.`);
      load();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  });

  $host.on('click', '[data-edit]', function () { openEdit(find($(this).data('edit'))); });

  $host.on('click', '[data-delete]', async function () {
    const a = find($(this).data('delete'));
    const ok = await ui.confirm({ title: 'Delete announcement?', message: `“${a.title}” will be permanently deleted.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await CE.api.announcements.remove(a.id);
      ui.toast('success', `“${a.title}” was deleted.`);
      load();
    } catch (err) {
      ui.toast('error', err.message);
    }
  });

  $('#create-btn').on('click', openCreate);
  $host.on('click', '[data-create]', openCreate);
  $('#q').on('input', utils.debounce(render, 200));
  $('#status-filter').on('change', render);

  load();
  if (utils.param('new')) openCreate();
})(window.CE, window.jQuery);
