/**
 * Lightweight, dependency-free SVG/HTML charts for the admin dashboard.
 * Single-series only, drawn in the brand blue; values are labelled in ink colour so
 * nothing relies on colour alone. Every chart has hover/focus tooltips and a table view.
 */
(function (CE, $) {
  'use strict';

  const { escape } = CE.utils;

  function tableView(rows, labelHeader, valueHeader) {
    return `<details class="mt-4 text-sm">
        <summary class="cursor-pointer font-semibold text-brand-strong">View as table</summary>
        <table class="mt-2 w-full text-left">
          <thead><tr class="border-b border-line text-xs uppercase text-ink-soft"><th class="py-1.5">${escape(labelHeader)}</th><th class="py-1.5 text-right">${escape(valueHeader)}</th></tr></thead>
          <tbody>${rows.map((r) => `<tr class="border-b border-line"><td class="py-1.5">${escape(r.label)}</td><td class="py-1.5 text-right tabular-nums">${escape(r.value)}</td></tr>`).join('')}</tbody>
        </table>
      </details>`;
  }

  function bindTooltip($host) {
    const $tip = $('<div class="pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow-lift" role="presentation"></div>');
    $host.css('position', 'relative').append($tip);
    const show = (el) => {
      const r = el.getBoundingClientRect();
      const h = $host[0].getBoundingClientRect();
      $tip.text($(el).data('tip')).css({ left: r.left - h.left + r.width / 2, top: r.top - h.top - 6 }).removeClass('hidden');
    };
    $host.on('mouseenter focus', '[data-tip]', function () { show(this); });
    $host.on('mouseleave blur', '[data-tip]', () => $tip.addClass('hidden'));
  }

  const charts = {
    /**
     * Vertical column chart (e.g. new users per month).
     * @param {jQuery} $host
     * @param {{label:string,value:number}[]} rows
     * @param {{valueLabel:string, labelHeader:string}} o
     */
    columns($host, rows, o) {
      if (!rows.length) {
        $host.html(CE.ui.emptyState({ icon: 'chart', title: 'No data yet', message: 'This chart fills in as activity is recorded.', className: 'border-0 py-8' }));
        return;
      }
      const max = Math.max(1, ...rows.map((r) => r.value));
      $host.html(`
        <div role="group" aria-label="${escape(o.valueLabel)} by ${escape(o.labelHeader.toLowerCase())}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}">
          <div class="relative border-b border-line">
            <div class="relative flex h-52 items-end gap-2 sm:gap-4">
              ${rows.map((r) => `
                <div class="flex h-full flex-1 flex-col items-center justify-end">
                  <span class="mb-1 text-xs font-bold tabular-nums text-ink" aria-hidden="true">${r.value}</span>
                  <span tabindex="0" class="block w-full max-w-[3.5rem] rounded-t-[4px] bg-brand transition hover:bg-brand-strong focus:bg-brand-strong" style="height:calc(${(r.value / max) * 100}% - 2.5rem); min-height:${r.value ? '4px' : '0'}" data-tip="${escape(r.label)}: ${r.value} ${escape(o.valueLabel.toLowerCase())}" aria-label="${escape(r.label)}: ${r.value}"></span>
                  <span class="mt-2 h-4 truncate text-[0.7rem] font-medium text-ink-soft" aria-hidden="true">${escape(r.label)}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
        ${tableView(rows, o.labelHeader, o.valueLabel)}`);
      bindTooltip($host);
    },

    /**
     * Horizontal bar list (category comparisons), sorted as given.
     * @param {jQuery} $host
     * @param {{label:string,value:number,href?:string}[]} rows
     * @param {{valueLabel:string, labelHeader:string}} o
     */
    bars($host, rows, o) {
      const max = Math.max(1, ...rows.map((r) => r.value));
      $host.html(`
        <ul class="space-y-4" aria-label="${escape(o.valueLabel)} by ${escape(o.labelHeader.toLowerCase())}">
          ${rows.map((r) => `
            <li>
              <div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span class="font-medium text-ink-soft">${r.href ? `<a class="text-ink-soft no-underline hover:text-brand-strong hover:underline" href="${r.href}">${escape(r.label)}</a>` : escape(r.label)}</span>
                <span class="font-heading font-bold tabular-nums text-ink">${r.value}</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-brand-light" aria-hidden="true">
                <div class="h-full rounded-full bg-brand" style="width:${(r.value / max) * 100}%; min-width:${r.value ? '4px' : '0'}" data-tip="${escape(r.label)}: ${r.value}"></div>
              </div>
            </li>`).join('')}
        </ul>
        ${tableView(rows, o.labelHeader, o.valueLabel)}`);
      bindTooltip($host);
    },
  };

  CE.charts = charts;
})(window.CE, window.jQuery);
