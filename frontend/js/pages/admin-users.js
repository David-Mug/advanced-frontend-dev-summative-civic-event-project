/**
 * User management (admin).
 *   GET   /api/users?page&limit   (paged; no total or search on the server)
 *   GET   /api/users/:id
 *   PATCH /api/users/:id/enable | /disable
 * Roles are displayed but never editable — there is deliberately no role control in this UI.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: administrators only.
  if (!CE.layout.boot('admin')) return;

  const { ui, utils, components } = CE;
  const { escape } = utils;
  const icon = CE.icon;
  const PAGE_SIZE = 10;
  const FETCH_LIMIT = 100;
  const me = CE.auth.getUser();
  const $host = $('#table-host');
  let users = [];
  let current = 1;

  /** The API has no total count, so fetch pages until a short page comes back. */
  async function fetchAll() {
    const all = [];
    for (let p = 1; p <= 50; p++) {
      const res = await CE.api.users.list(p, FETCH_LIMIT);
      const rows = res.data || [];
      all.push(...rows);
      if (rows.length < FETCH_LIMIT) break;
    }
    return all;
  }

  const statusBadge = (u) => (u.is_active ? `<span class="badge-green">${icon('check', 'h-3 w-3')} Active</span>` : `<span class="badge-red">${icon('lock', 'h-3 w-3')} Disabled</span>`);
  const roleBadge = (u) => `<span class="${u.role === 'admin' ? 'badge-yellow' : 'badge-blue'} capitalize">${escape(u.role)}</span>`;

  const columns = [
    {
      label: 'User',
      render: (u) => `<div class="flex items-center gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand-deep" aria-hidden="true">${escape(utils.initials(u.full_name))}</span>
          <span class="min-w-0"><span class="block truncate font-semibold">${escape(u.full_name)}${u.id === me.id ? ' <span class="text-xs font-medium text-ink-muted">(you)</span>' : ''}</span><span class="block truncate text-xs text-ink-muted">${escape(u.email)}</span></span>
        </div>`,
    },
    { label: 'Role', render: roleBadge },
    { label: 'Status', render: statusBadge },
    { label: 'Joined', render: (u) => `<span class="whitespace-nowrap">${escape(utils.formatDate(u.created_at))}</span>` },
  ];

  const actions = (u) => `
    <button type="button" class="btn-ghost btn-sm" data-view="${escape(u.id)}" aria-label="View details for ${escape(u.full_name)}">${icon('eye', 'h-4 w-4')}<span class="md:sr-only">Details</span></button>
    ${u.id === me.id ? '<span class="btn-sm btn cursor-default text-ink-muted" title="You cannot disable your own account">Current account</span>'
    : u.is_active
      ? `<button type="button" class="btn-sm btn text-danger hover:bg-red-50" data-disable="${escape(u.id)}" aria-label="Disable ${escape(u.full_name)}">${icon('lock', 'h-4 w-4')} Disable</button>`
      : `<button type="button" class="btn-sm btn text-success-text hover:bg-green-50" data-enable="${escape(u.id)}" aria-label="Enable ${escape(u.full_name)}">${icon('check', 'h-4 w-4')} Enable</button>`}`;

  function renderStats() {
    const active = users.filter((u) => u.is_active).length;
    $('#user-stats').html([
      components.statCard({ icon: 'users', label: 'Total users', value: users.length }),
      components.statCard({ icon: 'checkCircle', label: 'Active', value: active, tone: 'yellow' }),
      components.statCard({ icon: 'lock', label: 'Disabled', value: users.length - active }),
      components.statCard({ icon: 'shield', label: 'Administrators', value: users.filter((u) => u.role === 'admin').length, tone: 'yellow' }),
    ].join(''));
  }

  function render() {
    renderStats();
    const q = $('#q').val().trim().toLowerCase();
    const role = $('#role-filter').val();
    const st = $('#status-filter').val();
    const list = users.filter((u) => (!q || `${u.full_name} ${u.email}`.toLowerCase().includes(q))
      && (role === 'all' || u.role === role)
      && (st === 'all' || (st === 'active' ? u.is_active : !u.is_active)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    current = Math.min(current, pages);
    const slice = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    $('#results-count').text(`${utils.plural(list.length, 'user')}${q || role !== 'all' || st !== 'all' ? ' match your filters' : ''}`);
    $host.html(slice.length
      ? ui.dataTable(columns, slice, { caption: 'Users', actions })
      : `<div class="p-6">${ui.emptyState({ icon: 'users', title: 'No matching users', message: 'Try a different name, email or filter.', className: 'border-0' })}</div>`);
    ui.pagination($('#pagination'), current, pages, (p) => { current = p; render(); });
  }

  async function load() {
    $host.html(ui.tableSkeleton(4));
    $('#user-stats').html(ui.skeleton.stats(4));
    try {
      users = await fetchAll();
      render();
    } catch (err) {
      $('#user-stats').empty();
      ui.errorState($host, err, load);
    }
  }

  async function setActive(id, enable, $btn) {
    const u = users.find((x) => x.id === id);
    const ok = await ui.confirm({
      title: enable ? 'Enable this account?' : 'Disable this account?',
      message: enable
        ? `${u.full_name} (${u.email}) will be marked active again.`
        : `${u.full_name} (${u.email}) will be marked as disabled.`,
      confirmText: enable ? 'Enable account' : 'Disable account',
      danger: !enable,
    });
    if (!ok) return;
    ui.setLoading($btn, true, enable ? 'Enabling…' : 'Disabling…');
    try {
      const res = enable ? await CE.api.users.enable(id) : await CE.api.users.disable(id);
      Object.assign(u, res.data);
      ui.toast('success', `${u.full_name}'s account is now ${enable ? 'active' : 'disabled'}.`, enable ? 'Account enabled' : 'Account disabled');
      render();
    } catch (err) {
      ui.setLoading($btn, false);
      ui.toast('error', err.message);
    }
  }

  $host.on('click', '[data-enable]', function () { setActive(String($(this).data('enable')), true, $(this)); });
  $host.on('click', '[data-disable]', function () { setActive(String($(this).data('disable')), false, $(this)); });

  $host.on('click', '[data-view]', async function () {
    const m = ui.modal({ title: 'User details', body: ui.skeleton.lines(5), footer: '<button type="button" class="btn-primary" data-close>Close</button>' });
    try {
      const res = await CE.api.users.get(String($(this).data('view')));
      const u = res.data;
      m.$panel.find('[data-body]').html(`
        <div class="flex items-center gap-4">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white" aria-hidden="true">${escape(utils.initials(u.full_name))}</span>
          <div class="min-w-0"><p class="truncate font-heading text-lg font-bold">${escape(u.full_name)}</p><p class="truncate text-sm text-ink-soft">${escape(u.email)}</p></div>
        </div>
        <dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Role</dt><dd class="mt-1">${roleBadge(u)}</dd></div>
          <div><dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</dt><dd class="mt-1">${statusBadge(u)}</dd></div>
          <div><dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Joined</dt><dd class="mt-1">${escape(utils.formatDateTime(u.created_at))}</dd></div>
          <div><dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Last updated</dt><dd class="mt-1">${escape(utils.formatDateTime(u.updated_at))}</dd></div>
          <div class="col-span-2"><dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">User ID</dt><dd class="mt-1 break-all font-mono text-xs">${escape(u.id)}</dd></div>
        </dl>
        <p class="mt-5 flex items-start gap-2 rounded-xl bg-brand-light/60 p-3 text-xs text-ink-soft">${icon('info', 'h-4 w-4 shrink-0 text-brand-strong')} Roles cannot be changed from the admin interface.</p>`);
    } catch (err) {
      ui.errorState(m.$panel.find('[data-body]'), err);
    }
  });

  $('#q').on('input', utils.debounce(() => { current = 1; render(); }, 200));
  $('#role-filter, #status-filter').on('change', () => { current = 1; render(); });
  load();
})(window.CE, window.jQuery);
