/**
 * Alumni Data Manager v2 — Merged Config + New Year Wizard
 * Single alumni-metadata.json, seamless new-year workflow
 */

(() => {
  'use strict';

  // ═══ State ═══
  let records = [];
  let fileName = 'alumni.jsonl';
  let editingRow = null;
  let sortState = { by: null, asc: true };
  let configData = null;
  let configSupervisors = [];
  let wizardYear = null;
  let wizardBuffer = []; // temp records before merge

  // ═══ DOM ═══
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ═══ Toast ═══
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('.toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ═══ Tabs ═══
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`#panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // ═══ Helpers ═══
  function parseJSONL(text) {
    return text.trim().split('\n').filter(l => l.trim()).map((line, i) => {
      try { return JSON.parse(line); }
      catch { console.warn(`Baris ${i + 1} invalid`); return null; }
    }).filter(Boolean);
  }

  function toJSONL(data) {
    return data.map(d => JSON.stringify(d)).join('\n') + '\n';
  }

  function buildSearchText(r) {
    return [r.name, r.npm, r.thesis, ...(r.supervisors || [])].join(' ').toLowerCase();
  }

  function cleanRecord(r, year) {
    // Auto-clean: trim, fix NPM, set year, generate searchText
    if (r.name) r.name = r.name.trim();
    if (r.npm) r.npm = r.npm.trim().replace(/^'+/, '').replace(/'+$/, '');
    if (r.thesis) r.thesis = r.thesis.trim();
    if (r.id) r.id = String(r.id).trim();
    if (typeof r.graduationYear === 'string') r.graduationYear = parseInt(r.graduationYear);
    if (!r.graduationYear && year) r.graduationYear = year;
    if (r.supervisors && typeof r.supervisors === 'string') {
      r.supervisors = r.supervisors.split(/[;|]/).map(s => s.trim()).filter(Boolean);
    }
    if (!r.supervisors) r.supervisors = [];
    r.searchText = buildSearchText(r);
    return r;
  }

  function download(content, name, type = 'application/json') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  // ═══ Stats ═══
  function updateStats() {
    const years = {};
    records.forEach(r => {
      const y = r.graduationYear || '?';
      years[y] = (years[y] || 0) + 1;
    });
    const yearKeys = Object.keys(years).filter(y => y !== '?').map(Number).sort((a, b) => b - a);
    const yearCount = yearKeys.length;
    $('#statTotal').textContent = records.length;
    $('#statYears').textContent = yearCount;
    $('#statSupervisors').textContent = new Set(records.flatMap(r => r.supervisors || [])).size;
    $('#statNewest').textContent = yearKeys[0] || '—';

    const sorted = Object.entries(years).sort((a, b) => {
      if (a[0] === '?') return 1;
      if (b[0] === '?') return -1;
      return parseInt(b[0]) - parseInt(a[0]);
    });
    $('#yearBreakdown').innerHTML = sorted.map(([y, c]) =>
      `<span class="badge">${y}: ${c}</span> `
    ).join('');

    // Update year filter dropdown
    const sel = $('#filterYear');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Tahun</option>';
    yearKeys.forEach(y => {
      sel.innerHTML += `<option value="${y}" ${String(y) === cur ? 'selected' : ''}>${y} (${years[y]})</option>`;
    });
  }

  // ═══ Table ═══
  function renderTable() {
    const tbody = $('#dataBody');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">Belum ada data. Import file, tambah record, atau gunakan wizard Tahun Baru.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map((r, i) => {
      if (editingRow === i) return editRowHTML(r, i);
      return viewRowHTML(r, i);
    }).join('');
    $('#rowCount').textContent = `${records.length} records`;
    updateStats();
  }

  function viewRowHTML(r, i) {
    const sups = (r.supervisors || []).map(s => `<div>${esc(s)}</div>`).join('') || '<span style="color:#ccc">—</span>';
    return `<tr data-idx="${i}">
      <td><span class="badge">${esc(String(r.graduationYear || '—'))}</span></td>
      <td><strong>${esc(r.name || '—')}</strong></td>
      <td>${esc(r.npm || '—')}</td>
      <td style="max-width:250px;font-style:italic;font-size:.82rem">${esc((r.thesis || '—').substring(0, 120))}${(r.thesis||'').length > 120 ? '…' : ''}</td>
      <td style="font-size:.78rem">${sups}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="app.edit(${i})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="app.remove(${i})">🗑</button>
        <button class="btn btn-sm btn-outline" onclick="app.moveUp(${i})" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-sm btn-outline" onclick="app.moveDown(${i})" ${i === records.length - 1 ? 'disabled' : ''}>↓</button>
      </td>
    </tr>`;
  }

  function editRowHTML(r, i) {
    const supsStr = (r.supervisors || []).join('; ');
    return `<tr data-idx="${i}" style="background:#f0f0ff">
      <td><input type="number" value="${r.graduationYear || ''}" data-field="graduationYear"></td>
      <td><input type="text" value="${esc(r.name || '')}" data-field="name"></td>
      <td><input type="text" value="${esc(r.npm || '')}" data-field="npm"></td>
      <td><textarea data-field="thesis" rows="2">${esc(r.thesis || '')}</textarea></td>
      <td><input type="text" value="${esc(supsStr)}" data-field="supervisors" placeholder="Pisah dengan ;"></td>
      <td class="actions">
        <button class="btn btn-sm btn-success" onclick="app.save(${i})">💾</button>
        <button class="btn btn-sm btn-outline" onclick="app.cancelEdit()">✕</button>
      </td>
    </tr>`;
  }

  // ═══ CRUD ═══
  function edit(i) { editingRow = i; renderTable(); }

  function save(i) {
    const row = $(`tr[data-idx="${i}"]`);
    row.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      let v = el.value.trim();
      if (f === 'graduationYear') v = v ? parseInt(v) : null;
      else if (f === 'supervisors') v = v.split(/[;|]/).map(s => s.trim()).filter(Boolean);
      records[i][f] = v;
    });
    records[i].searchText = buildSearchText(records[i]);
    editingRow = null;
    renderTable();
    toast('Record diupdate', 'success');
  }

  function cancelEdit() { editingRow = null; renderTable(); }

  function remove(i) {
    if (!confirm(`Hapus "${records[i].name || 'record ini'}"?`)) return;
    records.splice(i, 1);
    editingRow = null;
    renderTable();
    toast('Record dihapus', 'success');
  }

  function moveUp(i) {
    if (i <= 0) return;
    [records[i - 1], records[i]] = [records[i], records[i - 1]];
    renderTable();
  }

  function moveDown(i) {
    if (i >= records.length - 1) return;
    [records[i], records[i + 1]] = [records[i + 1], records[i]];
    renderTable();
  }

  function addRecord(keepOpen = false) {
    const name = $('#addName').value.trim();
    if (!name) { toast('Nama wajib diisi', 'error'); return; }
    const r = {
      id: $('#addId').value.trim() || Date.now().toString(),
      name,
      npm: $('#addNpm').value.trim(),
      graduationYear: parseInt($('#addYear').value) || null,
      thesis: $('#addThesis').value.trim(),
      supervisors: $('#addSupervisors').value.split(/[;|]/).map(s => s.trim()).filter(Boolean),
    };
    r.searchText = buildSearchText(r);
    records.push(r);
    editingRow = null;
    renderTable();
    toast(`Ditambahkan: ${r.name}`, 'success');

    if (keepOpen) {
      // Keep form open, clear fields for next entry, preserve year
      const year = $('#addYear').value;
      ['#addId','#addName','#addNpm','#addThesis','#addSupervisors'].forEach(s => $(s).value = '');
      $('#addYear').value = year;
      $('#addName').focus();
    } else {
      ['#addId','#addName','#addNpm','#addYear','#addThesis','#addSupervisors'].forEach(s => $(s).value = '');
      $('#addBody').style.display = 'none';
    }
  }

  // ═══ Search & Sort & Filter ═══
  function filterTable() {
    const q = $('#searchBox').value.toLowerCase().trim();
    const yearFilter = $('#filterYear').value;
    $$('#dataBody tr').forEach(row => {
      const idx = parseInt(row.dataset.idx);
      if (isNaN(idx)) return;
      const r = records[idx];
      const text = r.searchText || buildSearchText(r);
      const matchSearch = !q || text.includes(q);
      const matchYear = !yearFilter || String(r.graduationYear) === yearFilter;
      row.style.display = (matchSearch && matchYear) ? '' : 'none';
    });
  }

  function sortRecords(by) {
    if (sortState.by === by) sortState.asc = !sortState.asc;
    else { sortState.by = by; sortState.asc = true; }
    const dir = sortState.asc ? 1 : -1;
    records.sort((a, b) => {
      const va = a[by] ?? '', vb = b[by] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    renderTable();
    toast(`Sorted by ${by} ${sortState.asc ? '↑' : '↓'}`, 'info');
  }

  // ═══ Import ═══
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const name = file.name.toLowerCase();

      // Auto-detect config files
      if (name.includes('metadata') || name === 'alumni-metadata.json') {
        try {
          const obj = JSON.parse(text);
          if (obj.years || obj.cleaningInfo || obj.supervisors) {
            loadConfigJSON(text);
            toast(`Config dimuat dari ${file.name}`, 'success');
            return;
          }
        } catch {}
      }

      if (file.name.endsWith('.csv')) {
        importCSV(text);
      } else {
        let parsed = parseJSONL(text);
        // Try parsing as JSON array
        if (!parsed.length) {
          try {
            const arr = JSON.parse(text);
            if (Array.isArray(arr)) parsed = arr;
          } catch {}
        }
        parsed.forEach(r => cleanRecord(r));
        records = [...records, ...parsed];
      }
      fileName = file.name;
      editingRow = null;
      renderTable();
      toast(`Loaded dari ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line) {
    const result = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) { if (c === '"') { if (line[i+1]==='"'){cur+='"';i++;}else inQ=false; } else cur+=c; }
      else { if (c==='"') inQ=true; else if (c===','){result.push(cur.trim());cur='';} else cur+=c; }
    }
    result.push(cur.trim());
    return result;
  }

  function importCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { toast('CSV kosong', 'error'); return; }
    const headers = parseCSVLine(lines[0]);
    const mapping = {};
    const known = {nama:'name',namalengkap:'name',npm:'npm',nip:'npm',tahun:'graduationYear',angkatan:'graduationYear',year:'graduationYear',judul:'thesis',thesis:'thesis',tesis:'thesis',pembimbing:'supervisors',supervisor:'supervisors',supervisors:'supervisors'};
    headers.forEach(h => { const k=h.toLowerCase().replace(/[^a-z]/g,''); if(known[k]&&known[k]!==h) mapping[h]=known[k]; });

    const parsed = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[mapping[h]||h] = (vals[i]||'').trim(); });
      cleanRecord(obj);
      return obj;
    });
    records = [...records, ...parsed];
  }

  async function importGSheet() {
    let url = $('#gsheetUrl').value.trim();
    if (!url) { toast('Masukkan URL Google Sheets', 'error'); return; }
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const id = match[1];
      const gid = (url.match(/gid=(\d+)/) || [null,'0'])[1];
      url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    toast('Mengambil data…', 'info');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      importCSV(await res.text());
      editingRow = null; renderTable();
      toast(`Imported dari Google Sheets`, 'success');
    } catch (err) { toast(`Gagal: ${err.message}`, 'error'); }
  }

  // ═══ Export ═══
  function exportJSONL() {
    if (!records.length) { toast('Tidak ada data', 'error'); return; }
    download(toJSONL(records), fileName.replace(/\.\w+$/, '') + '.jsonl', 'application/jsonl');
    toast(`Exported ${records.length} records`, 'success');
  }

  function exportCSV() {
    if (!records.length) { toast('Tidak ada data', 'error'); return; }
    const fields = ['id','name','npm','graduationYear','thesis','supervisors'];
    const header = fields.join(',');
    const rows = records.map(r => fields.map(f => {
      let v = r[f];
      if (Array.isArray(v)) v = v.join('; ');
      if (typeof v === 'string' && (v.includes(',') || v.includes('"')))
        v = `"${v.replace(/"/g,'""')}"`;
      return v ?? '';
    }).join(','));
    download(header+'\n'+rows.join('\n'), fileName.replace(/\.\w+$/, '') + '.csv', 'text/csv');
    toast('CSV exported', 'success');
  }

  function splitByYear() {
    if (!records.length) { toast('Tidak ada data', 'error'); return; }
    const groups = {};
    records.forEach(r => { const y = r.graduationYear || 'unknown'; (groups[y]=groups[y]||[]).push(r); });

    // Download each year's JSONL
    Object.entries(groups).sort().forEach(([y, data]) => {
      download(toJSONL(data), `${y}.jsonl`);
    });

    // Generate unified alumni-metadata.json
    const years = Object.keys(groups).filter(y => y !== 'unknown').map(Number).sort();
    const counts = Object.fromEntries(Object.entries(groups).map(([y, d]) => [y, d.length]));
    const allSups = [...new Set(records.flatMap(r => r.supervisors || []))].sort();

    const metadata = {
      years,
      counts,
      totalAlumni: records.length,
      lastUpdated: new Date().toISOString(),
      dataStructure: {
        fields: ['id', 'name', 'npm', 'graduationYear', 'thesis', 'supervisors', 'searchText'],
        description: 'Data alumni Magister Teknik Elektro USK'
      },
      cleaningInfo: {
        cleanedBy: 'Alumni Data Manager',
        issuesFixed: ['Auto-generated from split'],
        cleaningDate: new Date().toISOString().split('T')[0]
      },
      supervisors: allSups
    };

    download(JSON.stringify(metadata, null, 2), 'alumni-metadata.json');
    toast(`Split ${Object.keys(groups).length} JSONL + alumni-metadata.json`, 'success');
  }

  // ══════════════════════════════════════════
  // NEW YEAR WIZARD
  // ══════════════════════════════════════════
  function wizardSetYear() {
    const y = parseInt($('#newYearInput').value);
    if (!y || y < 2000 || y > 2030) { toast('Masukkan tahun yang valid (2000-2030)', 'error'); return; }

    // Check if year already exists
    const existing = records.filter(r => r.graduationYear === y);
    if (existing.length) {
      if (!confirm(`Tahun ${y} sudah ada ${existing.length} record. Lanjutkan? (data baru akan ditambahkan)`)) return;
    }

    wizardYear = y;
    wizardBuffer = [];
    $('#wizardYearLabel').textContent = y;
    $('#wizardYearDisplay').textContent = y;
    $('#wizardCount').textContent = '';
    $('#wizardStep2').style.opacity = '1';
    $('#wizardStep2').style.pointerEvents = 'auto';
    $('#wizardStep3').style.opacity = '.4';
    $('#wizardStep3').style.pointerEvents = 'none';
    toast(`Tahun ${y} dipilih. Import data sekarang.`, 'info');
  }

  function wizardParsePaste() {
    const text = $('#newYearPaste').value.trim();
    if (!text) { toast('Paste data dulu', 'error'); return; }

    let parsed = [];
    // Try JSONL first
    try {
      parsed = parseJSONL(text);
    } catch {}
    // Try JSON array
    if (!parsed.length) {
      try {
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) parsed = arr;
      } catch {}
    }
    // Try line-by-line CSV-like (name, npm, thesis)
    if (!parsed.length) {
      const lines = text.split('\n').filter(l => l.trim());
      parsed = lines.map(line => {
        const parts = line.split(/[,\t]/).map(p => p.trim());
        return { name: parts[0] || '', npm: parts[1] || '', thesis: parts[2] || '', supervisors: [] };
      });
    }

    if (!parsed.length) { toast('Tidak bisa parse data', 'error'); return; }

    parsed.forEach(r => cleanRecord(r, wizardYear));
    wizardBuffer = [...wizardBuffer, ...parsed];
    enableStep3();
    toast(`${parsed.length} record di-parse (${wizardBuffer.length} total di buffer)`, 'success');
    $('#newYearPaste').value = '';
  }

  function wizardTemplate(count) {
    wizardBuffer = Array.from({ length: count }, (_, i) => ({
      id: '',
      name: '',
      npm: '',
      graduationYear: wizardYear,
      thesis: '',
      supervisors: [],
      searchText: ''
    }));
    enableStep3();
    toast(`${count} baris kosong dibuat untuk tahun ${wizardYear}`, 'success');
  }

  async function wizardImportGSheet() {
    let url = $('#newYearGSheet').value.trim();
    if (!url) { toast('Masukkan URL', 'error'); return; }
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const id = match[1];
      const gid = (url.match(/gid=(\d+)/) || [null,'0'])[1];
      url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    toast('Mengambil data…', 'info');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) { toast('Sheet kosong', 'error'); return; }
      const headers = parseCSVLine(lines[0]);
      const mapping = {};
      const known = {nama:'name',namalengkap:'name',npm:'npm',nip:'npm',tahun:'graduationYear',angkatan:'graduationYear',year:'graduationYear',judul:'thesis',thesis:'thesis',tesis:'thesis',pembimbing:'supervisors',supervisor:'supervisors',supervisors:'supervisors'};
      headers.forEach(h => { const k=h.toLowerCase().replace(/[^a-z]/g,''); if(known[k]&&known[k]!==h) mapping[h]=known[k]; });

      const parsed = lines.slice(1).map(line => {
        const vals = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[mapping[h]||h] = (vals[i]||'').trim(); });
        cleanRecord(obj, wizardYear);
        return obj;
      });
      wizardBuffer = [...wizardBuffer, ...parsed];
      enableStep3();
      toast(`${parsed.length} record di-import dari Sheets (${wizardBuffer.length} total)`, 'success');
    } catch (err) { toast(`Gagal: ${err.message}`, 'error'); }
  }

  function enableStep3() {
    $('#wizardStep3').style.opacity = '1';
    $('#wizardStep3').style.pointerEvents = 'auto';
    $('#wizardCount').textContent = `${wizardBuffer.length} record di buffer`;
  }

  function wizardMerge() {
    if (!wizardBuffer.length) { toast('Buffer kosong', 'error'); return; }
    // Final clean pass
    wizardBuffer.forEach(r => cleanRecord(r, wizardYear));
    records = [...records, ...wizardBuffer];
    const count = wizardBuffer.length;
    wizardBuffer = [];
    editingRow = null;
    renderTable();
    toast(`${count} record tahun ${wizardYear} di-merge ke data utama`, 'success');

    // Reset wizard
    $('#wizardStep2').style.opacity = '.4';
    $('#wizardStep2').style.pointerEvents = 'none';
    $('#wizardStep3').style.opacity = '.4';
    $('#wizardStep3').style.pointerEvents = 'none';
    $('#wizardCount').textContent = '';
    $('#newYearInput').value = '';
  }

  // Setup wizard drop zone
  function initWizardDrop() {
    const dz = $('#newYearDrop');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = ev => {
          const text = ev.target.result;
          let parsed = [];
          if (file.name.endsWith('.csv')) {
            const lines = text.trim().split('\n');
            if (lines.length >= 2) {
              const headers = parseCSVLine(lines[0]);
              parsed = lines.slice(1).map(line => {
                const vals = parseCSVLine(line);
                const obj = {};
                headers.forEach((h, i) => { obj[h] = (vals[i]||'').trim(); });
                return obj;
              });
            }
          } else {
            parsed = parseJSONL(text);
            if (!parsed.length) {
              try { const arr = JSON.parse(text); if (Array.isArray(arr)) parsed = arr; } catch {}
            }
          }
          parsed.forEach(r => cleanRecord(r, wizardYear));
          wizardBuffer = [...wizardBuffer, ...parsed];
          enableStep3();
          toast(`${parsed.length} record dari ${file.name}`, 'success');
        };
        reader.readAsText(file);
      }
    });
    dz.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.jsonl,.json,.csv'; inp.multiple = true;
      inp.onchange = () => {
        for (const file of inp.files) {
          const reader = new FileReader();
          reader.onload = ev => {
            const text = ev.target.result;
            let parsed = parseJSONL(text);
            if (!parsed.length) { try { const a = JSON.parse(text); if (Array.isArray(a)) parsed = a; } catch {} }
            parsed.forEach(r => cleanRecord(r, wizardYear));
            wizardBuffer = [...wizardBuffer, ...parsed];
            enableStep3();
            toast(`${parsed.length} record dari ${file.name}`, 'success');
          };
          reader.readAsText(file);
        }
      };
      inp.click();
    });
  }

  // ══════════════════════════════════════════
  // CONFIG EDITOR (merged alumni-metadata.json)
  // ══════════════════════════════════════════
  function loadConfigJSON(text) {
    try {
      configData = JSON.parse(text);
      configSupervisors = [...(configData.supervisors || [])];
      populateConfigForm();
    } catch { toast('JSON tidak valid', 'error'); }
  }

  function populateConfigForm() {
    if (!configData) return;
    $('#cfgTotal').value = configData.totalAlumni || 0;
    $('#cfgLastUpdated').value = (configData.lastUpdated || '').split('T')[0];
    $('#cfgYears').value = (configData.years || []).join(', ');
    $('#cfgCleanedBy').value = configData.cleaningInfo?.cleanedBy || '';
    $('#cfgCleaningDate').value = configData.cleaningInfo?.cleaningDate || '';
    $('#cfgDescription').value = configData.dataStructure?.description || '';
    $('#cfgIssues').value = (configData.cleaningInfo?.issuesFixed || []).join('\n');

    // Counts editor
    renderCountsEditor();
    renderSupervisorsList();
    syncRawFromForm();
  }

  function renderCountsEditor() {
    const container = $('#cfgCountsEditor');
    const counts = configData?.counts || {};
    const years = configData?.years || [];
    const allYears = [...new Set([...years, ...Object.keys(counts).filter(k => k !== 'unknown').map(Number)])].sort((a, b) => b - a);
    container.innerHTML = allYears.map(y => `
      <div class="count-cell">
        <label>${y}</label>
        <input type="number" value="${counts[y] || 0}" data-count-year="${y}" min="0">
      </div>
    `).join('') + (counts.unknown ? `
      <div class="count-cell">
        <label>?</label>
        <input type="number" value="${counts.unknown || 0}" data-count-year="unknown" min="0">
      </div>
    ` : '');

    // Listen for changes
    container.querySelectorAll('input[data-count-year]').forEach(el => {
      el.addEventListener('change', syncRawFromForm);
    });
  }

  function renderSupervisorsList() {
    const container = $('#cfgSupervisors');
    $('#cfgSupCount').textContent = configSupervisors.length;
    container.innerHTML = configSupervisors.map((s, i) => `
      <div style="display:flex;gap:.35rem;align-items:center;margin-bottom:.25rem;font-size:.82rem">
        <span style="flex:1">${esc(s)}</span>
        <button class="btn btn-sm btn-danger" onclick="app.removeSupervisor(${i})" style="padding:.15rem .4rem;font-size:.7rem">✕</button>
      </div>
    `).join('') || '<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem">Belum ada pembimbing</div>';
  }

  function addSupervisor() {
    const val = $('#cfgNewSup').value.trim();
    if (!val) return;
    configSupervisors.push(val);
    $('#cfgNewSup').value = '';
    renderSupervisorsList();
    syncRawFromForm();
  }

  function removeSupervisor(i) {
    configSupervisors.splice(i, 1);
    renderSupervisorsList();
    syncRawFromForm();
  }

  function autoGenerateConfig() {
    if (!records.length) { toast('Load data JSONL dulu', 'error'); return; }
    const years = {};
    const allSups = new Set();
    records.forEach(r => {
      const y = r.graduationYear || '?';
      years[y] = (years[y] || 0) + 1;
      (r.supervisors || []).forEach(s => allSups.add(s));
    });
    configSupervisors = [...allSups].sort();
    const intYears = Object.keys(years).filter(y => y !== '?').map(Number).sort((a, b) => b - a);

    configData = {
      years: intYears,
      counts: years,
      totalAlumni: records.length,
      lastUpdated: new Date().toISOString(),
      dataStructure: {
        fields: ['id', 'name', 'npm', 'graduationYear', 'thesis', 'supervisors', 'searchText'],
        description: $('#cfgDescription').value || 'Data alumni Magister Teknik Elektro USK'
      },
      cleaningInfo: {
        cleanedBy: $('#cfgCleanedBy').value || 'Auto-generated',
        issuesFixed: $('#cfgIssues').value.split('\n').filter(l => l.trim()),
        cleaningDate: new Date().toISOString().split('T')[0]
      },
      supervisors: configSupervisors
    };
    populateConfigForm();
    toast('Config di-generate dari data', 'success');
  }

  function syncRawFromForm() {
    const yearsStr = $('#cfgYears').value.trim();
    const years = yearsStr ? yearsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];

    // Read counts from editor
    const counts = {};
    $$('#cfgCountsEditor input[data-count-year]').forEach(el => {
      const y = el.dataset.countYear;
      const v = parseInt(el.value) || 0;
      if (v > 0) counts[y] = v;
    });

    configData = {
      years,
      counts,
      totalAlumni: parseInt($('#cfgTotal').value) || 0,
      lastUpdated: ($('#cfgLastUpdated').value || new Date().toISOString().split('T')[0]) + 'T00:00:00.000Z',
      dataStructure: {
        fields: ['id', 'name', 'npm', 'graduationYear', 'thesis', 'supervisors', 'searchText'],
        description: $('#cfgDescription').value || ''
      },
      cleaningInfo: {
        cleanedBy: $('#cfgCleanedBy').value || '',
        issuesFixed: $('#cfgIssues').value.split('\n').filter(l => l.trim()),
        cleaningDate: $('#cfgCleaningDate').value || ''
      },
      supervisors: configSupervisors
    };
    $('#cfgRaw').value = JSON.stringify(configData, null, 2);
  }

  function saveConfig() {
    syncRawFromForm();
    if (!configData) { toast('Tidak ada data', 'error'); return; }
    download(JSON.stringify(configData, null, 2), 'alumni-metadata.json');
    toast('alumni-metadata.json di-download', 'success');
  }

  function parseRawConfig() {
    try {
      configData = JSON.parse($('#cfgRaw').value);
      configSupervisors = [...(configData.supervisors || [])];
      populateConfigForm();
      toast('Raw JSON parsed', 'success');
    } catch { toast('JSON tidak valid', 'error'); }
  }

  // Watch config form changes
  ['cfgTotal', 'cfgLastUpdated', 'cfgYears', 'cfgCleanedBy', 'cfgCleaningDate', 'cfgDescription', 'cfgIssues'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', syncRawFromForm);
      el.addEventListener('input', () => { clearTimeout(el._t); el._t = setTimeout(syncRawFromForm, 500); });
    }
  });

  // Config drop zone
  const cdz = $('#configDropZone');
  if (cdz) {
    cdz.addEventListener('dragover', e => { e.preventDefault(); cdz.classList.add('drag-over'); });
    cdz.addEventListener('dragleave', () => cdz.classList.remove('drag-over'));
    cdz.addEventListener('drop', e => {
      e.preventDefault(); cdz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => { loadConfigJSON(ev.target.result); toast('Config dimuat', 'success'); };
        reader.readAsText(file);
      }
    });
    cdz.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = () => {
        if (inp.files[0]) {
          const reader = new FileReader();
          reader.onload = ev => { loadConfigJSON(ev.target.result); toast('Config dimuat', 'success'); };
          reader.readAsText(inp.files[0]);
        }
      };
      inp.click();
    });
  }

  // ═══ Main drop zone (multi-file support) ═══
  const dz = $('#dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    for (const file of files) loadFile(file);
    if (files.length > 1) toast(`${files.length} file di-import`, 'info');
  });
  dz.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.jsonl,.json,.csv'; inp.multiple = true;
    inp.onchange = () => { for (const file of inp.files) loadFile(file); };
    inp.click();
  });

  // ═══ Drag reorder ═══
  let dragIdx = null;
  document.addEventListener('dragstart', e => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr || editingRow !== null) return;
    dragIdx = parseInt(tr.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
    tr.style.opacity = '.4';
  });
  document.addEventListener('dragover', e => {
    const tr = e.target.closest('tr[data-idx]');
    if (tr && dragIdx !== null) { e.preventDefault(); tr.style.borderTop = '3px solid var(--primary)'; }
  });
  document.addEventListener('dragleave', e => {
    const tr = e.target.closest('tr[data-idx]');
    if (tr) tr.style.borderTop = '';
  });
  document.addEventListener('drop', e => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr || dragIdx === null) return;
    e.preventDefault(); tr.style.borderTop = '';
    const dropIdx = parseInt(tr.dataset.idx);
    if (dragIdx !== dropIdx) { const [item] = records.splice(dragIdx, 1); records.splice(dropIdx, 0, item); renderTable(); }
    dragIdx = null;
  });
  document.addEventListener('dragend', () => {
    dragIdx = null;
    $$('tr').forEach(tr => { tr.style.opacity = ''; tr.style.borderTop = ''; });
  });

  // ═══ Public API ═══
  window.app = {
    edit, save, cancelEdit, remove, moveUp, moveDown,
    addRecord, filterTable, sortRecords,
    importGSheet, exportJSONL, exportCSV,
    splitByYear,
    wizardSetYear, wizardParsePaste, wizardTemplate, wizardImportGSheet, wizardMerge,
    autoGenerateConfig, saveConfig, parseRawConfig,
    addSupervisor, removeSupervisor,
  };

  // ═══ Init ═══
  renderTable();
  initWizardDrop();

  // Auto-update copyright
  const el = document.getElementById('copyright-text');
  if (el) el.textContent = `\u00A9 ${new Date().getFullYear()} KingSyah`;
})();
