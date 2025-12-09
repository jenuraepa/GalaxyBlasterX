/* Galaxy Blaster X - Game Logic */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width, H = canvas.height;

function resizeCanvasToDisplay() {
  W = canvas.width = 900;
  H = canvas.height = 500;
}
resizeCanvasToDisplay();

// Audio Setup
const AudioCtx = (window.AudioContext || window.webkitAudioContext);
let audioCtx = null;
let soundOn = true;
function ensureAudio() {
  if (!audioCtx && AudioCtx && soundOn) audioCtx = new AudioCtx();
}
function playBeep(freq = 300, time=0.06, type='sine', vol=0.07) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
  setTimeout(()=>{ o.stop(); }, time*1000 + 10);
}
function playExplosion() {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'triangle';
  o.frequency.value = 120;
  g.gain.value = 0.08;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  const now = audioCtx.currentTime;
  o.frequency.linearRampToValueAtTime(30, now + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  setTimeout(()=> o.stop(), 450);
}

// State
let state = 'menu';
let score = 0;
let highScore = Number(localStorage.getItem('gbx_high') || 0);

// Player
const player = {
  x: W/2, y: H/2, r: 16, speed: 3.4, vx: 0, vy: 0, hp: 100, maxHp: 100, color: '#39ffbf', hitFlash: 0
};

// Entities
let bullets = []; 
let enemies = []; 
let particles = []; 

// Controls
const keys = {};
window.addEventListener('keydown', (e)=>{
  keys[e.key.toLowerCase()] = true;
  if (!audioCtx && AudioCtx) { try { audioCtx = new AudioCtx(); audioCtx.suspend && audioCtx.suspend(); } catch(e){} }
});
window.addEventListener('keyup', (e)=>{ keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('click', (e)=> {
  if (state === 'menu') startGame();
  else if (state === 'playing') shoot();
});

// Touch
const tLeft = document.getElementById('tLeft'), tRight = document.getElementById('tRight'), tUp = document.getElementById('tUp'), tDown = document.getElementById('tDown'), tShoot = document.getElementById('tShoot');
let touchState = {left:false,right:false,up:false,down:false,shoot:false};
function bindTouch(btn, prop) {
    if(!btn) return;
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); btn.classList.add('active'); touchState[prop]=true; });
    btn.addEventListener('touchend', (e)=>{ e.preventDefault(); btn.classList.remove('active'); touchState[prop]=false; });
}
bindTouch(tLeft, 'left'); bindTouch(tRight, 'right'); bindTouch(tUp, 'up'); bindTouch(tDown, 'down'); bindTouch(tShoot, 'shoot');

// UI
const scoreBox = document.getElementById('scoreBox');
const hpFill = document.getElementById('hpFill');
const btnStart = document.getElementById('btnStart');
const startBtn = document.getElementById('startBtn');
const overlayStart = document.getElementById('overlayStart');
const overlayGameOver = document.getElementById('overlayGameOver');
const finalScore = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const bestTxt = document.getElementById('bestTxt');
const btnMute = document.getElementById('btnMute');

bestTxt.innerText = highScore;
scoreBox.innerText = 'Score: 0 • High: ' + highScore;

btnStart.addEventListener('click', ()=>{ if (state === 'menu') startGame(); });
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', ()=> resetAndStart());
menuBtn.addEventListener('click', ()=> showMenu());
btnMute.addEventListener('click', ()=>{ soundOn = !soundOn; btnMute.textContent = soundOn ? '🔊' : '🔇'; });

window.addEventListener('keydown', (e)=>{
  if (e.key.toLowerCase() === 'r') resetAndStart();
  else if (e.key === 'Escape') showMenu();
  else if (e.key === ' ') { e.preventDefault(); if (state === 'menu') startGame(); if (state === 'playing') shoot(); }
});

// Logic
let spawnTimer = 0;
let spawnInterval = 1250;
let lastTime = performance.now();

function startGame(){
  overlayStart.style.display = 'none'; overlayGameOver.style.display = 'none';
  state = 'playing'; score = 0; player.x = W/2; player.y = H/2; player.hp = player.maxHp; player.hitFlash = 0;
  bullets = []; enemies = []; particles = []; spawnTimer = 0; spawnInterval = 1300;
  lastTime = performance.now();
  playBeep(500,0.08,'sawtooth',0.08);
}

function resetAndStart(){
  state = 'playing'; overlayGameOver.style.display = 'none'; score = 0; player.hp = player.maxHp;
  bullets = []; enemies = []; particles = []; spawnInterval = 1300;
  player.x = W/2; player.y = H/2;
  playBeep(700,0.08,'sine',0.08);
}

function showMenu(){
  state = 'menu'; overlayStart.style.display = 'flex'; overlayGameOver.style.display = 'none';
}

let lastShoot = 0;
const shootCooldown = 160;
function shoot() {
  const now = performance.now();
  if (now - lastShoot < shootCooldown) return;
  lastShoot = now;
  playBeep(900,0.05,'square',0.06);
  let mx = lastMouse.x || (player.x); let my = lastMouse.y || (player.y - 40);
  const dx = mx - player.x, dy = my - player.y;
  const len = Math.hypot(dx,dy) || 1;
  const speed = 7.5;
  bullets.push({x:player.x, y:player.y, vx:(dx/len)*speed, vy:(dy/len)*speed, life: 1200, r:4});
}

let lastMouse = {x: W/2, y: H/2};
canvas.addEventListener('mousemove', (e)=>{
  const rect = canvas.getBoundingClientRect();
  lastMouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  lastMouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener('mousedown', (e)=> { if (state === 'playing') shoot(); });

function spawnEnemy() {
  const edge = Math.floor(Math.random()*4);
  let x,y;
  if (edge === 0) { x = -30; y = Math.random()*H; }
  else if (edge === 1) { x = W + 30; y = Math.random()*H; }
  else if (edge === 2) { x = Math.random()*W; y = -30; }
  else { x = Math.random()*W; y = H + 30; }
  const size = 12 + Math.random()*18;
  const hp = Math.round(size/6) + 1;
  const spd = 0.6 + Math.random()*1.6 + Math.min(score/1200, 1.6);
  enemies.push({x,y,r:size,spd,hp,hit:0});
}

function spawnExplosion(x,y,count=14,color='#ffb86b') {
  playExplosion();
  for (let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const sp = 1 + Math.random()*3;
    particles.push({x,y,vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life: 600 + Math.random()*600, size: 2 + Math.random()*3, color});
  }
}

function update(dt){
  if (state !== 'playing') return;
  let ax=0, ay=0;
  if (keys['w']||keys['arrowup']||touchState.up) ay -= 1;
  if (keys['s']||keys['arrowdown']||touchState.down) ay += 1;
  if (keys['a']||keys['arrowleft']||touchState.left) ax -= 1;
  if (keys['d']||keys['arrowright']||touchState.right) ax += 1;
  if (touchState.shoot) shoot();
  if (ax !== 0 || ay !== 0) {
    const mag = Math.hypot(ax,ay) || 1;
    player.vx = (ax/mag) * player.speed; player.vy = (ay/mag) * player.speed;
  } else { player.vx = 0; player.vy = 0; }
  player.x += player.vx; player.y += player.vy;
  const pad = 12; player.x = Math.max(pad, Math.min(W-pad, player.x)); player.y = Math.max(pad, Math.min(H-pad, player.y));

  for (let i = bullets.length-1; i>=0;i--){
    const b = bullets[i]; b.x += b.vx; b.y += b.vy; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > W+20 || b.y < -20 || b.y > H+20) { bullets.splice(i,1); continue; }
  }

  for (let i = enemies.length-1; i>=0; i--){
    const e = enemies[i];
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx,dy) || 1;
    e.x += (dx/dist) * e.spd; e.y += (dy/dist) * e.spd;
    e.hit = Math.max(0, e.hit - dt*0.01);
    if (dist < e.r + player.r - 4) {
      player.hp -= 8 + Math.floor(e.r/6); player.hitFlash = 10;
      e.x -= (dx/dist) * 20; e.y -= (dy/dist) * 20;
      if (player.hp <= 0) { player.hp = 0; endGame(); }
    }
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const ddx = b.x - e.x, ddy = b.y - e.y;
      if (ddx*ddx + ddy*ddy < (b.r + e.r)*(b.r + e.r)) {
        bullets.splice(j,1); e.hp -= 1; e.hit = 6; score += 35; spawnExplosion(b.x, b.y, 8, '#ffd88a');
        if (e.hp <= 0) { enemies.splice(i,1); spawnExplosion(e.x, e.y, 18, '#ff8aa1'); score += 80; }
        break;
      }
    }
  }

  for (let i = particles.length-1; i>=0; i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life -= dt; p.size *= 0.997;
    if (p.life <= 0 || p.size < 0.3) particles.splice(i,1);
  }

  spawnTimer += dt;
  if (spawnTimer > spawnInterval) {
    spawnTimer = 0; spawnEnemy();
    spawnInterval = Math.max(400, spawnInterval - 10 * Math.min(1, score/1200));
  }
  score += Math.floor(dt * 0.02 * (1 + Math.min(2, score/1000)));
  player.hitFlash = Math.max(0, player.hitFlash - dt*0.03);

  scoreBox.innerText = 'Score: ' + Math.floor(score) + ' • High: ' + highScore;
  hpFill.style.width = (player.hp/player.maxHp*100) + '%';
  hpFill.style.background = (player.hp < player.maxHp*0.35) ? 'linear-gradient(90deg,var(--danger),#ff8a6f)' : '';
}

function endGame(){
  state = 'gameover'; finalScore.innerText = 'Score: ' + Math.floor(score);
  overlayGameOver.style.display = 'flex'; overlayStart.style.display = 'none';
  if (score > highScore) {
    highScore = Math.floor(score); localStorage.setItem('gbx_high', highScore);
    bestTxt.innerText = highScore; playBeep(1000,0.12,'sine',0.12);
  } else { playBeep(220,0.12,'sine',0.06); }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawStars();
  for (let p of particles) {
    ctx.globalAlpha = Math.max(0.12, Math.min(1, p.life/800)); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let e of enemies) {
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = e.hit ? '#ffd7d7' : '#ff6b88';
    ctx.beginPath(); ctx.moveTo(e.r,0);
    for (let i=1;i<7;i++){
      const a = (i/7)*Math.PI*2; const rr = e.r * (i%2 ? 0.9 : 1.3); ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(57,255,191,0.07)'; ctx.beginPath(); ctx.arc(0,0,player.r + 18,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = player.hitFlash ? '#ffdddf' : player.color;
  ctx.beginPath(); ctx.moveTo(0,-player.r); ctx.lineTo(player.r, player.r); ctx.lineTo(-player.r, player.r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#083544'; ctx.beginPath(); ctx.arc(0, -4, player.r*0.45, 0, Math.PI*2); ctx.fill(); ctx.restore();
  for (let b of bullets) { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); }
}

let starCache = [];
function initStars() {
  starCache = [];
  for (let i=0;i<160;i++){ starCache.push({x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.6, tw: Math.random()*0.8 + 0.2}); }
}
function drawStars(){
  if (!starCache.length) initStars();
  ctx.fillStyle = '#081526'; ctx.fillRect(0,0,W,H);
  for (let s of starCache) {
    ctx.globalAlpha = 0.5 + Math.sin(Date.now()*0.001*s.tw)*0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop(now) {
  const dt = Math.min(40, now - lastTime); lastTime = now;
  update(dt); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

overlayStart.style.display = 'flex'; overlayGameOver.style.display = 'none';
for (let i=0;i<3;i++) spawnEnemy();
scoreBox.innerText = 'Score: 0 • High: ' + highScore;
bestTxt.innerText = highScore;
canvas.addEventListener('touchstart', ()=> { if (!audioCtx && AudioCtx && soundOn) { try { audioCtx = new AudioCtx(); audioCtx.resume && audioCtx.resume(); } catch(e){} } });
window.addEventListener('resize', ()=> initStars());