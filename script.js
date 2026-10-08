(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const stage = $('#stage');
  const svg = $('#mainSVG');
  const sceneParallax = $('#sceneParallax');
  const stageGlow = $('.stage-glow');
  const logoGroup = $('#logoGroup');
  const campusIcon = $('#campusIcon');
  const wordmark = $('#campusWord');
  const letters = $$('.letter', wordmark);
  const plus = $('#plus');
  const plusHalo = $('#plusHalo');
  const plusRing = $('#plusRing');
  const arc = $('#arc');
  const arcBloom = $('#arcBloom');
  const orbitGhost = $('#orbitGhost');
  const comet = $('#comet');
  const particlesGroup = $('#particles');
  const starfield = $('#starfield');
  const heroTitle = $('.hero-copy h1');
  const heroSubtitle = $('.hero-copy p');
  const caption = $('.stage-caption');
  const logoHitArea = $('#logoHitArea');
  const plusHitArea = $('#plusHitArea');
  const status = $('#sceneStatus');
  const pauseButton = $('#pauseButton');
  const replayButton = $('#replayButton');
  const soundButton = $('#soundButton');
  const soundLabel = $('.sound-button span');
  const dialog = $('#detailDialog');
  const dialogContent = $('#dialogContent');
  const closeDialog = $('#closeDialog');

  let introTl;
  let holdTl;
  let pulseTl;
  let isPaused = false;
  let isLogoHover = false;
  let isPlusHover = false;
  let starEls = [];
  let particleEls = [];
  let pathLength = 1;
  let cometProgress = { value: 0 };
  let lastSparkAt = 0;
  let audioContext;
  let soundGain;
  let soundOn = false;
  let pointerTarget = { x: 0, y: 0 };
  let pointerCurrent = { x: 0, y: 0 };
  let pointerInsideStage = false;

  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function buildStarfield() {
    const count = window.innerWidth < 600 ? 17 : 31;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement('span');
      const cross = i % 9 === 0;
      star.className = cross ? 'star cross' : 'star';
      star.style.left = `${random(5, 95)}%`;
      star.style.top = `${random(10, 79)}%`;
      if (!cross) {
        const size = random(1, 2.5);
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
      }
      fragment.appendChild(star);
    }
    starfield.appendChild(fragment);
    starEls = $$('.star', starfield);
  }

  function buildParticles() {
    const count = window.innerWidth < 600 ? 13 : 22;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const isStreak = i % 5 === 0;
      const el = document.createElementNS(SVG_NS, isStreak ? 'rect' : 'circle');
      const angle = random(0, Math.PI * 2);
      const distance = random(40, 122);
      el.dataset.dx = String(Math.cos(angle) * distance);
      el.dataset.dy = String(Math.sin(angle) * distance);
      el.dataset.delay = String(random(0, .16));
      el.classList.add('particle');
      if (isStreak) {
        el.classList.add('streak');
        el.setAttribute('x', '817');
        el.setAttribute('y', '238');
        el.setAttribute('width', String(random(8, 20)));
        el.setAttribute('height', String(random(.6, 1.5)));
        el.setAttribute('rx', '1');
      } else {
        if (i % 4 === 0) el.classList.add('diamond');
        el.setAttribute('cx', '817');
        el.setAttribute('cy', '239');
        const size = random(1.3, 3.1);
        el.setAttribute('r', String(size));
      }
      fragment.appendChild(el);
    }
    particlesGroup.appendChild(fragment);
    particleEls = $$('.particle', particlesGroup);
  }

  function setPathState() {
    const previousLength = pathLength || 1;
    const previousOffset = parseFloat(arc.style.strokeDashoffset);
    const previousProgress = Number.isFinite(previousOffset)
      ? clamp(1 - previousOffset / previousLength, 0, 1)
      : 0;
    pathLength = arc.getTotalLength ? arc.getTotalLength() : 1000;
    [arc, arcBloom].forEach((path) => {
      path.style.strokeDasharray = `${pathLength} ${pathLength}`;
      path.style.strokeDashoffset = pathLength * (1 - previousProgress);
    });
  }

  function setCometPosition(progress) {
    if (!arc.getTotalLength) return;
    const safeProgress = clamp(progress, 0, 1);
    const length = pathLength * safeProgress;
    const point = arc.getPointAtLength(length);
    const previous = arc.getPointAtLength(Math.max(0, length - 2));
    const angle = Math.atan2(point.y - previous.y, point.x - previous.x) * 180 / Math.PI;
    comet.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`);
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function killTimelines() {
    if (introTl) introTl.kill();
    if (holdTl) holdTl.kill();
    if (pulseTl) pulseTl.kill();
    gsap.killTweensOf([sceneParallax, logoGroup, campusIcon, wordmark, letters, plus, plusHalo, plusRing, arc, arcBloom, orbitGhost, comet, particleEls, stageGlow, heroTitle, heroSubtitle, caption]);
  }

  function resetScene() {
    killTimelines();
    isPaused = false;
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.setAttribute('aria-label', 'Pause animation');
    $('#pauseShape').setAttribute('d', 'M7 5v10M13 5v10');
    setPathState();
    cometProgress.value = 0;
    setCometPosition(0);
    gsap.set(stageGlow, { opacity: 0 });
    gsap.set(sceneParallax, { attr: { transform: 'translate(0 0)' } });
    gsap.set(logoGroup, { opacity: 1, x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(campusIcon, { opacity: 0, scale: .78, y: 8, transformOrigin: '50% 50%' });
    gsap.set(letters, { opacity: 0, y: 14, scale: .94, transformOrigin: '50% 50%' });
    gsap.set(plus, { opacity: 0, scale: .12, y: 9, transformOrigin: '50% 50%' });
    gsap.set(plusHalo, { opacity: 0, scale: .65, transformOrigin: '50% 50%' });
    gsap.set(plusRing, { opacity: 0, attr: { r: 34 } });
    gsap.set(arc, { opacity: 1, strokeDashoffset: pathLength });
    gsap.set(arcBloom, { opacity: 0, strokeDashoffset: pathLength });
    gsap.set(orbitGhost, { opacity: 0 });
    gsap.set(comet, { opacity: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(starEls, { opacity: 0 });
    gsap.set(particleEls, { opacity: 0, x: 0, y: 0, scale: .2, rotation: 0 });
    gsap.set([heroTitle, heroSubtitle], { opacity: 0, y: 8 });
    gsap.set(caption, { opacity: 0, y: 4 });
    setStatus('THE INTRO');
  }

  function makeParticleBurst() {
    const burst = gsap.timeline();
    particleEls.forEach((particle) => {
      const dx = Number(particle.dataset.dx);
      const dy = Number(particle.dataset.dy);
      const delay = Number(particle.dataset.delay);
      burst.fromTo(particle,
        { opacity: 0, scale: .25, x: 0, y: 0, rotation: 0 },
        { opacity: random(.25, .9), scale: random(.7, 1.35), x: dx, y: dy, rotation: random(-75, 75), duration: random(.6, .95), ease: 'power2.out' },
        delay
      );
      burst.to(particle, { opacity: 0, scale: .1, duration: random(.32, .55), ease: 'power2.in' }, delay + random(.48, .68));
    });
    return burst;
  }

  function makeMicroBurst() {
    if (prefersReducedMotion.matches) return;
    const burst = gsap.timeline();
    particleEls.slice(0, 7).forEach((particle, index) => {
      const angle = (Math.PI * 2 * index) / 7 + random(-.2, .2);
      const distance = random(19, 40);
      burst.fromTo(particle,
        { opacity: 0, scale: .2, x: 0, y: 0 },
        { opacity: .8, scale: .85, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, duration: .4, ease: 'power2.out' },
        index * .018
      ).to(particle, { opacity: 0, scale: 0, duration: .25 }, index * .018 + .25);
    });
    return burst;
  }

  function enterHold() {
    setStatus('THE HOLD');
    if (prefersReducedMotion.matches) return;
    holdTl = gsap.timeline({ repeat: -1, yoyo: true });
    holdTl.to(logoGroup, { scale: 1.008, duration: 3.1, ease: 'sine.inOut' }, 0)
      .to(arcBloom, { opacity: .67, duration: 3.1, ease: 'sine.inOut' }, 0)
      .to(plusHalo, { opacity: .19, scale: 1.06, duration: 3.1, ease: 'sine.inOut' }, 0);
  }

  function playReducedIntro() {
    introTl = gsap.timeline({ onComplete: enterHold });
    introTl.to(stageGlow, { opacity: .72, duration: .3, ease: 'power1.out' })
      .to(arc, { strokeDashoffset: 0, duration: .55, ease: 'power2.out' }, .06)
      .to(arcBloom, { strokeDashoffset: 0, opacity: .4, duration: .55, ease: 'power2.out' }, .06)
      .to(plus, { opacity: 1, scale: 1, y: 0, duration: .22, ease: 'power1.out' }, .25)
      .to(letters, { opacity: 1, y: 0, scale: 1, duration: .3, stagger: .025, ease: 'power1.out' }, .29)
      .to(campusIcon, { opacity: 1, scale: 1, y: 0, duration: .25, ease: 'power1.out' }, .35)
      .to([heroTitle, heroSubtitle, caption], { opacity: 1, y: 0, duration: .3, stagger: .04, ease: 'power1.out' }, .46)
      .to(starEls, { opacity: .2, duration: .4, stagger: .02 }, .2);
  }

  function playCampusIntro() {
    resetScene();
    if (prefersReducedMotion.matches) {
      playReducedIntro();
      return;
    }

    introTl = gsap.timeline({ onComplete: enterHold });
    introTl.to(stageGlow, { opacity: .95, duration: .85, ease: 'power2.out' }, 0)
      .to(starEls, { opacity: .3, duration: .95, stagger: .035, ease: 'power1.out' }, .28)
      .to(orbitGhost, { opacity: .22, duration: .7, ease: 'power1.out' }, .42)
      .to(arc, { strokeDashoffset: 0, duration: 1.55, ease: 'power2.inOut' }, .62)
      .to(arcBloom, { strokeDashoffset: 0, opacity: .6, duration: 1.55, ease: 'power2.inOut' }, .62)
      .to(comet, { opacity: 1, duration: .12 }, .68)
      .to(cometProgress, { value: 1, duration: 1.68, ease: 'power2.inOut', onUpdate: () => setCometPosition(cometProgress.value) }, .7)
      .to(comet, { scale: 1.45, opacity: 0, duration: .18, ease: 'power2.out', onStart: () => {
        gsap.fromTo(stageGlow, { opacity: 1.1 }, { opacity: .82, duration: .5, ease: 'power2.out' });
      } }, 2.3)
      .to(plusHalo, { opacity: .17, scale: 1, duration: .32, ease: 'power2.out' }, 2.34)
      .fromTo(plus, { opacity: 0, scale: .1, y: 10 }, { opacity: 1, scale: 1.12, y: 0, duration: .46, ease: 'back.out(2.2)' }, 2.34)
      .to(plus, { scale: 1, duration: .28, ease: 'power2.out' }, 2.76)
      .to(letters, { opacity: 1, y: 0, scale: 1, duration: .48, stagger: .075, ease: 'power3.out' }, 2.58)
      .to(campusIcon, { opacity: 1, scale: 1.08, y: 0, duration: .42, ease: 'back.out(1.4)' }, 3.05)
      .to(campusIcon, { scale: 1, duration: .25, ease: 'power2.out' }, 3.47)
      .to([heroTitle, heroSubtitle, caption], { opacity: 1, y: 0, duration: .55, stagger: .09, ease: 'power3.out' }, 3.35)
      .add(makeParticleBurst(), 3.42);
  }

  function replayWithPulse() {
    if (prefersReducedMotion.matches) {
      playCampusIntro();
      return;
    }
    killTimelines();
    pulseTl = gsap.timeline({ onComplete: playCampusIntro });
    setStatus('RESTARTING');
    pulseTl.set(plusRing, { opacity: .75, attr: { r: 30 } })
      .to(plusRing, { attr: { r: 76 }, opacity: 0, duration: .48, ease: 'power2.out' })
      .to(stageGlow, { opacity: .95, duration: .15 }, 0)
      .to(stageGlow, { opacity: 0, duration: .32, ease: 'power2.out' }, .15)
      .add(makeMicroBurst(), 0);
  }

  function setPaused(nextPaused) {
    isPaused = nextPaused;
    [introTl, holdTl, pulseTl].forEach((timeline) => {
      if (timeline) timeline.paused(isPaused);
    });
    pauseButton.setAttribute('aria-pressed', String(isPaused));
    pauseButton.setAttribute('aria-label', isPaused ? 'Resume animation' : 'Pause animation');
    $('#pauseShape').setAttribute('d', isPaused ? 'M8 5 16 10 8 15Z' : 'M7 5v10M13 5v10');
    setStatus(isPaused ? 'PAUSED' : (holdTl && holdTl.isActive() ? 'THE HOLD' : 'THE INTRO'));
  }

  function createPointerSpark(x, y) {
    const spark = document.createElement('span');
    spark.className = 'pointer-spark';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    stage.appendChild(spark);
    const dx = random(-15, 15);
    const dy = random(-17, 17);
    gsap.fromTo(spark, { opacity: 0, scale: .2, x: 0, y: 0 }, {
      opacity: random(.3, .7), scale: 1, x: dx, y: dy, duration: .22, ease: 'power1.out',
      onComplete: () => gsap.to(spark, { opacity: 0, scale: 0, duration: .28, onComplete: () => spark.remove() })
    });
  }

  function updatePointer(event) {
    const rect = stage.getBoundingClientRect();
    const px = clamp(event.clientX - rect.left, 0, rect.width);
    const py = clamp(event.clientY - rect.top, 0, rect.height);
    const nx = (px / rect.width - .5) * 2;
    const ny = (py / rect.height - .5) * 2;
    if (prefersReducedMotion.matches) {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
      stage.style.setProperty('--pointer-x', '0px');
      stage.style.setProperty('--pointer-y', '0px');
    } else {
      pointerTarget.x = -nx * (window.innerWidth < 600 ? 3 : 6);
      pointerTarget.y = -ny * (window.innerWidth < 600 ? 2 : 4);
      stage.style.setProperty('--pointer-x', `${-nx * 12}px`);
      stage.style.setProperty('--pointer-y', `${-ny * 8}px`);
    }
    document.documentElement.style.setProperty('--mx', `${clamp(px / rect.width * 100, 20, 80)}%`);
    document.documentElement.style.setProperty('--my', `${clamp(py / rect.height * 100, 14, 65)}%`);
    if (isLogoHover && event.pointerType !== 'touch' && performance.now() - lastSparkAt > 75) {
      lastSparkAt = performance.now();
      createPointerSpark(px, py);
    }
  }

  function resetPointer() {
    pointerInsideStage = false;
    pointerTarget.x = 0;
    pointerTarget.y = 0;
    stage.style.setProperty('--pointer-x', '0px');
    stage.style.setProperty('--pointer-y', '0px');
    document.documentElement.style.setProperty('--mx', '50%');
    document.documentElement.style.setProperty('--my', '33%');
  }

  function pointerLoop() {
    if (prefersReducedMotion.matches) {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    }
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * .075;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * .075;
    sceneParallax.setAttribute('transform', `translate(${pointerCurrent.x.toFixed(2)} ${pointerCurrent.y.toFixed(2)})`);
    requestAnimationFrame(pointerLoop);
  }

  function setLogoHover(active) {
    isLogoHover = active;
    gsap.to(logoGroup, { y: active ? -2 : 0, duration: .42, ease: 'power3.out', overwrite: 'auto' });
    gsap.to(stageGlow, { opacity: active ? .98 : .84, duration: .45, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(arc, { attr: { 'stroke-width': active ? 1.75 : 1.35 }, duration: .4, overwrite: 'auto' });
    if (!active) {
      gsap.to(plusHalo, { opacity: .12, duration: .4, overwrite: 'auto' });
    }
  }

  function setPlusHover(active) {
    isPlusHover = active;
    gsap.to(plusRing, { opacity: active ? .9 : 0, attr: { r: active ? 45 : 34 }, duration: .5, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(plusHalo, { opacity: active ? .3 : .14, scale: active ? 1.16 : 1, duration: .5, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(arc, { attr: { 'stroke-width': active ? 2.1 : (isLogoHover ? 1.75 : 1.35) }, duration: .4, overwrite: 'auto' });
    if (active) makeMicroBurst()?.play();
  }

  function initializeSound() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = new AudioCtx();
      soundGain = audioContext.createGain();
      soundGain.gain.setValueAtTime(.0001, audioContext.currentTime);
      soundGain.connect(audioContext.destination);
      const low = audioContext.createOscillator();
      const high = audioContext.createOscillator();
      low.type = 'sine';
      high.type = 'sine';
      low.frequency.value = 108;
      high.frequency.value = 216;
      const lowGain = audioContext.createGain();
      const highGain = audioContext.createGain();
      lowGain.gain.value = .65;
      highGain.gain.value = .18;
      low.connect(lowGain).connect(soundGain);
      high.connect(highGain).connect(soundGain);
      low.start();
      high.start();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    soundGain.gain.cancelScheduledValues(now);
    soundGain.gain.linearRampToValueAtTime(.028, now + .5);
    soundOn = true;
    soundButton.setAttribute('aria-pressed', 'true');
    soundLabel.textContent = 'Sound on';
  }

  function disableSound() {
    if (!audioContext || !soundGain) return;
    const now = audioContext.currentTime;
    soundGain.gain.cancelScheduledValues(now);
    soundGain.gain.linearRampToValueAtTime(.0001, now + .25);
    soundOn = false;
    soundButton.setAttribute('aria-pressed', 'false');
    soundLabel.textContent = 'Sound off';
  }

  const modalData = {
    identity: {
      kicker: 'THE IDENTITY SYSTEM',
      title: 'Built for <em>what’s next.</em>',
      copy: 'Campus+ is an open-doorway mark: a connected “C” for the campus ecosystem, with an ascending plus for every opportunity beyond it. The moving arc is the energy of a student in motion — curious, connected, and going somewhere.',
      list: [['Core idea', 'One campus, more possibility'], ['Primary colors', 'Midnight · electric blue · ice cyan'], ['The plus', 'Growth, access, connection']],
      actions: '<button class="dialog-action" data-download="icon">Download icon SVG</button><button class="dialog-action" data-download="wordmark">Download wordmark SVG</button>'
    },
    learn: { kicker: '01 / LEARN', title: 'Make room for <em>curiosity.</em>', copy: 'The next chapter rarely starts with a perfect plan. It starts with one more question, one more resource, one more perspective worth exploring.', list: [['Explore', 'Courses, tools & workshops'], ['Build', 'Skills that compound']], actions: '' },
    connect: { kicker: '02 / CONNECT', title: 'Find your <em>people.</em>', copy: 'Big ideas move faster together. Campus+ brings the right communities, mentors, peers, and collaborators into the same orbit.', list: [['Meet', 'Communities & conversations'], ['Belong', 'A place to show up as you are']], actions: '' },
    achieve: { kicker: '03 / ACHIEVE', title: 'Your next move starts <em>here.</em>', copy: 'Opportunities are easier to see when everything is connected. Follow the signal, take the shot, and make the next chapter yours.', list: [['Discover', 'Projects, placements & pathways'], ['Go', 'Momentum for what’s next']], actions: '' }
  };

  function openModal(name) {
    const data = modalData[name] || modalData.identity;
    const list = data.list.map(([key, value]) => `<li><span>${key}</span>${value}</li>`).join('');
    dialogContent.innerHTML = `${name === 'identity' ? '<div class="dialog-mark"><svg><use href="#icon-mark"/></svg></div>' : ''}<div class="dialog-kicker">${data.kicker}</div><h2 id="dialogTitle" class="dialog-title">${data.title}</h2><p class="dialog-copy">${data.copy}</p><ul class="dialog-list">${list}</ul><div class="dialog-actions">${data.actions || '<button class="dialog-action" data-close>Back to the experience</button>'}</div>`;
    if (!dialog.open) dialog.showModal();
  }

  const iconDownload = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Campus Plus icon</title><path d="M44 10 29 3 8 15v32l21 12 15-8V39L29 47l-10-6V22l10-6 15 8" fill="none" stroke="#64E8F6" stroke-width="4.5" stroke-linejoin="round"/><path d="M49 16v20m-10-10h20" fill="none" stroke="#F5F8FC" stroke-width="4.5" stroke-linecap="round"/></svg>`;
  const wordmarkDownload = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 410"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#b8c9df"/></linearGradient></defs><g fill="none" stroke="url(#w)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M240 211H207C188 211 176 222 176 239C176 256 188 267 207 267H240"/><path d="M263 267 296 211 329 267M276 245H316"/><path d="M348 267V211L379 246 411 211V267"/><path d="M444 267V211H475C494 211 504 220 504 233C504 245 494 253 475 253H444"/><path d="M540 211V246C540 260 550 267 565 267C580 267 590 260 590 246V211"/><path d="M680 218C672 213 664 211 651 211H640C625 211 616 219 616 230C616 240 623 246 637 249L660 254C675 257 681 262 681 268C681 272 678 275 673 275H650C637 275 628 272 620 266"/><path d="M807 201H828V228H855V249H828V276H807V249H780V228H807Z" fill="#64E8F6" stroke="none"/></g></svg>`;

  function downloadSvg(type) {
    const content = type === 'icon' ? iconDownload : wordmarkDownload;
    const filename = type === 'icon' ? 'campus-plus-icon.svg' : 'campus-plus-wordmark.svg';
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function bindEvents() {
    stage.addEventListener('pointerenter', () => { pointerInsideStage = true; });
    stage.addEventListener('pointermove', updatePointer, { passive: true });
    stage.addEventListener('pointerleave', resetPointer);
    logoHitArea.addEventListener('pointerenter', () => setLogoHover(true));
    logoHitArea.addEventListener('pointerleave', () => setLogoHover(false));
    logoHitArea.addEventListener('click', replayWithPulse);
    plusHitArea.addEventListener('pointerenter', () => setPlusHover(true));
    plusHitArea.addEventListener('pointerleave', () => setPlusHover(false));
    plusHitArea.addEventListener('click', replayWithPulse);
    replayButton.addEventListener('click', replayWithPulse);
    pauseButton.addEventListener('click', () => setPaused(!isPaused));
    soundButton.addEventListener('click', () => soundOn ? disableSound() : initializeSound());
    $$('[data-open]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.open)));
    closeDialog.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialogContent.addEventListener('click', (event) => {
      const download = event.target.closest('[data-download]');
      if (download) downloadSvg(download.dataset.download);
      if (event.target.closest('[data-close]')) dialog.close();
    });
    window.addEventListener('resize', () => {
      setPathState();
      setCometPosition(cometProgress.value);
    }, { passive: true });
    prefersReducedMotion.addEventListener?.('change', playCampusIntro);
  }

  function init() {
    if (!window.gsap) return;
    buildStarfield();
    buildParticles();
    setPathState();
    bindEvents();
    pointerLoop();
    $('#year').textContent = String(new Date().getFullYear());
    window.setTimeout(playCampusIntro, 260);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.playCampusIntro = playCampusIntro;
})();
