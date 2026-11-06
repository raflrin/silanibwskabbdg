/* WASRA & WASRI RUN — SiLani extra-easy mode.
   Players choose one original mascot (Wasra or Wasri). Road barriers require
   jumping; birds from above require sliding. Slow pace and auto-assist enabled. */
(function () {
  'use strict';

  function initWasraWasriRun() {
    const root = document.getElementById('wwr-canvas');
    if (!root || root.dataset.initialized === '1') return;
    root.dataset.initialized = '1';

    const ctx = root.getContext('2d');
    if (!ctx) return;
    const $ = (id) => document.getElementById(id);
    const ui = {
      score: $('wwr-score'), distance: $('wwr-distance'), coins: $('wwr-coins'),
      speed: $('wwr-speed'), best: $('wwr-best'), bestDistance: $('wwr-best-distance'),
      record: $('wwr-record'), overlay: $('wwr-overlay'), title: $('wwr-overlay-title'),
      copy: $('wwr-overlay-copy'), start: $('wwr-start'), pause: $('wwr-pause'),
      jump: $('wwr-jump'), slide: $('wwr-slide'), fullscreen: $('wwr-fullscreen'),
      fullscreenLabel: $('wwr-fullscreen-label'), lives: $('wwr-lives'), card: document.querySelector('.wwr-game-card'),
      stage: document.querySelector('.wwr-stage')
    };

    const BEST_KEY = 'silani_wwr_best_v1';
    const DIST_KEY = 'silani_wwr_distance_v1';
    const PLAYER_KEY = 'silani_wwr_selected_player_v1';
    const safeRead = (key) => { try { return Number(localStorage.getItem(key) || 0); } catch (_) { return 0; } };
    const safeReadText = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
    const safeWrite = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) { /* storage optional */ } };
    let best = safeRead(BEST_KEY);
    let bestDistance = safeRead(DIST_KEY);
    let selectedPlayer = safeReadText(PLAYER_KEY, 'wasra') === 'wasri' ? 'wasri' : 'wasra';
    const playerPickerButtons = Array.from(document.querySelectorAll('[data-player-choice]'));

    ui.best.textContent = best.toLocaleString('id-ID');
    ui.record.textContent = best.toLocaleString('id-ID');
    ui.bestDistance.textContent = bestDistance + ' m';

    const wasra = new Image();
    const wasri = new Image();
    const electionBg = new Image();
    wasra.src = 'WASRA.png?v=20261106-mascot-original';
    wasri.src = 'WASRI.png?v=20261106-mascot-original';
    electionBg.src = 'game-bg-election-landscape.jpg?v=20261106-election-scene-v2';

    let W = 960, H = 420, ground = 330, portrait = false;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let characterSize = 96, characterWidth = 102;
    let unitY = 1, unitX = 1;
    let raf = 0, last = 0, mode = 'ready';
    let elapsed = 0, distance = 0, score = 0, coins = 0, speed = 140;
    let spawn = 0, coinSpawn = 0, groundOffset = 0;
    let obstacles = [], tokens = [], particles = [];
    const MAX_LIVES = 15;
    let lives = MAX_LIVES, hitCooldown = 0, jumpBuffer = 0;
    const player = { x: 132, y: 0, vy: 0, jumping: false, sliding: false, slideUntil: 0 };
    let resizeObserver = null;

    function setOverlayVisible(visible) {
      if (!ui.overlay) return;
      ui.overlay.hidden = !visible;
      ui.overlay.classList.toggle('is-hidden', !visible);
      ui.overlay.setAttribute('aria-hidden', String(!visible));
      // Inline !important guarantees that mobile display rules cannot keep the
      // start/pause panel above the running game after the button is tapped.
      if (visible) {
        ui.overlay.style.removeProperty('display');
        ui.overlay.style.removeProperty('visibility');
        ui.overlay.style.removeProperty('pointer-events');
      } else {
        ui.overlay.style.setProperty('display', 'none', 'important');
        ui.overlay.style.setProperty('visibility', 'hidden', 'important');
        ui.overlay.style.setProperty('pointer-events', 'none', 'important');
      }
    }

    function updatePlayerPicker() {
      playerPickerButtons.forEach((button) => {
        const active = button.dataset.playerChoice === selectedPlayer;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function getSelectedSprite() {
      return selectedPlayer === 'wasri' ? wasri : wasra;
    }

    playerPickerButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (mode === 'running') return;
        const choice = button.dataset.playerChoice;
        if (choice !== 'wasra' && choice !== 'wasri') return;
        selectedPlayer = choice;
        safeWrite(PLAYER_KEY, selectedPlayer);
        updatePlayerPicker();
        preview();
      });
    });
    updatePlayerPicker();

    function resizeCanvas() {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nextW = Math.max(240, rect.width);
      const nextH = Math.max(180, rect.height);
      const changed = Math.abs(nextW - W) > 1 || Math.abs(nextH - H) > 1;
      W = nextW;
      H = nextH;
      portrait = H > W * 1.12;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const backingW = Math.round(W * pixelRatio);
      const backingH = Math.round(H * pixelRatio);
      if (root.width !== backingW || root.height !== backingH) {
        root.width = backingW;
        root.height = backingH;
      }
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      ground = H * (portrait ? 0.79 : 0.79);
      // One selected owl, with a deliberately compact footprint for easier play.
      characterSize = portrait
        ? Math.min(94, W * 0.135, H * 0.105)
        : Math.min(100, H * 0.24);
      characterSize = Math.max(46, characterSize);
      characterWidth = characterSize * 1.02;
      unitY = characterSize / 100;
      unitX = W / 960;
      player.x = W * (portrait ? 0.12 : 0.1375);
      if (!player.jumping) player.y = ground - characterSize;
      if (changed && mode === 'ready') preview();
    }

    function updateLives() {
      if (!ui.lives) return;
      ui.lives.textContent = 'NYAWA ' + lives + '/' + MAX_LIVES;
      ui.lives.setAttribute('aria-label', 'Sisa nyawa ' + lives + ' dari ' + MAX_LIVES);
      ui.lives.classList.toggle('is-low', lives <= 3);
    }

    function reset() {
      elapsed = 0; distance = 0; score = 0; coins = 0;
      // Extra-easy mode: slow speed, long first wait and generous obstacle spacing.
      speed = 105 * unitX; spawn = 13.0; coinSpawn = 1.8; groundOffset = 0;
      obstacles = []; tokens = []; particles = [];
      lives = MAX_LIVES; hitCooldown = 0; jumpBuffer = 0;
      player.y = ground - characterSize; player.vy = 0;
      player.jumping = false; player.sliding = false;
      updateLives(); hud();
    }

    function hud() {
      ui.score.textContent = Math.floor(score).toLocaleString('id-ID');
      ui.distance.textContent = Math.floor(distance) + ' m';
      ui.coins.textContent = coins;
      ui.speed.textContent = (speed / Math.max(1, 105 * unitX)).toFixed(1) + '×';
      updateLives();
    }

    function start() {
      if (mode === 'running') return;
      reset();
      mode = 'running';
      setOverlayVisible(false);
      ui.pause.textContent = 'Jeda';
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    function end() {
      mode = 'over';
      cancelAnimationFrame(raf);
      const final = Math.floor(score);
      if (final > best) {
        best = final; safeWrite(BEST_KEY, best);
        ui.best.textContent = best.toLocaleString('id-ID');
        ui.record.textContent = best.toLocaleString('id-ID');
      }
      if (Math.floor(distance) > bestDistance) {
        bestDistance = Math.floor(distance); safeWrite(DIST_KEY, bestDistance);
        ui.bestDistance.textContent = bestDistance + ' m';
      }
      ui.title.textContent = 'Perjalanan selesai!';
      ui.copy.textContent = 'Skor ' + final.toLocaleString('id-ID') + ' · Jarak ' + Math.floor(distance) + ' m · Koin ' + coins + '. Lima belas kesempatan sudah digunakan. Coba lagi!';
      ui.start.textContent = 'Main lagi';
      setOverlayVisible(true);
    }

    function pause() {
      if (mode === 'running') {
        mode = 'paused'; cancelAnimationFrame(raf);
        ui.title.textContent = 'Permainan dijeda';
        ui.copy.textContent = 'Istirahat sebentar. Lanjutkan saat siap.';
        ui.start.textContent = 'Lanjutkan';
        setOverlayVisible(true); ui.pause.textContent = 'Lanjut';
      } else if (mode === 'paused') {
        mode = 'running'; setOverlayVisible(false); ui.pause.textContent = 'Jeda';
        last = performance.now(); raf = requestAnimationFrame(loop);
      }
    }

    function performJump() {
      if (player.jumping) return;
      player.sliding = false;
      player.vy = -720 * unitY;
      player.jumping = true;
      jumpBuffer = 0;
    }

    function jump() {
      if (mode !== 'running') return;
      // Short input buffer: a slightly early tap still triggers on landing.
      jumpBuffer = 0.62;
      if (!player.jumping) performJump();
    }

    function slide() {
      if (mode !== 'running') return;
      if (player.jumping) return;
      player.sliding = true;
      player.slideUntil = elapsed + 1.35;
    }

    function key(e) {
      if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyP'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jump();
      if (e.code === 'ArrowDown' || e.code === 'KeyS') slide();
      if (e.code === 'KeyP') pause();
    }
    window.addEventListener('keydown', key);

    ui.start.addEventListener('click', () => {
      if (mode === 'paused') { pause(); return; }
      start();
    });
    ui.pause.addEventListener('click', pause);
    ui.jump.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    ui.slide.addEventListener('pointerdown', (e) => { e.preventDefault(); slide(); });

    function isNativeFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
    function isMobileFullscreen() { return !!(ui.card && ui.card.classList.contains('wwr-mobile-fullscreen')); }
    function syncFullscreenButton() {
      const active = isNativeFullscreen() || isMobileFullscreen();
      if (!ui.fullscreen) return;
      ui.fullscreenLabel.textContent = active ? 'Keluar layar penuh' : 'Layar penuh';
      ui.fullscreen.setAttribute('aria-label', active ? 'Keluar dari layar penuh' : 'Aktifkan layar penuh');
      ui.fullscreen.title = active ? 'Keluar layar penuh' : 'Layar penuh';
    }
    function enterFallbackFullscreen() {
      ui.card.classList.add('wwr-mobile-fullscreen');
      document.body.classList.add('wwr-lock-scroll');
      syncFullscreenButton();
      setTimeout(resizeCanvas, 100);
    }
    async function toggleFullscreen() {
      const target = ui.card;
      if (!target) return;
      if (isMobileFullscreen()) {
        target.classList.remove('wwr-mobile-fullscreen');
        document.body.classList.remove('wwr-lock-scroll');
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) { /* optional */ }
        syncFullscreenButton(); setTimeout(resizeCanvas, 100); return;
      }
      if (isNativeFullscreen()) {
        try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (_) { /* optional */ }
        syncFullscreenButton(); setTimeout(resizeCanvas, 100); return;
      }
      try {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        else enterFallbackFullscreen();
      } catch (_) { enterFallbackFullscreen(); }
      if (window.matchMedia('(max-width: 760px)').matches && screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); } catch (_) { /* iOS Safari may not allow orientation lock */ }
      }
      syncFullscreenButton(); setTimeout(resizeCanvas, 160);
    }
    if (ui.fullscreen) ui.fullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => { syncFullscreenButton(); setTimeout(resizeCanvas, 80); });
    document.addEventListener('webkitfullscreenchange', () => { syncFullscreenButton(); setTimeout(resizeCanvas, 80); });
    function escapeFullscreen(e) {
      if (e.key === 'Escape' && isMobileFullscreen()) {
        ui.card.classList.remove('wwr-mobile-fullscreen');
        document.body.classList.remove('wwr-lock-scroll');
        syncFullscreenButton(); setTimeout(resizeCanvas, 80);
      }
    }
    window.addEventListener('keydown', escapeFullscreen);

    function rounded(x, y, w, h, r, color) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    }

    function drawCloud(x, y, s) {
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.beginPath(); ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
      ctx.arc(x + 16 * s, y - 8 * s, 19 * s, 0, Math.PI * 2);
      ctx.arc(x + 36 * s, y, 13 * s, 0, Math.PI * 2); ctx.fill();
    }

    function drawPortraitEnvironment() {
      // On phones, reuse the EXACT same landscape artwork as desktop.
      // The image is never stretched and no extra text is painted over it.
      // Instead, the portrait camera slowly pans across the panorama as the
      // player runs: campaign/Bawaslu first, then the crowd and TPS.
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#79d3f2');
      sky.addColorStop(.60, '#d9f0e6');
      sky.addColorStop(1, '#d9f0e6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      if (electionBg.complete && electionBg.naturalWidth && electionBg.naturalHeight) {
        const sceneH = H * 0.62;
        const scale = sceneH / electionBg.naturalHeight;
        const sourceW = Math.min(electionBg.naturalWidth, W / scale);
        const maxScroll = Math.max(0, electionBg.naturalWidth - sourceW);
        // Pan steadily through the original landscape illustration.
        // At the start we show the Bawaslu building and peaceful campaign;
        // later the camera reveals the polling station and voters.
        const startCameraX = Math.min(maxScroll, electionBg.naturalWidth * 0.05);
        const cameraX = startCameraX + Math.min(maxScroll - startCameraX, elapsed * 15 / scale);
        ctx.drawImage(
          electionBg,
          cameraX, 0, sourceW, electionBg.naturalHeight,
          0, 0, W, sceneH
        );

        // Extend the same scene's roadside into the playable foreground.
        // This area is intentionally kept text-free; moving obstacles and
        // the original Wasra/Wasri sprites are drawn above it.
        const vergeTop = sceneH;
        const roadTop = H * 0.65;
        const verge = ctx.createLinearGradient(0, vergeTop, 0, roadTop);
        verge.addColorStop(0, '#86c891');
        verge.addColorStop(1, '#70b77f');
        ctx.fillStyle = verge;
        ctx.fillRect(0, vergeTop, W, Math.max(0, roadTop - vergeTop));
        ctx.fillStyle = '#5a9e70';
        ctx.fillRect(0, roadTop - 12 * unitY, W, 12 * unitY);
        ctx.fillStyle = '#e8e4d3';
        ctx.fillRect(0, roadTop - 12 * unitY, W, 3 * unitY);
      } else {
        // Fallback while the panorama is still loading.
        drawCloud(W * .14, H * .13, Math.min(1.2, W / 380));
        drawCloud(W * .68, H * .18, Math.min(1.1, W / 400));
        ctx.fillStyle = '#81c69a';
        ctx.fillRect(0, H * .56, W, H * .10);
      }
    }

    function drawLandscapeEnvironment() {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#90dff2'); sky.addColorStop(1, '#e8f5db');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (electionBg.complete && electionBg.naturalWidth) {
        // The supplied art crop shows the office, peaceful campaign, TPS and
        // people; the foreground road is drawn separately so the real mascots
        // run in front instead of duplicating the concept artwork mascots.
        ctx.drawImage(electionBg, 0, 0, W, H * 0.68);
      } else {
        drawCloud(W * .13, H * .20, 1); drawCloud(W * .61, H * .16, 1.2);
        ctx.fillStyle = '#89c79d'; ctx.beginPath(); ctx.ellipse(W * .22, H * .70, W * .32, H * .22, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(W * .78, H * .70, W * .35, H * .20, 0, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = '#8bc68b'; ctx.fillRect(0, H * .68, W, ground - H * .68);
      ctx.fillStyle = '#5c9f71'; ctx.fillRect(0, ground - 12 * unitY, W, 12 * unitY);
      ctx.fillStyle = '#e8e4d3'; ctx.fillRect(0, ground - 12 * unitY, W, 3 * unitY);
    }

    function drawRoad(dt) {
      const s = Math.max(.45, unitY);
      const roadTop = portrait ? H * 0.65 : ground;
      ctx.fillStyle = '#59616a'; ctx.fillRect(0, roadTop, W, H - roadTop);
      ctx.fillStyle = '#3d4651'; ctx.fillRect(0, roadTop + 2 * s, W, 4 * s);
      // Lane markers move to make the run feel fast.
      ctx.fillStyle = '#f8f0d7';
      const dashW = 48 * s, gap = 34 * s, cycle = dashW + gap;
      const off = groundOffset % cycle;
      for (let x = -off; x < W + dashW; x += cycle) {
        ctx.fillRect(x, ground + (H - ground) * .53, dashW, Math.max(3, 4 * s));
      }
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(0, ground + (H - ground) * .10, W, 2 * s);
    }

    function drawBackground(dt) {
      if (portrait) drawPortraitEnvironment(); else drawLandscapeEnvironment();
      drawRoad(dt);
    }

    function drawCharacter(img, x, y, size, phase, slideMode) {
      ctx.save();
      if (slideMode) {
        const slideH = size * .66;
        ctx.translate(x, ground - slideH);
        ctx.rotate(-.08);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, size * 1.05, slideH);
      } else if (img.complete && img.naturalWidth) {
        const bob = Math.sin(phase) * Math.max(1.5, size * .025);
        ctx.drawImage(img, x, y + bob, size * 1.06, size);
      } else {
        ctx.fillStyle = '#242b35'; ctx.beginPath(); ctx.ellipse(x + size / 2, y + size / 2, size * .36, size * .42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0b64a'; ctx.beginPath(); ctx.arc(x + size * .50, y + size * .34, size * .24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + size * .40, y + size * .34, size * .08, 0, Math.PI * 2); ctx.arc(x + size * .60, y + size * .34, size * .08, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawBird(o) {
      const s = unitY;
      const flap = Math.sin(elapsed * 9 + (o.phase || 0)) * 7 * s;
      ctx.save();
      ctx.translate(o.x, o.y + Math.sin(elapsed * 3 + (o.phase || 0)) * 3 * s);
      // A friendly cartoon bird flying across the upper part of the track.
      ctx.fillStyle = '#34485c';
      ctx.beginPath(); ctx.ellipse(0, 0, 22 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#425f78';
      ctx.beginPath();
      ctx.moveTo(-4 * s, -2 * s);
      ctx.quadraticCurveTo(-18 * s, -19 * s - flap, -34 * s, -10 * s - flap);
      ctx.quadraticCurveTo(-22 * s, 2 * s, -4 * s, 5 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5 * s, -1 * s);
      ctx.quadraticCurveTo(18 * s, -18 * s + flap, 34 * s, -9 * s + flap);
      ctx.quadraticCurveTo(22 * s, 4 * s, 5 * s, 5 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e5b34b';
      ctx.beginPath(); ctx.moveTo(20 * s, -1 * s); ctx.lineTo(34 * s, 4 * s); ctx.lineTo(20 * s, 7 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12 * s, -5 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#182a38'; ctx.beginPath(); ctx.arc(13 * s, -5 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawObstacle(o) {
      const s = unitY;
      if (o.type === 'bird') {
        drawBird(o);
      } else if (o.type === 'crate') {
        rounded(o.x, o.y - 38 * s, 38 * s, 38 * s, 7 * s, '#9b542d');
        ctx.strokeStyle = '#f4c17a'; ctx.lineWidth = 3 * s; ctx.strokeRect(o.x + 6 * s, o.y - 32 * s, 26 * s, 26 * s);
        ctx.beginPath(); ctx.moveTo(o.x + 6 * s, o.y - 32 * s); ctx.lineTo(o.x + 32 * s, o.y - 6 * s); ctx.moveTo(o.x + 32 * s, o.y - 32 * s); ctx.lineTo(o.x + 6 * s, o.y - 6 * s); ctx.stroke();
      } else {
        ctx.fillStyle = '#f27632'; ctx.beginPath(); ctx.moveTo(o.x + 17 * s, o.y - 40 * s); ctx.lineTo(o.x + 35 * s, o.y); ctx.lineTo(o.x - 2 * s, o.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(o.x + 6 * s, o.y - 15 * s, 23 * s, 6 * s); ctx.fillRect(o.x - 4 * s, o.y - 2 * s, 43 * s, 6 * s);
      }
    }

    function spawnObstacle() {
      // Road barriers require a jump; flying birds can be passed by sliding.
      const roll = Math.random();
      if (roll < 0.28) {
        obstacles.push({
          x: W + 42 * unitX,
          y: ground - characterSize * 0.80,
          type: 'bird',
          phase: Math.random() * Math.PI * 2,
          assisted: false
        });
      } else {
        const type = roll < 0.88 ? 'cone' : 'crate';
        obstacles.push({ x: W + 42 * unitX, y: ground, type, assisted: false });
      }
    }

    function spawnCoins() {
      const n = 4 + Math.floor(Math.random() * 2);
      const s = unitY;
      const y = ground - 118 * s - Math.random() * 16 * s;
      for (let i = 0; i < n; i++) {
        const arc = Math.sin(i / (n - 1 || 1) * Math.PI) * 12 * s;
        tokens.push({ x: W + 20 * unitX + i * 34 * s, y: y - arc, r: 11 * s, taken: false });
      }
    }

    function collide(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    function loop(now) {
      if (mode !== 'running') return;
      const dt = Math.min((now - last) / 1000, .035);
      last = now; elapsed += dt;
      // Very gentle difficulty curve: the game remains slow even after several minutes.
      speed = Math.min(180 * unitX, 105 * unitX + elapsed * 0.08 * unitX + distance * .00045);
      distance += speed * dt / 13;
      score += dt * (10 + speed / Math.max(100, 100 * unitX));
      groundOffset += speed * dt;
      spawn -= dt; coinSpawn -= dt;
      jumpBuffer = Math.max(0, jumpBuffer - dt);
      hitCooldown = Math.max(0, hitCooldown - dt);
      if (spawn <= 0) {
        spawnObstacle();
        // Long gaps between obstacles let new players understand the controls.
        spawn = 9.0 + Math.random() * 3.5;
      }
      if (coinSpawn <= 0) { spawnCoins(); coinSpawn = 2.2 + Math.random() * 1.5; }

      // Buffered touch input: if the player tapped just before landing, jump now.
      if (jumpBuffer > 0 && !player.jumping) performJump();

      // Built-in beginner assistance: ground barriers trigger a jump,
      // overhead birds trigger a slide. Each obstacle is assisted only once.
      const hitboxLeft = player.x + characterSize * 0.20;
      const collisionStartX = hitboxLeft - 62 * unitY;
      const assistRange = speed * 2.15 + 28 * unitX;
      const approachingObstacle = obstacles.find((o) =>
        !o.assisted && o.x >= collisionStartX && o.x - collisionStartX <= assistRange
      );
      if (approachingObstacle && hitCooldown <= 0) {
        if (approachingObstacle.type === 'bird') {
          if (!player.sliding && !player.jumping) slide();
        } else if (!player.jumping) {
          performJump();
        }
        approachingObstacle.assisted = true;
      }

      if (player.jumping) {
        player.y += player.vy * dt;
        player.vy += 1150 * unitY * dt;
        if (player.y >= ground - characterSize) { player.y = ground - characterSize; player.vy = 0; player.jumping = false; }
      }
      if (player.sliding && elapsed > player.slideUntil) player.sliding = false;
      obstacles.forEach((o) => { o.x -= speed * dt; });
      tokens.forEach((t) => { t.x -= speed * dt; });
      obstacles = obstacles.filter((o) => o.x > -100 * unitY);
      tokens = tokens.filter((t) => t.x > -40 * unitY && !t.taken);

      // One-character compact hitbox: transparent edges are ignored.
      // Sliding lowers the head/body box so overhead birds pass safely above.
      const pbox = player.sliding
        ? { x: player.x + characterSize * 0.27, y: ground - characterSize * 0.31,
            w: characterSize * 0.48, h: characterSize * 0.16 }
        : { x: player.x + characterSize * 0.25, y: player.y + characterSize * 0.25,
            w: characterSize * 0.50, h: characterSize * 0.57 };
      if (hitCooldown <= 0) {
        for (const o of obstacles) {
          let box;
          if (o.type === 'bird') {
            box = { x: o.x - 19 * unitY, y: o.y - 14 * unitY,
              w: 43 * unitY, h: 27 * unitY };
          } else if (o.type === 'crate') {
            box = { x: o.x + 8 * unitY, y: ground - 34 * unitY,
              w: 24 * unitY, h: 34 * unitY };
          } else {
            box = { x: o.x + 8 * unitY, y: ground - 34 * unitY,
              w: 24 * unitY, h: 34 * unitY };
          }
          if (collide(pbox, box)) {
            lives = Math.max(0, lives - 1);
            hitCooldown = 3.0;
            // Remove the obstacle and grant a generous grace period.
            o.x = -1000 * unitX;
            updateLives();
            if (lives <= 0) { end(); break; }
            break;
          }
        }
      }
      if (mode !== 'running') return;

      for (const t of tokens) {
        if (t.taken) continue;
        const nearestX = Math.max(pbox.x, Math.min(t.x, pbox.x + pbox.w));
        const nearestY = Math.max(pbox.y, Math.min(t.y, pbox.y + pbox.h));
        const dx = t.x - nearestX, dy = t.y - nearestY;
        const boxPickup = (dx * dx + dy * dy) <= ((t.r + 13 * unitY) * (t.r + 13 * unitY));
        const jumpMagnet = player.jumping && Math.abs(t.x - (pbox.x + pbox.w / 2)) < 175 * unitY && Math.abs(t.y - (pbox.y + pbox.h / 2)) < 150 * unitY;
        const easyMagnet = Math.abs(t.x - (pbox.x + pbox.w / 2)) < 105 * unitY && Math.abs(t.y - (ground - characterSize * 0.78)) < 95 * unitY;
        if (boxPickup || jumpMagnet || easyMagnet) {
          t.taken = true; coins++; score += 50;
          for (let i = 0; i < 5; i++) particles.push({ x: t.x, y: t.y, vx: (Math.random() - .5) * 95 * unitY, vy: (Math.random() - .8) * 95 * unitY, life: .32, maxLife: .32 });
        }
      }
      particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * unitY * dt; p.life -= dt; });
      particles = particles.filter((p) => p.life > 0);

      ctx.clearRect(0, 0, W, H);
      drawBackground(dt);
      obstacles.forEach(drawObstacle);
      tokens.forEach((t) => {
        ctx.save(); ctx.translate(t.x, t.y); ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#b97b1b'; ctx.lineWidth = 3 * unitY;
        ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff4bd'; ctx.font = 'bold ' + (13 * unitY) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 0, 5 * unitY); ctx.restore();
      });
      particles.forEach((p) => { ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = '#fff3a6'; ctx.beginPath(); ctx.arc(p.x, p.y, 3 * unitY, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      const phase = elapsed * 13;
      // Brief visual blink after a bump; play continues while the grace timer runs.
      ctx.globalAlpha = (hitCooldown > 0 && Math.floor(elapsed * 9) % 2 === 0) ? .48 : 1;
      drawCharacter(getSelectedSprite(), player.x, player.y, characterSize, phase, player.sliding);
      ctx.globalAlpha = 1;
      // Small dust puffs behind the two owls.
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const xx = player.x - 12 * unitY - ((elapsed * 80 * unitY + i * 17 * unitY) % (34 * unitY));
        ctx.globalAlpha = .65 - i * .16; ctx.beginPath(); ctx.arc(xx, ground - 18 * unitY - i * 9 * unitY, 3 * unitY, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      hud(); raf = requestAnimationFrame(loop);
    }

    function preview() {
      ctx.clearRect(0, 0, W, H);
      drawBackground(0);
      const y = ground - characterSize;
      drawCharacter(getSelectedSprite(), player.x, y, characterSize, 0, false);
      drawObstacle({ x: W * .72, y: ground, type: 'crate' });
      drawObstacle({ x: W * .86, y: ground - characterSize * .80, type: 'bird', phase: 0.6 });
    }

    // Recalculate the game world when the user enters/exits fullscreen or
    // rotates a phone. The same panorama is reframed through a portrait camera.
    resizeCanvas();
    if (window.ResizeObserver && ui.stage) {
      resizeObserver = new ResizeObserver(() => { resizeCanvas(); });
      resizeObserver.observe(ui.stage);
    } else {
      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 150));
    }
    wasra.onload = () => { if (mode === 'ready') preview(); };
    wasri.onload = () => { if (mode === 'ready') preview(); };
    electionBg.onload = () => { if (mode === 'ready' && !portrait) preview(); };
    updateLives();
    setOverlayVisible(true);
    preview();

    window.destroyWasraWasriRun = function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keydown', escapeFullscreen);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('fullscreenchange', syncFullscreenButton);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenButton);
      root.dataset.initialized = '0';
    };
  }

  window.initWasraWasriRun = initWasraWasriRun;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWasraWasriRun, { once: true });
  else initWasraWasriRun();
})();
