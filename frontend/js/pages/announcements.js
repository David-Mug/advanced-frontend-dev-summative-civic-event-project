/**
 * Announcements feed (GET /api/announcements). Users see published items only.
 * Each card can expand an inline accessible audio player.
 */
(function (CE, $) {
  'use strict';

  // ROLE GUARD: any signed-in user.
  if (!CE.layout.boot(null)) return;

  const { ui, utils, components } = CE;
  const isAdmin = CE.auth.isAdmin();
  const PAGE_SIZE = CE.config.PAGE_SIZE;
  const $grid = $('#announcements-grid');
  let items = [];
  let page = 1;

  function render() {
    const q = $('#q').val().trim().toLowerCase();
    const list = items.filter((a) => !q || a.title.toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#results-count').text(q ? `${utils.plural(list.length, 'announcement')} match “${$('#q').val().trim()}”` : utils.plural(list.length, 'announcement'));
    $grid.attr('aria-busy', 'false').html(slice.length
      ? slice.map((a) => components.announcementCard(a, { isAdmin })).join('')
      : `<div class="md:col-span-2 xl:col-span-3">${ui.emptyState({ icon: 'megaphone', title: q ? 'No matching announcements' : 'No announcements yet', message: q ? 'Try a different search term.' : 'Official audio updates will appear here once published.' })}</div>`);
    components.hydrateDurations($grid);
    ui.pagination($('#pagination'), page, pages, (p) => { page = p; render(); $grid.find('h3 a').first().trigger('focus'); });
  }

  async function load() {
    $grid.attr('aria-busy', 'true').html(ui.skeleton.cards(6, false));
    try {
      const res = await CE.api.announcements.list();
      items = (res.data || []).filter((a) => isAdmin || a.published);
      render();
    } catch (err) {
      ui.errorState($grid, err, load);
    }
  }

  // Inline player: first click mounts the player and starts playback.
  $grid.on('click', '[data-play-inline]', function () {
    const id = String($(this).data('play-inline'));
    const a = items.find((x) => x.id === id);
    const $slot = $grid.find(`[data-player-slot="${id}"]`);
    if (!$slot.children().length) {
      const audio = CE.media.audioPlayer($slot, { src: a.audio_url, title: a.title, compact: true });
      CE.media.claim(audio);
      audio.play().catch(() => {});
      $(this).remove();
      $slot.find('[data-play]').trigger('focus');
    }
  });

  $('#q').on('input', utils.debounce(() => { page = 1; render(); }, 200));
  load();
})(window.CE, window.jQuery);
