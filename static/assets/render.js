/* MarketViewer 渲染器（多页面版 + 桌面响应式）
 * 数据源：data/manifest.json（页面清单） + data/<page>/latest.json（各页数据）
 * 加新页面：① 在 data/<page>/latest.json 写数据 ② 在 manifest.json 加一条
 *
 * 桌面端（>= 900px）：
 *   - Tabs 移到顶部 sticky topbar
 *   - Sections 2-col 网格，KPI / 大图 横跨双列
 *   - 有图表的 section 内部：表格 + 图表左右并排
 *   - 更大的图表高度（CSS 控制）
 * 移动端：保持原有堆叠布局
 */
(function () {
  'use strict';

  const MANIFEST_URL = 'data/manifest.json';
  const FALLBACK_MANIFEST = {
    pages: [
      { id: 'premarket', label: '盘前速览', icon: '📊', data: 'data/premarket/latest.json' }
    ]
  };

  const DESKTOP_MQ = window.matchMedia('(min-width: 900px)');
  // 所有 section 都是 1 col 卡片,宽度相等 — 不再有全宽 banner
  const WIDE_SECTION_IDS = new Set();

  // 桌面端「成对叠放」配置:两个 section 共享一个外层 grid cell,内部各占 50% 高
  // 只对桌面端生效,移动端 stack-pair 退化为单列
  const STACK_PAIRS_BY_PAGE = {
    premarket: [
      ['us_yield', 'fx'],   // 三、四
      ['oil', 'metal']      // 五、六
    ]
  };

  /* ========== 工具：转义 HTML ========== */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ========== 设备检测 ========== */
  function isDesktop() { return DESKTOP_MQ.matches; }

  /* ========== 主题切换 ========== */
  const Theme = (function () {
    const KEY = 'mv-theme';
    function get() {
      return localStorage.getItem(KEY) ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    function apply(t) {
      document.documentElement.setAttribute('data-theme', t);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
    }
    function toggle() {
      const next = get() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      apply(next);
      // 触发 ECharts resize（主题切换可能影响容器尺寸）
      requestAnimationFrame(resizeAllCharts);
    }
    function init() {
      apply(get());
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.addEventListener('click', toggle);
      // 跟随系统主题变化（仅在用户没显式选择时）
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
      });
    }
    return { init, get, apply };
  })();

  /* ========== 图表实例管理（用于 resize） ========== */
  const chartInstances = [];
  function registerChart(inst) { chartInstances.push(inst); }
  function resizeAllCharts() {
    chartInstances.forEach(inst => { try { inst.resize(); } catch (_) {} });
  }
  window.addEventListener('resize', () => {
    // 防抖
    clearTimeout(window.__mvResizeT);
    window.__mvResizeT = setTimeout(resizeAllCharts, 120);
  });

  /* ========== 单元格渲染 ==========
   * 支持的 cell 形式：
   *   "纯文本"
   *   {text:"...", dir:"up|down|flat"}     // 带方向颜色
   *   {type:"code", text:"us.DJI"}         // 代码样式
   *   {type:"pill", text:"临近预警", level:"breach|near|ok"}
   *   {type:"source", text:"聚源"}         // 来源列
   *   {type:"source", fallback:true, text:"📡"}  // 兜底来源
   *   {type:"html", html:"<b>...</b>"}     // 原始 HTML（谨慎使用）
   */
  function renderCell(c) {
    if (c == null) return '<td></td>';
    if (typeof c === 'string') return `<td>${esc(c)}</td>`;
    if (typeof c !== 'object') return `<td>${esc(c)}</td>`;

    const extraCls = c.className ? ' ' + esc(c.className) : '';

    if (c.type === 'code') {
      const codeCls = c.className || 'col-code';
      return `<td class="code ${esc(codeCls)}">${esc(c.text)}</td>`;
    }
    if (c.type === 'pill') {
      return `<td><span class="pill ${esc(c.level || 'near')}">${esc(c.text)}</span></td>`;
    }
    if (c.type === 'source' || (c.fallback !== undefined && c.text === undefined)) {
      if (c.fallback) {
        return `<td><span class="srcfallback">${esc(c.text || '📡')}</span></td>`;
      }
      return `<td><span class="source-ok">${esc(c.text || '聚源')}</span></td>`;
    }
    if (c.type === 'html') {
      return `<td>${c.html || ''}</td>`;
    }
    const dir = c.dir ? esc(c.dir) : '';
    const classes = [dir, (c.className || '').trim()].filter(Boolean).join(' ');
    return classes ? `<td class="${classes}">${esc(c.text || '')}</td>` : `<td>${esc(c.text || '')}</td>`;
  }

  function renderRow(row) {
    return '<tr>' + row.map(renderCell).join('') + '</tr>';
  }

  function renderTable(columns, rows) {
    const thead = '<thead><tr>' +
      columns.map(c => {
        const cls = (typeof c === 'object' && c.className) ? ` class="${esc(c.className)}"` : '';
        const text = (typeof c === 'object') ? c.text : c;
        return `<th${cls}>${esc(text)}</th>`;
      }).join('') +
      '</tr></thead>';
    const tbody = '<tbody>' + rows.map(renderRow).join('') + '</tbody>';
    // 包一层 .table-wrap,移动端列多时横向滚动
    return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
  }

  function renderKpis(kpis) {
    if (!kpis || !kpis.length) return '';
    return '<div class="kpi-row">' +
      kpis.map(k => {
        const dir = k.dir ? ` ${esc(k.dir)}` : '';
        return `<div class="kpi">
          <div class="lbl">${esc(k.label)}</div>
          <div class="val">${esc(k.value)}</div>
          <div class="chg${dir}">${esc(k.chg)}</div>
        </div>`;
      }).join('') +
      '</div>';
  }

  function renderHeader(h) {
    if (!h) return '';
    const tags = (h.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const summaryHtml = (h.summary || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    return `<div class="tags-row">${tags}</div>
      <h1>${esc(h.title || '')}</h1>
      <p>${summaryHtml}</p>`;
  }

  function renderFooter(f) {
    if (!f) return '';
    return esc(f.text || '');
  }

  function renderSource(parts) {
    if (typeof parts === 'string') return `<div class="src">${esc(parts)}</div>`;
    if (!Array.isArray(parts)) return '';
    const html = parts.map(p => {
      if (p.fallback) {
        return `<span class="srcfallback">${esc(p.text || '📡')}</span>`;
      }
      if (p.html) return p.html;
      return esc(p.text || '');
    }).join('');
    return `<div class="src">${html}</div>`;
  }

  function renderNote(note, source) {
    if (!note && !source) return '';
    const noteHtml = note ? note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>') : '';
    const sourceHtml = source ? renderSource(source) : '';
    // popover 浮窗:trigger 和 body 用同一个 popover-id(避免用 .popover-note 父级
    // 因为后续 showPopover 会把 body appendChild 到 <body> 末尾脱离所有 SC)
    let pid = 'p' + Math.random().toString(36).slice(2, 9);
    // 用同源 id,避免 Math.random 两次不一致
    pid = 'p' + (Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7));
    return `<div class="popover-note">
      <button type="button" class="popover-trigger" data-popover-id="${pid}">📝 详情 / 解读</button>
      <div class="popover-body" data-popover-id="${pid}" hidden>
        ${sourceHtml}
        ${noteHtml}
      </div>
    </div>`;
  }

  /* ========== ECharts 渲染 ==========
   * chart: {
   *   id, type:"bar-h"|"bar"|"bar-single"|"line",
   *   categories, data, series, markLine, ...
   * }
   */
  function renderChart(chart) {
    if (!chart || !chart.id) return '';
    const el = document.createElement('div');
    el.id = `chart-${chart.id}`;
    el.className = 'chart';
    setTimeout(() => {
      const dom = document.getElementById(`chart-${chart.id}`);
      if (!dom || !window.echarts) return;
      const inst = echarts.init(dom);
      // 全局字号 +1(让轴标签/legend/tooltip 更清晰)
      inst.setOption({ textStyle: { fontSize: 13 } });
      registerChart(inst);

      const data = (chart.data || []).map(d => ({
        value: d.value,
        itemStyle: d.color ? { color: d.color } : undefined
      }));

      const markLineData = (Array.isArray(chart.markLine) ? chart.markLine : (chart.markLine?.data || [])).map(m => ({
        yAxis: m.yAxis,
        xAxis: m.xAxis,
        lineStyle: { type: 'dashed', color: m.color || '#e23c3c' },
        label: {
          formatter: m.label || m.name || '',
          color: m.color || '#e23c3c',
          position: m.position || 'end',
          fontSize: 10
        }
      }));

      let option;
      const axisFmt = chart.axisFormat || '{value}';
      if (chart.type === 'bar-h') {
        option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: chart.tooltipFormat || '{b}: {c}' },
          grid: { left: 84, right: 24, top: 14, bottom: 20 },
          xAxis: { type: 'value', axisLabel: { formatter: axisFmt } },
          // inverse: true 让 yAxis 从上到下排,跟表格行序一致
          yAxis: { type: 'category', data: chart.categories || [], inverse: true },
          series: [{ type: 'bar', data }]
        };
      } else if (chart.type === 'bar') {
        option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: chart.tooltipFormat || '{b}: {c}' },
          grid: { left: 48, right: 24, top: chart.markLine ? 40 : 14, bottom: 22 },
          xAxis: { type: 'category', data: chart.categories || [] },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: axisFmt },
            max: chart.yMax,
            min: chart.yMin
          },
          series: [{
            type: 'bar', barWidth: '46%', data,
            markLine: markLineData.length ? { silent: true, symbol: 'none', data: markLineData } : undefined
          }]
        };
      } else if (chart.type === 'bar-single') {
        option = {
          title: { text: chart.title || '', left: 'center', textStyle: { fontSize: 12, color: '#1f2937' } },
          tooltip: { trigger: 'axis', formatter: '{b}: {c}' },
          grid: { left: 40, right: 16, top: 38, bottom: 20 },
          xAxis: { type: 'category', data: chart.categories || [] },
          yAxis: {
            type: 'value',
            min: chart.yMin, max: chart.yMax,
            axisLabel: { formatter: '{value}' }
          },
          series: [{
            type: 'bar', barWidth: '40%', data,
            markLine: markLineData.length ? { silent: true, symbol: 'none', data: markLineData } : undefined
          }]
        };
      } else if (chart.type === 'line') {
        const series = chart.series || [];
        const hasDualY = series.length > 1 && series.some(s => s.yAxisIndex === 1);
        const tooltipOpt = { trigger: 'axis' };
        if (typeof chart.tooltipFormatter === 'string') {
          try {
            tooltipOpt.formatter = new Function('params', chart.tooltipFormatter);
          } catch (e) {}
        } else if (typeof chart.tooltipFormatter === 'function') {
          tooltipOpt.formatter = chart.tooltipFormatter;
        }
        option = {
          tooltip: tooltipOpt,
          legend: {
            top: 0,
            textStyle: { fontSize: 11 },
            data: series.map(s => s.name)
          },
          grid: { left: 50, right: hasDualY ? 60 : 24, top: 32, bottom: 24 },
          xAxis: {
            type: 'category',
            data: chart.categories || [],
            boundaryGap: false,
            axisLabel: { fontSize: 10 }
          },
          yAxis: hasDualY ? [
            // scale:true 让 ECharts 自动从数据实际范围开始,不再强制 0 起点
            { type: 'value', position: 'left', scale: true, axisLabel: { fontSize: 10, formatter: axisFmt } },
            { type: 'value', position: 'right', scale: true, axisLabel: { fontSize: 10, formatter: axisFmt }, splitLine: { show: false } }
          ] : {
            type: 'value',
            scale: true,
            axisLabel: { fontSize: 10, formatter: axisFmt },
            ...(chart.yLabel ? { name: chart.yLabel, nameTextStyle: { fontSize: 10, color: '#6b7280' } } : {})
          },
          series: series.map(s => ({
            name: s.name,
            type: 'line',
            data: s.data,
            smooth: true,
            yAxisIndex: s.yAxisIndex || 0,
            lineStyle: { color: s.color, width: 2, type: s.lineType || s.lineStyle || 'solid' },
            itemStyle: { color: s.color },
            symbol: 'circle',
            symbolSize: 6,
            encode: s.encode
          }))
        };
      } else {
        option = {};
      }
      inst.setOption(option);
    }, 0);
    return el.outerHTML;
  }

  /* ========== Section 渲染 ==========
   * 自动给 section 加 class：
   *   kpi-strip    — type==='kpi'，桌面端用 4 列 KPI 横排
   *   has-chart    — 含图表，桌面端内部 table + chart 左右并排
   *   span-2       — 横跨双列：KPI strip / 含双 Y 轴折线图 / 指定 id
   */
  function renderSection(s) {
    if (!s) return '';

    const isKpi = s.type === 'kpi';
    const hasCharts = !!(s.charts && s.charts.length);
    const hasTable = !!(s.columns && s.rows);
    const hasKpis = !!(s.kpis && s.kpis.length);
    const isWideById = s.id && WIDE_SECTION_IDS.has(s.id);
    // 桌面端左右并排：必须同时有 table 和 chart，且没有 kpis
    const useSideLayout = !isKpi && hasTable && hasCharts && !hasKpis;

    const classes = [];
    if (isKpi) classes.push('kpi-strip');
    if (useSideLayout) classes.push('has-chart');
    // KPI 段(type:kpi)横着占满全宽 — 每个页面的"一"都是关键指标 banner
    if (isKpi || isWideById) classes.push('span-2');
    const clsAttr = classes.length ? ` class="${classes.join(' ')}"` : '';

    let body;
    if (isKpi) {
      body = renderKpis(s.kpis);
    } else {
      // source 和 note 都折进 note 里(默认折叠),不在外面单独渲染
      const inner = (hasKpis ? renderKpis(s.kpis) : '') +
        (hasTable ? renderTable(s.columns, s.rows) : '') +
        (hasCharts ? s.charts.map(renderChart).join('') : '') +
        (s.legend ? `<div class="legend">${esc(s.legend)}</div>` : '') +
        renderNote(s.note, s.source);
      // 桌面端：有 table + chart 的 section 把 inner 装到 .body 里，CSS 做左右并排
      body = useSideLayout ? `<div class="body">${inner}</div>` : inner;
    }

    return `<section${clsAttr} id="sec-${esc(s.id || '')}">
      <h2><span class="bar"></span>${esc(s.title || '')}</h2>
      ${body}
    </section>`;
  }

  /* ========== Tab 切换（双容器：floating + mobile） ========== */
  function renderTabs(pages, activeId) {
    const makeBtn = (p) => {
      const active = p.id === activeId ? ' active' : '';
      const icon = p.icon ? `<span class="ico">${esc(p.icon)}</span>` : '';
      return `<button type="button" data-page="${esc(p.id)}" class="${active.trim()}">
        ${icon}${esc(p.label)}
      </button>`;
    };

    const floating = document.getElementById('floating-tabs');
    const mobile = document.getElementById('mobile-tabs');
    if (!pages || !pages.length) {
      if (floating) floating.innerHTML = '';
      if (mobile) mobile.innerHTML = '';
      return;
    }
    // 桌面 floating 卡片: 左侧 brand-dot + 按钮组
    const floatingHTML = `<span class="brand-dot" title="Market Viewer">📈</span>` +
      pages.map(makeBtn).join('');
    const mobileHTML = pages.map(makeBtn).join('');

    if (floating) floating.innerHTML = floatingHTML;
    if (mobile) mobile.innerHTML = mobileHTML;

    const onClick = (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn) return;
      const page = pages.find(x => x.id === btn.dataset.page);
      if (!page) return;
      // 同步 active 态到两个容器
      [floating, mobile].forEach(el => {
        if (!el) return;
        [...el.querySelectorAll('button')].forEach(b => b.classList.remove('active'));
        const match = el.querySelector(`button[data-page="${page.id}"]`);
        if (match) match.classList.add('active');
      });
      loadPage(page);
    };
    if (floating) floating.onclick = onClick;
    if (mobile) mobile.onclick = onClick;
  }

  /* ========== 加载单个页面 ========== */
  async function loadPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="load-error" style="color:var(--sub)">加载中…</div>';
    try {
      const r = await fetch(page.data, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (' + page.data + ')');
      const data = await r.json();
      renderPage(data, page.id);
    } catch (err) {
      content.innerHTML =
        `<div class="load-error">⚠️ 加载 <code>${esc(page.data)}</code> 失败<br><br>
         <small>${esc(err.message || '')}</small></div>`;
    }
  }

  /* ========== 渲染单个页面的内容 ========== */
  function renderPage(data, pageId) {
    document.getElementById('header').innerHTML = renderHeader(data.header);

    // 清空旧 chart 实例（页面切换时释放）
    chartInstances.length = 0;

    const content = document.getElementById('content');
    const sections = data.sections || [];

    // 桌面端成对叠放:把 pair 里的两个 section 包进 .stack-pair wrapper
    const pairs = STACK_PAIRS_BY_PAGE[pageId] || [];
    let html;
    if (DESKTOP_MQ.matches && pairs.length) {
      const used = new Set();
      const parts = [];
      for (const s of sections) {
        if (!s || used.has(s.id)) continue;
        const pair = pairs.find(p => p[0] === s.id);
        if (pair) {
          const s1 = sections.find(x => x.id === pair[0]);
          const s2 = sections.find(x => x.id === pair[1]);
          if (s1 && s2) {
            parts.push(`<div class="stack-pair">${renderSection(s1)}${renderSection(s2)}</div>`);
            used.add(s1.id); used.add(s2.id);
            continue;
          }
        }
        parts.push(renderSection(s));
        used.add(s.id);
      }
      html = parts.join('');
    } else {
      html = sections.map(renderSection).join('');
    }

    content.innerHTML = html || '<div class="load-error" style="color:var(--sub)">该页面暂无内容</div>';

    document.getElementById('footer').textContent = renderFooter(data.footer);
    if (data.title) document.title = data.title;

    // 更新 topbar 右上角"最后更新"时间（从 header.tags 找 🕐 开头的那条）
    const updatedTag = (data.header && data.header.tags || []).find(t => /🕐|最后更新/.test(t));
    const updatedEl = document.getElementById('last-updated');
    if (updatedEl) {
      updatedEl.textContent = updatedTag ? updatedTag.replace(/^🕐\s*/, '').replace(/最后更新\s*/, '') : '';
      updatedEl.style.display = updatedTag ? '' : 'none';
    }
  }

  function showError(msg) {
    document.getElementById('content').innerHTML =
      `<div class="load-error">⚠️ ${esc(msg)}</div>`;
  }

  /* ========== 启动 ========== */
  async function init() {
    Theme.init();

    let manifest;
    try {
      const r = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      manifest = await r.json();
    } catch (e) {
      console.warn('manifest 加载失败，使用兜底清单:', e.message);
      manifest = FALLBACK_MANIFEST;
    }
    if (!manifest.pages || !manifest.pages.length) {
      showError('manifest.json 中没有 pages 字段或为空');
      return;
    }
    renderTabs(manifest.pages, manifest.pages[0].id);
    await loadPage(manifest.pages[0]);
  }

  // 全局 popover 浮窗行为:点击 trigger 切换,点击别处关闭
  function closeAllPopovers() {
    document.querySelectorAll('.popover-body').forEach(b => { if (!b.hidden) trackClose(); b.hidden = true; });
    document.querySelectorAll('.popover-note.open').forEach(w => w.classList.remove('open'));
  }
  function showPopover(body, trigger) {
    // 关键:第一次显示时把 body appendChild 到 <body> 末尾,
    // 彻底脱离 popover-note 父级(避免 thead sticky z:1 / stack-pair SC 干扰 fixed 定位)
    if (body.parentElement !== document.body) {
      document.body.appendChild(body);
    }
    const rect = trigger.getBoundingClientRect();
    // 默认在 trigger **上方**;上方空间不够才放下方
    const popH = Math.min(body.scrollHeight || 400, 480);
    const margin = 8;
    let top = rect.top - popH - 6;
    if (top < margin) {
      // 上方空间不够,放到下方
      top = rect.bottom + 6;
      if (top + popH + margin > window.innerHeight) {
        // 上下都不够,贴 viewport 顶部
        top = margin;
      }
    }
    // 左右夹在视口内
    const maxW = 520;
    let left = rect.left;
    if (left + maxW + margin > window.innerWidth) {
      left = window.innerWidth - maxW - margin;
    }
    if (left < margin) left = margin;
    body.style.top = top + 'px';
    body.style.left = left + 'px';
    body.style.maxWidth = maxW + 'px';
    body.hidden = false;
  }
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.popover-trigger');
    if (trigger) {
      e.stopPropagation();
      const pid = trigger.dataset.popoverId;
      // body 可能已被 appendChild 到 body 末尾,所以用 dataset.popoverId 全局查找
      const body = document.querySelector(`.popover-body[data-popover-id="${pid}"]`);
      if (!body) return;
      const wrap = trigger.closest('.popover-note');
      const wasHidden = body.hidden;
      closeAllPopovers();
      if (wasHidden) {
        showPopover(body, trigger);
        if (wrap) wrap.classList.add('open');
        trackOpen();
      }
      return;
    }
    if (!e.target.closest('.popover-body')) {
      closeAllPopovers();
    }
  });
  // 滚动 / resize 时关闭浮窗(只在有 popover open 时生效,避免 scrollIntoView 等程序化滚动误关)
  let popoverOpenCount = 0;
  function trackOpen(){ popoverOpenCount++; }
  function trackClose(){ popoverOpenCount = Math.max(0, popoverOpenCount - 1); }
  function maybeCloseOnScroll(){
    if (popoverOpenCount > 0) closeAllPopovers();
  }
  window.addEventListener('scroll', maybeCloseOnScroll, { passive: true });
  window.addEventListener('resize', maybeCloseOnScroll);
  // ESC 也关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPopovers();
  });

  init();
})();
