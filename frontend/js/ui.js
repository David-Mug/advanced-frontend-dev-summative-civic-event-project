/**
 * Reusable UI components: toasts, modals, confirm dialogs, loading/empty/error states,
 * form validation helpers, pagination and file validation.
 * All components are keyboard accessible and announce changes to screen readers.
 */
(function (CE, $) {
  'use strict';

  const { escape } = CE.utils;
  const icon = CE.icon;

  // ---------------------------------------------------------------
  // Screen-reader live region
  // ---------------------------------------------------------------
  function announce(message) {
    let region = document.getElementById('sr-announcer');
    if (!region) {
      region = document.createElement('div');
      region.id = 'sr-announcer';
      region.className = 'sr-only';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
  }

  // ---------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------
  const TOAST_ICON = { success: 'checkCircle', error: 'xCircle', info: 'info' };
  const TOAST_COLOR = { success: 'text-success-text', error: 'text-danger', info: 'text-brand-strong' };

  function toast(type, message, title) {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.className = 'toast-region';
      document.body.appendChild(region);
    }
    const kind = TOAST_ICON[type] ? type : 'info';
    const heading = title || (kind === 'success' ? 'Success' : kind === 'error' ? 'Something went wrong' : 'Heads up');
    const $t = $(`
      <div class="toast toast-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">
        <span class="${TOAST_COLOR[kind]} mt-0.5">${icon(TOAST_ICON[kind])}</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-ink">${escape(heading)}</p>
          <p class="mt-0.5 break-words text-ink-soft">${escape(message)}</p>
        </div>
        <button type="button" class="-m-1 rounded-md p-1 text-ink-muted hover:text-ink" aria-label="Dismiss notification">${icon('x', 'h-4 w-4')}</button>
      </div>`);
    const remove = () => $t.fadeOut(150, () => $t.remove());
    $t.find('button').on('click', remove);
    $(region).append($t);
    setTimeout(remove, kind === 'error' ? 7000 : 4500);
  }

  // ---------------------------------------------------------------
  // Modal (focus trap, Esc to close, focus returned to the opener)
  // ---------------------------------------------------------------
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * @param {object} o { title, body (html), footer (html), size: 'md'|'lg', onOpen($panel), onClose() }
   * @returns {{ $panel, close }}
   */
  function modal(o) {
    const opener = document.activeElement;
    const titleId = 'modal-title-' + Date.now();
    const width = o.size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';
    const $root = $(`
      <div class="modal-root">
        <div class="overlay" data-close></div>
        <div class="modal-shell" data-close>
          <div class="modal-panel ${width}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
            <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <h2 id="${titleId}" class="font-heading text-lg font-bold">${escape(o.title)}</h2>
              <button type="button" class="btn-icon -mr-2 -mt-1" data-close aria-label="Close dialog">${icon('x')}</button>
            </div>
            <div class="px-5 py-5 sm:px-6" data-body>${o.body || ''}</div>
            ${o.footer ? `<div class="flex flex-col-reverse gap-2 border-t border-line bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">${o.footer}</div>` : ''}
          </div>
        </div>
      </div>`);
    const $panel = $root.find('.modal-panel');

    function close() {
      $(document).off('keydown.modal' + titleId);
      $root.remove();
      if (!$('.modal-root').length) $('body').removeClass('overflow-hidden');
      if (opener && opener.focus) opener.focus();
      if (o.onClose) o.onClose();
    }

    $root.on('click', '[data-close]', function (e) {
      if (e.target === this) close();
    });
    $(document).on('keydown.modal' + titleId, (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const items = $panel.find(FOCUSABLE).filter(':visible').toArray();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    $('body').append($root).addClass('overflow-hidden');
    if (o.onOpen) o.onOpen($panel, close);
    const autofocus = $panel.find('[autofocus]').get(0) || $panel.find('[data-body]').find(FOCUSABLE).get(0) || $panel.find(FOCUSABLE).get(0);
    if (autofocus) autofocus.focus();
    return { $panel, close };
  }

  /**
   * Confirmation dialog. Resolves true when confirmed.
   * @param {object} o { title, message, confirmText, danger }
   */
  function confirmDialog(o) {
    return new Promise((resolve) => {
      let settled = false;
      const m = modal({
        title: o.title || 'Are you sure?',
        body: `<div class="flex gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${o.danger ? 'bg-red-50 text-danger' : 'bg-brand-light text-brand-strong'}">${icon(o.danger ? 'alert' : 'info')}</span>
            <p class="text-sm leading-relaxed text-ink-soft">${escape(o.message)}</p>
          </div>`,
        footer: `<button type="button" class="btn-outline" data-cancel>Cancel</button>
                 <button type="button" class="${o.danger ? 'btn-danger' : 'btn-primary'}" data-ok>${escape(o.confirmText || 'Confirm')}</button>`,
        onClose: () => { if (!settled) resolve(false); },
      });
      m.$panel.find('[data-cancel]').on('click', () => m.close());
      m.$panel.find('[data-ok]').on('click', () => { settled = true; m.close(); resolve(true); }).trigger('focus');
    });
  }

  // ---------------------------------------------------------------
  // Button loading state
  // ---------------------------------------------------------------
  function setLoading(btn, loading, label) {
    const $b = $(btn);
    if (loading) {
      if (!$b.data('label')) $b.data('label', $b.html());
      $b.prop('disabled', true).attr('aria-busy', 'true')
        .html(`<span class="spinner" aria-hidden="true"></span><span>${escape(label || 'Please wait…')}</span>`);
    } else {
      $b.prop('disabled', false).removeAttr('aria-busy');
      if ($b.data('label')) $b.html($b.data('label'));
      $b.removeData('label');
    }
  }

  // ---------------------------------------------------------------
  // Loading / empty / error states
  // ---------------------------------------------------------------
  const skeleton = {
    cards(count, withMedia = true) {
      return Array.from({ length: count }, () => `
        <div class="card overflow-hidden" aria-hidden="true">
          ${withMedia ? '<div class="skeleton aspect-[16/9] rounded-none"></div>' : ''}
          <div class="space-y-3 p-5">
            <div class="skeleton h-4 w-24"></div>
            <div class="skeleton h-5 w-3/4"></div>
            <div class="skeleton h-4 w-full"></div>
            <div class="skeleton h-4 w-2/3"></div>
          </div>
        </div>`).join('');
    },
    rows(count, cols) {
      return Array.from({ length: count }, () => `<tr aria-hidden="true">${Array.from({ length: cols }, () => '<td><div class="skeleton h-4 w-full max-w-[10rem]"></div></td>').join('')}</tr>`).join('');
    },
    lines(count) {
      return `<div class="space-y-3" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<div class="skeleton h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}"></div>`).join('')}</div>`;
    },
    stats(count) {
      return Array.from({ length: count }, () => '<div class="card card-pad" aria-hidden="true"><div class="skeleton h-10 w-10 rounded-xl"></div><div class="skeleton mt-4 h-7 w-16"></div><div class="skeleton mt-2 h-4 w-28"></div></div>').join('');
    },
  };

  function emptyState(o) {
    return `<div class="empty-state ${o.className || ''}">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand">${icon(o.icon || 'inbox', 'h-7 w-7')}</span>
        <h3 class="mt-4 font-heading text-base font-bold">${escape(o.title)}</h3>
        ${o.message ? `<p class="mt-1 max-w-sm text-sm text-ink-soft">${escape(o.message)}</p>` : ''}
        ${o.action || ''}
      </div>`;
  }

  /** Error block with a Retry button wired to `onRetry`. */
  function errorState($container, err, onRetry) {
    const message = (err && err.message) || 'Something went wrong while loading this content.';
    $container.html(`<div class="empty-state" role="alert">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-danger">${icon('alert', 'h-7 w-7')}</span>
        <h3 class="mt-4 font-heading text-base font-bold">We couldn't load this</h3>
        <p class="mt-1 max-w-md text-sm text-ink-soft">${escape(message)}</p>
        ${onRetry ? `<button type="button" class="btn-primary mt-5" data-retry>${icon('refresh', 'h-4 w-4')} Try again</button>` : ''}
      </div>`);
    if (onRetry) $container.find('[data-retry]').on('click', onRetry);
  }

  // ---------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------
  function fieldError($input, message) {
    const id = ($input.attr('id') || $input.attr('name')) + '-error';
    $input.attr('aria-invalid', 'true');
    const describedBy = ($input.attr('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
    describedBy.push(id);
    $input.attr('aria-describedby', describedBy.join(' '));
    let $err = $('#' + id);
    if (!$err.length) {
      $err = $(`<p class="form-error" id="${id}"></p>`);
      const $anchor = $input.closest('.input-group, [data-field]').length ? $input.closest('.input-group, [data-field]') : $input;
      $anchor.after($err);
    }
    $err.html(icon('alert', 'h-3.5 w-3.5') + '<span>' + escape(message) + '</span>');
  }

  function clearFieldError($input) {
    const id = ($input.attr('id') || $input.attr('name')) + '-error';
    $input.removeAttr('aria-invalid');
    const rest = ($input.attr('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
    if (rest.length) $input.attr('aria-describedby', rest.join(' ')); else $input.removeAttr('aria-describedby');
    $('#' + id).remove();
  }

  function clearFormErrors($form) {
    $form.find('[aria-invalid="true"]').each(function () { clearFieldError($(this)); });
    $form.find('[data-form-alert]').empty();
  }

  /**
   * Apply a map of { fieldName: message } to a form and focus the first invalid field.
   * Returns true when there were no errors.
   */
  function applyErrors($form, errors) {
    const names = Object.keys(errors);
    names.forEach((name) => fieldError($form.find(`[name="${name}"]`), errors[name]));
    if (names.length) {
      $form.find(`[name="${names[0]}"]`).trigger('focus');
      announce('Please fix ' + CE.utils.plural(names.length, 'error') + ' in the form.');
    }
    return names.length === 0;
  }

  /** Inline alert at the top of a form (used for API errors). */
  function formAlert($form, type, message) {
    const cls = type === 'error' ? 'border-red-200 bg-red-50 text-danger' : 'border-green-200 bg-green-50 text-success-text';
    $form.find('[data-form-alert]').html(
      `<div class="mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${cls}" role="alert">${icon(type === 'error' ? 'alert' : 'checkCircle', 'mt-0.5 h-4 w-4')}<span>${escape(message)}</span></div>`,
    );
  }

  /** Show/hide password toggle for every [data-toggle-password] button inside $scope. */
  function bindPasswordToggles($scope) {
    $scope.find('[data-toggle-password]').each(function () {
      const $btn = $(this);
      const $input = $('#' + $btn.data('toggle-password'));
      $btn.html(icon('eye')).attr({ 'aria-label': 'Show password', 'aria-pressed': 'false' });
      $btn.on('click', () => {
        const show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');
        $btn.html(icon(show ? 'eyeOff' : 'eye')).attr({ 'aria-label': show ? 'Hide password' : 'Show password', 'aria-pressed': String(show) });
      });
    });
  }

  /** Validate a File against the backend's multer rules. Returns an error string or null. */
  function validateFile(file, kind) {
    const rule = CE.config.UPLOAD_LIMITS[kind];
    if (!file) return null;
    if (!rule.exts.includes(CE.utils.fileExt(file.name))) {
      return `Unsupported file type. Allowed: ${rule.exts.map((e) => '.' + e).join(', ')}.`;
    }
    if (file.size > rule.maxBytes) {
      return `File is ${CE.utils.formatBytes(file.size)}. Maximum size is ${CE.utils.formatBytes(rule.maxBytes)}.`;
    }
    return null;
  }

  /** Upload progress bar markup + updater. */
  function progressBar($container) {
    $container.html(`<div class="mt-3" data-progress>
        <div class="mb-1 flex justify-between text-xs font-medium text-ink-soft"><span>Uploading…</span><span data-pct>0%</span></div>
        <div class="progress" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span style="width:0%"></span></div>
      </div>`);
    return {
      update(pct) {
        $container.find('[data-pct]').text(pct + '%');
        $container.find('[role="progressbar"]').attr('aria-valuenow', pct).find('span').css('width', pct + '%');
      },
      done() { $container.empty(); },
    };
  }

  // ---------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------
  /**
   * Render numbered pagination into $nav.
   * @param {jQuery} $nav <nav> element
   * @param {number} page current page (1-based)
   * @param {number} pages total pages
   * @param {(page:number)=>void} onChange
   */
  function pagination($nav, page, pages, onChange) {
    if (pages <= 1) { $nav.empty(); return; }
    const btn = (p, label, opts = {}) => `<button type="button" class="${p === page && !opts.nav ? 'bg-brand-strong text-white' : 'bg-white text-ink hover:bg-brand-light'} inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-line px-3 text-sm font-semibold transition disabled:opacity-40" data-page="${p}" ${opts.disabled ? 'disabled' : ''} ${p === page && !opts.nav ? 'aria-current="page"' : ''} aria-label="${opts.aria || 'Page ' + p}">${label}</button>`;
    const nums = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(btn(p, p));
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    $nav.attr('aria-label', 'Pagination').html(`<div class="flex flex-wrap items-center justify-center gap-2">
        ${btn(page - 1, icon('chevronLeft', 'h-4 w-4'), { nav: true, disabled: page === 1, aria: 'Previous page' })}
        ${nums.map((n) => (n === '…' ? '<span class="px-1 text-ink-muted" aria-hidden="true">…</span>' : n)).join('')}
        ${btn(page + 1, icon('chevronRight', 'h-4 w-4'), { nav: true, disabled: page === pages, aria: 'Next page' })}
      </div>`);
    $nav.find('[data-page]').on('click', function () {
      const p = Number($(this).data('page'));
      if (p >= 1 && p <= pages && p !== page) onChange(p);
    });
  }

  // ---------------------------------------------------------------
  // Responsive data table: <table> from md up, stacked cards on phones
  // ---------------------------------------------------------------
  /**
   * @param {{label:string, render:(row)=>string, className?:string, hideOnCard?:boolean}[]} columns
   * @param {object[]} rows
   * @param {{caption:string, actions?:(row)=>string}} o
   */
  function dataTable(columns, rows, o) {
    const table = `<table class="table hidden md:table">
        <caption class="sr-only">${escape(o.caption)}</caption>
        <thead><tr>${columns.map((c) => `<th scope="col" class="${c.className || ''}">${escape(c.label)}</th>`).join('')}${o.actions ? '<th scope="col" class="text-right">Actions</th>' : ''}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td class="${c.className || ''}">${c.render(r)}</td>`).join('')}${o.actions ? `<td class="text-right"><div class="flex justify-end gap-1">${o.actions(r)}</div></td>` : ''}</tr>`).join('')}</tbody>
      </table>`;
    const cards = `<ul class="divide-y divide-line md:hidden" aria-label="${escape(o.caption)}">${rows.map((r) => `
        <li class="space-y-2 p-4">
          ${columns.filter((c) => !c.hideOnCard).map((c, i) => (i === 0 ? `<div>${c.render(r)}</div>` : `<div class="flex items-center justify-between gap-3 text-sm"><span class="text-xs font-semibold uppercase tracking-wide text-ink-muted">${escape(c.label)}</span><span class="text-right">${c.render(r)}</span></div>`)).join('')}
          ${o.actions ? `<div class="flex flex-wrap gap-2 pt-2">${o.actions(r)}</div>` : ''}
        </li>`).join('')}</ul>`;
    return table + cards;
  }

  function tableSkeleton(cols) {
    return `<table class="table" aria-hidden="true"><tbody>${skeleton.rows(5, cols)}</tbody></table>`;
  }

  // ---------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------
  function statusBadge(published) {
    return published
      ? `<span class="badge-green">${icon('check', 'h-3 w-3')} Published</span>`
      : `<span class="badge-gray">${icon('eyeOff', 'h-3 w-3')} Draft</span>`;
  }

  function eventTimingBadge(event) {
    const s = CE.utils.eventStatus(event);
    if (s === 'live') return '<span class="badge-yellow"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-ink"></span> Happening now</span>';
    if (s === 'past') return '<span class="badge-gray">Ended</span>';
    return '<span class="badge-blue">Upcoming</span>';
  }

  /** Decorative placeholder used when an event has no uploaded image. */
  function imagePlaceholder(title, cls) {
    return `<div class="${cls || 'aspect-[16/9]'} hero-pattern flex items-center justify-center bg-brand-light" role="img" aria-label="${escape(title)} — no image provided">
        <span class="flex aspect-square h-[45%] max-h-14 items-center justify-center rounded-[28%] bg-white text-brand shadow-card">${icon('calendar', 'h-1/2 w-1/2')}</span>
      </div>`;
  }

  /** Star rating display (read-only). */
  function stars(rating, cls) {
    const r = Math.round(Number(rating) || 0);
    return `<span class="inline-flex items-center gap-0.5" role="img" aria-label="${r} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= r ? 'text-accent' : 'text-slate-300'}">${icon('star', cls || 'h-4 w-4')}</span>`).join('')}</span>`;
  }

  CE.ui = {
    announce, toast, modal, confirm: confirmDialog, setLoading, skeleton, emptyState, errorState,
    fieldError, clearFieldError, clearFormErrors, applyErrors, formAlert, dataTable, tableSkeleton,
    bindPasswordToggles, validateFile, progressBar, pagination, statusBadge, eventTimingBadge,
    imagePlaceholder, stars,
  };
})(window.CE, window.jQuery);
