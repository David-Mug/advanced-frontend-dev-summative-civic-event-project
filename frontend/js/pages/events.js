/**
 * Events browser with search, date range, timing and location filters, plus pagination.
 * GET /api/events returns every event without server-side filtering or paging, so filtering
 * and paging happen here on the fetched list.
 * Normal users only see published events; admins see everything with status badges and
 * Edit/Delete controls.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user (admin controls rendered only for admins).
  if (!CE.layout.boot(null)) return;

  const { ui, components, utils } = CE;
  const isAdmin = CE.auth.isAdmin();
  const PAGE_SIZE = CE.config.PAGE_SIZE;

  const $grid = $('#events-grid');
  const $count = $('#results-count');
  const $form = $('#filters');

  let events = [];
  let regByEvent = new Map();
  let currentPage = 1;

  // Restore filters from the URL so results are shareable/bookmarkable.
  const params = new URLSearchParams(window.location.search);
  ['q', 'when', 'from', 'to', 'location'].forEach((k) => { if (params.has(k)) $form.find(`[name="${k}"]`).val(params.get(k)); });
  currentPage = Number(params.get('page')) || 1;

  function filters() {
    return {
      q: $('#q').val().trim().toLowerCase(),
      when: $('#when').val(),
      from: $('#from').val(),
      to: $('#to').val(),
      location: $('#location').val(),
    };
  }

  function syncUrl(f) {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v && !(k === 'when' && v === 'upcoming')) p.set(k, v); });
    if (currentPage > 1) p.set('page', currentPage);
    history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p : ''));
  }

  function matches(e, f) {
    const now = Date.now();
    const start = new Date(e.starts_at).getTime();
    const status = utils.eventStatus(e);
    if (f.q && !`${e.title} ${e.description || ''} ${e.location || ''}`.toLowerCase().includes(f.q)) return false;
    if (f.location && e.location !== f.location) return false;
    if (f.when === 'upcoming' && status === 'past') return false;
    if (f.when === 'past' && status !== 'past') return false;
    if (f.when === 'week' && (status === 'past' || start > now + 7 * 864e5)) return false;
    if (f.when === 'month' && (status === 'past' || start > now + 30 * 864e5)) return false;
    if (f.from && start < new Date(f.from + 'T00:00').getTime()) return false;
    if (f.to && start > new Date(f.to + 'T23:59:59').getTime()) return false;
    return true;
  }

  function render() {
    const f = filters();
    if (f.from && f.to && f.from > f.to) {
      ui.fieldError($('#to'), '“To” must be on or after “From”.');
      return;
    }
    ui.clearFieldError($('#to'));

    const list = events.filter((e) => matches(e, f));
    if (f.when === 'past') list.reverse(); // most recent past events first
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pages);
    const slice = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    $count.text(list.length
      ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${(currentPage - 1) * PAGE_SIZE + slice.length} of ${utils.plural(list.length, 'event')}`
      : 'No events match your filters');

    $grid.attr('aria-busy', 'false').html(slice.length
      ? slice.map((e) => components.eventCard(e, { isAdmin, registration: regByEvent.get(e.id) })).join('')
      : `<div class="sm:col-span-2 lg:col-span-3">${ui.emptyState({
        icon: 'search',
        title: events.length ? 'No matching events' : 'No events yet',
        message: events.length ? 'Try a different keyword, date range or location.' : (isAdmin ? 'Create the first event to get started.' : 'New civic events will appear here as soon as they are published.'),
        action: events.length ? '<button type="button" class="btn-outline btn-sm mt-4" data-clear>Clear filters</button>' : (isAdmin ? `<a href="${utils.page('event-form.html')}" class="btn-primary btn-sm mt-4">Create event</a>` : ''),
      })}</div>`);

    ui.pagination($('#pagination'), currentPage, pages, (p) => {
      currentPage = p;
      render();
      document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      $grid.find('h3 a').first().trigger('focus');
    });
    syncUrl(f);
  }

  async function load() {
    $grid.attr('aria-busy', 'true').html(ui.skeleton.cards(6));
    $count.text('Loading events…');
    try {
      const [eventsRes, regsRes] = await Promise.all([
        CE.api.events.list(),
        isAdmin ? Promise.resolve({ data: [] }) : CE.api.registrations.mine(),
      ]);
      // Normal users must only see published events.
      events = (eventsRes.data || []).filter((e) => isAdmin || e.published);
      regByEvent = new Map((regsRes.data || []).map((r) => [r.event_id, r]));

      const locations = Array.from(new Set(events.map((e) => e.location).filter(Boolean))).sort();
      const selected = $('#location').val() || params.get('location') || '';
      $('#location').html('<option value="">All locations</option>' + locations.map((l) => `<option value="${utils.escape(l)}">${utils.escape(l)}</option>`).join('')).val(selected);
      render();
    } catch (err) {
      $count.text('');
      ui.errorState($grid, err, load);
    }
  }

  const rerender = () => { currentPage = 1; render(); };
  $('#q').on('input', utils.debounce(rerender, 250));
  $form.on('change', 'select, input[type=date]', rerender);
  $form.on('submit', (e) => { e.preventDefault(); rerender(); });
  $(document).on('click', '#clear-filters, [data-clear]', () => {
    $form[0].reset();
    $('#when').val('upcoming');
    rerender();
    ui.announce('Filters cleared.');
  });

  components.bindEventActions($grid, () => { CE.api.clearCache(); load(); });
  load();
})(window.CE, window.jQuery);
