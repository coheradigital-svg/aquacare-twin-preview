/* AquaCare Twin, v3. One scroll clock (Lenis + GSAP ScrollTrigger), each scene reads only its own progress.
   Nothing is fixed on screen except the header and the ambient light, so a scene can never hang over the next. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const html = document.documentElement;
const DATA = JSON.parse($('#data').textContent);
const G = window.gsap, ST = window.ScrollTrigger, LENIS = window.Lenis;
const RM = html.classList.contains('rm');
const FINE = matchMedia('(pointer: fine)').matches;
const wantPin = () => !RM && G && ST && innerWidth >= 1024 && innerHeight >= 600;
clearTimeout(window.__fail);
html.classList.remove('no-lib');
if (wantPin()) html.classList.add('pin');
const PIN = () => html.classList.contains('pin');
if (G && ST) G.registerPlugin(ST);

/* ---------------------------------------------------------------- smooth scroll */
let lenis = null;
if (!RM && LENIS && G && ST && FINE) {
  lenis = new LENIS({ lerp: 0.11, wheelMultiplier: 0.95 });
  lenis.on('scroll', ST.update);
  G.ticker.add(t => lenis.raf(t * 1000));
  G.ticker.lagSmoothing(0);
}
function goTo(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
}
$$('a[data-scroll]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (!id || id[0] !== '#') return;
  e.preventDefault(); closeMenu(); goTo($(id));
  history.replaceState(null, '', id);
}));

/* ---------------------------------------------------------------- header */
const menuBtn = $('.menu-btn'), nav = $('#nav-main');
function closeMenu() { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => {
  const o = !nav.classList.contains('open');
  nav.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', String(o));
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const navLinks = $$('#nav-main a');
const lightEls = $$('.scene.light');
function headerState() {
  const y = 26;
  let light = false;
  for (const s of lightEls) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) { light = true; break; } }
  if (!light) { const b = $('#bialo'); const r = b.getBoundingClientRect(); if (r.top < -r.height * 0.3 && r.bottom > y) light = true; }
  html.classList.toggle('on-light', light);
  let cur = null;
  for (const a of navLinks) { const s = $(a.getAttribute('href')); if (!s) continue; const r = s.getBoundingClientRect(); if (r.top <= innerHeight * 0.4) cur = a; }
  navLinks.forEach(a => a.setAttribute('aria-current', a === cur ? 'true' : 'false'));
}

/* ---------------------------------------------------------------- ambient light (WebGL) */
const TINTS = { aqua: [0.20, 0.55, 1.0], blue: [0.18, 0.42, 0.95], green: [0.20, 0.75, 0.55], steel: [0.45, 0.55, 0.72], sylc: [0.22, 0.80, 0.50], powder: [0.3, 0.6, 1.0] };
const BG = { tint: [0.2, 0.55, 1.0], target: [0.2, 0.55, 1.0], fade: 1, gl: null };
function initGL() {
  const cv = $('#bg');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) { html.classList.add('no-gl'); return; }
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;uniform vec2 r;uniform float t,s;uniform vec3 c;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
  float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.);
   float sc=s*.00035;
   vec2 w=vec2(fb(q*1.3+vec2(t*.018,-t*.012+sc)),fb(q*1.3+vec2(-t*.014,t*.016-sc)));
   float f=fb(q*1.6+w*1.4+vec2(0.,sc*1.5));
   float a=smoothstep(.35,.95,f);
   float top=smoothstep(.15,1.05,uv.y)*.75+.25;
   vec3 base=vec3(.012,.018,.032);
   vec3 col=base+c*a*.34*top+c*pow(a,3.)*.22;
   float caust=pow(abs(sin((q.x*7.+w.y*6.)+t*.25)*sin((q.y*6.-w.x*5.)-t*.2)),9.)*.07;
   col+=mix(c,vec3(1.),.5)*caust*a;
   float v=1.-smoothstep(.35,1.25,length(uv-vec2(.5,.55)));
   col*=.55+.45*v;
   gl_FragColor=vec4(col,1.);}`;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { html.classList.add('no-gl'); return; }
  // dust: points drifting slowly, parallax with scroll
  const pvs = `attribute vec3 a;uniform float t,s,asp;uniform vec2 r;varying float al;
   void main(){vec3 p=a;float y=fract(p.y+t*.004*(.4+p.z)+s*.00006*(.3+p.z));float x=fract(p.x+sin(t*.05+p.y*9.)*.01);
   gl_Position=vec4(x*2.-1.,y*2.-1.,0.,1.);gl_PointSize=(1.+p.z*2.6)*(r.y/900.);al=(.18+.55*p.z)*smoothstep(0.,.15,y)*smoothstep(1.,.8,y);}`;
  const pfs = `precision mediump float;uniform vec3 c;varying float al;void main(){vec2 d=gl_PointCoord-.5;float m=smoothstep(.5,.0,length(d));gl_FragColor=vec4(mix(c,vec3(1.),.6)*m*al,1.);}`;
  const pp = gl.createProgram();
  gl.attachShader(pp, sh(gl.VERTEX_SHADER, pvs)); gl.attachShader(pp, sh(gl.FRAGMENT_SHADER, pfs)); gl.linkProgram(pp);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const N = innerWidth < 720 ? 160 : 420, pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pts[i * 3] = Math.random(); pts[i * 3 + 1] = Math.random(); pts[i * 3 + 2] = Math.pow(Math.random(), 2.2); }
  const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const u = { r: U(pr, 'r'), t: U(pr, 't'), s: U(pr, 's'), c: U(pr, 'c') }, v = { r: U(pp, 'r'), t: U(pp, 't'), s: U(pp, 's'), c: U(pp, 'c') };
  const aP = gl.getAttribLocation(pr, 'p'), aA = gl.getAttribLocation(pp, 'a');
  const scale = innerWidth < 720 ? 0.5 : 0.6;
  function size() { const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } }
  BG.gl = (time) => {
    size();
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.r, cv.width, cv.height); gl.uniform1f(u.t, time); gl.uniform1f(u.s, scrollY); gl.uniform3fv(u.c, BG.tint);
    gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(aP);
    gl.useProgram(pp);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(v.r, cv.width, cv.height); gl.uniform1f(v.t, time); gl.uniform1f(v.s, scrollY); gl.uniform3fv(v.c, BG.tint);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(aA);
  };
  html.classList.add('gl');
}
try { initGL(); } catch (err) { html.classList.add('no-gl'); }
const tintScenes = $$('[data-tint]');
function tintTarget() {
  const mid = innerHeight * 0.5;
  for (const s of tintScenes) { if (s.id === 'hero' && PIN()) continue; const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) return s.dataset.tint === 'powder' && PW.color ? PW.color : TINTS[s.dataset.tint]; }
  return null;
}

/* ---------------------------------------------------------------- scene progress (one source: ScrollTrigger) */
const prog = {};
function track(id) {
  const el = $(`#${id} .track`) || $(`.${id}-track`);
  if (!el || !ST) return;
  ST.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: s => { prog[id] = s.progress; } , onRefresh: s => { prog[id] = s.progress; } });
}
['hero', 'princip', 'dve-kameri', 'razglobyavane', 'sylc', 'bialo'].forEach(track);
const P = id => prog[id] || 0;
const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > -40 && r.top < innerHeight + 40; };

/* ---------------------------------------------------------------- hero */
const heroCopy = $('.hero-copy'), heroDev = $('.hero-dev-wrap'), heroFig = $('.hero-fig'), heroSticky = $('.hero-sticky'), facts = $('#hero .facts');
const prSec = $('#princip'), prTrack = $('#princip .track');
function uiHero() {
  if (!PIN()) { heroCopy.style.cssText = heroDev.style.transform = heroSticky.style.opacity = heroFig.style.filter = ''; return; }
  const p = P('hero');
  const a = ss(0.0, 0.42, p);
  heroCopy.style.transform = `translate3d(0, ${-a * 90}px, 0)`;
  heroCopy.style.opacity = String(1 - ss(0.04, 0.36, p));
  facts.style.opacity = String(1 - ss(0.0, 0.2, p));
  // one continuous camera move across the hero and the arrival of the next scene: the hero pins for 1.3 screens,
  // then the jet scene rises over it for 1 screen. u runs 0..1 over both, so the zoom never stops at the seam.
  const t = clamp(1 - prSec.getBoundingClientRect().top / innerHeight);
  const u = (p * 1.3 + t) / 2.3;
  const z = ss(0.02, 0.62, u), sc = 1 + 2.1 * ss(0.02, 1, u) + 0.25 * P('princip');
  heroDev.style.transform = `translate3d(${-12 * z * sc}%, ${5 * z * sc}%, 0) translateY(${-z * 16}vh) scale(${sc})`;
  heroDev.style.opacity = '';
  // the device goes soft and dark behind the glass of the next scene, and stays there as its backdrop
  const b = ss(0.42, 1, u);
  heroFig.style.filter = b > 0.002 ? `blur(${(b * 18).toFixed(2)}px) brightness(${(1 - b * 0.62).toFixed(3)}) saturate(${(1 - b * 0.35).toFixed(3)})` : '';
  // once the jet scene is done the backdrop fades as the page moves on
  const out = clamp((innerHeight - prTrack.getBoundingClientRect().bottom) / innerHeight);
  heroSticky.style.opacity = String(1 - out * 0.85);
}

/* ---------------------------------------------------------------- princip: the jet */
const pr = { sec: $('#princip'), cv: $('#princip .jet-cv'), stage: $('#princip .jet-stage'), out: $('#princip .tip-out'), tip: $('#princip .tip-wrap'),
  jt: $('#princip .jt'), hit: $('#princip .jt-hit'), labels: $$('#princip .jl'), steps: $$('#princip .ped-step'), plate: $('#princip .pedal-plate') };
const pg = pr.cv.getContext('2d');
const JP = [];
for (let i = 0; i < 360; i++) JP.push({ s: Math.random(), r: Math.random() * 2 - 1, v: 0.55 + Math.random() * 0.7, L: i < 200 ? 2 : (i < 300 ? 1 : 0), z: Math.random() });
const SPL = [];
let jetState = { a: 0, f: 0, p: 0, step: -1 };
function setPedal(step) {
  if (step === jetState.step) return;
  jetState.step = step;
  pr.steps.forEach((s, i) => s.classList.toggle('on', i === step));
  pr.plate.style.transform = `rotate(${[0, 7, 14][Math.max(0, step)]}deg)`;
}
function jetTargets(t) {
  if (PIN()) {
    const p = P('princip');
    const st = p < 0.36 ? 0 : (p < 0.62 ? 1 : 2);
    setPedal(p < 0.1 ? -1 : st);
    pr.tip.style.transform = `translate3d(${(1 - ss(0.0, 0.12, p)) * 40}%, ${(1 - ss(0.0, 0.12, p)) * -10}%, 0) rotate(42deg)`;
    pr.tip.style.opacity = String(ss(0.0, 0.1, p));
    pr.jt.style.opacity = String(ss(0.05, 0.16, p));
    return { a: ss(0.12, 0.2, p), f: ss(0.38, 0.46, p), p: ss(0.64, 0.72, p) };
  }
  // phones and reduced motion: the three positions cycle while the scene is on screen
  const st = RM ? 2 : Math.floor(t / 2.6) % 3;
  setPedal(st);
  return { a: 1, f: st >= 1 ? 1 : 0, p: st >= 2 ? 1 : 0 };
}
function drawJet(t, dt) {
  const tg = jetTargets(t);
  const k = 1 - Math.pow(0.002, dt);
  jetState.a = lerp(jetState.a, tg.a, k); jetState.f = lerp(jetState.f, tg.f, k); jetState.p = lerp(jetState.p, tg.p, k);
  const dpr = Math.min(devicePixelRatio || 1, 2), R = pr.stage.getBoundingClientRect();
  const W = R.width, H = R.height;
  if (pr.cv.width !== Math.round(W * dpr)) { pr.cv.width = Math.round(W * dpr); pr.cv.height = Math.round(H * dpr); }
  const g = pg; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const o = pr.out.getBoundingClientRect(), jr = pr.jt.getBoundingClientRect();
  const ox = o.left + 1 - R.left, oy = o.top + 1 - R.top;
  const hx = jr.left + jr.width * 0.72 - R.left, hy = jr.top + jr.height * 0.42 - R.top;  // the buccal surface of the crown
  const dx0 = hx - ox, dy0 = hy - oy, len = Math.hypot(dx0, dy0), dx = dx0 / len, dy = dy0 / len, nx = -dy, ny = dx;
  const r0 = 4, r1 = len * 0.12;
  const pt = (s, w) => [ox + dx * s * len + nx * w, oy + dy * s * len + ny * w];
  const band = (w0, w1, fill, stroke, a, dash) => {
    if (a < 0.01) return;
    const A = pt(0, w0), B = pt(1, w1), C = pt(1, -w1), D = pt(0, -w0);
    g.save(); g.globalAlpha = a;
    const grd = g.createLinearGradient(ox, oy, hx, hy); grd.addColorStop(0, fill); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.fillStyle = grd; g.fill();
    g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = 1;
    g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.moveTo(...D); g.lineTo(...C); g.stroke();
    g.restore();
  };
  const A = jetState.a, F = jetState.f, Pw = jetState.p;
  band(r0 * 2.6, r1 * 1.6, 'rgba(255,255,255,.07)', 'rgba(255,255,255,.28)', A, [2, 6]);
  band(r0 * 1.9, r1 * 1.15, 'rgba(110,190,255,.30)', 'rgba(150,210,255,.6)', F);
  band(r0 * 1.0, r1 * 0.55, 'rgba(255,255,255,.22)', 'rgba(255,255,255,.0)', Pw);
  g.globalCompositeOperation = 'lighter';
  for (const q of JP) {
    const a = q.L === 2 ? Pw : (q.L === 1 ? F : A);
    if (a < 0.02) continue;
    const s = (q.s + t * 0.34 * q.v) % 1;
    const wmax = q.L === 2 ? lerp(r0, r1 * 0.55, s) : (q.L === 1 ? lerp(r0 * 1.8, r1 * 1.1, s) : lerp(r0 * 2.5, r1 * 1.55, s));
    const w = q.L === 2 ? q.r * wmax : Math.sign(q.r || 1) * wmax * (0.84 + 0.14 * Math.abs(q.r));
    const [x, y] = pt(s, w);
    g.globalAlpha = a * (q.L === 2 ? 0.95 : 0.6) * (0.35 + 0.65 * s);
    g.fillStyle = q.L === 2 ? '#ffffff' : (q.L === 1 ? '#9fd6ff' : '#dfe8f3');
    const rad = q.L === 2 ? 1.1 + q.z * 1.4 : 1.1;
    g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
    if (q.L === 2 && s > 0.97 && Math.random() < 0.5 * Pw) SPL.push({ x: hx, y: hy, vx: (-dx + (Math.random() - 0.5) * 1.6) * (40 + Math.random() * 90), vy: (-dy + (Math.random() - 0.5) * 1.6) * (40 + Math.random() * 90), l: 1 });
  }
  for (let i = SPL.length - 1; i >= 0; i--) {
    const sp = SPL[i]; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 60 * dt; sp.l -= dt * 1.6;
    if (sp.l <= 0) { SPL.splice(i, 1); continue; }
    g.globalAlpha = sp.l * 0.8; g.fillStyle = '#e8f6ff'; g.beginPath(); g.arc(sp.x, sp.y, 1.2, 0, 6.283); g.fill();
  }
  if (SPL.length > 400) SPL.splice(0, SPL.length - 400);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  pr.hit.style.opacity = String(Pw * (0.75 + 0.25 * Math.sin(t * 9)));
  // the three labels sit on their layer, half way along the jet
  const hw = (s, w0, w1) => lerp(w0, w1, s);
  const L = [[0.34, hw(0.34, r0 * 2.6, r1 * 1.6) + 16], [0.56, hw(0.56, r0 * 1.9, r1 * 1.15) + 16], [0.62, -(hw(0.62, r0, r1 * 0.55) + 26)]];
  pr.labels.forEach((el, i) => {
    const on = [A, F, Pw][i] > 0.5;
    el.classList.toggle('on', on);
    const [x, y] = pt(L[i][0], -L[i][1]);
    el.style.transform = `translate3d(${x + (i === 2 ? -60 : 10)}px, ${y - 10}px, 0)`;
  });
  // a soft bloom where the jet leaves the tip
  if (F + Pw > 0.05) { const b = g.createRadialGradient(ox, oy, 0, ox, oy, 60); b.addColorStop(0, `rgba(170,220,255,${0.35 * Math.max(F, Pw)})`); b.addColorStop(1, 'rgba(170,220,255,0)'); g.fillStyle = b; g.fillRect(ox - 60, oy - 60, 120, 120); }
}

/* ---------------------------------------------------------------- dve kameri: one camera, four stops */
const dk = { view: $('#dve-kameri .dk-view'), cam: $('#dve-kameri .dk-cam'), steps: $$('#dve-kameri .dk-step'), dots: $$('#dve-kameri .dk-dots li'),
  spots: $$('#dve-kameri .spot'), tags: $$('#dve-kameri .g-tag, #dve-kameri .c-tag'), dim: $('#dve-kameri .dk-dim'), k: -1 };
function uiChambers() {
  if (!PIN()) { dk.cam.style.transform = ''; return; }
  const p = P('dve-kameri');
  const k = p < 0.24 ? 0 : (p < 0.46 ? 1 : (p < 0.66 ? 2 : 3));
  if (k !== dk.k) {
    dk.k = k;
    dk.steps.forEach(s => s.classList.toggle('on', +s.dataset.k === k));
    dk.dots.forEach((d, i) => d.classList.toggle('on', i === k));
    dk.spots.forEach(s => s.classList.toggle('on', +s.dataset.k === k));
  }
  const V = dk.view.getBoundingClientRect(), img = dk.cam.getBoundingClientRect();
  const w0 = dk.cam.offsetWidth, h0 = dk.cam.offsetHeight;
  const camTop = (V.height - h0) / 2, camLeft = dk.cam.offsetLeft;
  dk.cam.classList.toggle('k3', k === 3);
  const z = ss(0.68, 0.84, p), s = 1 + z * 0.9;
  const fx = 0.48, fy = 0.564;                               // the gauges and knobs of the front shot
  const tx = (V.width / 2 - (camLeft + fx * w0 * s)) * z, ty = (V.height / 2 - (camTop + fy * h0 * s)) * z;
  dk.cam.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
  // the spotlight: dims everything but the active chamber
  const sp = k === 1 ? [0.193, 0.44] : (k === 2 ? [0.733, 0.44] : null);
  if (sp) {
    dk.dim.style.setProperty('--sx', `${(camLeft + sp[0] * w0) / V.width * 100}%`); dk.dim.style.setProperty('--sy', `${(camTop + sp[1] * h0) / V.height * 100}%`);
    dk.dim.style.setProperty('--sr', '17%'); dk.dim.style.setProperty('--sa', '.62');
  } else dk.dim.style.setProperty('--sa', '0');
  for (const tg of dk.tags) {
    const [ax, ay] = tg.dataset.at.split(',').map(Number);
    const x = camLeft + tx + ax * w0 * s, y = ty + camTop + ay * h0 * s;
    tg.style.left = x + 'px'; tg.style.top = y + 'px';
    const on = +tg.dataset.k === k && (k < 3 || z > 0.95);
    tg.classList.toggle('on', on);
  }
}

/* ---------------------------------------------------------------- parts */
const rz = { parts: $$('#razglobyavane .part'), imgs: $$('#razglobyavane .rz-img'), i: -1 };
function uiParts() {
  if (!PIN()) return;
  const p = P('razglobyavane'), n = rz.parts.length;
  const i = Math.min(n - 1, Math.floor(ss(0.04, 0.98, p) * n));
  if (i === rz.i) return;
  rz.i = i;
  rz.parts.forEach((el, j) => el.classList.toggle('on', j === i));
  rz.imgs.forEach((el, j) => el.classList.toggle('on', j === i));
}
rz.parts.forEach((el, j) => $('.part-h', el).addEventListener('click', () => {
  if (!PIN()) return;
  const tr = $('#razglobyavane .track'), top = tr.getBoundingClientRect().top + scrollY, len = tr.offsetHeight - innerHeight, n = rz.parts.length;
  const y = top + len * (0.04 + 0.94 * (j + 0.5) / n);
  if (lenis) lenis.scrollTo(y, { duration: 1.1 }); else scrollTo({ top: y, behavior: 'smooth' });
}));

/* ---------------------------------------------------------------- powders: horizontal rail, a splash for each */
const PW = { track: $('#prahove .pw-track'), slides: $$('#prahove .pw-slide'), pips: $$('#prahove .pw-pips li'), detail: $('#prahove .pw-detail'),
  prev: $('#prahove .paddle.prev'), next: $('#prahove .paddle.next'), i: -1, color: null, burst: 0, parts: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nb = s => esc(s).replace(/(\d) (µm|bar|mm|g|ml|€|секунди)/g, '$1&nbsp;$2');
function renderPowder(i) {
  const d = DATA.powders[i];
  const comb = d.combine.map(c => `<li>${nb(c.t)}${c.s ? `<p class="src">${esc(c.s)}</p>` : ''}</li>`).join('');
  const caut = d.caution.map(c => `<p class="pd-warn">${nb(c.t)}</p>`).join('');
  PW.detail.style.setProperty('--pc', d.jet);
  PW.detail.innerHTML = `<div class="pd-grid pd-in">
    <div class="pd-col"><h4>За какво се използва</h4><p class="big">${nb(d.for)}</p><dl class="pd-meta"><dt>Камера</dt><dd>${esc(d.chamber)}</dd><dt>Размер на частиците</dt><dd>${nb(d.particle)}</dd></dl>
      <div class="pd-buy"><span class="pd-price">${nb(d.price)}</span><span class="src">${esc(d.pack)} · ${esc(d.sku)} · ${esc(d.stock)}</span></div>
      <p style="margin-top:10px"><a class="lk lk-sm" href="${esc(d.url)}" target="_blank" rel="noopener"><span>${esc(DATA.link)}</span><svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 8 8.5 3.5M4.5 3.5h4v4"/></svg></a></p></div>
    <div class="pd-col"><h4>Какво го отличава</h4><p>${nb(d.special)}</p><h4 style="margin-top:22px">Настройки</h4><p>${nb(d.settings)}</p>${d.settings_src ? `<p class="src">Източник: ${esc(d.settings_src)}</p>` : ''}${caut}</div>
    <div class="pd-col"><h4>Как го използват колегите</h4><ul>${comb}</ul>${d.tm ? `<p class="src">${esc(d.tm)}</p>` : ''}</div>
  </div>`;
}
function setPowder(i, scroll) {
  i = clamp(i, 0, PW.slides.length - 1);
  if (scroll) {
    const sl = PW.slides[i];
    PW.track.scrollTo({ left: sl.offsetLeft - (PW.track.clientWidth - sl.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' });
  }
  if (i === PW.i) return;
  PW.i = i;
  PW.slides.forEach((s, j) => { s.classList.toggle('on', j === i); $('.pw-btn', s).setAttribute('aria-pressed', String(j === i)); });
  PW.pips.forEach((p, j) => p.classList.toggle('on', j === i));
  PW.prev.disabled = i === 0; PW.next.disabled = i === PW.slides.length - 1;
  const hex = DATA.powders[i].jet, n = parseInt(hex.slice(1), 16);
  PW.color = [(n >> 16 & 255) / 255 * 0.8, (n >> 8 & 255) / 255 * 0.8, (n & 255) / 255 * 0.8];
  renderPowder(i);
  burst(i);
}
function nearest() {
  const c = PW.track.scrollLeft + PW.track.clientWidth / 2;
  let best = 0, bd = 1e9;
  PW.slides.forEach((s, j) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - c); if (d < bd) { bd = d; best = j; } });
  return best;
}
let pwT = 0;
PW.track.addEventListener('scroll', () => { cancelAnimationFrame(pwT); pwT = requestAnimationFrame(() => setPowder(nearest(), false)); }, { passive: true });
PW.slides.forEach((s, j) => $('.pw-btn', s).addEventListener('click', () => setPowder(j, true)));
PW.prev.addEventListener('click', () => setPowder(PW.i - 1, true));
PW.next.addEventListener('click', () => setPowder(PW.i + 1, true));
PW.track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { setPowder(PW.i + 1, true); e.preventDefault(); } if (e.key === 'ArrowLeft') { setPowder(PW.i - 1, true); e.preventDefault(); } });
// mouse drag on the rail (touch already scrolls natively)
if (FINE) {
  let down = null;
  PW.track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, l: PW.track.scrollLeft, moved: false }; PW.track.style.scrollSnapType = 'none'; });
  addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 6) down.moved = true; PW.track.scrollLeft = down.l - dx; });
  addEventListener('pointerup', () => { if (!down) return; const moved = down.moved; down = null; PW.track.style.scrollSnapType = ''; setPowder(nearest(), true); if (moved) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; PW.track.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => PW.track.removeEventListener('click', stop, { capture: true }), 50); } });
}
function burst(i) {
  PW.burst = performance.now();
  const s = PW.slides[i], cv = $('.splash', s);
  PW.parts = [];
  const n = RM ? 0 : 520;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = 0.1 + Math.pow(Math.random(), 1.3) * 0.95;
    PW.parts.push({ a, sp, r: 0.7 + Math.pow(Math.random(), 2) * 4.2, d: Math.random(), w: Math.random() * 6.28 });
  }
  PW.cv = cv;
}
function drawSplash(t) {
  const cv = PW.cv; if (!cv) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const e = (performance.now() - PW.burst) / 1000, hex = DATA.powders[PW.i].jet;
  const cx = W / 2, cy = H * 0.56, R = Math.min(W, H) * 0.5;
  // a soft cloud of the powder's colour behind the cartridge
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
  glow.addColorStop(0, hex + 'aa'); glow.addColorStop(0.35, hex + '44'); glow.addColorStop(1, hex + '00');
  g.fillStyle = glow; g.globalAlpha = ss(0, 0.5, e); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  const ex = 1 - Math.pow(1 - clamp(e / 1.3), 3);                 // ease out of the burst
  for (const q of PW.parts) {
    const dist = R * (0.18 + q.sp * ex) + Math.sin(t * 0.6 + q.w) * 4;
    const x = cx + Math.cos(q.a + t * 0.03 * (q.d - 0.5)) * dist, y = cy + Math.sin(q.a + t * 0.03 * (q.d - 0.5)) * dist * 0.82 + e * 2 * q.d;
    g.globalAlpha = (0.35 + 0.65 * q.d) * (1 - 0.4 * ss(0.8, 3, e));
    g.fillStyle = q.d > 0.85 ? '#ffffff' : hex;
    g.beginPath(); g.arc(x, y, q.r, 0, 6.283); g.fill();
  }
}

/* ---------------------------------------------------------------- sylc: into the tooth */
const sy = { stage: $('#sylc .sy-stage'), cv: $('#sylc .sy-cv'), L: {}, steps: $$('#sylc .sy-steps li'), caps: $$('#sylc .sy-cap span'), parts: [] };
['tooth', 'sec', 'open', 'sealed', 'adh'].forEach(k => sy.L[k] = $(`#sylc .ty-${k}`));
for (let i = 0; i < 220; i++) sy.parts.push({ x: Math.random(), y: Math.random(), v: 0.4 + Math.random(), r: 0.8 + Math.random() * 2 });
function lay(el, o, s, x = 0, y = 0, blur = 0, origin) {
  if (!el) return;
  el.style.opacity = o.toFixed(3);
  el.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${s.toFixed(4)})`;
  if (origin) el.style.transformOrigin = origin;
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
  el.style.visibility = o < 0.003 ? 'hidden' : 'visible';
}
function uiSylc(t) {
  if (!PIN()) { Object.values(sy.L).forEach(el => el && (el.style.cssText = '')); return; }
  const p = P('sylc');
  // 1 the tooth, then the camera dives in: tooth -> section -> dentin -> sealed -> clean surface
  const toothOut = ss(0.2, 0.32, p);
  lay(sy.L.tooth, 1 - toothOut, 1 + ss(0.12, 0.32, p) * 0.9, 0, 0, toothOut * 10, '50% 45%');
  const secIn = ss(0.22, 0.32, p), secOut = ss(0.44, 0.52, p);
  lay(sy.L.sec, secIn * (1 - secOut), lerp(0.7, 1, secIn) + ss(0.34, 0.52, p) * 1.25, 0, 0, secOut * 12, '42% 48%');
  const opIn = ss(0.46, 0.54, p), opOut = ss(0.64, 0.74, p);
  lay(sy.L.open, opIn * (1 - opOut * 0.0), lerp(0.55, 1, opIn) + ss(0.54, 0.8, p) * 0.08, 0, 0, (1 - opIn) * 10);
  const seIn = ss(0.64, 0.74, p), seOut = ss(0.82, 0.88, p);
  lay(sy.L.sealed, seIn * (1 - seOut), 1 + ss(0.54, 0.8, p) * 0.08, 0, 0, 0);
  if (sy.L.open) sy.L.open.style.opacity = String(opIn * (1 - seOut));
  const adIn = ss(0.84, 0.92, p);
  lay(sy.L.adh, adIn, lerp(0.92, 1, adIn), 0, 0, (1 - adIn) * 8);
  const step = p < 0.42 ? 0 : (p < 0.82 ? 1 : 2);
  sy.steps.forEach((s, i) => s.classList.toggle('on', i === step));
  const cap = p < 0.24 ? 0 : (p < 0.48 ? 1 : (p < 0.66 ? 2 : (p < 0.86 ? 3 : 4)));
  sy.caps.forEach((c, i) => c.classList.toggle('on', i === cap));
  // green Sylc particles settle on the dentin while the tubules close
  const a = ss(0.5, 0.58, p) * (1 - ss(0.76, 0.84, p));
  const cv = sy.cv, dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (a > 0.01) {
    g.globalCompositeOperation = 'lighter';
    for (const q of sy.parts) {
      const yy = (q.y + t * 0.07 * q.v) % 1, x = W * (0.12 + 0.76 * q.x) + Math.sin(t + q.y * 20) * 6;
      g.globalAlpha = a * (0.3 + 0.6 * yy) * 0.85;
      g.fillStyle = yy > 0.8 ? '#d9ffe8' : '#53cf86';
      g.beginPath(); g.arc(x, H * (0.08 + 0.8 * yy), q.r, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}

/* ---------------------------------------------------------------- bridge: dark to light */
const br = { fig: $('#bialo .br-fig'), copy: $('#bialo .br-copy'), sec: $('#bialo') };
function uiBridge() {
  const bg = $('#bg');
  const r = br.sec.getBoundingClientRect();
  if (PIN()) {
    const p = P('bialo');
    br.fig.style.opacity = String(ss(0.2, 0.6, p));
    br.fig.style.transform = `translate3d(0, ${(1 - ss(0.2, 0.7, p)) * 90}px, 0) scale(${lerp(0.94, 1, ss(0.2, 0.8, p))})`;
    br.copy.style.opacity = String(ss(0.42, 0.7, p));
    br.copy.style.transform = `translate3d(0, ${(1 - ss(0.42, 0.75, p)) * 30}px, 0)`;
    BG.fade = r.top > 0 ? 1 : 1 - ss(0.15, 0.55, p);
  } else {
    const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
    BG.fade = r.top > innerHeight * 0.2 ? 1 : 1 - ss(0.0, 0.6, p);
  }
  if (r.bottom < 0) BG.fade = 0;
  bg.style.opacity = BG.fade.toFixed(3);
}

/* ---------------------------------------------------------------- frame loop */
let last = performance.now(), clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!RM) clock += dt;
  headerState();
  uiHero(); uiChambers(); uiParts(); uiBridge();
  if (onScreen(pr.sec)) drawJet(clock, dt);
  if (onScreen($('#sylc'))) uiSylc(clock);
  if (PW.cv && onScreen($('#prahove'))) drawSplash(clock);
  const tt = tintTarget();
  if (tt) BG.target = tt;
  const k = 1 - Math.pow(0.08, dt);
  BG.tint = BG.tint.map((v, i) => lerp(v, BG.target[i], k));
  if (BG.gl && BG.fade > 0.01 && (!RM || !frame.once)) { BG.gl(clock + 20); frame.once = true; }
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- flow parts: reveal, counter, filters, FAQ, video, form */
const rvSel = ['.notes3 .note-col', '#prilozheniya .mx-group', '.notfor', '.cta-in > *', '.case-lead', '.case-bg', '.ch-top', '.chm', '.win', '.md-stage', '.md-scroll', '.box-grid li', '.cons', '.tl-b', '.ac-vis', '.ac-txt', '.qa', '.demo-copy', '.demo-fig', '.study > *', '.part', '.dk-step', '.sy-stage', '.pw-head > *', '.video'];
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
if (!RM) $$(rvSel.join(',')).forEach((el, i) => {
  if (PIN() && el.closest('.sticky')) return;
  el.classList.add('rv'); el.style.transitionDelay = `${(i % 4) * 0.06}s`; io.observe(el);
});
const cnt = $('.count');
if (cnt) new IntersectionObserver((es, o) => es.forEach(en => {
  if (!en.isIntersecting) return; o.disconnect();
  if (RM) return;
  const to = +cnt.dataset.to, t0 = performance.now();
  const step = n => { const k = clamp((n - t0) / 1600); cnt.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), { threshold: 0.5 }).observe(cnt);
$$('.seg button').forEach(b => b.addEventListener('click', () => {
  $$('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const c = b.dataset.cat;
  $$('.case-in').forEach(li => { li.hidden = !!c && !li.dataset.cats.split(' ').includes(c); });
  $('.intl').scrollTo({ left: 0, behavior: 'smooth' });
}));
$$('.qa button').forEach(b => b.addEventListener('click', () => {
  const o = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(o)); $('#' + b.getAttribute('aria-controls')).hidden = !o;
  if (ST) ST.refresh();
}));
const vid = $('.v-media[data-src]');
if (vid && !RM) new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) { if (!vid.src) vid.src = vid.dataset.src; vid.play().catch(() => {}); } else vid.pause();
}), { threshold: 0.25 }).observe(vid);
const form = $('#demo-form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const bad = $$('[required]', form).filter(x => (x.type === 'checkbox' ? !x.checked : !x.value.trim()));
  $$('[required]', form).forEach(x => x.setAttribute('aria-invalid', String(bad.includes(x))));
  const msg = $('.form-msg', form);
  if (bad.length) { msg.hidden = false; msg.textContent = 'Попълнете полетата със звездичка.'; bad[0].focus(); return; }
  msg.hidden = false; msg.textContent = DATA.success;
});

/* ---------------------------------------------------------------- start */
setPowder(0, false);
addEventListener('resize', () => {
  const want = wantPin();
  if (want !== PIN()) { html.classList.toggle('pin', want); }
  if (ST) ST.refresh();
});
addEventListener('load', () => ST && ST.refresh());
requestAnimationFrame(() => { html.classList.add('ready'); requestAnimationFrame(frame); });
/* hooks for the QA scripts */
window.__lenis = lenis;
window.__geo = new Proxy({}, { get: (_, id) => { const sec = document.getElementById(id); if (!sec) return null; const tr = sec.querySelector('.track') || document.querySelector(`.${id}-track`); const top = sec.getBoundingClientRect().top + scrollY; if (tr && PIN()) { const t = tr.getBoundingClientRect().top + scrollY; return { top, trTop: t, trH: tr.offsetHeight }; } return { top, trH: 0 }; } });
window.__at = (id, p) => { const g = window.__geo[id]; return g.trTop + p * (g.trH - innerHeight); };
setTimeout(() => { window.__ready = true; }, 600);

/* ---------------------------------------------------------------- demo: the device from every side */
{
  const fig = $('#demo .vw');
  if (fig) {
    const imgs = $$('.vw-img', fig), btns = $$('.vw-btn', fig), cap = $('.vw-cap', fig);
    const show = (i, focus) => {
      imgs.forEach((im, j) => { im.classList.toggle('on', j === i); im.toggleAttribute('aria-hidden', j !== i); if (j === i) im.loading = 'eager'; });
      btns.forEach((b, j) => { const on = j === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      cap.textContent = btns[i].getAttribute('aria-label');
      if (focus) btns[i].focus();
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => show(i));
      b.addEventListener('keydown', ev => {
        const n = btns.length;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); show((i + (ev.key === 'ArrowRight' ? 1 : n - 1)) % n, true); }
      });
    });
    // preload the other views once the section is near, so a switch never waits
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { imgs.forEach(im => { im.loading = 'eager'; }); io.disconnect(); } }, { rootMargin: '600px' });
    io.observe(fig);
  }
}
