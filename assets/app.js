/* Gudang Resi – Warehouse Management sederhana (tanpa server, data di localStorage) */
(() => {
  'use strict';
  const KEY = 'gudang-resi-v1';
  const STATUS = { DIKEMAS: 'Dikemas', DIKIRIM: 'Dikirim', BATAL: 'Batal' };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- Penyimpanan ----------
  let db = load();
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.products) && Array.isArray(d.orders)) return d;
    } catch (_) { /* abaikan */ }
    return { products: [], orders: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Gagal menyimpan data: ' + e.message); }
  }

  // ---------- Util ----------
  const normResi = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const findOrder = (resi) => db.orders.find((o) => o.resi === resi);
  const product = (sku) => db.products.find((p) => p.sku === sku);
  const orderQty = (o) => o.items.reduce((n, i) => n + i.qty, 0);

  function stockOf(sku) {
    const p = product(sku);
    let keluar = 0, batal = 0;
    for (const o of db.orders) for (const it of o.items) {
      if (it.sku !== sku) continue;
      if (o.status === 'BATAL') batal += it.qty; else keluar += it.qty;
    }
    return { masuk: p ? p.masuk : 0, keluar, batal, tersedia: (p ? p.masuk : 0) - keluar };
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2500);
  }

  let audioCtx;
  function beep(ok) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const play = (freq, start, dur) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = freq; o.type = ok ? 'sine' : 'square';
        g.gain.value = 0.15; o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + start); o.stop(audioCtx.currentTime + start + dur);
      };
      if (ok) play(1200, 0, 0.12); else { play(300, 0, 0.25); play(300, 0.35, 0.25); play(300, 0.7, 0.25); }
      if (!ok && navigator.vibrate) navigator.vibrate([300, 100, 300]);
    } catch (_) { /* tanpa suara */ }
  }

  function showAlert(type, html) {
    const a = $('#alertBox');
    a.className = 'alert ' + type; a.innerHTML = html; a.hidden = false;
    beep(type === 'ok');
  }

  // ---------- Tabs ----------
  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === b));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    renderAll();
    if (b.dataset.tab === 'scan') $('#resiInput').focus();
  }));

  // ---------- Scan ----------
  const mode = () => document.querySelector('input[name=mode]:checked').value;
  $$('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
    $('#itemFields').hidden = mode() !== 'keluar';
    $('#submitBtn').textContent = mode() === 'keluar' ? 'Simpan Barang Keluar' : 'Verifikasi & Tandai Dikirim';
    $('#alertBox').hidden = true;
    $('#resiInput').focus();
  }));

  $('#scanForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const resi = normResi($('#resiInput').value);
    if (!resi) return;
    if (mode() === 'keluar') catatKeluar(resi); else verifikasiKirim(resi);
    $('#resiInput').value = '';
    $('#resiInput').focus();
    renderAll();
  });

  function catatKeluar(resi) {
    const ex = findOrder(resi);
    if (ex && ex.status === 'BATAL') {
      return showAlert('danger', `⛔ RESI <span class="mono">${esc(resi)}</span> SUDAH DIBATALKAN!<br>Jangan dikemas / dikirim.`);
    }
    if (ex) {
      return showAlert('warn', `⚠ Resi <span class="mono">${esc(resi)}</span> sudah tercatat (${STATUS[ex.status]}) pada ${fmtDate(ex.createdAt)}. Tidak dihitung dua kali.`);
    }
    const sku = $('#productSelect').value;
    const qty = parseInt($('#qtyInput').value, 10);
    if (!sku) return showAlert('warn', 'Belum ada barang. Tambahkan dulu di tab <b>Stok Barang</b>.');
    if (!(qty > 0)) return showAlert('warn', 'Jumlah harus lebih dari 0.');
    const st = stockOf(sku);
    if (st.tersedia < qty && !confirm(`Stok ${product(sku).name} hanya ${st.tersedia}. Tetap catat keluar?`)) return;

    db.orders.unshift({
      resi, items: [{ sku, qty }], note: $('#noteInput').value.trim(),
      status: 'DIKEMAS', createdAt: new Date().toISOString(), shippedAt: null, cancelledAt: null,
    });
    save();
    localStorage.setItem(KEY + '-lastSku', sku);
    $('#qtyInput').value = 1; $('#noteInput').value = '';
    const sisa = stockOf(sku).tersedia;
    showAlert('ok', `✅ ${esc(resi)} tercatat keluar: ${esc(product(sku).name)} × ${qty}. Sisa stok: <b>${sisa}</b>`);
  }

  function verifikasiKirim(resi) {
    const o = findOrder(resi);
    if (!o) return showAlert('warn', `❓ Resi <span class="mono">${esc(resi)}</span> belum tercatat sebagai barang keluar. Catat dulu di mode 1.`);
    if (o.status === 'BATAL') return showAlert('danger', `⛔ PESANAN BATAL — JANGAN DISERAHKAN KE KURIR!<br><span class="mono">${esc(resi)}</span> dibatalkan ${fmtDate(o.cancelledAt)}. Kembalikan barang ke rak.`);
    if (o.status === 'DIKIRIM') return showAlert('warn', `⚠ Resi <span class="mono">${esc(resi)}</span> sudah diserahkan ke kurir pada ${fmtDate(o.shippedAt)}.`);
    o.status = 'DIKIRIM'; o.shippedAt = new Date().toISOString(); save();
    showAlert('ok', `✅ Aman. <span class="mono">${esc(resi)}</span> ditandai DIKIRIM.`);
  }

  // ---------- Kamera ----------
  let scanner = null;
  $('#camBtn').addEventListener('click', async () => {
    const reader = $('#reader');
    if (scanner) { await scanner.stop().catch(() => {}); scanner = null; reader.hidden = true; $('#camBtn').textContent = '📷 Kamera'; return; }
    if (!window.Html5Qrcode) return toast('Library kamera gagal dimuat (cek koneksi internet).');
    reader.hidden = false; $('#camBtn').textContent = '✖ Tutup';
    scanner = new Html5Qrcode('reader');
    let last = '', lastAt = 0;
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 300, height: 140 } }, (text) => {
        const now = Date.now();
        if (text === last && now - lastAt < 3000) return; // cegah scan ganda
        last = text; lastAt = now;
        $('#resiInput').value = text;
        $('#scanForm').requestSubmit();
      });
    } catch (err) {
      toast('Kamera tidak bisa dibuka: ' + err);
      scanner = null; reader.hidden = true; $('#camBtn').textContent = '📷 Kamera';
    }
  });

  // ---------- Status aksi ----------
  function setStatus(resi, status) {
    const o = findOrder(resi); if (!o) return;
    if (status === 'BATAL') { o.status = 'BATAL'; o.cancelledAt = new Date().toISOString(); }
    else if (status === 'DIKIRIM') { o.status = 'DIKIRIM'; o.shippedAt = new Date().toISOString(); }
    else if (status === 'DIKEMAS') { o.status = 'DIKEMAS'; o.cancelledAt = null; o.shippedAt = null; }
    save(); renderAll();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, resi, sku } = b.dataset;
    if (act === 'batal' && confirm(`Tandai ${resi} BATAL? Stok akan dikembalikan.`)) setStatus(resi, 'BATAL');
    if (act === 'kirim') setStatus(resi, 'DIKIRIM');
    if (act === 'pulih' && confirm(`Aktifkan kembali ${resi}? Stok akan dikurangi lagi.`)) setStatus(resi, 'DIKEMAS');
    if (act === 'hapus' && confirm(`Hapus catatan resi ${resi}?`)) { db.orders = db.orders.filter((o) => o.resi !== resi); save(); renderAll(); }
    if (act === 'hapus-produk') {
      if (db.orders.some((o) => o.items.some((i) => i.sku === sku))) return toast('Barang sudah dipakai di resi, tidak bisa dihapus.');
      if (confirm(`Hapus barang ${sku}?`)) { db.products = db.products.filter((p) => p.sku !== sku); save(); renderAll(); }
    }
  });

  $('#bulkCancelBtn').addEventListener('click', () => {
    const list = $('#bulkCancel').value.split(/[\n,;]+/).map(normResi).filter(Boolean);
    let ok = 0; const notFound = [];
    for (const r of list) {
      const o = findOrder(r);
      if (!o) { notFound.push(r); continue; }
      if (o.status !== 'BATAL') { o.status = 'BATAL'; o.cancelledAt = new Date().toISOString(); ok++; }
    }
    save(); renderAll(); $('#bulkCancel').value = '';
    alert(`${ok} resi ditandai batal.` + (notFound.length ? `\nTidak ditemukan: ${notFound.join(', ')}` : ''));
  });

  // ---------- Produk ----------
  $('#productForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const sku = $('#pSku').value.trim().toUpperCase();
    const name = $('#pName').value.trim();
    const qty = parseInt($('#pQty').value, 10) || 0;
    if (!sku || !name) return;
    const p = product(sku);
    if (p) { p.masuk += qty; p.name = name; toast(`Restock ${name} +${qty}`); }
    else { db.products.push({ sku, name, masuk: qty }); toast(`Barang ${name} ditambahkan`); }
    save(); e.target.reset(); renderAll();
  });
  $('#pSku').addEventListener('input', () => {
    const p = product($('#pSku').value.trim().toUpperCase());
    if (p) $('#pName').value = p.name;
  });

  // ---------- Filter & Export ----------
  ['#fSearch', '#fFrom', '#fTo', '#fStatus'].forEach((s) => $(s).addEventListener('input', renderResi));

  function filteredOrders() {
    const q = $('#fSearch').value.trim().toUpperCase();
    const from = $('#fFrom').value, to = $('#fTo').value, st = $('#fStatus').value;
    return db.orders.filter((o) => {
      const d = dayKey(o.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (st && o.status !== st) return false;
      if (q && !(o.resi.includes(q) || (o.note || '').toUpperCase().includes(q))) return false;
      return true;
    });
  }

  $('#exportCsv').addEventListener('click', () => {
    const rows = [['Tanggal Keluar', 'No Resi', 'SKU', 'Nama Barang', 'Qty', 'Status', 'Tgl Dikirim', 'Tgl Batal', 'Catatan', 'Sisa Stok Saat Ini']];
    for (const o of filteredOrders()) for (const it of o.items) {
      rows.push([fmtDate(o.createdAt), o.resi, it.sku, product(it.sku)?.name || '', it.qty, STATUS[o.status],
        o.shippedAt ? fmtDate(o.shippedAt) : '', o.cancelledAt ? fmtDate(o.cancelledAt) : '', o.note || '', stockOf(it.sku).tersedia]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(`resi-${dayKey(new Date().toISOString())}.csv`, '﻿' + csv, 'text/csv');
  });

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Backup ----------
  $('#backupBtn').addEventListener('click', () => download(`backup-gudang-${dayKey(new Date().toISOString())}.json`, JSON.stringify(db, null, 2), 'application/json'));
  $('#restoreFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.products) || !Array.isArray(d.orders)) throw new Error('format tidak dikenal');
      if (confirm('Timpa semua data dengan backup ini?')) { db = d; save(); renderAll(); toast('Backup dipulihkan'); }
    } catch (err) { alert('File backup tidak valid: ' + err.message); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Hapus SEMUA data barang dan resi? Tindakan ini tidak bisa dibatalkan.')) { db = { products: [], orders: [] }; save(); renderAll(); }
  });

  // ---------- Render ----------
  function itemsText(o) { return o.items.map((i) => `${esc(product(i.sku)?.name || i.sku)}`).join('<br>'); }
  function actionsHtml(o) {
    const r = esc(o.resi); let h = '';
    if (o.status === 'DIKEMAS') h += `<button class="btn ok sm" data-act="kirim" data-resi="${r}">Kirim</button>`;
    if (o.status !== 'BATAL') h += `<button class="btn danger sm" data-act="batal" data-resi="${r}">Batal</button>`;
    else h += `<button class="btn secondary sm" data-act="pulih" data-resi="${r}">Aktifkan</button>`;
    h += `<button class="btn secondary sm" data-act="hapus" data-resi="${r}">Hapus</button>`;
    return `<div class="actions">${h}</div>`;
  }
  const stat = (label, val) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;

  function renderProductsSelect() {
    const sel = $('#productSelect'), cur = sel.value || localStorage.getItem(KEY + '-lastSku');
    sel.innerHTML = db.products.length
      ? db.products.map((p) => `<option value="${esc(p.sku)}">${esc(p.sku)} – ${esc(p.name)} (stok ${stockOf(p.sku).tersedia})</option>`).join('')
      : '<option value="">— belum ada barang —</option>';
    if (cur && product(cur)) sel.value = cur;
  }

  function renderScan() {
    renderProductsSelect();
    const today = dayKey(new Date().toISOString());
    const t = db.orders.filter((o) => dayKey(o.createdAt) === today);
    $('#todayStats').innerHTML =
      stat('Resi hari ini', t.length) +
      stat('Barang keluar hari ini', t.filter((o) => o.status !== 'BATAL').reduce((n, o) => n + orderQty(o), 0)) +
      stat('Belum diserahkan kurir', db.orders.filter((o) => o.status === 'DIKEMAS').length) +
      stat('Batal hari ini', t.filter((o) => o.status === 'BATAL').length);
    $('#recentList').innerHTML = db.orders.slice(0, 8).map((o) => `
      <div class="item"><div><span class="mono"><b>${esc(o.resi)}</b></span><br><span class="muted">${fmtDate(o.createdAt)} · ${itemsText(o)} × ${orderQty(o)}</span></div>
      <div><span class="badge ${o.status}">${STATUS[o.status]}</span></div></div>`).join('') || '<p class="muted">Belum ada scan.</p>';
  }

  function renderResi() {
    const list = filteredOrders();
    const active = list.filter((o) => o.status !== 'BATAL');
    $('#resiStats').innerHTML =
      stat('Total resi', list.length) +
      stat('Barang keluar', active.reduce((n, o) => n + orderQty(o), 0)) +
      stat('Dikemas', list.filter((o) => o.status === 'DIKEMAS').length) +
      stat('Dikirim', list.filter((o) => o.status === 'DIKIRIM').length) +
      stat('Batal', list.filter((o) => o.status === 'BATAL').length);
    $('#resiTable').innerHTML = list.map((o) => `
      <tr class="${o.status}">
        <td>${fmtDate(o.createdAt)}</td>
        <td class="mono"><b>${esc(o.resi)}</b></td>
        <td>${itemsText(o)}</td>
        <td>${o.items.map((i) => i.qty).join('<br>')}</td>
        <td>${o.items.map((i) => stockOf(i.sku).tersedia).join('<br>')}</td>
        <td><span class="badge ${o.status}">${STATUS[o.status]}</span></td>
        <td>${esc(o.note)}</td>
        <td>${actionsHtml(o)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">Tidak ada data.</td></tr>';
    $('#resiStock').innerHTML = db.products.map((p) => stat(`${esc(p.name)} (${esc(p.sku)})`, stockOf(p.sku).tersedia)).join('') || '<p class="muted">Belum ada barang.</p>';
  }

  function renderStock() {
    $('#stockTable').innerHTML = db.products.map((p) => {
      const s = stockOf(p.sku);
      return `<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${s.masuk}</td><td>${s.keluar}</td><td>${s.batal}</td>
        <td class="${s.tersedia <= 5 ? 'low' : ''}"><b>${s.tersedia}</b></td>
        <td><button class="btn secondary sm" data-act="hapus-produk" data-sku="${esc(p.sku)}">Hapus</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="muted">Belum ada barang.</td></tr>';
  }

  function renderAll() { renderScan(); renderResi(); renderStock(); }

  $('#submitBtn').textContent = 'Simpan Barang Keluar';
  renderAll();
})();
