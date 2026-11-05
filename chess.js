(function(){
'use strict';
const boardEl=document.getElementById('chess-board');
if(!boardEl || boardEl.dataset.chessInitialized==='1')return;
boardEl.dataset.chessInitialized='1';
const $=id=>document.getElementById(id);
const glyph={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const value={p:100,n:320,b:335,r:500,q:900,k:20000};
let game=null,selected=null,legal=[],flipped=false,busy=false,lastMove=null;
function init(){if(typeof Chess==='undefined'){ $('game-status').textContent='Komponen catur gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';return;}
 game=new Chess();render();status('Giliran Anda. Silakan melangkah.');}
function files(){return flipped?['h','g','f','e','d','c','b','a']:['a','b','c','d','e','f','g','h'];}
function ranks(){return flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];}
function render(){
 boardEl.innerHTML='';
 const b=game.board();
 ranks().forEach((rank,ri)=>files().forEach((file,fi)=>{
  const sq=file+rank,cell=b[8-rank][file.charCodeAt(0)-97],el=document.createElement('button');
  el.type='button';el.className='square '+(((ri+fi)%2===0)?'light':'dark');el.dataset.square=sq;el.setAttribute('role','gridcell');el.setAttribute('aria-label',sq);
  if(selected===sq)el.classList.add('selected');
  if(lastMove&&(lastMove.from===sq||lastMove.to===sq))el.classList.add('last-move');
  if(cell){const piece=document.createElement('span');piece.className='piece '+(cell.color==='w'?'white-piece':'black-piece');piece.textContent=glyph[cell.color+cell.type];el.appendChild(piece);}
  if(legal.some(m=>m.to===sq)){el.classList.add(cell?'capture-target':'move-target');}
  el.addEventListener('click',()=>clickSquare(sq));boardEl.appendChild(el);
 }));
 captured();
}
function clickSquare(sq){
 if(busy||game.game_over()||game.turn()!=='w')return;
 const piece=game.get(sq);
 if(selected&&legal.some(m=>m.to===sq)){
  const move=game.move({from:selected,to:sq,promotion:'q'});
  selected=null;legal=[];lastMove=move;render();afterHuman();return;
 }
 if(piece&&piece.color==='w'){
  selected=sq;legal=game.moves({square:sq,verbose:true});render();return;
 }
 selected=null;legal=[];render();
}
function afterHuman(){
 if(game.game_over()){render();statusText();return;}
 busy=true;status('Komputer sedang berpikir…');$('turn-indicator').textContent='Giliran Komputer';
 setTimeout(()=>{const depth=Number($('difficulty').value);const move=chooseMove(depth);if(move){lastMove=game.move(move);}busy=false;render();statusText();},180);
}
function evaluate(){
 let score=0;const b=game.board();
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(!p)continue;
  let v=value[p.type];const advance=p.type==='p'?(p.color==='b'?r:7-r)*5:0;
  v+=advance+(p.type==='n'||p.type==='b'? (3.5-Math.abs(3.5-c))*4:0);
  score+=(p.color==='b'?v:-v);
 }
 if(game.in_check())score+=(game.turn()==='b'?-35:35);
 return score;
}
function search(depth,alpha,beta){
 if(depth===0||game.game_over())return evaluate();
 const moves=game.moves({verbose:true});if(!moves.length)return evaluate();
 const maximizing=game.turn()==='b';let best=maximizing?-Infinity:Infinity;
 for(const m of moves){
  game.move({from:m.from,to:m.to,promotion:m.promotion||'q'});
  const score=search(depth-1,alpha,beta);game.undo();
  if(maximizing){best=Math.max(best,score);alpha=Math.max(alpha,best);}else{best=Math.min(best,score);beta=Math.min(beta,best);}
  if(beta<=alpha)break;
 }
 return best;
}
function chooseMove(depth){
 const moves=game.moves({verbose:true});if(!moves.length)return null;
 let best=-Infinity,candidates=[];
 for(const m of moves){
  game.move({from:m.from,to:m.to,promotion:m.promotion||'q'});
  let score=search(depth-1,-Infinity,Infinity);
  game.undo();
  // Sedikit variasi agar komputer tidak selalu memilih jalur identik.
  score+=Math.random()*5;
  if(score>best+0.01){best=score;candidates=[m];}else if(Math.abs(score-best)<0.01)candidates.push(m);
 }
 const m=candidates[Math.floor(Math.random()*candidates.length)];
 return {from:m.from,to:m.to,promotion:m.promotion||'q'};
}
function status(t){$('game-status').textContent=t;$('turn-indicator').textContent=game.turn()==='w'?'Giliran Putih':'Giliran Komputer';}
function statusText(){
 if(game.in_checkmate()){status(game.turn()==='w'?'Skakmat. Komputer menang.':'Skakmat. Anda menang!');return;}
 if(game.in_draw()){status('Remis. Permainan berakhir seri.');return;}
 if(game.in_check()){status(game.turn()==='w'?'Raja Anda skak!':'Raja komputer skak!');return;}
 status(game.turn()==='w'?'Giliran Anda. Silakan melangkah.':'Komputer selesai melangkah.');
}
function captured(){
 const start={p:8,n:2,b:2,r:2,q:1},counts={w:{p:0,n:0,b:0,r:0,q:0},b:{p:0,n:0,b:0,r:0,q:0}};
 game.board().flat().forEach(p=>{if(p&&p.type!=='k')counts[p.color][p.type]++;});
 const order=['q','r','b','n','p'];
 const lostBlack=order.map(t=>glyph['b'+t].repeat(Math.max(0,start[t]-counts.b[t]))).join('')||'—';
 const lostWhite=order.map(t=>glyph['w'+t].repeat(Math.max(0,start[t]-counts.w[t]))).join('')||'—';
 $('captured-black').textContent=lostBlack;$('captured-white').textContent=lostWhite;
}
$('new-game').addEventListener('click',()=>{game.reset();selected=null;legal=[];lastMove=null;busy=false;render();status('Giliran Anda. Silakan melangkah.');});
$('undo-move').addEventListener('click',()=>{if(busy)return;if(game.history().length){game.undo();if(game.turn()==='b'&&game.history().length)game.undo();selected=null;legal=[];lastMove=null;render();statusText();}});
$('flip-board').addEventListener('click',()=>{flipped=!flipped;render();});
$('difficulty').addEventListener('change',()=>{});
init();

// Immersive full-screen mode: native Fullscreen API on supported browsers,
// CSS fixed-viewport fallback for iOS Safari and browsers without Fullscreen API.
(function bindChessFullscreen(){
 const btn=document.getElementById('chess-fullscreen');
 const target=document.querySelector('.chess-layout');
 if(!btn||!target)return;
 const active=()=>!!(document.fullscreenElement===target || document.webkitFullscreenElement===target || target.classList.contains('chess-mobile-fullscreen'));
 const paint=()=>{btn.textContent=active()?'⛶ Keluar layar penuh':'⛶ Layar penuh';};
 async function toggle(){
  if(target.classList.contains('chess-mobile-fullscreen')){target.classList.remove('chess-mobile-fullscreen');document.body.classList.remove('chess-lock-scroll');paint();return;}
  if(document.fullscreenElement||document.webkitFullscreenElement){try{if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}catch(e){}paint();return;}
  try{
   if(target.requestFullscreen)await target.requestFullscreen();
   else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();
   else throw new Error('fallback');
  }catch(e){target.classList.add('chess-mobile-fullscreen');document.body.classList.add('chess-lock-scroll');}
  paint();
 }
 btn.addEventListener('click',toggle);
 document.addEventListener('fullscreenchange',paint);document.addEventListener('webkitfullscreenchange',paint);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&target.classList.contains('chess-mobile-fullscreen')){target.classList.remove('chess-mobile-fullscreen');document.body.classList.remove('chess-lock-scroll');paint();}});
 paint();
})();
})();