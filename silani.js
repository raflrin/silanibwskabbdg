var SURVEY_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeKS85GCZxb2eptfXGz6tHEKmWDMq-11Tqvwq94D08Kd5Io9Q/viewform';

function configureSurveyLink() {
  var link = document.getElementById('surveyLink');
  if (!link) return;

  if (SURVEY_FORM_URL && SURVEY_FORM_URL.indexOf('https://docs.google.com/forms/') === 0) {
    link.href = SURVEY_FORM_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.removeAttribute('aria-disabled');
    link.textContent = 'Isi Survei Kepuasan';
  } else {
    link.href = '#';
    link.setAttribute('aria-disabled', 'true');
    link.textContent = 'Formulir segera tersedia';
  }
}

(function () {
  'use strict';

  // Audio dibuat sekali dan node yang sama dipertahankan selama navigasi internal.
  var audio = document.getElementById('mars');
  var PAGE_FILES = ['index.html', 'panduan.html', 'faq.html', 'game.html', 'run.html', 'catur.html'];
  var scriptPromises = Object.create(null);

  function paintMusicState(on) {
    var btn = document.getElementById('musicBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(!!on));
    btn.setAttribute('aria-label', on ? 'Jeda Mars Pengawas Pemilu' : 'Putar Mars Pengawas Pemilu');
    var label = document.getElementById('musicLabel');
    if (label) label.textContent = on ? 'Jeda mars' : 'Putar mars';
  }

  function bindMusic() {
    var btn = document.getElementById('musicBtn');
    if (!btn || !audio || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', function () {
      if (audio.paused) {
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () { paintMusicState(false); });
        }
      } else {
        audio.pause();
      }
    });
    paintMusicState(!audio.paused);
  }

  function bindFaq() {
    var list = document.getElementById('faqList');
    if (!list || list.dataset.bound === '1') return;
    list.dataset.bound = '1';

    var items = Array.from(list.querySelectorAll('.q'));
    var chips = Array.from(document.querySelectorAll('.chip'));
    var input = document.getElementById('faqSearch');
    var empty = document.getElementById('faqEmpty');
    var category = 'all';

    function apply() {
      var term = input ? input.value.trim().toLowerCase() : '';
      var shown = 0;
      items.forEach(function (item) {
        var matchCategory = category === 'all' || item.getAttribute('data-cat') === category;
        var matchText = !term || item.textContent.toLowerCase().includes(term);
        item.hidden = !(matchCategory && matchText);
        if (!item.hidden) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        category = chip.getAttribute('data-filter');
        chips.forEach(function (item) {
          var active = item === chip;
          item.classList.toggle('on', active);
          item.setAttribute('aria-pressed', String(active));
        });
        apply();
      });
    });
    if (input) input.addEventListener('input', apply);
    apply();
  }

  function syncPageStyles(parsed, pageUrl) {
    var currentHead = document.head;
    Array.from(parsed.head.querySelectorAll('link[rel~="stylesheet"]')).forEach(function (targetLink) {
      var rawHref = targetLink.getAttribute('href');
      if (!rawHref) return;
      var absoluteHref = new URL(rawHref, pageUrl).href;
      var exists = Array.from(currentHead.querySelectorAll('link[rel~="stylesheet"]')).some(function (link) {
        return link.href === absoluteHref;
      });
      if (exists) return;

      var newLink = document.createElement('link');
      Array.from(targetLink.attributes).forEach(function (attr) {
        if (attr.name !== 'href') newLink.setAttribute(attr.name, attr.value);
      });
      newLink.href = absoluteHref;
      currentHead.appendChild(newLink);
    });

    Array.from(parsed.head.querySelectorAll('style')).forEach(function (targetStyle) {
      var styleId = targetStyle.id;
      if (styleId) {
        var existingStyle = document.getElementById(styleId);
        if (existingStyle) existingStyle.textContent = targetStyle.textContent;
        else currentHead.appendChild(targetStyle.cloneNode(true));
      } else {
        var styleText = targetStyle.textContent;
        var alreadyPresent = Array.from(currentHead.querySelectorAll('style')).some(function (style) {
          return !style.id && style.textContent === styleText;
        });
        if (!alreadyPresent) currentHead.appendChild(targetStyle.cloneNode(true));
      }
    });
  }

  function loadScriptOnce(key, src) {
    if (scriptPromises[key]) return scriptPromises[key];

    var existing = document.getElementById(key);
    if (existing && existing.dataset.loaded === 'true') return Promise.resolve();

    scriptPromises[key] = new Promise(function (resolve, reject) {
      var script = existing || document.createElement('script');
      script.id = key;
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = function () {
        delete scriptPromises[key];
        script.remove();
        reject(new Error('Gagal memuat skrip: ' + src));
      };
      if (!existing) document.head.appendChild(script);
    });
    return scriptPromises[key];
  }

  async function initRunPage() {
    if (!document.getElementById('wwr-canvas')) return;
    if (typeof window.initWasraWasriRun !== 'function') {
      await loadScriptOnce('silani-run-game-script', 'game.js?v=20261106-mobile-audio-v2');
    }
    if (typeof window.initWasraWasriRun === 'function') window.initWasraWasriRun();
  }

  async function initChessPage() {
    if (!document.getElementById('chess-board')) return;

    if (typeof window.Chess !== 'function') {
      await loadScriptOnce('silani-chess-library', 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
    }
    if (typeof window.initCaturSiLani !== 'function') {
      await loadScriptOnce('silani-chess-app-script', 'chess.js?v=20261106-spa-audio-v2');
    }
    if (typeof window.initCaturSiLani === 'function') {
      window.initCaturSiLani();
    } else {
      var status = document.getElementById('game-status');
      if (status) status.textContent = 'Komponen catur belum berhasil dimuat. Periksa koneksi internet lalu muat ulang halaman.';
    }
  }

  async function initPage() {
    bindMusic();
    bindFaq();
    configureSurveyLink();

    try {
      await initRunPage();
      await initChessPage();
    } catch (error) {
      console.error('Inisialisasi halaman SiLani:', error);
      var status = document.getElementById('game-status');
      if (status) status.textContent = 'Komponen permainan gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';
    }
    paintMusicState(audio && !audio.paused);
  }

  async function navigate(url, push) {
    try {
      var response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Gagal memuat halaman (' + response.status + ')');

      var html = await response.text();
      var parsed = new DOMParser().parseFromString(html, 'text/html');
      if (!parsed.getElementById('mars')) throw new Error('Elemen audio tidak ditemukan');

      syncPageStyles(parsed, url);

      // Hentikan permainan yang sedang aktif sebelum konten lama dilepas.
      if (typeof window.destroyWasraWasriRun === 'function') window.destroyWasraWasriRun();
      if (typeof window.destroyCaturSiLani === 'function') window.destroyCaturSiLani();

      // Audio tidak dilepas dari DOM: status play/pause dan currentTime tetap terjaga.
      var savedAudio = audio;
      if (!savedAudio) {
        savedAudio = document.getElementById('mars');
        audio = savedAudio;
      }

      Array.from(document.body.childNodes).forEach(function (node) {
        if (node !== savedAudio) document.body.removeChild(node);
      });

      Array.from(parsed.body.childNodes).forEach(function (node) {
        if (node.nodeType === 8) return;
        if (node.nodeType === 1 && (node.id === 'mars' || node.tagName === 'SCRIPT')) return;
        document.body.insertBefore(document.importNode(node, true), savedAudio);
      });

      document.title = parsed.title;
      if (push) history.pushState({ silani: true }, '', url);
      window.scrollTo(0, 0);
      await initPage();
    } catch (error) {
      console.error('Navigasi SiLani:', error);
      // Fallback agar tautan tetap bisa dibuka bila navigasi internal gagal.
      location.href = url;
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.nodeType === 1 ? event.target : (event.target && event.target.parentElement);
    var link = target && target.closest ? target.closest('a[href]') : null;
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (link.target && link.target.toLowerCase() === '_blank') return;
    if (link.hasAttribute('download')) return;

    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    var page = url.pathname.split('/').pop().toLowerCase();
    if (PAGE_FILES.indexOf(page) === -1) return;
    if (url.pathname === location.pathname && url.hash) return;

    event.preventDefault();
    navigate(url.href, true);
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });

  if (audio) {
    audio.addEventListener('play', function () { paintMusicState(true); });
    audio.addEventListener('pause', function () { paintMusicState(false); });
  }

  initPage();
})();
