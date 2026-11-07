# 📦 Gudang Resi – Warehouse Management Sederhana

Aplikasi web untuk mengurus paket jualan online: **scan resi** untuk mencatat barang keluar, memantau **status pesanan**, **mendeteksi pesanan batal sebelum dikirim**, dan langsung melihat **stok tersedia**.

Tanpa server & tanpa instalasi — cukup buka `index.html` di browser. Data tersimpan di browser (localStorage) perangkat tersebut.

## Alur kerja

1. **Stok Barang** → tambahkan barang (SKU, nama, jumlah masuk). Restock dengan SKU yang sama.
2. **Scan Resi → Mode 1 "Catat Barang Keluar"** → saat paket dikemas, pilih barang & jumlah lalu scan resi.
   Stok langsung berkurang, status = **Dikemas**. Resi ganda otomatis ditolak.
3. Jika pembeli membatalkan → di **Daftar Resi** klik **Batal** (atau tempel banyak resi sekaligus).
   Stok dikembalikan otomatis.
4. **Scan Resi → Mode 2 "Verifikasi Serah Kurir"** → scan ulang setiap paket sebelum diserahkan ke kurir.
   - Resi aktif → status jadi **Dikirim** ✅
   - Resi **batal** → peringatan merah besar + bunyi alarm ⛔ "JANGAN DISERAHKAN KE KURIR"
   - Resi belum tercatat / sudah dikirim → peringatan kuning ⚠
5. **Daftar Resi** → daftar nomor resi dengan tanggal, barang, qty, status, dan **stok tersedia** saat ini.
   Filter tanggal/status, cari, dan **Export CSV** (bisa dibuka di Excel).

## Cara scan

- **Scanner barcode USB/Bluetooth**: klik kolom *Nomor Resi*, lalu scan — scanner otomatis menekan Enter.
- **Kamera HP/laptop**: tombol **📷 Kamera** (butuh internet untuk memuat library & halaman dibuka lewat `https://` atau `localhost`).
- Ketik manual lalu Enter juga bisa.

## Menjalankan

- Langsung: buka `index.html`.
- Untuk kamera di HP, host via HTTPS, mis. **GitHub Pages** (Settings → Pages → deploy dari branch), atau lokal:
  `python3 -m http.server 8000` lalu buka `http://localhost:8000`.

## Backup

Tab **Data** → *Download Backup (JSON)* dan *Restore*. Karena data ada di browser, lakukan backup berkala
dan gunakan perangkat/browser yang sama untuk operasional sehari-hari.

## Rumus stok

```
Stok tersedia = Total barang masuk − Barang keluar (resi berstatus Dikemas + Dikirim)
```
Resi berstatus **Batal** tidak mengurangi stok.
