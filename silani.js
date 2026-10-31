(function(){
  var audio = document.getElementById('mars');
  var KP='silaniMarsPlaying';
  var currentPage = function(){
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  };

  function paint(on){
    var btn=document.getElementById('musicBtn');
    var label=document.getElementById('musicLabel');
    if(!btn)return;
    btn.setAttribute('aria-pressed',String(on));
    btn.setAttribute('aria-label',on?'Jeda Mars Pengawas Pemilu':'Putar Mars Pengawas Pemilu');
    if(label)label.textContent=on?'Mars aktif':'Putar mars';
  }

  function bindMusic(){
    var btn=document.getElementById('musicBtn');
    if(!btn || !audio || btn.dataset.bound==='1')return;
    btn.dataset.bound='1';
    btn.addEventListener('click',function(){
      if(audio.paused){
        try{sessionStorage.setItem(KP,'1')}catch(e){}
        var p=audio.play();
        if(p&&p.catch)p.catch(function(){paint(false)});
      }else{
        audio.pause();
        try{sessionStorage.setItem(KP,'0')}catch(e){}
      }
    });
    paint(!audio.paused);
  }

  function bindFaq(){
    var list=document.getElementById('faqList');
    if(!list || list.dataset.bound==='1')return;
    list.dataset.bound='1';
    var items=Array.prototype.slice.call(list.querySelectorAll('.q'));
    var chips=Array.prototype.slice.call(document.querySelectorAll('.chip'));
    var input=document.getElementById('faqSearch');
    var empty=document.getElementById('faqEmpty');
    var cat='all';
    function apply(){
      var term=input?(input.value||'').trim().toLowerCase():'',shown=0;
      items.forEach(function(el){
        var okCat=cat==='all'||el.getAttribute('data-cat')===cat;
        var okTerm=!term||el.textContent.toLowerCase().indexOf(term)>-1;
        var show=okCat&&okTerm;
        el.hidden=!show;
        if(show)shown++;
      });
      if(empty)empty.hidden=shown>0;
    }
    chips.forEach(function(c){
      c.addEventListener('click',function(){
        cat=c.getAttribute('data-filter');
        chips.forEach(function(x){
          var on=x===c;
          x.classList.toggle('on',on);
          x.setAttribute('aria-pressed',String(on));
        });
        apply();
      });
    });
    if(input)input.addEventListener('input',apply);
    apply();
  }

  function initPage(){
    bindMusic();
    bindFaq();
    var page=currentPage();
    document.querySelectorAll('.nav a').forEach(function(a){
      var target=(a.getAttribute('href')||'').split('/').pop().toLowerCase();
      if(target===page)a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }

  async function navigate(url,push){
    try{
      var response=await fetch(url,{headers:{'X-SiLani-Navigation':'1'}});
      if(!response.ok)throw new Error('Page tidak dapat dimuat');
      var html=await response.text();
      var parsed=new DOMParser().parseFromString(html,'text/html');
      var incomingAudio=parsed.getElementById('mars');
      if(!incomingAudio)throw new Error('Audio player tidak ditemukan');
      var preservedAudio=audio;
      var newBody=parsed.body.cloneNode(true);
      var staleAudio=newBody.querySelector('#mars');
      if(staleAudio)staleAudio.remove();
      newBody.querySelectorAll('script').forEach(function(s){s.remove()});
      document.body.innerHTML=newBody.innerHTML;
      document.body.appendChild(preservedAudio);
      document.title=parsed.title;
      audio=preservedAudio;
      if(push)history.pushState({silani:true},'',url);
      window.scrollTo(0,0);
      initPage();
    }catch(err){
      // Fallback to normal navigation if fetch is unavailable.
      location.href=url;
    }
  }

  document.addEventListener('click',function(event){
    var link=event.target.closest('a[href]');
    if(!link || event.defaultPrevented || event.button!==0 ||
       event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    var url=new URL(link.href,location.href);
    if(url.origin!==location.origin)return;
    var page=url.pathname.split('/').pop().toLowerCase();
    if(['index.html','panduan.html','faq.html'].indexOf(page)===-1)return;
    if(url.pathname===location.pathname && !url.search && !url.hash)return;
    event.preventDefault();
    navigate(url.href,true);
  });

  window.addEventListener('popstate',function(){navigate(location.href,false)});
  if(audio){
    audio.addEventListener('play',function(){paint(true)});
    audio.addEventListener('pause',function(){paint(false)});
  }
  initPage();
})();