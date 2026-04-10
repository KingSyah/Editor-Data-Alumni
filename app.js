/**
 * Alumni Data Manager — app.js
 * JSONL editor + Manifest & Metadata manager
 */

(() => {
  'use strict';

  // ═══ State ═══
  let records = [];
  let fileName = 'alumni.jsonl';
  let editingRow = null;
  let sortState = { by: null, asc: true };
  let manifestData = null;
  let metadataData = null;
  let metaSupervisors = [];

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
    const yearCount = Object.keys(years).filter(y => y !== '?').length;
    $('#statTotal').textContent = records.length;
    $('#statYears').textContent = yearCount;
    $('#statSupervisors').textContent = new Set(records.flatMap(r => r.supervisors || [])).size;

    const sorted = Object.entries(years).sort((a, b) => {
      if (a[0] === '?') return 1;
      if (b[0] === '?') return -1;
      return parseInt(b[0]) - parseInt(a[0]);
    });
    $('#yearBreakdown').innerHTML = sorted.map(([y, c]) =>
      `<span class="badge">${y}: ${c}</span> `
    ).join('');
  }

  // ═══ Table ═══
  function renderTable() {
    const tbody = $('#dataBody');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">Belum ada data. Import file atau tambah record baru.</td></tr>';
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

  function addRecord() {
    const r = {
      id: $('#addId').value.trim() || Date.now().toString(),
      name: $('#addName').value.trim(),
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
    ['#addId','#addName','#addNpm','#addYear','#addThesis','#addSupervisors'].forEach(s => $(s).value = '');
  }

  // ═══ Search & Sort ═══
  function filterTable() {
    const q = $('#searchBox').value.toLowerCase().trim();
    $$('#dataBody tr').forEach(row => {
      const idx = parseInt(row.dataset.idx);
      if (isNaN(idx)) return;
      const r = records[idx];
      const text = r.searchText || buildSearchText(r);
      row.style.display = (!q || text.includes(q)) ? '' : 'none';
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
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      if (file.name.endsWith('.csv')) importCSV(text);
      else if (file.name === 'manifest.json') { loadManifestJSON(text); return; }
      else if (file.name.includes('metadata')) { loadMetadataJSON(text); return; }
      else {
        records = parseJSONL(text);
        records.forEach(r => { if (!r.searchText) r.searchText = buildSearchText(r); });
      }
      editingRow = null;
      renderTable();
      toast(`Loaded ${records.length} records dari ${file.name}`, 'success');
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

    records = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[mapping[h]||h] = (vals[i]||'').trim(); });
      if (obj.graduationYear) obj.graduationYear = parseInt(obj.graduationYear);
      if (obj.supervisors && typeof obj.supervisors === 'string')
        obj.supervisors = obj.supervisors.split(/[;|]/).map(s => s.trim()).filter(Boolean);
      obj.searchText = buildSearchText(obj);
      return obj;
    });
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
      toast(`Imported ${records.length} records`, 'success');
    } catch (err) { toast(`Gagal: ${err.message}`, 'error'); }
  }

  // ═══ Export ═══
  function exportJSONL() {
    if (!records.length) { toast('Tidak ada data', 'error'); return; }
    download(toJSONL(records), fileName, 'application/jsonl');
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
    download(header+'\n'+rows.join('\n'), fileName.replace('.jsonl','.csv'), 'text/csv');
    toast('CSV exported', 'success');
  }

  function splitByYear() {
    if (!records.length) { toast('Tidak ada data', 'error'); return; }
    const groups = {};
    records.forEach(r => { const y = r.graduationYear || 'unknown'; (groups[y]=groups[y]||[]).push(r); });
    Object.entries(groups).sort().forEach(([y, data]) => download(toJSONL(data), `${y}.jsonl`));
    const years = Object.keys(groups).filter(y => y!=='unknown').map(Number).sort();
    const manifest = { years, counts: Object.fromEntries(Object.entries(groups).map(([y,d])=>[y,d.length])), total: records.length, lastUpdated: new Date().toISOString().split('T')[0] };
    download(JSON.stringify(manifest, null, 2), 'manifest.json');
    toast(`Split ${Object.keys(groups).length} files + manifest`, 'success');
  }

  // ═══ Template ═══
  function createTemplate() {
    const fields = ($('#templateFields').value||'id,name,npm,graduationYear,thesis,supervisors').split(',').map(f=>f.trim());
    const sample = {};
    fields.forEach(f => {
      switch(f){
        case 'id': sample.id='XXXXXXXXXXXX'; break;
        case 'name': sample.name='Nama Lengkap'; break;
        case 'npm': sample.npm='XXXXXXXXXXXX'; break;
        case 'graduationYear': sample.graduationYear=2024; break;
        case 'thesis': sample.thesis='Judul Tesis'; break;
        case 'supervisors': sample.supervisors=['Pembimbing 1','Pembimbing 2']; break;
        case 'searchText': sample.searchText=''; break;
        default: sample[f]='';
      }
    });
    sample.searchText = buildSearchText(sample);
    records = [sample]; editingRow = null; renderTable();
    toast('Template dibuat', 'success');
  }

  // ══════════════════════════════════════════
  // MANIFEST EDITOR
  // ══════════════════════════════════════════
  function loadManifestFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const reader = new FileReader();
      reader.onload = e => loadManifestJSON(e.target.result);
      reader.readAsText(inp.files[0]);
    };
    inp.click();
  }

  function loadManifestJSON(text) {
    try {
      manifestData = JSON.parse(text);
      populateManifestForm();
      toast('manifest.json dimuat', 'success');
    } catch { toast('JSON tidak valid', 'error'); }
  }

  function populateManifestForm() {
    if (!manifestData) return;
    $('#mfTotal').value = manifestData.total || 0;
    $('#mfLastUpdated').value = (manifestData.lastUpdated || '').split('T')[0];
    $('#mfYears').value = (manifestData.years || []).join(', ');
    $('#mfCounts').value = JSON.stringify(manifestData.counts || {}, null, 2);
    $('#mfRaw').value = JSON.stringify(manifestData, null, 2);
  }

  function autoGenerateManifest() {
    if (!records.length) { toast('Load data JSONL dulu', 'error'); return; }
    const years = {}; 
    records.forEach(r => { const y = r.graduationYear || 'unknown'; years[y] = (years[y]||0)+1; });
    const intYears = Object.keys(years).filter(y => y !== 'unknown').map(Number).sort();
    manifestData = {
      years: intYears,
      counts: years,
      total: records.length,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    populateManifestForm();
    toast('Manifest di-generate dari data', 'success');
  }

  function saveManifest() {
    // Sync form → raw JSON
    syncManifestFromForm();
    if (!manifestData) { toast('Tidak ada data', 'error'); return; }
    download(JSON.stringify(manifestData, null, 2), 'manifest.json');
    toast('manifest.json di-download', 'success');
  }

  function syncManifestFromForm() {
    const yearsStr = $('#mfYears').value.trim();
    const years = yearsStr ? yearsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
    let counts = {};
    try { counts = JSON.parse($('#mfCounts').value); } catch {}
    manifestData = {
      years,
      counts,
      total: parseInt($('#mfTotal').value) || 0,
      lastUpdated: $('#mfLastUpdated').value || new Date().toISOString().split('T')[0]
    };
    $('#mfRaw').value = JSON.stringify(manifestData, null, 2);
  }

  // Watch form changes → update raw JSON
  ['mfTotal','mfLastUpdated','mfYears','mfCounts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', syncManifestFromForm);
    if (el) el.addEventListener('input', () => { clearTimeout(el._t); el._t = setTimeout(syncManifestFromForm, 500); });
  });

  // Watch raw JSON → update form
  const mfRaw = document.getElementById('mfRaw');
  if (mfRaw) mfRaw.addEventListener('change', () => {
    try {
      manifestData = JSON.parse(mfRaw.value);
      populateManifestForm();
    } catch { toast('Raw JSON tidak valid', 'error'); }
  });

  // ══════════════════════════════════════════
  // METADATA EDITOR
  // ══════════════════════════════════════════
  function loadMetaFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const reader = new FileReader();
      reader.onload = e => loadMetadataJSON(e.target.result);
      reader.readAsText(inp.files[0]);
    };
    inp.click();
  }

  function loadMetadataJSON(text) {
    try {
      metadataData = JSON.parse(text);
      metaSupervisors = [...(metadataData.supervisors || [])];
      populateMetaForm();
      toast('alumni-metadata.json dimuat', 'success');
    } catch { toast('JSON tidak valid', 'error'); }
  }

  function populateMetaForm() {
    if (!metadataData) return;
    $('#mdTotal').value = metadataData.totalAlumni || 0;
    $('#mdLastUpdated').value = (metadataData.lastUpdated || '').split('T')[0];
    $('#mdYears').value = (metadataData.graduationYears || []).join(', ');
    $('#mdCleanedBy').value = metadataData.cleaningInfo?.cleanedBy || '';
    $('#mdCleaningDate').value = metadataData.cleaningInfo?.cleaningDate || '';
    $('#mdDescription').value = metadataData.dataStructure?.description || '';
    $('#mdIssues').value = (metadataData.cleaningInfo?.issuesFixed || []).join('\n');
    renderSupervisorsList();
    $('#mdRaw').value = JSON.stringify(metadataData, null, 2);
  }

  function renderSupervisorsList() {
    const container = $('#mdSupervisors');
    $('#mdSupCount').textContent = metaSupervisors.length;
    container.innerHTML = metaSupervisors.map((s, i) => `
      <div style="display:flex;gap:.35rem;align-items:center;margin-bottom:.25rem;font-size:.82rem">
        <span style="flex:1">${esc(s)}</span>
        <button class="btn btn-sm btn-danger" onclick="app.removeSupervisor(${i})" style="padding:.15rem .4rem;font-size:.7rem">✕</button>
      </div>
    `).join('') || '<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem">Belum ada pembimbing</div>';
  }

  function addSupervisor() {
    const val = $('#mdNewSup').value.trim();
    if (!val) return;
    metaSupervisors.push(val);
    $('#mdNewSup').value = '';
    renderSupervisorsList();
    syncMetaFromForm();
  }

  function removeSupervisor(i) {
    metaSupervisors.splice(i, 1);
    renderSupervisorsList();
    syncMetaFromForm();
  }

  function autoGenerateMetadata() {
    if (!records.length) { toast('Load data JSONL dulu', 'error'); return; }
    const years = {};
    const allSups = new Set();
    records.forEach(r => {
      const y = r.graduationYear || '?';
      years[y] = (years[y]||0)+1;
      (r.supervisors||[]).forEach(s => allSups.add(s));
    });
    metaSupervisors = [...allSups].sort();
    metadataData = {
      cleaningInfo: {
        cleanedBy: $('#mdCleanedBy').value || 'Auto-generated',
        issuesFixed: $('#mdIssues').value.split('\n').filter(l => l.trim()),
        cleaningDate: new Date().toISOString().split('T')[0]
      },
      graduationYears: Object.keys(years).filter(y => y !== '?').map(Number).sort(),
      lastUpdated: new Date().toISOString(),
      totalAlumni: records.length,
      dataStructure: {
        fields: ['id','name','npm','graduationYear','thesis','supervisors','searchText'],
        description: $('#mdDescription').value || 'Data alumni Magister Teknik Elektro USK'
      },
      supervisors: metaSupervisors
    };
    populateMetaForm();
    toast('Metadata di-generate dari data', 'success');
  }

  function saveMetadata() {
    syncMetaFromForm();
    if (!metadataData) { toast('Tidak ada data', 'error'); return; }
    download(JSON.stringify(metadataData, null, 2), 'alumni-metadata.json');
    toast('alumni-metadata.json di-download', 'success');
  }

  function syncMetaFromForm() {
    const yearsStr = $('#mdYears').value.trim();
    const years = yearsStr ? yearsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
    metadataData = {
      cleaningInfo: {
        cleanedBy: $('#mdCleanedBy').value || '',
        issuesFixed: $('#mdIssues').value.split('\n').filter(l => l.trim()),
        cleaningDate: $('#mdCleaningDate').value || ''
      },
      graduationYears: years,
      lastUpdated: ($('#mdLastUpdated').value || new Date().toISOString().split('T')[0]) + 'T00:00:00.000Z',
      totalAlumni: parseInt($('#mdTotal').value) || 0,
      dataStructure: {
        fields: ['id','name','npm','graduationYear','thesis','supervisors','searchText'],
        description: $('#mdDescription').value || ''
      },
      supervisors: metaSupervisors
    };
    $('#mdRaw').value = JSON.stringify(metadataData, null, 2);
  }

  // Watch metadata form changes
  ['mdTotal','mdLastUpdated','mdYears','mdCleanedBy','mdCleaningDate','mdDescription','mdIssues'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', syncMetaFromForm);
      el.addEventListener('input', () => { clearTimeout(el._t); el._t = setTimeout(syncMetaFromForm, 500); });
    }
  });

  // Watch raw metadata JSON
  const mdRawEl = document.getElementById('mdRaw');
  if (mdRawEl) mdRawEl.addEventListener('change', () => {
    try {
      metadataData = JSON.parse(mdRawEl.value);
      metaSupervisors = [...(metadataData.supervisors || [])];
      populateMetaForm();
    } catch { toast('Raw JSON tidak valid', 'error'); }
  });

  // ═══ Drop Zone ═══
  const dz = $('#dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  dz.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.jsonl,.json,.csv';
    inp.onchange = () => { if (inp.files[0]) loadFile(inp.files[0]); };
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
    splitByYear, createTemplate,
    loadManifestFile, saveManifest, autoGenerateManifest,
    loadMetaFile, saveMetadata, autoGenerateMetadata,
    addSupervisor, removeSupervisor,
  };

  // ═══ Init ═══
  renderTable();

  // Auto-update copyright year
  const el = document.getElementById('copyright-text');
  if (el) el.textContent = `\u00A9 ${new Date().getFullYear()} KingSyah`;
})();
