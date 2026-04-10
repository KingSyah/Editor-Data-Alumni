# Alumni Data Manager

Tools berbasis web untuk mengelola data alumni JSONL & metadata.

## Fitur

| Tab | Fungsi |
|-----|--------|
| **📊 Data** | Import (drop file / Google Sheets), tabel interaktif (edit inline, hapus, drag reorder, search, sort, filter tahun), form tambah record |
| **🆕 Tahun Baru** | 3-step wizard: pilih tahun → import/paste/template → auto-clean & merge |
| **⚙️ Config** | Editor unified `alumni-metadata.json` (counts grid, supervisors list, raw JSON) |

### Quick Actions (Tab Data)
- **📥 Import** — drop JSONL/CSV multi-file atau Google Sheets URL
- **➕ Tambah** — form collapsible, ada tombol "Tambah & Lagi" untuk input beruntun

### Export
- **⬇ JSONL** — download semua data sebagai JSONL
- **⬇ CSV** — download sebagai CSV
- **✂ Split + Metadata** — split per tahun + auto-generate `alumni-metadata.json`

## Cara Pakai

1. Buka `index.html` di browser (atau deploy ke GitHub Pages)
2. Tab **Data** → klik **📥 Import** → drag & drop file `.jsonl` / `.csv`
3. Edit data langsung di tabel (klik ✏️), atau tambah baru via **➕ Tambah**
4. Untuk tahun baru: tab **🆕 Tahun Baru** → pilih tahun → import → merge

### Tambah Angkatan Baru (2024, 2025, dst)
1. Tab **🆕 Tahun Baru**
2. Ketik tahun (misal `2024`), klik "Lanjut →"
3. Pilih cara import: drop file, paste JSON, Google Sheets, atau **buat template kosong** (5/10/20/30 baris)
4. Klik **"✅ Merge ke Data Utama"**
5. Cek hasil di tab **Data**

## Google Sheets

1. Buka Google Sheets dengan data alumni
2. Share → "Anyone with the link"
3. Copy URL, paste di Import atau Wizard → Google Sheets
4. Klik Import

**Mapping kolom otomatis:**
- `nama` / `Nama` → `name`
- `NPM` / `npm` → `npm`
- `tahun` / `angkatan` / `year` → `graduationYear`
- `judul` / `tesis` / `thesis` → `thesis`
- `pembimbing` / `supervisors` → `supervisors` (pisah dengan `;`)

## File Struktur

```
tools/
├── index.html    # Entry point (3 tab)
├── style.css     # Styles (wizard, counts grid)
├── app.js        # Application logic
└── README.md     # This file
```

## Config

Single file: `alumni-metadata.json` — berisi:
- `years` — daftar tahun angkatan
- `counts` — jumlah per tahun
- `supervisors` — daftar pembimbing (dinormalisasi)
- `cleaningInfo` — info pembersihan data
- `dataStructure` — deskripsi struktur data

Auto-generate dari data: tab Config → klik "🔄 Auto-generate dari Data"

100% client-side. Tidak perlu server atau backend.
