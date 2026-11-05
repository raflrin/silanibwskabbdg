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
  var audio = document.getElementById('mars');
  var navigationBusy = false;

  function paint(on) {
    var btn = document.getElementById('musicBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Jeda Mars Pengawas Pemilu' : 'Putar Mars Pengawas Pemilu');
  }

  function bindMusic() {
    var btn = document.getElementById('musicBtn');
    if (!btn || !audio || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().catch(function () { paint(false); });
      } else {
        audio.pause();
      }
    });
    paint(!audio.paused);
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
    var targetLinks = Array.from(parsed.head.querySelectorAll('link[rel~="stylesheet"]'));
    targetLinks.forEach(function (targetLink) {
      var rawHref = targetLink.getAttribute('href');
      if (!rawHref) return;
      var absoluteHref = new URL(rawHref, pageUrl).href;
      var exists = Array.from(document.head.querySelectorAll('link[rel~="stylesheet"]'))
        .some(function (link) { return link.href === absoluteHref; });
      if (!exists) {
        var newLink = document.createElement('link');
        Array.from(targetLink.attributes).forEach(function (attr) {
          if (attr.name !== 'href') newLink.setAttribute(attr.name, attr.value);
        });
        newLink.href = absoluteHref;
        document.head.appendChild(newLink);
      }
    });

    Array.from(parsed.head.querySelectorAll('style')).forEach(function (targetStyle) {
      var styleId = targetStyle.id;
      if (styleId) {
        var existingStyle = document.getElementById(styleId);
        if (existingStyle) existingStyle.textContent = targetStyle.textContent;
        else document.head.appendChild(targetStyle.cloneNode(true));
      } else {
        var styleText = targetStyle.textContent;
        var alreadyPresent = Array.from(document.head.querySelectorAll('style'))
          .some(function (style) { return !style.id && style.textContent === styleText; });
        if (!alreadyPresent) document.head.appendChild(targetStyle.cloneNode(true));
      }
    });
  }

  // Load page-specific scripts in document order without reloading this page
  // or replacing the existing audio element. This is needed for the game pages.
  async function loadPageScripts(parsed, pageUrl) {
    var scripts = Array.from(parsed.querySelectorAll('script[src]'));

    for (var i = 0; i < scripts.length; i++) {
      var rawSrc = scripts[i].getAttribute('src');
      if (!rawSrc || /(^|\/)silani\.js(?:[?#]|$)/i.test(rawSrc)) continue;

      var absoluteSrc = new URL(rawSrc, pageUrl).href;
      var parsedSrc = new URL(absoluteSrc);
      var fileName = parsedSrc.pathname.split('/').pop().toLowerCase();

      // The chess engine is shared; only its page-specific controller needs
      // to be executed again when the chess page is opened again.
      if (fileName === 'chess.min.js' && typeof window.Chess === 'function') continue;

      // The runner exposes an initializer. Reuse it when the script was
      // already loaded during an earlier visit in this SPA session.
      if (fileName === 'game.js' && typeof window.initWasraWasriRun === 'function') {
        window.initWasraWasriRun();
        continue;
      }

      await new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = absoluteSrc;
        script.async = false;
        script.onload = resolve;
        script.onerror = function () { reject(new Error('Gagal memuat skrip: ' + absoluteSrc)); };
        document.head.appendChild(script);
      });
    }
  }

  function initPage() {
    bindMusic();
    bindFaq();
    configureSurveyLink();
    if (document.getElementById('wwr-canvas') && typeof window.initWasraWasriRun === 'function') {
      window.initWasraWasriRun();
    }
    paint(audio && !audio.paused);
  }

  async function navigate(url, push) {
    if (navigationBusy) return;
    navigationBusy = true;
    try {
      var response = await fetch(url);
      if (!response.ok) throw new Error('Gagal memuat halaman: ' + response.status);
      var html = await response.text();
      var parsed = new DOMParser().parseFromString(html, 'text/html');
      if (!parsed.getElementById('mars')) throw new Error('Elemen audio tidak ditemukan');

      syncPageStyles(parsed, url);
      if (typeof window.destroyWasraWasriRun === 'function') window.destroyWasraWasriRun();

      // Keep the same audio DOM node alive while replacing the page content.
      var savedAudio = audio;
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

      await loadPageScripts(parsed, url);
      initPage();
    } catch (error) {
      console.error('Navigasi SiLani:', error);
      // Fallback preserves normal navigation if a page resource cannot load.
      location.href = url;
    } finally {
      navigationBusy = false;
    }
  }

  // Keep the existing audio node alive for every internal page, including
  // WASRA & WASRI RUN and Catur. This prevents the Mars from stopping on entry.
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.nodeType === 1
      ? event.target
      : event.target && event.target.parentElement;
    var link = target && target.closest ? target.closest('a[href]') : null;
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || event.button !== 0) return;

    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    var page = url.pathname.split('/').pop().toLowerCase();
    var internalPages = ['index.html', 'panduan.html', 'faq.html', 'game.html', 'run.html', 'catur.html'];
    if (internalPages.indexOf(page) === -1) return;

    event.preventDefault();
    navigate(url.href, true);
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });

  if (audio) {
    audio.addEventListener('play', function () { paint(true); });
    audio.addEventListener('pause', function () { paint(false); });
  }

  initPage();
})();
