@echo off
title PRATAMA NEWS - local server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Unduh dari https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)
echo Memulai PRATAMA NEWS. Alamat website akan ditampilkan di bawah.
echo Buka alamat yang ditampilkan. Biarkan jendela ini tetap terbuka.
echo Tekan Ctrl+C untuk menghentikan server.
node server.js
pause
