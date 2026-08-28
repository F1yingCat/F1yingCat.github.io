/* MarketViewer 渲染器（多页面版）
 * 数据源：data/manifest.json（页面清单） + data/<page>/latest.json（各页数据）
 * 加新页面：① 在 data/<page>/latest.json 写数据 ② 在 manifest.json 加一条
 */
(function () {
  'use strict';

  const MANIFEST_URL = 'data/manifest.json';
  const FALLBACK_MANIFEST = {
    pages: [
      { id: 'premarket', label: '盘前速览', icon: '📊', data: 'data/premarket/latest.json' }
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

    // 收集额外的 class（如 col-code 隐藏列、自定义 className）
    const extraCls = c.className ? ' ' + esc(c.className) : '';

    if (c.type === 'code') {
      // code 类型默认加 col-code（隐藏列），除非显式覆盖
      const codeCls = c.className || 'col-code';
      return `<td class="code ${esc(codeCls)}">${esc(c.text)}</td>`;
    }
    if (c.type === 'pill') {
      return `<td><span class="pill ${esc(c.level || 'near')}">${esc(c.text)}</span></td>`;
    }
    if (c.type === 'source' || (c.fallback !== undefined && c.text === undefined)) {
      // 简写：{ "fallback": true } 或 { "fallback": true, "text": "📡" } 或 { "text": "聚源" }
      if (c.fallback) {
        return `<td><span class="srcfallback">${esc(c.text || '📡')}</span></td>`;
      }
      return `<td>${esc(c.text || '聚源')}</td>`;
    }
    if (c.type === 'html') {
      return `<td>${c.html || ''}</td>`;
    }
    // 默认：带方向的文本
    const dir = c.dir ? esc(c.dir) : '';
    const classes = [dir, (c.className || '').trim()].filter(Boolean).join(' ');
    return classes ? `<td class="${classes}">${esc(c.text || '')}</td>` : `<td>${esc(c.text || '')}</td>`;
  }

  function renderRow(row) {
    return '<tr>' + row.map(renderCell).join('') + '</tr>';
  }

  /* ========== 表格渲染 ==========
   * columns: ["标的", "代码", ...]
   *   也支持 [{key:"code", className:"col-code"}] 这种带隐藏列的
   * rows: [[cell, cell, ...], ...]
   * colGroups: 隐藏列控制 [{type:'col', show:false}]（可选）
   */
  function renderTable(columns, rows) {
    const thead = '<thead><tr>' +
      columns.map(c => {
        const cls = (typeof c === 'object' && c.className) ? ` class="${esc(c.className)}"` : '';
        const text = (typeof c === 'object') ? c.text : c;
        return `<th${cls}>${esc(text)}</th>`;
      }).join('') +
      '</tr></thead>';
    const tbody = '<tbody>' + rows.map(renderRow).join('') + '</tbody>';
    return `<table>${thead}${tbody}</table>`;
  }

  /* ========== KPI 卡片渲染 ========== */
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

  /* ========== Header 渲染 ==========
   * summary 允许 <b>（与 note 同语义），其它字段仍 esc
   */
  function renderHeader(h) {
    if (!h) return '';
    const tags = (h.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    // 放行 <b>：先转义再反转 <b> / </b>，逻辑与 renderNote 一致
    const summaryHtml = (h.summary || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    return `<div>${tags}</div>
      <h1>${esc(h.title || '')}</h1>
      <p>${summaryHtml}</p>`;
  }

  /* ========== Footer 渲染 ========== */
  function renderFooter(f) {
    if (!f) return '';
    return esc(f.text || '');
  }

  /* ========== Source 渲染（支持 srcfallback 高亮片段） ==========
   * sourceParts: [
   *    {text:"来源：聚源 · ..."},
   *    {fallback:true, text:"📡 web_search 兜底"}
   * ]
   */
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

  /* ========== Note 渲染（允许 <b>） ========== */
  function renderNote(note) {
    if (!note) return '';
    // 简单处理：只放行 <b>，其它按需扩展
    const html = note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    return `<div class="note">${html}</div>`;
  }

  /* ========== ECharts 渲染 ==========
   * chart: {
   *   id: "us_equity",
   *   type: "bar-h" | "bar" | "bar-single" | "line",
   *   xLabel / yLabel:  轴标签（可选）
   *   categories: ["..."],
   *   data: [{"value":0.21, "color":"#e23c3c"}, ...],   // bar 系列
   *   series: [{name, data, color, yAxisIndex}, ...],    // line 系列
   *   title: "DXY (预警 100)",      // bar-single
   *   yMin / yMax,                  // 可选
   *   markLine: [                   // 可选
   *     {yAxis:100, color:"#e23c3c", label:"预警 100", position:"end|insideEndTop"}
   *   ]
   * }
   */
  function renderChart(chart) {
    if (!chart || !chart.id) return '';
    const el = document.createElement('div');
    el.id = `chart-${chart.id}`;
    el.className = 'chart';
    // 渲染完成后初始化
    setTimeout(() => {
      const dom = document.getElementById(`chart-${chart.id}`);
      if (!dom || !window.echarts) return;
      const inst = echarts.init(dom);

      const data = (chart.data || []).map(d => ({
        value: d.value,
        itemStyle: d.color ? { color: d.color } : undefined
      }));

      const markLineData = (chart.markLine || []).map(m => ({
        yAxis: m.yAxis,
        xAxis: m.xAxis,
        lineStyle: { type: 'dashed', color: m.color || '#e23c3c' },
        label: {
          formatter: m.label || '',
          color: m.color || '#e23c3c',
          position: m.position || 'end',
          fontSize: 10
        }
      }));

      let option;
      if (chart.type === 'bar-h') {
        option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
          grid: { left: 84, right: 24, top: 14, bottom: 20 },
          xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
          yAxis: { type: 'category', data: chart.categories || [] },
          series: [{ type: 'bar', data }]
        };
      } else if (chart.type === 'bar') {
        option = {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
          grid: { left: 48, right: 24, top: chart.markLine ? 40 : 14, bottom: 22 },
          xAxis: { type: 'category', data: chart.categories || [] },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}%' },
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
        // 折线图（支持多 series、双 Y 轴）
        const series = chart.series || [];
        const hasDualY = series.length > 1 && series.some(s => s.yAxisIndex === 1);
        option = {
          tooltip: { trigger: 'axis' },
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
            {
              type: 'value',
              // 删掉 name 和 nameTextStyle：双 Y 轴的 name 标签会跟顶部 legend 按钮视觉撞车
              position: 'left',
              axisLabel: { fontSize: 10 }
            },
            {
              type: 'value',
              position: 'right',
              axisLabel: { fontSize: 10 },
              splitLine: { show: false }
            }
          ] : {
            type: 'value',
            axisLabel: { fontSize: 10 }
          },
          series: series.map(s => ({
            name: s.name,
            type: 'line',
            data: s.data,
            smooth: true,
            yAxisIndex: s.yAxisIndex || 0,
            lineStyle: { color: s.color, width: 2 },
            itemStyle: { color: s.color },
            symbol: 'circle',
            symbolSize: 6
          }))
        };
      } else {
        option = {};
      }
      inst.setOption(option);
    }, 0);
    return el.outerHTML;
  }

  /* ========== Section 渲染 ========== */
  function renderSection(s) {
    if (!s) return '';
    const isKpi = s.type === 'kpi';
    let body;
    if (isKpi) {
      body = renderKpis(s.kpis);
    } else {
      // 普通 section：如果有 kpis 字段，先渲染 KPI 卡片
      body = s.kpis ? renderKpis(s.kpis) : '';
      body += (s.source ? renderSource(s.source) : '') +
        (s.columns && s.rows ? renderTable(s.columns, s.rows) : '') +
        (s.charts ? s.charts.map(renderChart).join('') : '') +
        (s.legend ? `<div class="legend">${esc(s.legend)}</div>` : '') +
        (s.note ? renderNote(s.note) : '');
    }

    return `<section>
      <h2><span class="bar"></span>${esc(s.title || '')}</h2>
      ${body}
    </section>`;
  }

  /* ========== Tab 切换 ========== */
  function renderTabs(pages, activeId) {
    const el = document.getElementById('tabs');
    if (!pages || !pages.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = pages.map(p => {
      const active = p.id === activeId ? ' active' : '';
      const icon = p.icon ? `<span class="ico">${esc(p.icon)}</span>` : '';
      return `<button type="button" data-page="${esc(p.id)}" class="${active.trim()}">
        ${icon}${esc(p.label)}
      </button>`;
    }).join('');

    el.onclick = (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn) return;
      const page = pages.find(x => x.id === btn.dataset.page);
      if (!page) return;
      // 切换 active 态
      [...el.querySelectorAll('button')].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPage(page);
    };
  }

  /* ========== 加载单个页面 ========== */
  async function loadPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="load-error" style="color:var(--sub)">加载中…</div>';
    try {
      const r = await fetch(page.data, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (' + page.data + ')');
      const data = await r.json();
      renderPage(data);
    } catch (err) {
      content.innerHTML =
        `<div class="load-error">⚠️ 加载 <code>${esc(page.data)}</code> 失败<br><br>
         <small>${esc(err.message || '')}</small></div>`;
    }
  }

  /* ========== 渲染单个页面的内容 ========== */
  function renderPage(data) {
    // header
    document.getElementById('header').innerHTML = renderHeader(data.header);

    // 主体
    const content = document.getElementById('content');
    const sections = (data.sections || []).map(renderSection).join('');
    content.innerHTML = sections || '<div class="load-error" style="color:var(--sub)">该页面暂无内容</div>';

    // footer
    document.getElementById('footer').textContent = renderFooter(data.footer);

    // 浏览器标题
    if (data.title) document.title = data.title;
  }

  function showError(msg) {
    document.getElementById('content').innerHTML =
      `<div class="load-error">⚠️ ${esc(msg)}</div>`;
  }

  /* ========== 启动 ========== */
  async function init() {
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

  init();
})();
