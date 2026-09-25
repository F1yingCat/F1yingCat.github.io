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

  const DESKTOP_MQ = window.matchMedia('(min-width: 768px)');
  // 所有 section 都是 1 col 卡片,宽度相等 — 不再有全宽 banner
  const WIDE_SECTION_IDS = new Set();

  // 桌面端「成对叠放」配置:两个 section 共享一个外层 grid cell,内部上下排
  // 只对桌面端生效,移动端 stack-pair 退化为单列
  // postmarket 不配对(内容长度差异大,等高 1fr 1fr 会溢出)
  const STACK_PAIRS_BY_PAGE = {
    premarket: [
      ['us_yield', 'fx'],   // 三、美债 / 四、美元
      ['oil', 'metal']      // 五、原油 / 六、黄金
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
  // summary popover 全局唯一 id 计数器(避免多页面切换时 idx 重复串台)
  let summaryCounter = 0;
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
  // column className 自动应用到该列所有 cell(包括纯字符串)
  // 例:columns[0]={text:'标的',className:'wrap'} → 第 0 列所有 td 都有 'wrap' 类
  function getColumnClassName(columns, colIndex) {
    const col = columns && columns[colIndex];
    return (col && typeof col === 'object' && col.className) ? col.className : '';
  }

  function renderCell(c, colIndex, columns) {
    if (c == null) return '<td></td>';
    const colCls = getColumnClassName(columns, colIndex);

    if (typeof c === 'string') {
      // 纯字符串:td 加 colCls(让列 className 自动应用)
      // split(智能换行,仅 wrap split 列):在"中文名 + 英文/数字"边界自动拆
      // 例 "美元指数 DXY (9/9 收盘)" → "美元指数<br>DXY (9/9 收盘)"
      let cellHtml = esc(c);
      if (colCls && colCls.indexOf('split') !== -1) {
        cellHtml = cellHtml.replace(/^([\u4e00-\u9fff·、]+) ([A-Za-z0-9(\s].*)$/, '$1<br>$2');
        cellHtml = cellHtml.replace(/\n/g, '<br>');
      }
      return colCls ? `<td class="${esc(colCls)}">${cellHtml}</td>` : `<td>${cellHtml}</td>`;
    }
    if (typeof c !== 'object') return `<td>${esc(c)}</td>`;

    const extraCls = c.className ? ' ' + esc(c.className) : '';
    const finalCls = colCls + extraCls;

    if (c.type === 'code') {
      const codeCls = c.className || 'col-code';
      const merged = colCls ? `${esc(codeCls)} ${esc(colCls)}` : esc(codeCls);
      return `<td class="code ${merged}">${esc(c.text)}</td>`;
    }
    if (c.type === 'pill') {
      return `<td${colCls ? ' class="'+esc(colCls)+'"' : ''}><span class="pill ${esc(c.level || 'near')}">${esc(c.text)}</span></td>`;
    }
    if (c.type === 'source' || (c.fallback !== undefined && c.text === undefined)) {
      if (c.fallback) {
        return `<td${colCls ? ' class="'+esc(colCls)+'"' : ''}><span class="srcfallback">${esc(c.text || '📡')}</span></td>`;
      }
      return `<td${colCls ? ' class="'+esc(colCls)+'"' : ''}><span class="source-ok">${esc(c.text || '聚源')}</span></td>`;
    }
    if (c.type === 'html') {
      return `<td${colCls ? ' class="'+esc(colCls)+'"' : ''}>${c.html || ''}</td>`;
    }
    const dir = c.dir ? esc(c.dir) : '';
    const classes = [dir, finalCls.trim()].filter(Boolean).join(' ');
    return classes ? `<td class="${classes}">${esc(c.text || '')}</td>` : `<td>${esc(c.text || '')}</td>`;
  }

  function renderRow(row, columns) {
    return '<tr>' + row.map((c, i) => renderCell(c, i, columns)).join('') + '</tr>';
  }

  function renderTable(columns, rows) {
    const thead = '<thead><tr>' +
      columns.map(c => {
        // 表头不继承任何 class(包括 wrap / split)— 保持默认 nowrap + 标准 padding
        const text = (typeof c === 'object') ? c.text : c;
        return `<th>${esc(text)}</th>`;
      }).join('') +
      '</tr></thead>';
    const tbody = '<tbody>' + rows.map(r => renderRow(r, columns)).join('') + '</tbody>';
    // 包一层 .table-wrap,移动端列多时横向滚动
    return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
  }

  function renderKpis(kpis) {
    if (!kpis || !kpis.length) return '';
    return '<div class="kpi-row">' +
      kpis.map(k => {
        const dir = k.dir ? ` ${esc(k.dir)}` : '';
        // chg 支持 inline <b> 标签加粗(数据源可信,跟 summary 处理一致)
        const chgHtml = esc(k.chg).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
        return `<div class="kpi">
          <div class="lbl">${esc(k.label)}</div>
          <div class="val">${esc(k.value)}</div>
          <div class="chg${dir}">${chgHtml}</div>
        </div>`;
      }).join('') +
      '</div>';
  }

  // 通用 tag-row 渲染:每个 tag 加 class="tag tag-pop" + data-tag-idx
  // 点击触发 popover 显示全文
  // 防御性自动截断:tag 数量 > 8 只取前 8(超长降级);tag 文字 > 80 字符保留前 80
  // 让 Mavis 即使生成超长数据也不会撑坏页面
  const MAX_TAGS = 8;
  const MAX_TAG_LEN = 80;
  function renderTagsRow(tags) {
    if (!tags || !tags.length) return '';
    const limited = tags.slice(0, MAX_TAGS);
    return '<div class="tags-row">' + limited.map((t, i) => {
      const tagText = t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) + '…' : t;
      const fullText = t;  // popover 仍显示完整原文
      return `<span class="tag tag-pop" data-tag-idx="${i}">${esc(tagText)}</span>` +
        `<div class="popover-body tag-popover" data-tag-idx="${i}" hidden>${esc(fullText)}</div>`;
    }).join('') + '</div>';
  }

  function renderHeader(h) {
    if (!h) return '';
    // summary 限 500 字(防御 Mavis 生成超长 summary 撑高 header)
    // 超出部分用 ellipsis 截断(<b> 标签不计入字数计算)
    // 长 summary 时,header 末尾加"展开全文"按钮,点击触发 popover 显示完整内容
    const summaryRaw = h.summary || '';
    const summaryPlain = summaryRaw.replace(/<\/?b>/g, '');  // 去标签数纯字数
    const MAX_SUMMARY = 500;
    const isTruncated = summaryPlain.length > MAX_SUMMARY;
    let summaryDisplay = summaryRaw;
    if (isTruncated) {
      // 找最接近 500 字的边界(句号/分号),保持语义完整
      const cutAt = summaryPlain.lastIndexOf('。', MAX_SUMMARY);
      const end = cutAt > 100 ? cutAt + 1 : MAX_SUMMARY;
      summaryDisplay = summaryPlain.slice(0, end) + '…';
    }
    const summaryHtml = summaryDisplay
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    // 全文 html(用于 popover)— esc 后保留 <b> 标签
    const summaryFullHtml = summaryRaw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    // 按钮 + popover 放在 header 末尾(独立位置,移动端始终在 summary 下方的底部)
    // 用全局唯一 summaryCounter 避免多个页面(idx 重复)切换时 popover 串台
    const expandBtn = isTruncated
      ? `<div class="summary-expand-wrap">
          <button type="button" class="summary-expand" data-summary-idx="${summaryCounter++}" title="点击展开完整 summary">阅读全文</button>
        </div>
        <div class="popover-body summary-full" data-summary-idx="${summaryCounter - 1}" hidden>${summaryFullHtml}</div>`
      : '';
    return renderTagsRow(h.tags) +
      `<h1>${esc(h.title || '')}</h1>
      <p class="header-summary">${summaryHtml}</p>
      ${expandBtn}`;
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
      <button type="button" class="popover-trigger" data-popover-id="${pid}"></button>
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
    const titleHtml = chart.title ? `<div class="chart-title">${esc(chart.title)}</div>` : '';
    // line chart 加 chart-line class,统一高度(不受 --chart-h 断点影响)
    const isLine = chart.type === 'line';
    const chartCls = `chart${isLine ? ' chart-line' : ''}`;
    const el = document.createElement('div');
    el.id = `chart-${chart.id}`;
    el.className = chartCls;
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
        // bar-h: bar 按数据方向自动延伸(0 在数据范围中央/边缘)
        //   负值 bar 从 0 向左,正值 bar 从 0 向右
        //   数据全负时 0 紧贴 yAxis(图右);数据混合时 0 居中;数据全正时 0 紧贴图最左
        const rawValues = data.map(d => (typeof d === 'object' ? d.value : d));
        const absMax = Math.max(...rawValues.map(Math.abs)) * 1.1 || 1;
        const hasPositive = rawValues.some(v => v > 0);
        const xMin = -absMax;
        const xMax = absMax;
        // yAxis label 简称:'KOSPI (9/14 开盘)' → 'KOSPI','三星电子 (9/14 开盘)' → '三星电子','SK海力士 (9/14 开盘)' → 'SK海力士'
        // (避免长 label 被 chart 边界截断,tooltip 显示完整名字)
        const shortCats = (chart.categories || []).map(c => {
          // 匹配开头一段非空白字符(中文/英文/数字)— 'KOSPI (9/14 开盘)' → 'KOSPI','SK海力士 (9/14 开盘)' → 'SK海力士'
          const noSpace = c.replace(/\s.*$/, '');  // 截断第一个空格后的内容
          return noSpace;
        });
        option = {
          tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (params) => {
              if (!params || !params.length) return '';
              const p = params[0];
              const fullName = (chart.categories || [])[p.dataIndex] || p.name;
              return `${fullName}<br/>${p.value}%`;
            }
          },
          grid: { left: 60, right: 16, top: 14, bottom: 20 },
          xAxis: { type: 'value', min: xMin, max: xMax, axisLabel: { formatter: axisFmt } },
          yAxis: { type: 'category', data: shortCats, inverse: true },
          series: [{
            type: 'bar', data,
            label: chart.showLabel !== false ? {
              show: true, position: 'right', distance: 4,
              formatter: (p) => {
                const v = p.value;
                if (v < 0) return `▼${Math.abs(v)}%`;
                if (v > 0) return `▲${v}%`;
                return `${v}%`;
              },
              fontSize: 10, color: '#1f2937'
            } : undefined
          }]
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
        // 5+ series 时图例折 3+2 两行,grid.top 需预留 50px(单行图例 32px 够)
        const gridTop = series.length >= 5 ? 50 : 32;
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
          // legend 顶部 + 紧凑排(图例尽量占 1-2 行,不放进图内)
          // 4 series 时图例太长会挤,这里用简短 formatter + 小字号 + scroll
          legend: {
            top: 0,
            type: 'scroll',                       // 4+ series 时横向 scroll,不放图内挤
            textStyle: { fontSize: 10 },
            itemGap: 4,
            itemWidth: 10,                         // line 缩到 10px,窄屏也能放下
            pageIconSize: 10,
            pageTextStyle: { fontSize: 9 },
            // 简称:IF2609 (主力·沪深300) → IF2609(legend 短,信息在 tooltip 详)
            formatter: (name) => {
              const m = name.match(/^([A-Z]{2}\d{4})/);
              return m ? m[1] : name;
            },
            data: series.map(s => s.name)
          },
          // grid.top 给 legend 留位(1 行 18 / 5+ series 2 行 36)
          grid: { left: 70, right: hasDualY ? 70 : 24, top: gridTop, bottom: 24 },
          xAxis: {
            type: 'category',
            data: chart.categories || [],
            boundaryGap: false,
            // xAxis 自适应:数据点多时隐藏部分 label,防止 label 重叠
            axisLabel: { fontSize: 10, interval: 'auto', hideOverlap: true }
          },
          // yAxis name:左侧 + 旋转 90 度垂直显示(垂直在 yAxis 中间)
          // 单 Y:chart.yLabel,双 Y:chart.yLabelLeft / yLabelRight
          yAxis: hasDualY ? [
            // scale:true 让 ECharts 自动从数据实际范围开始,不再强制 0 起点
            { type: 'value', position: 'left', scale: true, axisLabel: { fontSize: 10, formatter: axisFmt },
              name: chart.yLabelLeft || '', nameLocation: 'middle', nameGap: 30, nameRotate: 90,
              nameTextStyle: { fontSize: 10, color: '#6b7280' } },
            { type: 'value', position: 'right', scale: true, axisLabel: { fontSize: 10, formatter: axisFmt }, splitLine: { show: false },
              name: chart.yLabelRight || '', nameLocation: 'middle', nameGap: 25, nameRotate: 90,
              nameTextStyle: { fontSize: 10, color: '#6b7280' } }
          ] : {
            type: 'value',
            scale: true,
            axisLabel: { fontSize: 10, formatter: axisFmt },
            // yAxis name:左侧 + 旋转 90 度垂直(垂直在 yAxis 中间)
            ...(chart.yLabel ? {
              name: chart.yLabel, nameLocation: 'middle', nameGap: 30, nameRotate: 90,
              nameTextStyle: { fontSize: 10, color: '#6b7280' }
            } : {})
          },
          series: series.map((s, idx) => ({
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
    return titleHtml + el.outerHTML;
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
    // 6 段(明日起 / 下周关注)整表贴左:事件+时间+影响+重要度 都左对齐
    if (s.id === 'next_focus') classes.push('text-left');
    // 4/5/6 段(美元/原油/金属)标的列贴左(默认 first-child 已 left),其他列保持 right(数字列)
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
      ${renderTagsRow(s.tags)}
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
      // 切页后强制 ECharts resize + 关闭 popovers(位置可能错)
      setTimeout(() => {
        resizeAllCharts();
        document.querySelectorAll('.popover-body').forEach(b => b.hidden = true);
      }, 30);
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

    // 清理旧 summary popover body(showPopover 已把它们 appendChild 到 <body>,
    // 不在 header 内,所以 innerHTML 替换清理不到)— 防止多页面 idx 串台
    closeAllPopovers();
    document.querySelectorAll('.summary-full').forEach(b => b.remove());

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
    // 先显示 + 限高,再量真实高度 — 避免 body 还在 hidden 时 scrollHeight=0
    body.style.maxWidth = '520px';
    body.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    // 动态 max-height:viewport 减去 trigger 上下方空间,留 16px 边距
    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    // 默认放 trigger 上方,如果上方空间小则放下方;最终取较大一边 -16px
    const maxH = Math.max(120, Math.max(spaceAbove, spaceBelow) - 16);
    body.style.maxHeight = maxH + 'px';
    const popH = body.offsetHeight;  // 真实高度(已 layout)
    // 默认在 trigger **上方**,浮窗底部紧贴 trigger 顶部(gap 0)
    let top = rect.top - popH;
    if (top < margin) {
      // 上方空间不够,放到下方,浮窗顶部紧贴 trigger 底部
      top = rect.bottom;
      if (top + popH + margin > window.innerHeight) {
        // 上下都不够,贴 viewport 顶部
        top = margin;
      }
    }
    // 左右夹在视口内
    let left = rect.left;
    if (left + 520 + margin > window.innerWidth) {
      left = window.innerWidth - 520 - margin;
    }
    if (left < margin) left = margin;
    body.style.top = top + 'px';
    body.style.left = left + 'px';
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
    // tag popover:点击 fact tag 显示全文
    const tag = e.target.closest('.tag-pop');
    if (tag) {
      e.stopPropagation();
      const idx = tag.dataset.tagIdx;
      const body = document.querySelector(`.tag-popover[data-tag-idx="${idx}"]`);
      if (!body) return;
      const wasHidden = body.hidden;
      closeAllPopovers();
      if (wasHidden) {
        showPopover(body, tag);
        trackOpen();
      }
      return;
    }
    // summary expand:点击 summary 展开按钮显示完整 summary
    const expandBtn = e.target.closest('.summary-expand');
    if (expandBtn) {
      e.stopPropagation();
      const idx = expandBtn.dataset.summaryIdx;
      const body = document.querySelector(`.summary-full[data-summary-idx="${idx}"]`);
      if (!body) return;
      const wasHidden = body.hidden;
      closeAllPopovers();
      if (wasHidden) {
        showPopover(body, expandBtn);
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
