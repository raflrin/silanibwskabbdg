(function(){
  var audio=document.getElementById('mars');
  var btn=document.getElementById('musicBtn');
  var label=document.getElementById('musicLabel');
  var KP='silaniMarsPlaying',KT='silaniMarsTime';
  function store(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
  function read(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
  function paint(on){
    if(!btn)return;
    btn.setAttribute('aria-pressed',String(on));
    btn.setAttribute('aria-label',on?'Jeda Mars Pengawas Pemilu':'Putar Mars Pengawas Pemilu');
    if(label)label.textContent=on?'Mars aktif':'Putar mars';
  }
  if(audio&&btn){
    var saved=Number(read(KT)||0);
    if(saved>0&&isFinite(saved)){
      audio.addEventListener('loadedmetadata',function(){
        try{audio.currentTime=Math.min(saved,Math.max(0,audio.duration-1))}catch(e){}
      },{once:true});
    }
    var tryPlay=function(){
      var p=audio.play();
      if(p&&p.catch){p.catch(function(){paint(false)})}
    };
    btn.addEventListener('click',function(){
      if(audio.paused){store(KP,'1');tryPlay()}
      else{audio.pause();store(KP,'0')}
    });
    audio.addEventListener('play',function(){paint(true)});
    audio.addEventListener('pause',function(){paint(false)});
    window.addEventListener('pagehide',function(){
      store(KT,String(audio.currentTime||0));
      store(KP,audio.paused?'0':'1');
    });
    if(read(KP)==='1'){window.addEventListener('load',tryPlay,{once:true})}
  }

  var list=document.getElementById('faqList');
  if(list){
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
      empty.hidden=shown>0;
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
  }
})();
