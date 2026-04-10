# Alumni Data Manager

Tools berbasis web untuk mengelola data alumni JSONL.

## Fitur

| Tab | Fungsi |
|-----|--------|
| **Data** | Tabel interaktif: edit inline, hapus, reorder (drag & drop), search, sort |
| **Import** | Drag & drop file JSONL/CSV, import dari Google Sheets URL |
| **Tambah** | Form tambah record baru |
| **Template** | Buat file JSONL kosong dengan custom fields |

**Export:** JSONL, CSV, Split per tahun (+ manifest.json)

## Cara Pakai

1. Buka `index.html` di browser (atau deploy ke GitHub Pages)
2. Tab **Import** → drag & drop file `.jsonl` / `.csv`, atau paste URL Google Sheets
3. Tab **Data** → edit, hapus, reorder data
4. Klik **Export JSONL** atau **Split per Tahun**

## Deploy ke GitHub Pages

```bash
# 1. Push folder ini ke repo GitHub
cd tools
git init
git add .
git commit -m "alumni data manager"
git remote add origin https://github.com/YOUR_USERNAME/alumni-tools.git
git push -u origin main

# 2. Di GitHub: Settings → Pages → Source: main branch → / (root)
# 3. Akses di: https://YOUR_USERNAME.github.io/alumni-tools/
```

## Google Sheets

1. Buka Google Sheets dengan data alumni
2. Share → "Anyone with the link"
3. Copy URL, paste di tab Import → Google Sheets
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
├── index.html    # Entry point
├── style.css     # Styles
├── app.js        # Application logic
└── README.md     # This file
```

100% client-side. Tidak perlu server atau backend.
