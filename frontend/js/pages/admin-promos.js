/**
 * Promos management (admin).
 *   GET    /api/promos
 *   POST   /api/promos        multipart, file field "video", { title, description, caption_text }
 *   PUT    /api/promos/:id    multipart, optional "video", { title, description, caption_text, published }
 *   PATCH  /api/promos/:id/publish | /unpublish
 *   DELETE /api/promos/:id
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils } = CE;
  const { escape, page } = utils;
  const icon = CE.icon;
  const $host = $('#table-host');
  let items = [];

  const columns = [
    {
      label: 'Promo',
      render: (p) => `<div class="flex items-center gap-3">
          <span class="relative block h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-brand-deep"><video class="h-full w-full object-cover" data-src="${escape(p.video_url)}" preload="none" muted aria-hidden="true" tabindex="-1"></video></span>
          <a href="${page('promo.html', { id: p.id })}" class="font-semibold text-ink no-underline hover:text-brand-strong">${escape(p.title)}</a>
        </div>`,
    },
    { label: 'Description', render: (p) => `<span class="line-clamp-2 max-w-xs text-ink-soft">${escape(p.description || '—')}</span>`, hideOnCard: true },
    { label: 'Captions', render: (p) => (p.caption_text ? `<span class="badge-blue">${icon('captions', 'h-3.5 w-3.5')} Yes</span>` : '<span class="badge-gray">None</span>') },
    { label: 'Created', render: (p) => `<span class="whitespace-nowrap">${escape(utils.formatDate(p.created_at))}</span>` },
    { label: 'Status', render: (p) => ui.statusBadge(p.published) },
  ];

  const actions = (p) => `
    <a href="${page('promo.html', { id: p.id })}" class="btn-ghost btn-sm" aria-label="Watch ${escape(p.title)}">${icon('play', 'h-4 w-4')}<span class="md:sr-only">Watch</span></a>
    <button type="button" class="btn-ghost btn-sm" data-toggle="${escape(p.id)}" aria-label="${p.published ? 'Unpublish' : 'Publish'} ${escape(p.title)}">${icon(p.published ? 'eyeOff' : 'eye', 'h-4 w-4')}<span>${p.published ? 'Unpublish' : 'Publish'}</span></button>
    <button type="button" class="btn-ghost btn-sm" data-edit="${escape(p.id)}" aria-label="Edit ${escape(p.title)}">${icon('edit', 'h-4 w-4')}<span class="md:sr-only">Edit</span></button>
    <button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-delete="${escape(p.id)}" aria-label="Delete ${escape(p.title)}">${icon('trash', 'h-4 w-4')}<span class="md:sr-only">Delete</span></button>`;

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const st = $('#status-filter').val();
    const list = items.filter((p) => (!q || `${p.title} ${p.description || ''}`.toLowerCase().includes(q))
      && (st === 'all' || (st === 'published' ? p.published : !p.published)));
    $('#results-count').text(`${utils.plural(list.length, 'promo')} · ${items.filter((p) => p.published).length} published`);
    $host.html(list.length
      ? ui.dataTable(columns, list, { caption: 'Promos', actions })
      : `<div class="p-6">${ui.emptyState({ icon: 'film', title: items.length ? 'No matching promos' : 'No promos yet', message: items.length ? 'Try another search or status.' : 'Upload your first promotional video.', action: items.length ? '' : `<button type="button" class="btn-primary mt-4" data-create>${icon('plus', 'h-4 w-4')} New promo</button>`, className: 'border-0' })}</div>`);
    CE.media.lazyThumbnails($host);
  }

  async function load() {
    $host.html(ui.tableSkeleton(5));
    try {
      const res = await CE.api.promos.list();
      items = res.data || [];
      render();
    } catch (err) {
      ui.errorState($host, err, load);
    }
  }

  const find = (id) => items.find((p) => p.id === String(id));

  /** Shared create/edit form. `promo` is null when creating. */
  function openForm(promo) {
    const editing = Boolean(promo);
    let previewUrl = null;
    const m = ui.modal({
      title: editing ? 'Edit promo' : 'New promotional video',
      size: 'lg',
      onClose: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); },
      body: `<form id="promo-form" class="space-y-5" novalidate>
          <div data-form-alert aria-live="assertive"></div>
          <div>
            <label for="pr-title" class="form-label">Title <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="pr-title" name="title" class="form-input" maxlength="200" value="${escape(promo ? promo.title : '')}" required autofocus>
          </div>
          <div>
            <label for="pr-description" class="form-label">Description <span class="text-danger" aria-hidden="true">*</span></label>
            <textarea id="pr-description" name="description" rows="3" class="form-input" maxlength="2000" required>${escape(promo ? promo.description || '' : '')}</textarea>
          </div>
          <div>
            <label for="pr-captions" class="form-label">Caption text <span class="text-danger" aria-hidden="true">*</span></label>
            <textarea id="pr-captions" name="caption_text" rows="6" class="form-input" maxlength="5000" aria-describedby="pr-captions-hint" required>${escape(promo ? promo.caption_text || '' : '')}</textarea>
            <p id="pr-captions-hint" class="form-hint">Start each line with the time it is spoken, e.g. <code>0:05 Welcome to Kigali</code>. A pasted SRT/VTT file or YouTube transcript also works. Without times, captions are spread evenly and won’t match the speech.</p>
          </div>
          <div data-field>
            <span class="form-label" id="pr-video-label">Video file ${editing ? '<span class="font-normal text-ink-muted">(optional — leave empty to keep the current video)</span>' : '<span class="text-danger" aria-hidden="true">*</span>'}</span>
            <input id="pr-video" name="video" type="file" accept=".mp4,.mov,.avi,.mkv,video/*" class="sr-only" aria-labelledby="pr-video-label">
            <label for="pr-video" class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-brand-light/50 px-4 py-6 text-center transition hover:border-brand">
              <span class="text-brand">${icon('upload', 'h-6 w-6')}</span>
              <span class="text-sm font-semibold text-ink" data-file-name>Choose a video file</span>
              <span class="text-xs text-ink-muted">MP4, MOV, AVI or MKV · up to 100 MB</span>
            </label>
          </div>
          <div data-video-preview></div>
          <label class="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" name="published" class="mt-1 h-4 w-4 accent-brand-strong" ${!promo || promo.published ? 'checked' : ''}>
            <span><span class="block text-sm font-semibold">${editing ? 'Published' : 'Publish immediately'}</span><span class="text-xs text-ink-soft">Visible to residents in the promo gallery.</span></span>
          </label>
          <div data-upload-progress></div>
        </form>`,
      footer: `<button type="button" class="btn-outline" data-close>Cancel</button><button type="submit" form="promo-form" class="btn-primary">${editing ? 'Save changes' : 'Upload promo'}</button>`,
    });
    const $form = m.$panel.find('form');

    $form.on('input', '.form-input', function () { ui.clearFieldError($(this)); });
    $form.on('change', '#pr-video', function () {
      const file = this.files[0];
      ui.clearFieldError($(this));
      $form.find('[data-video-preview]').empty();
      if (!file) return;
      const err = ui.validateFile(file, 'video');
      if (err) { ui.fieldError($(this), err); this.value = ''; $form.find('[data-file-name]').text('Choose a video file'); return; }
      $form.find('[data-file-name]').text(`${file.name} (${utils.formatBytes(file.size)})`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      $form.find('[data-video-preview]').html(`<video src="${previewUrl}" controls muted class="aspect-video w-full rounded-xl bg-black" aria-label="Preview of the selected video"></video>
        <p class="mt-2 text-xs text-ink-muted" data-cover-note>Creating a cover image from the video…</p>`);
      // Show the cover residents will see: a screenshot taken from the video itself.
      const thisUrl = previewUrl;
      CE.media.captureFrame(thisUrl).then((src) => {
        if (thisUrl !== previewUrl) return; // a different file was chosen meanwhile
        $form.find('[data-video-preview] video').attr('poster', src);
        $form.find('[data-cover-note]').text('Cover image: a screenshot from the video is shown on promo cards and before playback.');
      }).catch(() => $form.find('[data-cover-note]').text('A cover will be taken from the video once it is uploaded.'));
    });

    $form.on('submit', async (e) => {
      e.preventDefault();
      ui.clearFormErrors($form);
      const data = {
        title: $form.find('[name=title]').val().trim(),
        description: $form.find('[name=description]').val().trim(),
        caption_text: $form.find('[name=caption_text]').val().trim(),
      };
      const file = $form.find('#pr-video')[0].files[0];
      const publish = $form.find('[name=published]').is(':checked');
      const errors = {};
      if (!data.title) errors.title = 'Title is required.';
      if (!data.description) errors.description = 'Description is required.';
      if (!data.caption_text) errors.caption_text = 'Caption text is required so the video is accessible.';
      if (!editing && !file) errors.video = 'Please choose a video file to upload.';
      if (!ui.applyErrors($form, errors)) return;

      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      if (editing) fd.append('published', publish ? 'true' : 'false');
      if (file) fd.append('video', file); // exact multipart field name expected by multer

      const $btn = m.$panel.find('[type=submit]');
      const progress = file ? ui.progressBar($form.find('[data-upload-progress]')) : null;
      ui.setLoading($btn, true, file ? 'Uploading…' : 'Saving…');
      try {
        if (editing) {
          await CE.api.promos.update(promo.id, fd, progress && progress.update);
        } else {
          const res = await CE.api.promos.create(fd, progress && progress.update);
          // POST /promos always creates a published promo; drafts are unpublished straight after.
          if (!publish) await CE.api.promos.unpublish(res.data.id);
        }
        m.close();
        if (publish) {
          ui.toast('success', editing ? `“${data.title}” was updated and is visible to residents.` : `“${data.title}” was uploaded and is live for residents.`, editing ? 'Promo updated' : 'Promo published');
        } else {
          // Make a hidden draft obvious, so admins don't wonder why residents can't see it.
          ui.toast('info', `“${data.title}” was saved as a draft and is hidden from residents. Use “Publish” in the list to make it visible.`, 'Saved as draft');
        }
        load();
      } catch (err) {
        if (progress) progress.done();
        ui.setLoading($btn, false);
        ui.formAlert($form, 'error', err.message);
      }
    });
  }

  $host.on('click', '[data-toggle]', async function () {
    const p = find($(this).data('toggle'));
    const $btn = $(this);
    ui.setLoading($btn, true, p.published ? 'Unpublishing…' : 'Publishing…');
    try {
      if (p.published) await CE.api.promos.unpublish(p.id); else await CE.api.promos.publish(p.id);
      ui.toast('success', p.published ? `“${p.title}” is now hidden from residents.` : `“${p.title}” is live and residents were notified.`);
      load();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  });

  $host.on('click', '[data-edit]', function () { openForm(find($(this).data('edit'))); });

  $host.on('click', '[data-delete]', async function () {
    const p = find($(this).data('delete'));
    const ok = await ui.confirm({ title: 'Delete promo?', message: `“${p.title}” will be permanently deleted.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await CE.api.promos.remove(p.id);
      ui.toast('success', `“${p.title}” was deleted.`);
      load();
    } catch (err) {
      ui.toast('error', err.message);
    }
  });

  $('#create-btn').on('click', () => openForm(null));
  $host.on('click', '[data-create]', () => openForm(null));
  $('#q').on('input', utils.debounce(render, 200));
  $('#status-filter').on('change', render);

  load();
  if (utils.param('new')) openForm(null);
})(window.CE, window.jQuery);
