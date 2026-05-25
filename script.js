
'use strict';
// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
const SK = 'dsb_v6';
let S = {
  loggedIn: false,
  user: { name:'Diamondnaire', username:'@diamondnaire', av:'🧑', uid:null },
  tickets: 10, diamonds: 0, balance: 0.0, points: 0,
  wallet: false, walletAddr: '',
  settings: { sound:true, vibrate:true, notif:true },
  tasks: { wallet:false, channel:false, share:false },
  storyTs: 0, reactTs: 0, claimTs: 0,
  lbStart: Date.now(),
  isPremium: false
};
function save(){ try{ localStorage.setItem(SK, JSON.stringify(S)); }catch(e){} }
function load(){
  try{
    const d = localStorage.getItem(SK);
    if(d){ S = Object.assign(S, JSON.parse(d)); return true; }
  }catch(e){}
  return false;
}

// ═══════════════════════════════════════════════════════
//  SYMBOL SYSTEM
//  Grid layout (displayed in paytable):
//  Row 0:  🏆  💎  💵
//  Row 1:  👑  💸  🏅
//  Row 2:  🍿  💰  ⚡
//  Special: ♦️ (red diamond)
//
//  JACKPOT REWARDS (3 identical):
//  All → add POINTS (no raw dollar display per request)
//  💎 → special diamond jackpot
//  ⚡ → free respin
//  ♦️ → -10 pts
// ═══════════════════════════════════════════════════════
const SYMS = ['🏆','💎','💵','👑','💸','🏅','🍿','💰','⚡','♦️'];

// Points awarded for 3-match jackpot
const JK_PTS = {
  '🏆': 2400,
  '💎': 0,      // handled separately
  '💵': 360,    // dollar → pts
  '👑': 4500,
  '💸': 132,    // dollar → pts
  '🏅': 1800,
  '🍿': 3000,
  '💰': 1500,   // dollar → pts
  '⚡': 0,      // respin
  '♦️': -10     // deduction
};

// Weighted pool — diamond & dollar very rare; autospin makes them even rarer
function makePool(isAuto) {
  const weights = {
    '🏆':13, '💎': isAuto?1:4, '💵': isAuto?1:3,
    '👑':14, '💸': isAuto?1:3, '🏅':13,
    '🍿':14, '💰': isAuto?1:2, '⚡':9, '♦️':4
  };
  const pool = [];
  for(const [sym, w] of Object.entries(weights)){
    for(let i=0;i<w;i++) pool.push(sym);
  }
  return pool;
}

// ═══════════════════════════════════════════════════════
//  REEL ENGINE
//  Core design:
//  - Each reel shows EXACTLY 3 cells (top, middle, bottom)
//  - Middle cell = the "result" symbol
//  - On each spin: completely new random strip generated
//  - No two adjacent cells on the strip are identical
//  - Results guaranteed different from previous spin
// ═══════════════════════════════════════════════════════
const CELL_H = 42;       // px per cell
const STRIP_LEN = 40;    // symbols per strip

let strips   = [[], [], []];   // current symbol strips
let stopIdxs = [0,  0,  0 ];   // which strip index is the current "middle"
let prevMids = ['', '', ''];   // previous middle symbols (to ensure change)

let isSpinning = false;
let autoOn     = false;
let autoTimer  = null;

// Build a strip of N symbols with no two adjacent the same
function buildStrip(N, isAuto) {
  const pool = makePool(isAuto);
  const strip = [];
  for(let i=0; i<N; i++){
    let sym, tries=0;
    do {
      sym = pool[Math.floor(Math.random() * pool.length)];
      tries++;
    } while(strip.length > 0 && sym === strip[strip.length-1] && tries < 30);
    strip.push(sym);
  }
  return strip;
}

// Pick a new stop index such that the middle symbol differs from previous
function pickFreshStop(reelIdx, isAuto) {
  // Rebuild strip completely for true randomness each spin
  const newStrip = buildStrip(STRIP_LEN, isAuto);
  strips[reelIdx] = newStrip;
  const prev = prevMids[reelIdx];
  let candidate, tries=0;
  do {
    candidate = Math.floor(Math.random() * STRIP_LEN);
    tries++;
  } while(newStrip[candidate] === prev && tries < 40);
  return candidate;
}

// Get the middle symbol for reel r at current stopIdx
function getMid(r) {
  const idx = stopIdxs[r];
  const len = strips[r].length;
  return strips[r][(idx % len + len) % len];
}

// Render 3 static cells centred on stopIdx (top=idx-1, mid=idx, bot=idx+1)
function renderStatic(r, idx) {
  const track = document.getElementById('track' + r);
  track.innerHTML = '';
  const strip = strips[r];
  const len   = strip.length;
  for(let i=-1; i<=1; i++){
    const ci = ((idx + i) % len + len) % len;
    track.appendChild(makeCell(strip[ci]));
  }
}

// Create a single reel cell element
function makeCell(sym) {
  const d = document.createElement('div');
  d.className = 'rcell';
  if(sym === '♦️'){
    // Red diamond — styled red
    d.innerHTML = '<span style="color:#FF2222;filter:saturate(5) brightness(1.1)">♦️</span>';
  } else {
    d.textContent = sym;
  }
  return d;
}

// Smooth scrolling animation for one reel
// Renders 4 cells during animation for smooth sub-cell interpolation
function animateReel(r, durationMs, newStop, onDone) {
  const track  = document.getElementById('track' + r);
  const strip  = strips[r];
  const len    = strip.length;
  const t0     = performance.now();
  // Each reel scrolls through a different number of cells to stagger
  const totalScroll = 18 + r * 5; // r0=18, r1=23, r2=28

  function tick(now) {
    const elapsed  = now - t0;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease-out cubic — fast start, gentle stop
    const eased    = 1 - Math.pow(1 - progress, 3);
    const scrolled = eased * totalScroll;
    const cellsDone = Math.floor(scrolled);
    const frac      = scrolled - cellsDone; // 0..1 fractional offset

    // Top-visible index during animation
    const topIdx = ((newStop - (totalScroll - cellsDone) - 1) % len + len * 4) % len;

    track.innerHTML = '';
    // Render 4 cells (3 visible + 1 for smooth edge)
    for(let i=0; i<4; i++){
      const cell = makeCell(strip[(topIdx + i) % len]);
      // Shift upward by fractional amount for pixel-smooth scroll
      cell.style.transform = `translateY(${-frac * CELL_H}px)`;
      track.appendChild(cell);
    }

    if(progress < 1){
      requestAnimationFrame(tick);
    } else {
      // Snap to clean 3-cell static render
      stopIdxs[r] = newStop;
      renderStatic(r, newStop);
      onDone();
    }
  }
  requestAnimationFrame(tick);
}

// Initialise reels on game entry
function initReels() {
  for(let r=0; r<3; r++){
    strips[r]   = buildStrip(STRIP_LEN, false);
    stopIdxs[r] = Math.floor(Math.random() * STRIP_LEN);
    prevMids[r] = '';
    renderStatic(r, stopIdxs[r]);
  }
}

// ═══════════════════════════════════════════════════════
//  SPIN HANDLER
// ═══════════════════════════════════════════════════════
function handleSpin() {
  if(isSpinning) return;
  if(S.tickets <= 0){
    toast('Hey, Diamondnair 💎 tickets has finished!', 3000);
    openOv('shop');
    return;
  }
  doSpin(autoOn);
}

function doSpin(isAuto) {
  if(isSpinning) return;
  isSpinning = true;
  S.tickets--;
  updateHUD();

  const btn = document.getElementById('spinBtn');
  btn.classList.add('spinning');
  btn.textContent = '⏹ STOP';

  // Reset UI
  document.getElementById('wline').classList.remove('on');
  const wt = document.getElementById('winText');
  wt.style.display = 'none';
  wt.className = 'wt';

  // Pre-compute FRESH random stops for all 3 reels BEFORE animating
  const newStops = [
    pickFreshStop(0, isAuto),
    pickFreshStop(1, isAuto),
    pickFreshStop(2, isAuto)
  ];

  // Staggered stop times: reel 0 stops first, reel 2 last
  const stopTimes = [2000, 2800, 3600];
  let doneCount = 0;

  for(let r=0; r<3; r++){
    const reel  = r;
    const stop  = newStops[r];
    const ms    = stopTimes[r];
    animateReel(reel, ms, stop, () => {
      doneCount++;
      if(doneCount === 3) onAllStopped(isAuto);
    });
  }
}

function onAllStopped(isAuto) {
  isSpinning = false;
  const btn = document.getElementById('spinBtn');
  btn.classList.remove('spinning');
  btn.textContent = '▶ SPIN';

  // Record middles as "previous" for next spin
  const results = [getMid(0), getMid(1), getMid(2)];
  prevMids[0] = results[0];
  prevMids[1] = results[1];
  prevMids[2] = results[2];

  evaluate(results);

  if(autoOn){
    if(S.tickets <= 0){
      stopAuto();
      toast('Hey, Diamondnair 💎 tickets has finished! Going to shop...', 3000);
      setTimeout(() => openOv('shop'), 1600);
    } else {
      autoTimer = setTimeout(() => doSpin(true), 1500);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  EVALUATE RESULTS
// ═══════════════════════════════════════════════════════
function evaluate(res) {
  const wt = document.getElementById('winText');
  const wl = document.getElementById('wline');
  wt.style.display = 'block';

  const allSame = res[0] === res[1] && res[1] === res[2];
  const sym     = res[0];

  // ── JACKPOT: all 3 identical ──
  if(allSame){
    wl.classList.add('on');
    handleJackpot(sym);
    return;
  }

  // ── Not jackpot ──
  // Red diamond penalty (per symbol in result)
  const reds = res.filter(s => s === '♦️').length;
  if(reds > 0){
    const deduct = reds * 5;
    S.points = Math.max(0, S.points - deduct);
    wt.className = 'wt wt-b';
    wt.textContent = '♦️ Red Diamond! -' + deduct + ' pts';
    updateHUD(); save(); vibrate([60,30,60]);
    return;
  }

  // Diamond partial — having 💎 in result gives small bonus
  if(res.includes('💎')){
    let bonus = 120;
    res.filter(s => s !== '💎').forEach(s => {
      if(JK_PTS[s] > 0) bonus += Math.floor(JK_PTS[s] * 0.07);
    });
    S.points   += bonus;
    S.diamonds += 1;
    wt.className    = 'wt wt-g';
    wt.textContent  = '💎 Near! +' + bonus + ' pts +1💎';
    launchParticles('💎', false, 4);
    updateHUD(); save();
    return;
  }

  // 22% chance of small consolation for any near-miss
  if(Math.random() < 0.22){
    const vals = res.filter(s => JK_PTS[s] > 0);
    if(vals.length > 0){
      const pick  = vals[Math.floor(Math.random() * vals.length)];
      const bonus = Math.floor(JK_PTS[pick] * 0.06 + Math.random() * 60);
      S.points += bonus;
      wt.className   = 'wt wt-g';
      wt.textContent = pick + ' +' + bonus + ' pts';
      updateHUD(); save();
      return;
    }
  }

  wt.className   = 'wt wt-b';
  wt.textContent = 'No match — spin again!';
}

// ═══════════════════════════════════════════════════════
//  JACKPOT HANDLER
// ═══════════════════════════════════════════════════════
function handleJackpot(sym) {
  const wt = document.getElementById('winText');

  if(sym === '♦️'){
    S.points = Math.max(0, S.points - 10);
    wt.className   = 'wt wt-b';
    wt.textContent = '♦️♦️♦️ Red Diamond! -10 pts';
    updateHUD(); save(); vibrate([80,40,80]);
    return;
  }

  if(sym === '⚡'){
    // Free respin — refund ticket
    S.tickets++;
    wt.className   = 'wt wt-g';
    wt.textContent = '⚡⚡⚡ FREE RESPIN!';
    updateHUD(); save();
    setTimeout(() => doSpin(autoOn), 1100);
    return;
  }

  if(sym === '💎'){
    S.diamonds += 3;
    save(); updateHUD();
    launchParticles('💎', true, 18);
    showDJackpot('💎 DIAMOND JACKPOT! +3 💎');
    vibrate([100,50,100,50,200,50,200]);
    wt.style.display = 'none';
    return;
  }

  // All other symbols — add points
  const pts = JK_PTS[sym] || 200;
  S.points += pts;
  wt.className   = 'wt wt-j';
  wt.textContent = sym + sym + sym + ' JACKPOT! +' + pts + ' pts';
  showJK(sym + ' JACKPOT! +' + pts + ' pts');
  updateHUD(); save();
  vibrate([100, 50, 100]);
}

// ═══════════════════════════════════════════════════════
//  FLYING PARTICLES → avatar
// ═══════════════════════════════════════════════════════
function launchParticles(emoji, big, count) {
  const tEl = document.getElementById('gameAv') || document.getElementById('mainAv');
  if(!tEl) return;
  const tr = tEl.getBoundingClientRect();
  const tx = tr.left + tr.width  / 2;
  const ty = tr.top  + tr.height / 2;

  const src = document.getElementById('reelsWrap');
  if(!src) return;
  const sr = src.getBoundingClientRect();
  const sx = sr.left + sr.width  / 2;
  const sy = sr.top  + sr.height / 2;

  for(let i=0; i<count; i++){
    const el = document.createElement('div');
    el.className = 'flyp';
    el.textContent = emoji;
    el.style.fontSize = (big ? 1.1 : 0.75 + Math.random()*0.5) + 'rem';
    el.style.left     = (sx + (Math.random()-0.5)*80) + 'px';
    el.style.top      = (sy + (Math.random()-0.5)*40) + 'px';
    el.style.opacity  = '1';
    el.style.transform = 'scale(1)';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.left      = tx + 'px';
      el.style.top       = ty + 'px';
      el.style.opacity   = '0';
      el.style.transform = 'scale(0.15)';
      setTimeout(() => el.remove(), 900);
    }, i * 52);
  }
}

// ═══════════════════════════════════════════════════════
//  CELEBRATIONS
// ═══════════════════════════════════════════════════════
function showDJackpot(msg){
  const ov = document.getElementById('djovl');
  document.getElementById('djTxt').textContent = msg;
  ov.classList.add('on');
  mkConfetti(ov, 55);
  setTimeout(() => { ov.classList.remove('on'); clrConf(ov); }, 4200);
}
function showJK(msg){
  const ov = document.getElementById('jkovl');
  document.getElementById('jkbig').textContent = msg;
  ov.classList.add('on');
  mkConfetti(ov, 38);
  setTimeout(() => { ov.classList.remove('on'); clrConf(ov); }, 2800);
}
function mkConfetti(parent, n){
  const cols = ['#FFD700','#FF69B4','#00BFFF','#00FF88','#FF4500','#9B59B6'];
  for(let i=0; i<n; i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.cssText = 'left:' + (Math.random()*100) + '%;top:-8px;background:' +
      cols[i%cols.length] + ';animation-duration:' + (1.1+Math.random()*2) +
      's;animation-delay:' + (Math.random()*0.4) + 's;';
    parent.appendChild(c);
  }
}
function clrConf(p){ p.querySelectorAll('.confetti').forEach(c=>c.remove()); }

// ═══════════════════════════════════════════════════════
//  AUTO SPIN
// ═══════════════════════════════════════════════════════
function toggleAuto(){
  autoOn = !autoOn;
  const ab = document.getElementById('autoBadge');
  ab.textContent = 'AUTO\n' + (autoOn ? 'ON' : 'OFF');
  ab.className   = 'autobadge' + (autoOn ? ' on' : '');
  toast(autoOn ? '⚡ Auto-spin ON' : '⏹ Auto-spin OFF', 1200);
  if(autoOn && !isSpinning) doSpin(true);
  if(!autoOn && autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
}
function stopAuto(){
  autoOn = false;
  if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  const ab = document.getElementById('autoBadge');
  if(ab){ ab.textContent = 'AUTO\nOFF'; ab.className = 'autobadge'; }
}

// ═══════════════════════════════════════════════════════
//  HUD — update all displayed values
// ═══════════════════════════════════════════════════════
function updateHUD(){
  const map = [
    ['m_t','tickets'],['m_d','diamonds'],['m_b','balance'],['m_p','points'],
    ['g_t','tickets'],['g_b','balance'],['g_p','points']
  ];
  map.forEach(([id,k]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = k==='balance' ? parseFloat(S[k]).toFixed(2) : S[k];
  });
  ['mainAv','gameAv'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = S.user.av || '🧑';
  });
  save();
}

// ═══════════════════════════════════════════════════════
//  SCREENS
// ═══════════════════════════════════════════════════════
function showS(id){ const e=document.getElementById(id); e.style.display='flex'; e.classList.add('active'); }
function hideS(id){ const e=document.getElementById(id); e.style.display='none'; e.classList.remove('active'); }

function goGame(){
  if(S.tickets <= 0){ toast('Hey, Diamondnair 💎 tickets has finished!', 2500); openOv('shop'); return; }
  hideS('mainSc'); showS('gameSc'); updateHUD(); initReels();
}
function backMain(){ stopAuto(); hideS('gameSc'); showS('mainSc'); updateHUD(); }

// ═══════════════════════════════════════════════════════
//  OVERLAYS
// ═══════════════════════════════════════════════════════
const OV_RENDERERS = { lb:renderLB, shop:renderShop, airdrop:renderAirdrop,
                       notices:renderNotices, settings:renderSettings, prof:renderProf };
function openOv(id){
  document.getElementById(id).classList.add('active');
  if(OV_RENDERERS[id]) OV_RENDERERS[id]();
}
function closeOv(id){ document.getElementById(id).classList.remove('active'); }

// ─── LEADERBOARD ───
const LB_NPC = [
  {name:'CryptoKing',av:'👑',pts:45820},{name:'DiamondQueen',av:'💎',pts:38450},
  {name:'SpinMaster',av:'🎰',pts:31200},{name:'LuckyAce',av:'🃏',pts:22100},
  {name:'GoldRush',av:'🏆',pts:18700},{name:'StarPlayer',av:'⭐',pts:15400},
  {name:'NeonRider',av:'⚡',pts:12800},{name:'JackpotJoe',av:'💰',pts:9900},
  {name:'WildCard',av:'🎴',pts:7500},{name:'DiamondFan',av:'💠',pts:5300}
];
const MEDALS = ['🥇','🥈','🥉','🏅','🏅','🏅','🏅','🏅','🏅','🏅'];
const PRIZES = ['5🎟️','3🎟️','2🎟️','1🎟️','1🎟️','1🎟️','1🎟️'];

function renderLB(){
  const me = { name:S.user.name, av:S.user.av||'🧑', pts:S.points, isMe:true };
  const lb = [...LB_NPC, me].sort((a,b)=>b.pts-a.pts).slice(0,10);
  let h = '<div class="lbcdown"><div class="lbcdlbl">SEASON ENDS IN</div>' +
          '<div class="lbcdval" id="lbCd">—</div></div>';
  lb.forEach((p,i)=>{
    const cls = i===0?'r1':i===1?'r2':i===2?'r3':'';
    h += '<div class="lbrow '+cls+'" style="animation-delay:'+i*0.04+'s">' +
         '<span style="font-size:1rem;flex-shrink:0">'+MEDALS[i]+'</span>' +
         '<div class="lbav">'+p.av+'</div>' +
         '<div class="lbinfo"><div class="lbname">'+p.name+(p.isMe?' (You)':'')+'</div>' +
         '<div class="lbpts">🎖️ '+p.pts.toLocaleString()+'</div></div>' +
         '<div class="lbprize">'+(PRIZES[i]||'1🎟️')+'</div></div>';
  });
  document.getElementById('lbBody').innerHTML = h;
  updLBT();
}
function updLBT(){
  const el = document.getElementById('lbCd');
  if(!el) return;
  const rem = Math.max(0, S.lbStart + 7*864e5 - Date.now());
  const d=Math.floor(rem/864e5), h=Math.floor((rem%864e5)/36e5),
        m=Math.floor((rem%36e5)/6e4), s=Math.floor((rem%6e4)/1e3);
  el.textContent = d+'D '+p2(h)+':'+p2(m)+':'+p2(s);
}

// ─── SHOP ───
const SHOP = [
  {nm:'10 Tickets', ico:'🎟️', desc:'Starter pack', usd:'$0.66', stars:'⭐21', t:10},
  {nm:'19 Tickets', ico:'🎟️', desc:'Popular pack', usd:'$1.50', stars:'⭐43', t:19},
  {nm:'30 Tickets', ico:'🎟️', desc:'Value pack',   usd:'$3.00', stars:'⭐60', t:30},
  {nm:'60 Tickets', ico:'🎟️', desc:'Pro pack',     usd:'$5.00', stars:'⭐120',t:60},
  {nm:'Premium Pass',ico:'👑',desc:'Rare symbols + 30 tickets',usd:'$20.00',stars:'⭐1000',t:30,prem:true}
];
function renderShop(){
  let h = '<div class="shopsmoke"></div>';
  SHOP.forEach((it,i)=>{
    h += '<div class="shcard'+(it.prem?' prem':'')+'">' +
         '<div><div class="shnm">'+it.ico+' '+it.nm+'</div>' +
         '<div class="shdesc">'+it.desc+'</div></div>' +
         '<div style="text-align:right">' +
         '<div class="shusd">'+it.usd+'</div>' +
         '<div class="shstar">'+it.stars+'</div>' +
         '<button class="buybtn" onclick="buyIt('+i+')">BUY</button></div></div>';
  });
  document.getElementById('shopBody').innerHTML = h;
}
function buyIt(i){
  const it = SHOP[i];
  // Telegram Stars invoice (production: call bot backend)
  if(window.Telegram && Telegram.WebApp && Telegram.WebApp.openInvoice)
    toast('Opening Telegram Stars payment...', 2000);
  // Demo: grant directly
  S.tickets += it.t;
  if(it.prem) S.isPremium = true;
  updateHUD();
  toast('✅ '+it.t+'🎟️ added'+(it.prem?' + Premium!':''), 2500);
  closeOv('shop'); save();
}

// ─── AIRDROP ───
function renderAirdrop(){
  const wh = S.wallet
    ? '<div class="wtxt ok">✅ Wallet Connected<br><small style="color:#666">'+
      S.walletAddr.slice(0,8)+'...'+S.walletAddr.slice(-4)+'</small></div>'
    : '<div class="wtxt">Sorry Diamondnair, wallet not connected.</div>'+
      '<button class="connbtn" onclick="connW()">🔗 Connect Telegram Wallet</button>';

  const now = Date.now();
  const tasks = [
    {id:'wallet', ico:'💼', nm:'Connect your wallet',   rw:15, done:S.tasks.wallet},
    {id:'channel',ico:'📢', nm:'Follow our channel',    rw:15, done:S.tasks.channel},
    {id:'share',  ico:'👫', nm:'Share to 5 friends',    rw:40, done:S.tasks.share},
    {id:'story',  ico:'📖', nm:'Share to your story',   rw:15, ts:S.storyTs, h:24},
    {id:'react',  ico:'❤️', nm:'React to our channel',  rw:9,  ts:S.reactTs, h:24}
  ];

  let th = '';
  tasks.forEach(t => {
    let btn='CLAIM', dis=false, cd='';
    if(t.done){ btn='✅'; dis=true; }
    else if(t.ts){
      const rem = t.ts + t.h*36e5 - now;
      if(rem > 0){
        dis=true; btn='⏳';
        const hh=Math.floor(rem/36e5), mm=Math.floor((rem%36e5)/6e4), ss=Math.floor((rem%6e4)/1e3);
        cd = '<div class="tcd">'+p2(hh)+':'+p2(mm)+':'+p2(ss)+'</div>';
      }
    }
    th += '<div class="taskrow"><div class="tico">'+t.ico+'</div>' +
          '<div class="tinf"><div class="tnm">'+t.nm+'</div>' +
          '<div class="trw">+$'+t.rw+'</div>'+cd+'</div>' +
          '<button class="tdo'+(t.done?' done':'')+'" ' +
          (dis?'disabled style="opacity:.5"':'') +
          ' onclick="claimT(\''+t.id+'\','+t.rw+')">'+btn+'</button></div>';
  });
  document.getElementById('airdropBody').innerHTML =
    '<div style="font-size:2.4rem;text-align:center;margin-bottom:.5rem">📦</div>' +
    '<div class="wbox">'+wh+'</div>'+th;
}
function connW(){
  if(S.wallet) return;
  S.wallet=true;
  S.walletAddr='0x'+Math.random().toString(16).slice(2,14).toUpperCase();
  save(); renderAirdrop();
  if(!S.tasks.wallet) claimT('wallet',15);
  else toast('✅ Wallet connected!',2000);
}
function claimT(id, rw){
  const now = Date.now();
  if(id==='wallet'){
    if(!S.wallet){toast('Connect wallet first!',1500);return;}
    if(S.tasks.wallet) return;
    S.tasks.wallet=true; S.balance+=rw; toast('✅ +$'+rw+' for connecting wallet!',2000);
  } else if(id==='channel'){
    if(S.tasks.channel) return;
    window.open('https://t.me/boydonzbot','_blank');
    setTimeout(()=>{ S.tasks.channel=true; S.balance+=rw;
      toast('✅ +$'+rw+' for following!',2000); updateHUD(); save(); renderAirdrop(); },2000);
    return;
  } else if(id==='share'){
    if(S.tasks.share) return;
    window.open('https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fboydonzbot%2Fdiamondslotbox_1&text=Play%20Diamond%20Slotbox%20%F0%9F%92%8E%20Win%20big!','_blank');
    setTimeout(()=>{ S.tasks.share=true; S.balance+=rw;
      toast('✅ +$'+rw+' for sharing!',2000); updateHUD(); save(); renderAirdrop(); },2000);
    return;
  } else if(id==='story'){
    const rem = S.storyTs ? S.storyTs+24*36e5-now : 0;
    if(rem>0){toast('Please wait 24 hours before trying again.',2000);return;}
    S.storyTs=now; S.balance+=rw; toast('✅ +$'+rw+' story reward!',2000);
  } else if(id==='react'){
    const rem = S.reactTs ? S.reactTs+24*36e5-now : 0;
    if(rem>0){toast('Please wait 24 hours before trying again.',2000);return;}
    S.reactTs=now; S.balance+=rw; toast('✅ +$'+rw+' react reward!',2000);
  }
  updateHUD(); save(); setTimeout(renderAirdrop, 180);
}

// ─── NOTICES ───
const NOTICES = [
  {ico:'💎', msg:'Diamondnair, new diamond event! Spin now to win big!',time:'2h ago'},
  {ico:'🎟️', msg:'Leaderboard resets in 7 days. Climb the ranks!',    time:'5h ago'},
  {ico:'🎁', msg:'Premium Pass unlocks rare symbols. Check the shop!', time:'1d ago'}
];
function renderNotices(){
  const now = Date.now();
  const rem = S.claimTs ? Math.max(0, S.claimTs+4*36e5-now) : 0;
  const hh=Math.floor(rem/36e5), mm=Math.floor((rem%36e5)/6e4), ss=Math.floor((rem%6e4)/1e3);
  const rdy = rem===0;
  let h = '<div class="claimbox">' +
          '<div class="claimtitle">🎟️ FREE TICKETS — EVERY 4 HOURS</div>' +
          '<div class="claimtv" id="clTmr">'+(rdy?'Ready!':p2(hh)+':'+p2(mm)+':'+p2(ss))+'</div>' +
          '<button class="claimdo" id="clBtn" onclick="claimTix()" ' +
          (rdy?'':'disabled style="opacity:.5"')+'>CLAIM 5 🎟️</button></div>';
  NOTICES.forEach(n=>{
    h += '<div class="nitem"><span style="font-size:1.05rem;flex-shrink:0">'+n.ico+'</span>' +
         '<div><div class="nbody">'+n.msg+'</div><div class="ntime">'+n.time+'</div></div></div>';
  });
  document.getElementById('noticesBody').innerHTML = h;
}
function claimTix(){
  const now=Date.now();
  const rem=S.claimTs?Math.max(0,S.claimTs+4*36e5-now):0;
  if(rem>0){toast('Please wait before claiming again.',1500);return;}
  S.claimTs=now; S.tickets+=5; updateHUD(); save();
  toast('🎟️ 5 free tickets claimed!',2000); renderNotices();
}

// ─── SETTINGS ───
function renderSettings(){
  document.getElementById('settingsBody').innerHTML =
    '<div class="setprow" onclick="closeOv(\'settings\');openOv(\'prof\')">' +
    '<div class="setav">'+(S.user.av||'🧑')+'</div>' +
    '<div><div class="setuname">'+S.user.name+'</div>' +
    '<div class="setuid">'+S.user.username+'</div></div>' +
    '<span style="margin-left:auto;color:#888">→</span></div>' +
    '<div class="setseclbl">Audio & Haptics</div>' +
    '<div class="setrow"><span class="setrownm">🔊 Sound Effects</span>' +
    '<div class="tog'+(S.settings.sound?' on':'')+' " onclick="togS(\'sound\',this)"></div></div>' +
    '<div class="setrow"><span class="setrownm">📳 Vibration</span>' +
    '<div class="tog'+(S.settings.vibrate?' on':'')+' " onclick="togS(\'vibrate\',this)"></div></div>' +
    '<div class="setrow"><span class="setrownm">🔔 Notifications</span>' +
    '<div class="tog'+(S.settings.notif?' on':'')+' " onclick="togS(\'notif\',this)"></div></div>' +
    '<div class="setseclbl" style="margin-top:.65rem">Community</div>' +
    '<div class="setrow" onclick="window.open(\'https://t.me/boydonzbot\',\'_blank\')" style="cursor:pointer">' +
    '<span class="setrownm">✈️ Telegram Channel</span><span style="color:#888">→</span></div>' +
    '<div class="setseclbl" style="margin-top:.65rem">Account</div>' +
    '<button class="dangerbtn" onclick="delAcc()">🗑️ Delete Account</button>' +
    '<div class="setver">Diamond Slotbox v1.0.0 © 2025 Diamondnair</div>';
}
function togS(k,el){ S.settings[k]=!S.settings[k]; el.classList.toggle('on',S.settings[k]); save(); }
function delAcc(){
  if(confirm('Delete your Diamondnair account? This cannot be undone.')){
    localStorage.removeItem(SK); location.reload();
  }
}

// ─── PROFILE ───
const AVS = ['🧑','👨','👩','🧔','👱','🧑‍💻','🎭','🤖','👾','🦸'];
function renderProf(){
  document.getElementById('profBody').innerHTML =
    '<div class="profhdr">' +
    '<div class="profpic">'+(S.user.av||'🧑')+
    '<button class="profeditbtn" onclick="cycAv()">✏️</button></div>' +
    '<div class="profname">'+S.user.name+'</div>' +
    '<div class="profun">'+S.user.username+'</div></div>' +
    '<div class="profgrid">' +
    '<div class="profstat"><div class="profsv">'+S.tickets+'</div><div class="profsl">🎟️ Tickets</div></div>' +
    '<div class="profstat"><div class="profsv">'+S.diamonds+'</div><div class="profsl">💎 Diamonds</div></div>' +
    '<div class="profstat"><div class="profsv">$'+parseFloat(S.balance).toFixed(2)+'</div><div class="profsl">💲 Balance</div></div>' +
    '<div class="profstat"><div class="profsv">'+S.points+'</div><div class="profsl">🎖️ Points</div></div>' +
    '</div>' +
    '<div style="margin-top:.75rem;background:rgba(255,255,255,.04);border-radius:9px;padding:.65rem;">' +
    '<div style="font-size:.56rem;color:#888;letter-spacing:1px;margin-bottom:.28rem">WALLET</div>' +
    (S.wallet ?
      '<div style="color:#00FF88;font-size:.76rem">✅ '+S.walletAddr.slice(0,10)+'...'+S.walletAddr.slice(-4)+'</div>' :
      '<button onclick="closeOv(\'prof\');openOv(\'airdrop\')" style="background:rgba(0,136,204,.18);border:1px solid #0088cc;color:#fff;border-radius:7px;padding:.38rem .75rem;font-size:.7rem;cursor:pointer">🔗 Connect Wallet</button>')  +
    '</div>' +
    '<div style="margin-top:.55rem;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.12);border-radius:9px;padding:.55rem;">' +
    '<div style="font-size:.56rem;color:#888;margin-bottom:2px">STATUS</div>' +
    '<div style="font-size:.76rem;color:'+(S.isPremium?'#FFD700':'#888')+' ">'+(S.isPremium?'👑 Premium Member':'Standard Player')+'</div></div>';
}
function cycAv(){
  const i=AVS.indexOf(S.user.av||'🧑');
  S.user.av=AVS[(i+1)%AVS.length];
  save(); renderProf(); updateHUD();
}

// ═══════════════════════════════════════════════════════
//  TOAST & VIBRATE & UTILS
// ═══════════════════════════════════════════════════════
let _tt;
function toast(msg, dur=2000){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(_tt); _tt=setTimeout(()=>el.classList.remove('show'),dur);
}
function vibrate(p=[50]){ if(S.settings.vibrate && navigator.vibrate) navigator.vibrate(p); }
function p2(n){ return String(n).padStart(2,'0'); }

// ═══════════════════════════════════════════════════════
//  NETWORK CHECK
// ═══════════════════════════════════════════════════════
function initNet(){
  const el=document.getElementById('netErr');
  function chk(){
    if(!navigator.onLine){ el.style.display='flex'; }
    else { if(el.style.display==='flex'){ el.style.display='none'; toast('Connection restored, Diamondnair! 🌐',2000); } }
  }
  window.addEventListener('online', chk);
  window.addEventListener('offline', chk);
  setInterval(chk, 5000);
}

// ═══════════════════════════════════════════════════════
//  TIMERS
// ═══════════════════════════════════════════════════════
function startTimers(){
  setInterval(()=>{
    updLBT();
    const ct = document.getElementById('clTmr');
    if(ct){
      const now=Date.now(), rem=S.claimTs?Math.max(0,S.claimTs+4*36e5-now):0;
      if(rem===0){
        ct.textContent='Ready!'; ct.style.color='#00FF88';
        const cb=document.getElementById('clBtn');
        if(cb){ cb.disabled=false; cb.style.opacity='1'; }
      } else {
        const hh=Math.floor(rem/36e5),mm=Math.floor((rem%36e5)/6e4),ss=Math.floor((rem%6e4)/1e3);
        ct.textContent=p2(hh)+':'+p2(mm)+':'+p2(ss); ct.style.color='';
      }
    }
  }, 1000);
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
window.addEventListener('load', ()=>{
  load();
  initNet();

  // Telegram WebApp init
  if(window.Telegram && Telegram.WebApp){
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    const u = Telegram.WebApp.initDataUnsafe?.user;
    if(u){
      S.user.name = u.first_name || 'Diamondnair';
      S.user.uid  = u.id;
      if(!S.user.customUsername)
        S.user.username = '@diamondnair' + (u.id % 10000000000000);
      if(u.photo_url) S.user.photoUrl = u.photo_url;
    }
  }

  // Loading bar animation
  const steps=['Loading textures...','Building reels...','Connecting account...','Almost ready...','Welcome, Diamondnair! 💎'];
  let si=0;
  const bar=document.getElementById('lbar'), stat=document.getElementById('lstat');
  const iv=setInterval(()=>{
    si++;
    if(bar)  bar.style.width = (si/steps.length*100) + '%';
    if(stat && steps[si-1]) stat.textContent = steps[si-1];
    if(si >= steps.length) clearInterval(iv);
  }, 500);

  setTimeout(()=>{
    hideS('ldSc');
    if(S.loggedIn){ showS('mainSc'); updateHUD(); startTimers(); }
    else showS('authSc');
  }, 2900);
});

document.getElementById('tgBtn').addEventListener('click', ()=>{
  S.loggedIn = true;
  if(!S.user.uid){
    S.user.uid = Math.floor(Math.random() * 1e10);
    S.user.username = '@diamondnair' + S.user.uid;
  }
  save(); hideS('authSc'); showS('mainSc'); updateHUD(); startTimers();
  toast('Welcome, Diamondnair! 💎 Tap the machine to play!', 3000);
});

// Prevent accidental zoom/scroll on mobile
document.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
document.addEventListener('gesturestart', e=>e.preventDefault());
