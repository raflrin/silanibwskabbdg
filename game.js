/* WASRA & WASRI RUN — SiLani, responsive election-day edition.
   Uses the original WASRA.png and WASRI.png mascots supplied with SiLani.
   Landscape: campaign, Bawaslu office and TPS artwork. Portrait: an adapted
   full-height scene so the game fills a phone screen without letterboxing. */
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
      fullscreenLabel: $('wwr-fullscreen-label'), card: document.querySelector('.wwr-game-card'),
      stage: document.querySelector('.wwr-stage')
    };

    const BEST_KEY = 'silani_wwr_best_v1';
    const DIST_KEY = 'silani_wwr_distance_v1';
    const safeRead = (key) => { try { return Number(localStorage.getItem(key) || 0); } catch (_) { return 0; } };
    const safeWrite = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) { /* storage optional */ } };
    let best = safeRead(BEST_KEY);
    let bestDistance = safeRead(DIST_KEY);

    ui.best.textContent = best.toLocaleString('id-ID');
    ui.record.textContent = best.toLocaleString('id-ID');
    ui.bestDistance.textContent = bestDistance + ' m';

    const wasra = new Image();
    const wasri = new Image();
    const electionBg = new Image();
    wasra.src = 'WASRA.png?v=20261106-mascot-original';
    wasri.src = 'WASRI.png?v=20261106-mascot-original';
    electionBg.src = 'game-bg-election-landscape.jpg?v=20261106-election-scene';

    let W = 960, H = 420, ground = 330, portrait = false;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let characterSize = 112, characterWidth = 118, characterGap = 64;
    let unitY = 1, unitX = 1;
    let raf = 0, last = 0, mode = 'ready';
    let elapsed = 0, distance = 0, score = 0, coins = 0, speed = 300;
    let spawn = 0, coinSpawn = 0, groundOffset = 0;
    let obstacles = [], tokens = [], particles = [];
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
      characterSize = Math.min(108, H * (portrait ? 0.16 : 0.26));
      characterSize = Math.max(48, characterSize);
      characterWidth = characterSize * 1.06;
      characterGap = characterWidth * 0.62;
      unitY = characterSize / 112;
      unitX = W / 960;
      player.x = W * (portrait ? 0.105 : 0.1375);
      if (!player.jumping) player.y = ground - characterSize;
      if (changed && mode === 'ready') preview();
    }

    function reset() {
      elapsed = 0; distance = 0; score = 0; coins = 0;
      speed = 300 * unitX; spawn = 1.05; coinSpawn = 1.4; groundOffset = 0;
      obstacles = []; tokens = []; particles = [];
      player.y = ground - characterSize; player.vy = 0;
      player.jumping = false; player.sliding = false;
      hud();
    }

    function hud() {
      ui.score.textContent = Math.floor(score).toLocaleString('id-ID');
      ui.distance.textContent = Math.floor(distance) + ' m';
      ui.coins.textContent = coins;
      ui.speed.textContent = (speed / Math.max(1, 300 * unitX)).toFixed(1) + '×';
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
      ui.copy.textContent = 'Skor ' + final.toLocaleString('id-ID') + ' · Jarak ' + Math.floor(distance) + ' m · Koin ' + coins + '. Coba lagi dan pecahkan rekor!';
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

    function jump() {
      if (mode !== 'running' || player.jumping || player.sliding) return;
      player.vy = -720 * unitY;
      player.jumping = true;
    }

    function slide() {
      if (mode !== 'running') return;
      if (player.jumping) { player.vy = Math.max(player.vy, 80 * unitY); return; }
      player.sliding = true;
      player.slideUntil = elapsed + 0.62;
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

    function drawPortraitPerson(x, foot, h, shirt, pose, skin) {
      const head = h * 0.20, bodyW = h * 0.29, bodyH = h * 0.36;
      const shoulderY = foot - h * 0.60;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // legs
      ctx.strokeStyle = '#28364a'; ctx.lineWidth = Math.max(3, h * 0.075);
      ctx.beginPath(); ctx.moveTo(x - bodyW * 0.18, foot - h * 0.25); ctx.lineTo(x - bodyW * 0.22, foot); ctx.moveTo(x + bodyW * 0.18, foot - h * 0.25); ctx.lineTo(x + bodyW * 0.28, foot); ctx.stroke();
      // shoes
      ctx.strokeStyle = '#f7f7f4'; ctx.lineWidth = Math.max(3, h * 0.075);
      ctx.beginPath(); ctx.moveTo(x - bodyW * 0.3, foot); ctx.lineTo(x - bodyW * 0.12, foot); ctx.moveTo(x + bodyW * 0.18, foot); ctx.lineTo(x + bodyW * 0.39, foot); ctx.stroke();
      // torso
      rounded(x - bodyW / 2, shoulderY, bodyW, bodyH, Math.max(4, h * 0.06), shirt);
      // arms: some wave, some hold sign
      ctx.strokeStyle = skin; ctx.lineWidth = Math.max(4, h * 0.10);
      ctx.beginPath();
      if (pose === 'wave') {
        ctx.moveTo(x - bodyW * .42, shoulderY + h * .08); ctx.lineTo(x - bodyW * .76, shoulderY - h * .22);
        ctx.moveTo(x + bodyW * .42, shoulderY + h * .08); ctx.lineTo(x + bodyW * .78, shoulderY - h * .20);
      } else {
        ctx.moveTo(x - bodyW * .42, shoulderY + h * .10); ctx.lineTo(x - bodyW * .70, shoulderY - h * .02);
        ctx.moveTo(x + bodyW * .42, shoulderY + h * .10); ctx.lineTo(x + bodyW * .70, shoulderY - h * .02);
      }
      ctx.stroke();
      // head and hair
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, foot - h * .73, head, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26303b'; ctx.beginPath(); ctx.arc(x, foot - h * .79, head * .98, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20252d'; ctx.beginPath(); ctx.arc(x - head * .34, foot - h * .72, Math.max(1.5, h * .018), 0, Math.PI * 2); ctx.arc(x + head * .34, foot - h * .72, Math.max(1.5, h * .018), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawSign(x, y, w, h, line1, line2, accent) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = accent || '#b33b36'; ctx.lineWidth = 2;
      ctx.fillRect(0, 0, w, h); ctx.strokeRect(0, 0, w, h);
      ctx.fillStyle = '#6a2730'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.max(8, h * .21) + 'px Arial'; ctx.fillText(line1, w / 2, h * .36, w - 5);
      ctx.font = 'bold ' + Math.max(8, h * .20) + 'px Arial'; ctx.fillText(line2, w / 2, h * .68, w - 5);
      ctx.restore();
    }

    function drawPortraitEnvironment() {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#55c8f4'); sky.addColorStop(.57, '#d7f3e9'); sky.addColorStop(1, '#f6d5a1');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff3b5'; ctx.beginPath(); ctx.arc(W * .82, H * .09, Math.min(W, H) * .055, 0, Math.PI * 2); ctx.fill();
      drawCloud(W * .10, H * .12, Math.min(1.25, W / 360));
      drawCloud(W * .59, H * .17, Math.min(1.1, W / 390));
      // Distant green hills and urban roofline.
      ctx.fillStyle = '#83c49c'; ctx.beginPath(); ctx.moveTo(0, H * .31); ctx.quadraticCurveTo(W * .30, H * .23, W * .55, H * .31); ctx.quadraticCurveTo(W * .78, H * .25, W, H * .30); ctx.lineTo(W, H * .44); ctx.lineTo(0, H * .44); ctx.fill();
      // Bawaslu office, simplified but clearly labeled.
      const bx = W * .035, by = H * .205, bw = W * .49, bh = H * .225;
      ctx.fillStyle = '#c7b9a5'; ctx.fillRect(bx - 5, by + bh - 12, bw + 12, 15);
      ctx.fillStyle = '#fff5e7'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#9c6b44'; ctx.fillRect(bx, by + bh * .68, bw, bh * .32);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#a7d7e8'; ctx.fillRect(bx + bw * (.08 + i * .17), by + bh * .42, bw * .12, bh * .25); }
      ctx.fillStyle = '#d7b879'; ctx.beginPath(); ctx.moveTo(bx + bw * .07, by + bh * .14); ctx.lineTo(bx + bw * .16, by + bh * .14); ctx.lineTo(bx + bw * .16, by + bh * .34); ctx.lineTo(bx + bw * .07, by + bh * .34); ctx.fill();
      ctx.fillStyle = '#1a242b'; ctx.font = 'bold ' + Math.max(13, W * .043) + 'px Arial'; ctx.textAlign = 'left'; ctx.fillText('BAWASLU', bx + bw * .22, by + bh * .27);
      ctx.font = 'bold ' + Math.max(7, W * .018) + 'px Arial'; ctx.fillText('KABUPATEN BANDUNG', bx + bw * .22, by + bh * .39);
      // Peaceful campaign vehicle to the left.
      const tx = -W * .02, ty = H * .42, tw = W * .46, th = H * .14;
      rounded(tx, ty + th * .24, tw, th * .64, 9, '#176c9b');
      ctx.fillStyle = '#6ed0e2'; ctx.fillRect(tx + tw * .12, ty + th * .05, tw * .46, th * .40);
      ctx.fillStyle = '#eaf8f7'; ctx.fillRect(tx + tw * .08, ty + th * .43, tw * .52, th * .33);
      ctx.fillStyle = '#a51f2d'; ctx.font = 'bold ' + Math.max(9, W * .026) + 'px Arial'; ctx.textAlign = 'center';
      ctx.fillText('KAMPANYE', tx + tw * .34, ty + th * .58); ctx.fillText('DAMAI', tx + tw * .34, ty + th * .77);
      ctx.fillStyle = '#1d2c3a'; ctx.beginPath(); ctx.arc(tx + tw * .20, ty + th * .89, th * .12, 0, 7); ctx.arc(tx + tw * .78, ty + th * .89, th * .12, 0, 7); ctx.fill();
      // Loudspeaker and flag.
      ctx.fillStyle = '#26384a'; ctx.beginPath(); ctx.moveTo(tx + tw * .70, ty + th * .02); ctx.lineTo(tx + tw * .92, ty - th * .04); ctx.lineTo(tx + tw * .92, ty + th * .14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#697b83'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * .49, H * .15); ctx.lineTo(W * .49, H * .42); ctx.stroke();
      ctx.fillStyle = '#df343b'; ctx.fillRect(W * .49, H * .15, W * .16, H * .045); ctx.fillStyle = '#fff'; ctx.fillRect(W * .49, H * .195, W * .16, H * .045);
      // TPS tent at right.
      const sx = W * .54, sy = H * .34, sw = W * .46, sh = H * .26;
      ctx.fillStyle = '#fff7ed'; ctx.fillRect(sx + sw * .04, sy + sh * .30, sw * .92, sh * .68);
      ctx.fillStyle = '#c62d39'; ctx.beginPath(); ctx.moveTo(sx, sy + sh * .34); ctx.lineTo(sx + sw * .50, sy); ctx.lineTo(sx + sw, sy + sh * .34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff4e6'; ctx.beginPath(); ctx.moveTo(sx + sw * .10, sy + sh * .33); ctx.lineTo(sx + sw * .50, sy + sh * .07); ctx.lineTo(sx + sw * .90, sy + sh * .33); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a51f2d'; ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.max(15, W * .055) + 'px Arial'; ctx.fillText('TPS', sx + sw * .50, sy + sh * .28);
      ctx.font = 'bold ' + Math.max(7, W * .019) + 'px Arial'; ctx.fillText('TEMPAT PEMUNGUTAN SUARA', sx + sw * .50, sy + sh * .40);
      // Voting table / ballot box.
      ctx.fillStyle = '#f3e4c9'; ctx.fillRect(sx + sw * .36, sy + sh * .66, sw * .30, sh * .23);
      ctx.fillStyle = '#c7a36a'; ctx.fillRect(sx + sw * .39, sy + sh * .72, sw * .24, sh * .16);
      ctx.fillStyle = '#2b342e'; ctx.fillRect(sx + sw * .43, sy + sh * .69, sw * .16, 3);
      // Crowd cheering across the far side of the road, facing the runners.
      const crowdTop = ground - H * .025;
      const people = [
        {f:.07,c:'#d83c43',p:'wave',s:'#eab68e'}, {f:.19,c:'#286fa5',p:'hold',s:'#f0c5a0'},
        {f:.31,c:'#efb84c',p:'wave',s:'#9c654b'}, {f:.43,c:'#2a8a70',p:'hold',s:'#f1c7a4'},
        {f:.57,c:'#db7b9b',p:'wave',s:'#b77956'}, {f:.69,c:'#f2f1ec',p:'hold',s:'#e7b893'},
        {f:.82,c:'#2c679b',p:'wave',s:'#8b5d43'}, {f:.94,c:'#dfb14e',p:'wave',s:'#e9bb99'}
      ];
      people.forEach((p, i) => drawPortraitPerson(W * p.f, crowdTop + (i % 2) * H * .008, H * .13, p.c, p.p, p.s));
      drawSign(W * .12, H * .618, W * .22, H * .07, 'TOLAK POLITIK', 'UANG', '#b83b39');
      drawSign(W * .67, H * .615, W * .23, H * .07, 'DUKUNG', 'PEMILU DAMAI', '#277b67');
      // Low barrier / sidewalk between supporters and the road.
      ctx.fillStyle = '#d7d1bd'; ctx.fillRect(0, ground - H * .035, W, H * .035);
      ctx.fillStyle = '#75838a'; ctx.fillRect(0, ground - H * .035, W, H * .012);
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
      ctx.fillStyle = '#59616a'; ctx.fillRect(0, ground, W, H - ground);
      ctx.fillStyle = '#3d4651'; ctx.fillRect(0, ground + 2 * s, W, 4 * s);
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

    function drawObstacle(o) {
      const s = unitY;
      if (o.type === 'crate') {
        rounded(o.x, o.y - 42 * s, 42 * s, 42 * s, 7 * s, '#9b542d');
        ctx.strokeStyle = '#f4c17a'; ctx.lineWidth = 4 * s; ctx.strokeRect(o.x + 7 * s, o.y - 35 * s, 28 * s, 28 * s);
        ctx.beginPath(); ctx.moveTo(o.x + 7 * s, o.y - 35 * s); ctx.lineTo(o.x + 35 * s, o.y - 7 * s); ctx.moveTo(o.x + 35 * s, o.y - 35 * s); ctx.lineTo(o.x + 7 * s, o.y - 7 * s); ctx.stroke();
      } else if (o.type === 'cone') {
        ctx.fillStyle = '#f27632'; ctx.beginPath(); ctx.moveTo(o.x + 20 * s, o.y - 48 * s); ctx.lineTo(o.x + 42 * s, o.y); ctx.lineTo(o.x - 2 * s, o.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(o.x + 7 * s, o.y - 18 * s, 26 * s, 7 * s); ctx.fillRect(o.x - 5 * s, o.y - 2 * s, 50 * s, 7 * s);
      } else {
        rounded(o.x, o.y - 30 * s, 68 * s, 18 * s, 9 * s, '#263b50');
        ctx.fillStyle = '#f8d46b'; ctx.fillRect(o.x + 8 * s, o.y - 27 * s, 10 * s, 12 * s); ctx.fillRect(o.x + 48 * s, o.y - 27 * s, 10 * s, 12 * s);
      }
    }

    function spawnObstacle() {
      const type = Math.random() < .42 ? 'crate' : (Math.random() < .72 ? 'cone' : 'bar');
      obstacles.push({ x: W + 30 * unitX, y: ground, type });
    }

    function spawnCoins() {
      const n = 4 + Math.floor(Math.random() * 2);
      const s = unitY;
      const y = ground - 145 * s - Math.random() * 24 * s;
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
      speed = Math.min(650 * unitX, 300 * unitX + elapsed * 7.4 * unitX + distance * .07);
      distance += speed * dt / 13;
      score += dt * (10 + speed / Math.max(90, 90 * unitX));
      groundOffset += speed * dt;
      spawn -= dt; coinSpawn -= dt;
      if (spawn <= 0) { spawnObstacle(); spawn = Math.max(.72, 1.55 - Math.min(.7, elapsed * .006)) + Math.random() * .55; }
      if (coinSpawn <= 0) { spawnCoins(); coinSpawn = 2.5 + Math.random() * 2.1; }

      if (player.jumping) {
        player.y += player.vy * dt;
        player.vy += 1900 * unitY * dt;
        if (player.y >= ground - characterSize) { player.y = ground - characterSize; player.vy = 0; player.jumping = false; }
      }
      if (player.sliding && elapsed > player.slideUntil) player.sliding = false;
      obstacles.forEach((o) => { o.x -= speed * dt; });
      tokens.forEach((t) => { t.x -= speed * dt; });
      obstacles = obstacles.filter((o) => o.x > -100 * unitY);
      tokens = tokens.filter((t) => t.x > -40 * unitY && !t.taken);

      const pairWidth = characterWidth * 1.70;
      const pbox = {
        x: player.x + characterWidth * .12,
        y: player.sliding ? ground - 48 * unitY : player.y + characterSize * .16,
        w: player.sliding ? pairWidth * .80 : pairWidth * .83,
        h: player.sliding ? 38 * unitY : characterSize * .64
      };
      for (const o of obstacles) {
        const box = { x: o.x + 4 * unitY, y: o.type === 'bar' ? ground - 31 * unitY : ground - 45 * unitY,
          w: (o.type === 'bar' ? 60 : 34) * unitY, h: (o.type === 'bar' ? 20 : 42) * unitY };
        if (collide(pbox, box)) { end(); break; }
      }
      if (mode !== 'running') return;

      for (const t of tokens) {
        if (t.taken) continue;
        const nearestX = Math.max(pbox.x, Math.min(t.x, pbox.x + pbox.w));
        const nearestY = Math.max(pbox.y, Math.min(t.y, pbox.y + pbox.h));
        const dx = t.x - nearestX, dy = t.y - nearestY;
        const boxPickup = (dx * dx + dy * dy) <= ((t.r + 13 * unitY) * (t.r + 13 * unitY));
        const jumpMagnet = player.jumping && Math.abs(t.x - (pbox.x + pbox.w / 2)) < 104 * unitY && Math.abs(t.y - (pbox.y + pbox.h / 2)) < 96 * unitY;
        if (boxPickup || jumpMagnet) {
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
      drawCharacter(wasra, player.x, player.y, characterSize, phase, player.sliding);
      drawCharacter(wasri, player.x + characterGap, player.y + characterSize * .02, characterSize, phase + 1.2, player.sliding);
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
      drawCharacter(wasra, player.x, y, characterSize, 0, false);
      drawCharacter(wasri, player.x + characterGap, y, characterSize, 1, false);
      drawObstacle({ x: W * .72, y: ground, type: 'crate' });
      drawObstacle({ x: W * .86, y: ground, type: 'cone' });
    }

    // Recalculate the game world when the user enters/exits fullscreen or
    // rotates a phone. This gives portrait phones a full-height vertical scene
    // instead of shrinking a wide canvas into a narrow strip.
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
