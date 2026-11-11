# Command Center: laptop app

This repo is Izaiah's Command Center as an installable app (PWA) for his Chromebook, served by GitHub Pages at https://iw7seven-7.github.io/command-center/.

- When Izaiah says he's on his **laptop**, changes go here. When he says he's on his **phone**, changes go to the claude.ai web app artifact instead. Never change one when he asked for the other.
- `index.html` is the whole app (Three.js r128 from cdnjs). `app.js` holds the laptop-only layer: offline service worker registration, NWS weather for Redding, backup/restore, notifications, mouse look with pointer lock, center dot, Esc settings menu, sprint, Q opens the watch.
- `sw.js`: bump `VER` on every release so installed copies pick up the update.
- Data lives in the browser's localStorage on the laptop, never in this repo (the repo is public).
