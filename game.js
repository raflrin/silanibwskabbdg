/* WASRA & WASRI RUN — Canvas endless runner. No external library required. */
(function(){
  'use strict';
  function initWasraWasriRun(){
    const root=document.getElementById('wwr-canvas'); if(!root || root.dataset.initialized==='1') return;
    root.dataset.initialized='1';
    const ctx=root.getContext('2d'); if(!ctx) return;
    const $=id=>document.getElementById(id);
    const ui={score:$('wwr-score'),distance:$('wwr-distance'),coins:$('wwr-coins'),speed:$('wwr-speed'),best:$('wwr-best'),bestDistance:$('wwr-best-distance'),record:$('wwr-record'),overlay:$('wwr-overlay'),title:$('wwr-overlay-title'),copy:$('wwr-overlay-copy'),start:$('wwr-start'),pause:$('wwr-pause'),jump:$('wwr-jump'),slide:$('wwr-slide'),fullscreen:$('wwr-fullscreen'),fullscreenLabel:$('wwr-fullscreen-label'),card:document.querySelector('.wwr-game-card')};
    const BEST_KEY='silani_wwr_best_v1', DIST_KEY='silani_wwr_distance_v1';
    let best=Number(localStorage.getItem(BEST_KEY)||0),bestDistance=Number(localStorage.getItem(DIST_KEY)||0);
    ui.best.textContent=best.toLocaleString('id-ID');ui.record.textContent=best.toLocaleString('id-ID');ui.bestDistance.textContent=bestDistance+' m';
    const wasra=new Image(),wasri=new Image();wasra.src='WASRA.png?v=20261105-v13';wasri.src='WASRI.png?v=20261105-v13';
    const W=960,H=420,ground=340; let raf=0,last=0,mode='ready',elapsed=0,distance=0,score=0,coins=0,speed=300,spawn=0,coinSpawn=0,groundOffset=0,obstacles=[],tokens=[],particles=[];
    const player={x:132,y:ground-91,vy:0,jumping:false,sliding:false,slideUntil:0};
    function reset(){elapsed=0;distance=0;score=0;coins=0;speed=300;spawn=1.05;coinSpawn=1.4;groundOffset=0;obstacles=[];tokens=[];particles=[];player.y=ground-91;player.vy=0;player.jumping=false;player.sliding=false;hud();}
    function hud(){ui.score.textContent=Math.floor(score).toLocaleString('id-ID');ui.distance.textContent=Math.floor(distance)+' m';ui.coins.textContent=coins;ui.speed.textContent=(speed/300).toFixed(1)+'×';}
    function start(){if(mode==='running')return;reset();mode='running';ui.overlay.hidden=true;ui.pause.textContent='Jeda';last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
    function end(){mode='over';cancelAnimationFrame(raf);const final=Math.floor(score);if(final>best){best=final;localStorage.setItem(BEST_KEY,best);ui.best.textContent=best.toLocaleString('id-ID');ui.record.textContent=best.toLocaleString('id-ID');}if(Math.floor(distance)>bestDistance){bestDistance=Math.floor(distance);localStorage.setItem(DIST_KEY,bestDistance);ui.bestDistance.textContent=bestDistance+' m';}ui.title.textContent='Perjalanan selesai!';ui.copy.textContent='Skor '+final.toLocaleString('id-ID')+' · Jarak '+Math.floor(distance)+' m · Koin '+coins+'. Coba lagi dan pecahkan rekor!';ui.start.textContent='Main lagi';ui.overlay.hidden=false;}
    function pause(){if(mode==='running'){mode='paused';cancelAnimationFrame(raf);ui.title.textContent='Permainan dijeda';ui.copy.textContent='Istirahat sebentar. Lanjutkan saat siap.';ui.start.textContent='Lanjutkan';ui.overlay.hidden=false;ui.pause.textContent='Lanjut';}else if(mode==='paused'){mode='running';ui.overlay.hidden=true;ui.pause.textContent='Jeda';last=performance.now();raf=requestAnimationFrame(loop);}}
    function jump(){if(mode!=='running')return;if(!player.jumping&&!player.sliding){player.vy=-720;player.jumping=true;}}
    function slide(){if(mode!=='running')return;if(player.jumping){player.vy=Math.max(player.vy,80);return;}player.sliding=true;player.slideUntil=elapsed+.62;}
    function key(e){if(['Space','ArrowUp','ArrowDown','KeyW','KeyS','KeyP'].includes(e.code))e.preventDefault();if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')jump();if(e.code==='ArrowDown'||e.code==='KeyS')slide();if(e.code==='KeyP')pause();}
    window.addEventListener('keydown',key);ui.start.addEventListener('click',()=>{if(mode==='paused'){pause();return;}start();});ui.pause.addEventListener('click',pause);ui.jump.addEventListener('pointerdown',e=>{e.preventDefault();jump();});ui.slide.addEventListener('pointerdown',e=>{e.preventDefault();slide();});
    function syncFullscreenButton(){const active=!!(document.fullscreenElement||document.webkitFullscreenElement);if(ui.fullscreen){ui.fullscreenLabel.textContent=active?'Keluar layar penuh':'Layar penuh';ui.fullscreen.setAttribute('aria-label',active?'Keluar dari layar penuh':'Aktifkan layar penuh');ui.fullscreen.title=active?'Keluar layar penuh':'Layar penuh';}}
    async function toggleFullscreen(){const target=ui.card;if(!target)return;try{if(document.fullscreenElement||document.webkitFullscreenElement){if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}
      else if(target.requestFullscreen){await target.requestFullscreen();}
      else if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();}
      else {ui.copy.textContent='Browser ini belum mendukung mode layar penuh. Permainan tetap dapat dimainkan pada tampilan normal.';ui.overlay.hidden=false;return;}
      if(window.matchMedia('(max-width: 760px)').matches&&screen.orientation&&screen.orientation.lock){try{await screen.orientation.lock('landscape');}catch(_){/* Lock orientation is optional and browser-dependent. */}}
    }catch(err){ui.copy.textContent='Mode layar penuh tidak dapat diaktifkan. Coba gunakan tombol fullscreen pada browser atau lanjutkan dalam tampilan normal.';ui.overlay.hidden=false;}syncFullscreenButton();}
    if(ui.fullscreen)ui.fullscreen.addEventListener('click',toggleFullscreen);
    document.addEventListener('fullscreenchange',syncFullscreenButton);document.addEventListener('webkitfullscreenchange',syncFullscreenButton);
    function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
    function drawBackground(dt){const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#9de0ef');sky.addColorStop(1,'#e6f7dc');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff7c8';ctx.beginPath();ctx.arc(800,76,38,0,Math.PI*2);ctx.fill();
      // distant hills
      for(let i=0;i<4;i++){let x=((i*310-groundOffset*.18)%1300+1300)%1300-170;ctx.fillStyle=['#8bc9a1','#78bd91','#a6d5a3','#8dc99a'][i];ctx.beginPath();ctx.ellipse(x+130,ground-8,190,90,0,Math.PI,Math.PI*2);ctx.fill();}
      // clouds
      for(let i=0;i<4;i++){let x=((i*290-groundOffset*.08)%1150+1150)%1150-90;ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.arc(x,90+(i%2)*34,22,0,7);ctx.arc(x+25,80+(i%2)*34,28,0,7);ctx.arc(x+54,92+(i%2)*34,19,0,7);ctx.fill();}
      ctx.fillStyle='#6eae70';ctx.fillRect(0,ground,W,H-ground);ctx.fillStyle='#4c8f5a';ctx.fillRect(0,ground,W,9);
      ctx.fillStyle='#b9854f';ctx.fillRect(0,ground+9,W,H-ground-9);ctx.fillStyle='#d5a56b';for(let x=-(groundOffset%70);x<W;x+=70){ctx.fillRect(x,ground+27,34,5);ctx.fillRect(x+40,ground+58,18,4);}
      // small flowers/grass
      for(let i=0;i<18;i++){let x=((i*73-groundOffset*.8)%1000+1000)%1000;ctx.fillStyle=i%2?'#fff2b4':'#f6c3c8';ctx.beginPath();ctx.arc(x,ground-12-(i%3)*5,3,0,7);ctx.fill();}
    }
    function drawCharacter(img,x,y,w,h,phase,slideMode){ctx.save();if(slideMode){ctx.translate(x,y+42);ctx.rotate(-.12);if(img.complete&&img.naturalWidth)ctx.drawImage(img,0,0,w+10,h*.64);else drawFallback(x,y,w,h,phase); }else if(img.complete&&img.naturalWidth){let bob=Math.sin(phase)*3;ctx.drawImage(img,x,y+bob,w,h);}else drawFallback(x,y,w,h,phase);ctx.restore();}
    function drawFallback(x,y,w,h,p){ctx.fillStyle='#26252a';ctx.beginPath();ctx.ellipse(x+w/2,y+h*.38,w*.35,h*.36,0,0,7);ctx.fill();ctx.fillStyle='#f0d9a0';ctx.beginPath();ctx.arc(x+w/2,y+h*.24,w*.27,0,7);ctx.fill();ctx.fillStyle='#ed8b22';ctx.beginPath();ctx.ellipse(x+w/2,y+h*.34,w*.13,h*.07,0,0,7);ctx.fill();ctx.fillStyle='#17243a';ctx.fillRect(x+w*.22,y+h*.68,w*.22,h*.25);ctx.fillRect(x+w*.55,y+h*.68,w*.22,h*.25);}
    function drawObstacle(o){if(o.type==='crate'){rounded(o.x,o.y-42,42,42,7,'#9b542d');ctx.strokeStyle='#f4c17a';ctx.lineWidth=4;ctx.strokeRect(o.x+7,o.y-35,28,28);ctx.beginPath();ctx.moveTo(o.x+7,o.y-35);ctx.lineTo(o.x+35,o.y-7);ctx.moveTo(o.x+35,o.y-35);ctx.lineTo(o.x+7,o.y-7);ctx.stroke();}else if(o.type==='cone'){ctx.fillStyle='#f27632';ctx.beginPath();ctx.moveTo(o.x+20,o.y-48);ctx.lineTo(o.x+42,o.y);ctx.lineTo(o.x-2,o.y);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(o.x+7,o.y-18,26,7);ctx.fillStyle='#fff';ctx.fillRect(o.x-5,o.y-2,50,7);}else{rounded(o.x,o.y-30,68,18,9,'#263b50');ctx.fillStyle='#f8d46b';ctx.fillRect(o.x+8,o.y-27,10,12);ctx.fillRect(o.x+48,o.y-27,10,12);}}
    function spawnObstacle(){let type=Math.random()<.42?'crate':Math.random()<.72?'cone':'bar';obstacles.push({x:W+30,y:ground,type,w:type==='bar'?68:42,h:50});}
    function spawnCoins(){let n=3+Math.floor(Math.random()*3),y=ground-110-Math.random()*70;for(let i=0;i<n;i++)tokens.push({x:W+20+i*34,y:y-Math.sin(i/(n-1||1)*Math.PI)*20,r:10,taken:false});}
    function collide(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
    function loop(now){if(mode!=='running')return;let dt=Math.min((now-last)/1000,.035);last=now;elapsed+=dt;speed=Math.min(650,300+elapsed*7.4+distance*.07);distance+=speed*dt/13;score+=dt*(10+speed/90);groundOffset+=speed*dt;spawn-=dt;coinSpawn-=dt;if(spawn<=0){spawnObstacle();spawn=Math.max(.72,1.55-Math.min(.7,elapsed*.006))+Math.random()*.55;}if(coinSpawn<=0){spawnCoins();coinSpawn=2.5+Math.random()*2.1;}
      if(player.jumping){player.y+=player.vy*dt;player.vy+=1900*dt;if(player.y>=ground-91){player.y=ground-91;player.vy=0;player.jumping=false;}}
      if(player.sliding&&elapsed>player.slideUntil)player.sliding=false;
      obstacles.forEach(o=>o.x-=speed*dt);tokens.forEach(t=>t.x-=speed*dt);obstacles=obstacles.filter(o=>o.x>-100);tokens=tokens.filter(t=>t.x>-40&&!t.taken);
      const pbox={x:player.x+14,y:player.sliding?ground-48:player.y+18,w:player.sliding?102:75,h:player.sliding?38:70};
      for(const o of obstacles){let box={x:o.x+4,y:o.type==='bar'?ground-31:ground-45,w:o.type==='bar'?60:34,h:o.type==='bar'?20:42};if(collide(pbox,box)){end();break;}}
      if(mode!=='running')return;
      for(const t of tokens){if(!t.taken&&Math.hypot((pbox.x+pbox.w/2)-t.x,(pbox.y+pbox.h/2)-t.y)<42){t.taken=true;coins++;score+=50;}}
      ctx.clearRect(0,0,W,H);drawBackground(dt);obstacles.forEach(drawObstacle);
      tokens.forEach(t=>{ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle='#ffd54f';ctx.strokeStyle='#b97b1b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,t.r,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff4bd';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('★',0,5);ctx.restore();});
      let phase=elapsed*13;let y=player.y;drawCharacter(wasra,player.x,y-12,112,112,phase,player.sliding);drawCharacter(wasri,player.x+72,y-8,108,108,phase+1.2,player.sliding);
      // little trail sparkle
      ctx.fillStyle='#fff';for(let i=0;i<3;i++){let xx=player.x-12-((elapsed*80+i*17)%34);ctx.globalAlpha=.65-i*.16;ctx.beginPath();ctx.arc(xx,ground-18-i*9,3,0,7);ctx.fill();}ctx.globalAlpha=1;
      hud();raf=requestAnimationFrame(loop);
    }
    // Render a still scene while waiting for the first run.
    function preview(){ctx.clearRect(0,0,W,H);drawBackground(0);drawCharacter(wasra,player.x,ground-112,112,112,0,false);drawCharacter(wasri,player.x+72,ground-108,108,108,1,false);drawObstacle({x:610,y:ground,type:'crate'});drawObstacle({x:790,y:ground,type:'cone'});}
    preview();
    window.destroyWasraWasriRun=function(){cancelAnimationFrame(raf);window.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',syncFullscreenButton);document.removeEventListener('webkitfullscreenchange',syncFullscreenButton);root.dataset.initialized='0';};
  }
  window.initWasraWasriRun=initWasraWasriRun;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initWasraWasriRun,{once:true});else initWasraWasriRun();
})();
