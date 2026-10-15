# Kasa: şifre üretici ve şifreli kasa

Hem **web** hem **masaüstü** (Windows / macOS / Linux, Tauri v2) çalışan, şifreleri unutmaman için
yerel ve uçtan uca şifreli bir kasası olan şifre üretici.

## İndir

[Releases](https://github.com/arelbir/pasgen/releases/latest) sayfasından işletim sistemine uygun kurulum dosyasını indir:

| Sistem | Dosya |
| --- | --- |
| Windows | `Kasa_1.0.0_x64-setup.exe` (önerilen) veya `Kasa_1.0.0_x64_en-US.msi` |
| macOS (Apple Silicon) | `Kasa_1.0.0_aarch64.dmg` |
| macOS (Intel) | `Kasa_1.0.0_x64.dmg` |
| Linux | `Kasa_1.0.0_amd64.deb`, `Kasa_1.0.0_amd64.AppImage` |

Web sürümü GitHub Pages üzerinden yayınlanır (Settings > Pages > Source: GitHub Actions bir kez açılmalı).

> Uygulama imzasız olduğu için Windows SmartScreen "Daha fazla bilgi > Yine de çalıştır", macOS ise
> ilk açılışta sağ tık > Aç ister.

## Özellikler

- **Üretici**: şifre (6–64 karakter, karakter türleri, karışan karakterleri çıkarma), parola cümlesi
  (BIP‑39 2048 kelime listesi), PIN. `crypto.getRandomValues` + sapmasız (rejection sampling) seçim.
- **Güç ölçer**: entropi (bit) ve tahmini kırılma süresi.
- **Kasa**: başlık, kullanıcı adı, şifre, site, etiket, not, favori; arama (Ctrl+K), filtreler
  (favori / zayıf / tekrarlanan), çift tıkla şifre kopyala.
- **Güvenlik raporu**: zayıf, tekrar kullanılan ve 1 yıldan eski şifreler + puan.
- **Güvenlik**: otomatik kilit, panoyu otomatik temizleme, ana parola değiştirme.
- **Yedekleme**: şifreli `.json` yedek indir / geri yükle (cihazlar arası taşıma), Chrome/Firefox/Edge/
  Bitwarden CSV içe aktarma, CSV dışa aktarma.
- Türkçe / İngilizce, açık / koyu / sistem teması, mobil uyumlu (alt sekme çubuğu), klavye kısayolları.

## Tasarım

Geist yazı tipi (uygulamaya gömülü, internetsiz çalışır), tek renkli palet; renk yalnızca anlam taşıdığında
(şifre gücü, uyarılar, şifredeki rakam/sembol ayrımı) kullanılır. Kartlar yerine boşluk ve ince çizgilerle
gruplama, dekoratif animasyon yok, açık ve koyu tema sistem ayarını izler.

## Şifreleme

- Ana paroladan **PBKDF2‑SHA256 (600.000 tur)** ile anahtar türetilir, kasa **AES‑256‑GCM** ile şifrelenir.
- Ana parola hiçbir yere kaydedilmez/gönderilmez; **kurtarılamaz**.
- Depolama: masaüstünde işletim sisteminin uygulama veri klasöründe `vault.json`
  (atomik yazma + `.bak`), web'de tarayıcının `localStorage`'ında her ikisinde de yalnızca şifreli veri.

## Geliştirme

```bash
npm install
npm run dev          # web: http://localhost:1420
npm test             # birim testleri
npm run build        # web derlemesi -> dist/ (herhangi bir statik sunucuya koyulabilir)

npm run tauri dev    # masaüstü (geliştirme)
npm run tauri build  # masaüstü kurulum dosyaları -> src-tauri/target/release/bundle/
```

Masaüstü derlemesi için Rust ve [Tauri ön koşulları](https://v2.tauri.app/start/prerequisites/) gerekir.

## Klavye kısayolları

| Kısayol | İşlev |
| --- | --- |
| Boşluk | Yeni şifre üret (Üretici) |
| Ctrl+C | Üretilen şifreyi kopyala |
| Ctrl+K | Kasada ara |
| Ctrl+N | Yeni kayıt |
| Ctrl+L | Kasayı kilitle |
| Ctrl+1…4 | Sekmeler arası geçiş |

## Yeni sürüm yayınlama

```bash
# package.json, src-tauri/tauri.conf.json ve src-tauri/Cargo.toml içindeki sürümü güncelle,
# main'e pushla. tauri.conf.json değişince Release iş akışı otomatik çalışır.
```

`Release` iş akışı Windows, macOS ve Linux kurulum dosyalarını derleyip `v<sürüm>` adlı GitHub Release'e ekler.

## Proje yapısı

```
src/
  lib/        generator, strength, crypto, storage, vault, i18n (UI'dan bağımsız çekirdek)
  components/ Generator, Vault, EntryEditor, LockScreen, Health, Settings, ui
  store.tsx   kasa durumu (kilit, otomatik kilit, pano, kaydetme)
src-tauri/    Rust tarafı: şifreli dosya okuma/yazma, kaydetme penceresi, pano
tests/        birim testleri (vitest)
```
