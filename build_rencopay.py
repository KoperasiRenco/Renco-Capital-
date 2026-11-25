#!/usr/bin/env python3
"""Bangun RencoPay.html dari Koperasi_Renco.html (logika & Supabase TIDAK diubah).
Pakai: python3 build_rencopay.py [Koperasi_Renco.html] [RencoPay.html]
Jalankan ulang setiap Koperasi_Renco.html berubah supaya keduanya selalu sama."""
import sys
src = sys.argv[1] if len(sys.argv) > 1 else 'Koperasi_Renco.html'
dst = sys.argv[2] if len(sys.argv) > 2 else 'RencoPay.html'
s = open(src, encoding='utf-8').read()

EDITS = [
 # 1. Mode RencoPay mandiri selalu aktif (tanpa ?app=rencopay)
 ("var rp=/[?&]app=rencopay\\b/.test(q);", "var rp=true;"),
 # 2. Judul
 ("<title>KOPERASI RENCO</title>", "<title>RencoPay</title>"),
 # 3. Service worker sendiri, scope hanya halaman RencoPay (tidak bentrok dengan sw.js Koperasi)
 ("var kandidat = ['sw.js', '/Renco-Capital-/sw.js', '/sw.js'];", "var kandidat = ['sw-rencopay.js'];"),
 ("navigator.serviceWorker.register(kandidat[i], { updateViaCache: 'none' })",
  "navigator.serviceWorker.register(kandidat[i], { updateViaCache: 'none', scope: './RencoPay.html' })"),
 # 4. Warna tema
 ('<meta name="theme-color" content="#1a472a">', '<meta name="theme-color" content="#1a472a">'),
]
for old, new in EDITS:
    assert s.count(old) == 1, 'Pola tidak ditemukan / tidak unik: ' + old[:60]
    s = s.replace(old, new)
open(dst, 'w', encoding='utf-8').write(s)
print('OK ->', dst, len(s), 'byte')
