
var SURVEY_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeKS85GCZxb2eptfXGz6tHEKmWDMq-11Tqvwq94D08Kd5Io9Q/viewform';

function configureSurveyLink() {
  var link = document.getElementById('surveyLink');
  if (!link) return;

  if (SURVEY_FORM_URL &&
      SURVEY_FORM_URL.indexOf('https://docs.google.com/forms/') === 0) {
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

  function paint(on) {
    var btn = document.getElementById('musicBtn');
    if (!btn) return;

    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute(
      'aria-label',
      on ? 'Jeda Mars Pengawas Pemilu' : 'Putar Mars Pengawas Pemilu'
    );
  }

  function bindMusic() {
    var btn = document.getElementById('musicBtn');
    if (!btn || !audio || btn.dataset.bound === '1') return;

    btn.dataset.bound = '1';

    btn.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().catch(function () {
          paint(false);
        });
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
        var matchCategory =
          category === 'all' ||
          item.getAttribute('data-cat') === category;

        var matchText =
          !term || item.textContent.toLowerCase().includes(term);

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

    if (input) {
      input.addEventListener('input', apply);
    }

    apply();
  }

  // Sinkronisasi CSS halaman tujuan.
  function syncPageStyles(parsed, pageUrl) {
    var currentHead = document.head;

    var targetLinks = Array.from(
      parsed.head.querySelectorAll('link[rel~="stylesheet"]')
    );

    targetLinks.forEach(function (targetLink) {
      var rawHref = targetLink.getAttribute('href');
      if (!rawHref) return;

      var absoluteHref = new URL(rawHref, pageUrl).href;

      var exists = Array.from(
        currentHead.querySelectorAll('link[rel~="stylesheet"]')
      ).some(function (link) {
        return link.href === absoluteHref;
      });

      if (!exists) {
        var newLink = document.createElement('link');

        Array.from(targetLink.attributes).forEach(function (attr) {
          if (attr.name !== 'href') {
            newLink.setAttribute(attr.name, attr.value);
          }
        });

        newLink.href = absoluteHref;
        currentHead.appendChild(newLink);
      }
    });

    Array.from(parsed.head.querySelectorAll('style')).forEach(
      function (targetStyle) {
        var styleId = targetStyle.id;

        if (styleId) {
          var existingStyle = document.getElementById(styleId);

          if (existingStyle) {
            existingStyle.textContent = targetStyle.textContent;
          } else {
            currentHead.appendChild(targetStyle.cloneNode(true));
          }
        } else {
          var styleText = targetStyle.textContent;

          var alreadyPresent = Array.from(
            currentHead.querySelectorAll('style')
          ).some(function (style) {
            return !style.id && style.textContent === styleText;
          });

          if (!alreadyPresent) {
            currentHead.appendChild(targetStyle.cloneNode(true));
          }
        }
      }
    );
  }

  function initPage() {
    bindMusic();
    bindFaq();
    configureSurveyLink();
    if (document.getElementById('wwr-canvas')) {
      if (typeof window.initWasraWasriRun === 'function') { window.initWasraWasriRun(); }
      else if (!document.getElementById('wwr-game-script')) {
        var gameScript = document.createElement('script');
        gameScript.id = 'wwr-game-script';
        gameScript.src = 'game.js?v=1.0.0';
        document.body.appendChild(gameScript);
      }
    }
    paint(audio && !audio.paused);
  }

  // Navigasi tanpa memuat ulang browser.
  async function navigate(url, push) {
    try {
      var response = await fetch(url);

      if (!response.ok) {
        throw new Error('Gagal memuat halaman');
      }

      var html = await response.text();

      var parsed = new DOMParser().parseFromString(
        html,
        'text/html'
      );

      if (!parsed.getElementById('mars')) {
        throw new Error('Elemen audio tidak ditemukan');
      }

      // Muat CSS halaman tujuan sebelum mengganti konten.
      syncPageStyles(parsed, url);

      // Hentikan loop game lama sebelum konten halaman diganti.
      if (typeof window.destroyWasraWasriRun === 'function') window.destroyWasraWasriRun();

      // Pertahankan node audio yang sama agar musik tidak terputus.
      var savedAudio = audio;

      Array.from(document.body.childNodes).forEach(function (node) {
        if (node !== savedAudio) {
          document.body.removeChild(node);
        }
      });

      Array.from(parsed.body.childNodes).forEach(function (node) {
        if (node.nodeType === 8) return;

        if (
          node.nodeType === 1 &&
          (node.id === 'mars' || node.tagName === 'SCRIPT')
        ) {
          return;
        }

        document.body.insertBefore(
          document.importNode(node, true),
          savedAudio
        );
      });

      document.title = parsed.title;

      if (push) {
        history.pushState(
          { silani: true },
          '',
          url
        );
      }

      window.scrollTo(0, 0);

      initPage();

    } catch (error) {
      console.error('Navigasi SiLani:', error);
      location.href = url;
    }
  }

  // Navigasi menu Beranda, Panduan, dan FAQ.
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    var link = target && target.closest ? target.closest('a[href]') : null;

    if (
      !link ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    var url = new URL(link.href, location.href);

    if (url.origin !== location.origin) return;

    var page = url.pathname.split('/').pop().toLowerCase();

    // Ketiga halaman menggunakan navigasi internal.
    if (!['index.html', 'panduan.html', 'faq.html', 'game.html'].includes(page)) return;

    event.preventDefault();

    navigate(url.href, true);
  });

  // Tombol Back dan Forward.
  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });

  // Pantau status audio.
  if (audio) {
    audio.addEventListener('play', function () {
      paint(true);
    });

    audio.addEventListener('pause', function () {
      paint(false);
    });
  }

  initPage();

})();
