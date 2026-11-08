/**
 * FROM FRIENDS TO FOREVER — scroll-driven animated invitation.
 * Vanilla JavaScript only. No animation library, build step, or API key required.
 * EDIT THE CONFIG BELOW to change dates, venue, sharing text or intro behavior.
 */
const CONFIG = {
  couple: 'Giridharan & Padma Priya',
  title: 'From Friends to Forever',
  receptionDate: '2027-02-08',
  // Wedding details below are copied from the supplied invitation artwork.
  // Verify them with your family before publishing publicly.
  wedding: {
    date: '2027-02-08',
    displayDate: 'Monday, 8 February 2027',
    time: '4:30 AM – 6:00 AM',
    startLocal: '2027-02-08T04:30:00',
    calendarDurationMinutes: 90,
    venue: 'Arulmigu Sri Selvamuthukumaraswamy Temple',
    locality: 'Maraimalai Nagar',
    mapQuery: 'Arulmigu Sri Selvamuthukumaraswamy Temple, Maraimalai Nagar'
  },
  reception: {
    date: '2027-02-08',
    displayDate: 'Monday, 8 February 2027',
    time: '6:30 PM onwards',
    startLocal: '2027-02-08T18:30:00',
    calendarDurationMinutes: 90, // Personal calendar hold; not an announced end time.
    venue: 'Sri Alwaar Palace',
    locality: 'Kattankulathur',
    mapQuery: 'Sri Alwaar Palace, Kattankulathur'
  },
  autoAdvanceAfterIntro: false,
  introSource: 'assets/opening.mp4',
  musicInitiallyOn: false
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const ease = (n) => { const p=clamp(n); return p*p*(3-2*p); };
const lerp = (a, b, t) => a+(b-a)*t;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileOptimized=window.matchMedia('(max-width: 820px), (pointer: coarse)');
const storyBook = $('#storyBook');
const chapters = $$('.chapter');
const path = $('#trailDots');
const maskLine = $('#trailReveal');
const plane = $('#travellingPlane');
const planeSvg = $('#trailSvg');
// Keep the plane in a tiny fixed compositor layer on phones, separate from
// the very tall SVG trail, which otherwise makes mobile browsers repaint it.
const useMobilePlane = mobileOptimized.matches;
if(useMobilePlane){
  plane.classList.add('mobile-plane');
  document.body.appendChild(plane);
}
let mainTopOnPage=0;
let mainLeftOnScreen=0;
const video = $('#openingVideo');
const chapterName = $('#chapterName');
const chapterCounter = $('#chapterCounter');
const progressDots = $$('.progress-dot');
const toast = $('#toast');
let pathLength = 0;
let rafPending = false;
let lastSceneUpdate=0;
let lastChapterIndex=-1;
let lastStoryVisibility=false;
// The browser's native display refresh rate drives mobile plane updates.
let chapterMetrics=[];
const chapterProgress=new Array(chapters.length).fill(-1);
const journeySketchPaths=$$('.path-sketch');
const journeySketchLengths=journeySketchPaths.map(line=>line.getTotalLength());
let toastTimeout;
let introFinished = false;
let musicOn = false;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function goTo(id) {
  document.getElementById(id)?.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block: 'start'});
  requestFrame();
}

/* Tap anywhere on the original closed-envelope video to begin.
   Only after the video finishes do words reveal one after another. */
const opening = $('#opening');
const openingViewport = $('.opening-viewport', opening);
const openingTap = $('#openingTap');
const openingSound = $('#openingSound');
let openingStarted = false;
let openingFallbackTimer = null;
// Scroll-driven, one-by-one reveal: no text appears just because the video ended.
let openingRevealSteps = 0;
let lastOpeningRevealAt = 0;
let openingRevealTimer = null;
const openingScrollThresholds = [.10, .31, .54, .76];
// Opening audio ends with the envelope video; no extra music tail.
function stopOpeningSound() {
  if (!openingSound) return;
  openingSound.pause();
  openingSound.loop = false;
  try { openingSound.currentTime = 0; openingSound.volume = 1; } catch (_) {}
}

function revealOpeningText() {
  if (!openingStarted || introFinished) return;
  introFinished = true;
  if (openingFallbackTimer !== null) window.clearTimeout(openingFallbackTimer);
  // Stop the soundtrack as soon as the envelope-opening video finishes.
  stopOpeningSound();
  video.pause();
  opening.classList.remove('is-playing');
  opening.classList.add('is-revealed');
  openingTap.hidden = true;
  // Show the real moving plane first. The visitor now scrolls to reveal
  // the message, with each text group following their paper-plane journey.
  opening.classList.add('plane-ready');
  document.body.classList.remove('intro-locked');
  document.documentElement.classList.remove('intro-locked');
  requestFrame();
}

function updateOpeningScrollReveal(scrollY, now = performance.now()) {
  if (!introFinished || openingRevealSteps >= openingScrollThresholds.length) return;
  const runway = Math.max(1, opening.offsetHeight - openingViewport.offsetHeight);
  const progress = clamp((scrollY - mainTopOnPage) / runway);
  if(progress < openingScrollThresholds[openingRevealSteps]) return;

  // A fast swipe must not make four pieces of text appear at once. Each reveal
  // gets its own moment while the plane continues to follow the finger.
  const wait = openingRevealSteps === 0 ? 0 : Math.max(0, 640 - (now - lastOpeningRevealAt));
  if(wait > 0) {
    if(openingRevealTimer === null){
      openingRevealTimer = window.setTimeout(() => {
        openingRevealTimer = null;
        requestFrame();
      }, wait);
    }
    return;
  }

  openingRevealSteps += 1;
  lastOpeningRevealAt = now;
  opening.classList.add('intro-step-' + openingRevealSteps);
  // If the user has already swiped past multiple thresholds, preserve the
  // order using one timed check per step, never an automatic start.
  if(openingRevealSteps < openingScrollThresholds.length &&
     progress >= openingScrollThresholds[openingRevealSteps] &&
     openingRevealTimer === null) {
    openingRevealTimer = window.setTimeout(() => {
      openingRevealTimer = null;
      requestFrame();
    }, 655);
  }
}

function startEnvelopeVideo() {
  if (openingStarted) return;
  openingStarted = true;
  openingTap.hidden = true;
  opening.classList.add('is-playing');
  // The new soundtrack starts in the SAME user gesture as the envelope animation.
  // Using an <audio> element keeps your existing 8-second envelope video unchanged.
  if (openingSound) {
    // Repeat only if the track is shorter than the video; stop at its ending.
    openingSound.loop = true;
    try { openingSound.volume = 1; openingSound.currentTime = 0; } catch (_) {}
    try {
      const audioStart = openingSound.play();
      if (audioStart && typeof audioStart.catch === 'function') {
        // The envelope animation still works if the soundtrack file isn't present yet.
        audioStart.catch(() => {});
      }
    } catch (_) { /* Audio is optional; never block the invitation. */ }
  }
  // Make the original 8-second opening slightly brisker on phones, without
  // re-encoding or replacing its visuals. Keep the uploaded music in sync.
  const mobilePlaybackRate=mobileOptimized.matches?1.18:1;
  try { video.playbackRate=mobilePlaybackRate; } catch (_) {}
  if(openingSound){
    try { openingSound.playbackRate=mobilePlaybackRate; } catch (_) {}
  }
  // Start playback directly inside the tap interaction for mobile Safari.
  try {
    video.currentTime = 0;
  } catch (_) { /* Seek may be unavailable before media metadata arrives. */ }
  try {
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => revealOpeningText());
    }
  } catch (_) {
    revealOpeningText();
  }
  // If video playback stalls or its end event is unavailable, do not trap guests.
  openingFallbackTimer = window.setTimeout(revealOpeningText, 18000);
}

document.documentElement.classList.add('intro-locked');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
openingTap.addEventListener('click', startEnvelopeVideo);
video.addEventListener('ended', revealOpeningText);
video.addEventListener('error', () => {
  if (openingStarted) revealOpeningText();
});

$('#skipToInvite').addEventListener('click', () => {
  video.pause();
  goTo('chapter-8');
});
progressDots.forEach((dot) => dot.addEventListener('click', () => goTo(dot.dataset.go)));

function fillEventDetails() {
  const wed = CONFIG.wedding;
  const rec = CONFIG.reception;
  $('#weddingDateText').textContent = wed.displayDate;
  $('#weddingTimeText').textContent = wed.time;
  $('#weddingVenueText').innerHTML = escapeHTML(wed.venue) + '<br>' + escapeHTML(wed.locality);
  $('#receptionDateText').textContent = rec.displayDate;
  $('#receptionTimeText').textContent = rec.time;
  $('#receptionVenueText').innerHTML = escapeHTML(rec.venue) + '<br>' + escapeHTML(rec.locality);
  $('#weddingMap').href = mapURL(wed.mapQuery);
  $('#receptionMap').href = mapURL(rec.mapQuery);
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function mapURL(query) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query); }

/** Render a correct February 2027 calendar; no hardcoded incorrect weekdays. */
function buildCalendar() {
  const target = new Date(CONFIG.receptionDate + 'T12:00:00Z');
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth();
  const marked = target.getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const grid = $('#calendarGrid');
  grid.innerHTML = '';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach((day) => {
    const el = document.createElement('span'); el.className='weekday';el.textContent=day;grid.append(el);
  });
  for(let i=0;i<firstDay;i++) { const cell=document.createElement('span');cell.className='empty';cell.textContent='·';grid.append(cell); }
  for(let day=1;day<=days;day++) {
    const cell=document.createElement('span');cell.textContent=day;
    if(day===marked) {cell.classList.add('special-day');cell.setAttribute('aria-label',`${day} February ${year}: wedding and reception`);}
    grid.append(cell);
  }
  $('.cal-year').textContent=year;
  $('.calendar-card h3').textContent=new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(target);
  $('.save-date-caption strong').textContent = '8 February 2027';
}

/** A single continuous SVG path across every chapter, not eight disconnected lines. */
// One continuous path, beginning on the opened envelope and flowing into every chapter.
const invitationMain = document.querySelector('.invitation-main');
let trailSamples = [];

function buildTrail() {
  const w = Math.max(300, invitationMain.clientWidth);
  const h = Math.max(1000, invitationMain.scrollHeight);
  const mainRect=invitationMain.getBoundingClientRect();
  mainTopOnPage=mainRect.top+window.scrollY;
  mainLeftOnScreen=mainRect.left;
  planeSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const storyStart = storyBook.getBoundingClientRect().top - invitationMain.getBoundingClientRect().top;
  const openingHeight = opening.offsetHeight;
  const viewportHeight = openingViewport.offsetHeight;
  const positions = [
    // The plane is FIRST visible in the upper-left after the envelope opens.
    // While guests scroll the sticky opening, it flies diagonally downward,
    // arcs around the centered text, reaches the bottom and enters Chapter 01.
    {x:w*.11, y:viewportHeight*.13},
    {x:w*.18, y:viewportHeight*.53},
    {x:w*.74, y:viewportHeight*1.06},
    {x:w*.69, y:viewportHeight*1.50},
    {x:w*.49, y:Math.max(viewportHeight*1.93,openingHeight-viewportHeight*.19)},
    {x:w*.62, y:storyStart+25}
  ];
  chapters.forEach((chapter,i) => {
    const y = storyStart + chapter.offsetTop;
    const sectionH = chapter.offsetHeight;
    const left = i%2===0;
    const eventPage = chapter.classList.contains('story-event-chapter');
    // On the wedding and reception scenes, the travelling plane stays along the
    // outer paper margin instead of slicing through the text or illustrations.
    const edge = left ? .085 : .915;
    positions.push({x:w*(eventPage ? edge : (left ? .20 : .80)),y:y+Math.min(170,sectionH*.16)});
    positions.push({x:w*(eventPage ? edge : (left ? .83 : .17)),y:y+sectionH*.69});
  });
  const endH = $('#endHeart');
  const endBox = endH.getBoundingClientRect();
  const mainBox = invitationMain.getBoundingClientRect();
  positions.push({x:w*.51,y:endBox.top-mainBox.top+endBox.height*.5});
  positions.sort((a,b)=>a.y-b.y);
  let d=`M ${positions[0].x.toFixed(1)} ${positions[0].y.toFixed(1)}`;
  for(let i=0;i<positions.length-1;i++) {
    const p0=positions[Math.max(i-1,0)],p1=positions[i],p2=positions[i+1],p3=positions[Math.min(i+2,positions.length-1)];
    const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;
    d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  path.setAttribute('d',d);
  maskLine.setAttribute('d',d);
  pathLength=path.getTotalLength();
  chapterMetrics=chapters.map(chapter=>({
    top:storyBook.offsetTop+chapter.offsetTop,
    height:chapter.offsetHeight
  }));
  chapterProgress.fill(-1);
  // Mobile: skip repainting the enormous animated SVG reveal mask.
  // The dotted trail remains continuous and the paper plane still flies along it.
  if(mobileOptimized.matches){
    path.removeAttribute('mask');
    maskLine.style.display='none';
  }else{
    path.setAttribute('mask','url(#trailMask)');
    maskLine.style.display='';
    maskLine.style.strokeDasharray=`${pathLength} ${pathLength}`;
    maskLine.style.strokeDashoffset=String(pathLength);
  }
  trailSamples=[];
  const samples=Math.max(360,Math.min(mobileOptimized.matches?800:1200,
    Math.ceil(pathLength/(mobileOptimized.matches?32:30))));
  for(let i=0;i<=samples;i++){
    const length=pathLength*i/samples;
    const point=path.getPointAtLength(length);
    trailSamples.push({x:point.x,y:point.y,length});
  }
  // Interpolate cached path tangents for smooth rotations even on slow phones.
  trailSamples.forEach((sample,i)=>{
    const before=trailSamples[Math.max(0,i-1)]||sample;
    const after=trailSamples[Math.min(trailSamples.length-1,i+1)]||sample;
    sample.angle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
  });
  lastChapterIndex=-1;
  lastSceneUpdate=0;
  requestFrame();
}

function currentChapterIndex(scrollY) {
  const center=scrollY+window.innerHeight*.50;
  let idx=0;
  for(let i=0;i<chapterMetrics.length;i++){
    if(center>=chapterMetrics[i].top) idx=i;
    else break;
  }
  return idx;
}
function animateChapter(chapter, p) {
  chapter.style.setProperty('--p',p.toFixed(3));
  const number=Number(chapter.dataset.number);
  const reducedP=reduceMotion ? 1 : p;
  switch(number) {
    case 1: {
      const book=$('#bookObject');
      $('.book-half.left',book).style.transform=`rotateY(${-ease(reducedP*1.6)*23}deg)`;
      $('.book-half.right',book).style.transform=`rotateY(${ease(reducedP*1.6)*23}deg)`;
      book.style.transform=`translateY(${lerp(20,-5,ease(reducedP))}px) scale(${lerp(.88,1.1,ease(reducedP))})`;
      $('.pop-word',chapter).style.opacity=String(ease(reducedP*2.7));
      $('.chapter-one-content h2',chapter).style.transform=`translateY(${lerp(35,0,ease(reducedP*1.7))}px)`;
      break;
    }
    case 2: {
      const f=ease(reducedP*2.0),g=ease((reducedP-.17)*2.4);
      const img=$('.childhood-image',chapter),copy=$('.childhood-copy',chapter);
      img.style.opacity=String(.2+f*.8);
      img.style.transform=`translate(${lerp(-80,0,f)}px,${lerp(18,0,f)}px) rotate(${lerp(-4,0,f)}deg)`;
      copy.style.opacity=String(.15+g*.85);
      copy.style.transform=`translateX(${lerp(65,0,g)}px)`;
      break;
    }
    case 3: {
      const f=ease((reducedP-.06)*1.9),g=ease((reducedP-.25)*2.5);
      const sketch=$('.family-sketch',chapter),note=$('#familyNote');
      sketch.style.transform=`scale(${lerp(.75,1,f)}) translateY(${lerp(30,0,f)}px)`;
      sketch.style.opacity=String(f);
      note.style.opacity=String(Math.max(.02,g));
      note.style.transform=`translateY(${lerp(210,0,g)}px) rotate(${lerp(9,-5,g)}deg)`;
      $('.chapter-micro',chapter).style.opacity=String(g);
      break;
    }
    case 4: {
      const f=ease((reducedP-.01)*1.7);
      journeySketchPaths.forEach((line,i)=>{
        const len=journeySketchLengths[i];
        line.style.strokeDasharray=`${len} ${len}`;
        line.style.strokeDashoffset=String((1-f)*len);
      });
      const heart=$('.meeting-heart',chapter),g=ease((reducedP-.41)*3.2);
      heart.style.opacity=String(g);heart.style.transform=`scale(${lerp(.35,1,g)})`;
      $$('.tiny-note',chapter).forEach((note,i)=>{
        const v=ease((reducedP-.15-i*.15)*2.8);
        note.style.opacity=String(v);
        note.style.translate=`0 ${lerp(50,0,v)}px`;
      });
      break;
    }
    case 5: {
      const f=ease(reducedP*1.8),g=ease((reducedP-.13)*2.1);
      const photo=$('.love-photo',chapter),copy=$('.love-copy',chapter);
      photo.style.transform=`translateX(${lerp(-60,0,f)}px) scale(${lerp(.82,1.03,f)})`;
      photo.style.opacity=String(f);
      copy.style.transform=`translateX(${lerp(60,0,g)}px)`;copy.style.opacity=String(g);
      $$('.love-bloom span',chapter).forEach((heart,i)=>{
        const t=ease((reducedP-.18-i*.045)*3.5);
        heart.style.opacity=String(t*.73);
        heart.style.transform=`translateY(${lerp(50,-12-i*5,t)}px) scale(${lerp(.3,1.1,t)}) rotate(${(i%2?-1:1)*t*17}deg)`;
      });
      $('.love-glow',chapter).style.opacity=String(.3+f*.4);
      break;
    }
    case 6: {
      // The silk panels open directly with scroll position, revealing the
      // mandapam and names in a natural, lightweight cinematic transition.
      const open=ease((reducedP-.05)*1.95);
      $('.left-curtain',chapter).style.transform=`translate3d(${-open*104}%,0,0)`;
      $('.right-curtain',chapter).style.transform=`translate3d(${open*104}%,0,0)`;
      const fade=ease((reducedP-.25)*2.8);
      const copy=$('.reveal-copy',chapter);
      copy.style.opacity=String(fade);
      copy.style.transform=`translate3d(0,${lerp(26,0,fade)}px,0)`;
      $('#petalField').style.opacity=String(fade);
      break;
    }
    case 7: {
      const f=ease(reducedP*2.5),g=ease((reducedP-.28)*2.7);
      const calendar=$('#calendarCard');
      calendar.style.opacity=String(f);
      calendar.style.transform=`rotateX(${lerp(-85,0,f)}deg) rotate(-2deg) scale(${lerp(.9,1,f)})`;
      const special=$('.special-day',chapter);
      if(special)special.style.transform=`scale(${lerp(1,1.16,g)})`;
      const post=$('#signpost');
      post.style.opacity=String(g);
      post.style.translate=`0 ${lerp(150,0,g)}px`;
      break;
    }
  }
}
function updatePlane(scrollY) {
  if(!pathLength || !introFinished) { plane.style.opacity='0'; return; }
  if(reduceMotion) {
    maskLine.style.strokeDashoffset='0';
    plane.style.opacity='0';
    return;
  }
  // At the end of the opening screen the plane simply keeps flying into Chapter 1.
  // Start the paper plane at the bottom CENTRE of the opening.
  // Shift smoothly back to the usual story-flight level on the next screen.
  const relativeScroll=scrollY-mainTopOnPage;
  const openingRunway=Math.max(1,opening.offsetHeight-openingViewport.offsetHeight);
  const openingProgress=clamp(relativeScroll/openingRunway);
  // The opening starts in the upper-left at 14% of the viewport, NOT 84%.
  // The scroll drives the plane from top to bottom while text is revealed
  // at its four checkpoints. Past the opening, the same trail continues.
  const viewportGuide=relativeScroll<=openingRunway
    ? lerp(.14,.77,ease(openingProgress))
    : lerp(.77,.68,ease(clamp((relativeScroll-openingRunway)/Math.max(1,window.innerHeight))));
  // Follow scrolling directly: the old sine-wave offset temporarily opposed
  // the finger's movement and made the plane appear stuck.
  const targetY=relativeScroll+window.innerHeight*viewportGuide;
  let low=0,high=trailSamples.length-1;
  while(low<high) {
    const mid=(low+high)>>1;
    if(trailSamples[mid].y<targetY) low=mid+1; else high=mid;
  }
  const upper=trailSamples[low]||{y:0,length:0};
  const lower=trailSamples[Math.max(0,low-1)]||upper;
  const fraction=clamp((targetY-lower.y)/Math.max(.001,upper.y-lower.y));
  const length=lerp(lower.length,upper.length,fraction);
  if(!mobileOptimized.matches)maskLine.style.strokeDashoffset=String(pathLength-length);
  const x=lerp(lower.x,upper.x,fraction);
  const y=lerp(lower.y,upper.y,fraction);
  const angleDelta=((upper.angle-lower.angle+540)%360)-180;
  const degrees=lower.angle+angleDelta*fraction;
  // The mobile plane is viewport-fixed: map the same trail point to screen
  // coordinates, then move only its compositor transform at display refresh.
  // Desktop retains the original absolute plane positioning.
  const drawX=useMobilePlane?x+mainLeftOnScreen:x;
  const drawY=useMobilePlane?y-relativeScroll:y;
  plane.style.transform=`translate3d(${drawX.toFixed(1)}px,${drawY.toFixed(1)}px,0) translate(-50%,-50%) rotate(${degrees.toFixed(1)}deg)`;
  plane.style.opacity=targetY>=trailSamples[0].y-15 && targetY<trailSamples[trailSamples.length-1].y-110?'1':'0';

}
function update(now=performance.now()) {
  rafPending=false;
  const y=window.scrollY;
  // The plane moves first. Separate scroll thresholds reveal each line.
  updatePlane(y);
  updateOpeningScrollReveal(y,now);

  const storyTop=storyBook.offsetTop;
  const isStoryVisible=y+window.innerHeight*.32>=storyTop;
  if(isStoryVisible!==lastStoryVisibility){
    document.body.classList.toggle('story-started',isStoryVisible);
    lastStoryVisibility=isStoryVisible;
  }
  if(y<storyTop-window.innerHeight)return;

  // The plane paints at native refresh. Decorative chapter motions update
  // less often on phones to leave frame budget for a fluid plane.
  if(mobileOptimized.matches&&now-lastSceneUpdate<37)return;
  lastSceneUpdate=now;

  const idx=currentChapterIndex(y);
  if(idx!==lastChapterIndex){
    chapterName.textContent=chapters[idx]?.dataset.name||'OUR STORY';
    chapterCounter.textContent=`${String(idx+1).padStart(2,'0')} — ${String(chapters.length).padStart(2,'0')}`;
    progressDots.forEach((dot,i)=>dot.classList.toggle('active',i===idx));
    lastChapterIndex=idx;
  }
  chapters.forEach((chapter,i)=>{
    if(chapter.classList.contains('last-chapter'))return;
    if(mobileOptimized.matches&&Math.abs(i-idx)>1)return;
    const metric=chapterMetrics[i];
    if(!metric)return;
    const range=Math.max(1,metric.height-window.innerHeight);
    // Chapter 6 has NO oversized scroll tail. Animate the curtains while that
    // full-screen scene enters view, not via an artificial extra 24svh hold.
    // By the time it fills the viewport, the mandapam and names are revealed.
    const p=chapter.dataset.number==='6'
      ? clamp((y-(metric.top-window.innerHeight*.44))/(window.innerHeight*.70))
      : clamp((y-metric.top)/range);
    if(y>metric.top-window.innerHeight*1.4 &&
       y<metric.top+metric.height+window.innerHeight*.5 &&
       Math.abs(p-chapterProgress[i])>=(mobileOptimized.matches?.008:.003)){
      chapterProgress[i]=p;
      animateChapter(chapter,p);
    }
  });
  const finalMetric=chapterMetrics[chapters.length-1];
  if(finalMetric&&y>finalMetric.top-window.innerHeight){
    const finalP=ease((y-finalMetric.top)/Math.max(1,finalMetric.height*.6));
    $('#endHeart').style.transform=`scale(${lerp(.65,1.2,finalP)})`;
  }
}
function requestFrame(){
  if(rafPending)return;
  rafPending=true;
  // Let the browser paint on every native animation frame (typically 60Hz on
  // mobiles). The old forced 30fps cap caused visibly stepped plane motion.
  requestAnimationFrame(update);
}
window.addEventListener('scroll',requestFrame,{passive:true});
let resizeDebounce=null,layoutWidth=window.innerWidth,layoutHeight=window.innerHeight;
function scheduleTrailRebuild(force=false){
  requestFrame();
  // Phone address-bar movement fires resize repeatedly; rebuild only when
  // the actual page layout changes enough to matter.
  if(!force&&mobileOptimized.matches&&
     Math.abs(window.innerWidth-layoutWidth)<3 &&
     Math.abs(window.innerHeight-layoutHeight)<160)return;
  clearTimeout(resizeDebounce);
  resizeDebounce=setTimeout(()=>{
    layoutWidth=window.innerWidth;
    layoutHeight=window.innerHeight;
    buildTrail();
    requestFrame();
  },180);
}
window.addEventListener('resize',()=>scheduleTrailRebuild(false),{passive:true});
window.addEventListener('orientationchange',()=>scheduleTrailRebuild(true),{passive:true});
window.addEventListener('pageshow',()=>{buildTrail();requestFrame()});

function createPetals() {
  const field=$('#petalField');
  // Seeded positions make the effect stable and don't shift around between page views.
  const count=mobileOptimized.matches?10:27;
  for(let i=0;i<count;i++) {
    const petal=document.createElement('span');petal.className='falling-petal';
    petal.style.setProperty('--x',((i*73+17)%94+3)+'%');
    petal.style.setProperty('--drift',((i*17)%170-80)+'px');
    petal.style.setProperty('--delay',(-i*.42)+'s');
    petal.style.setProperty('--duration',(6+i%6)+'s');
    field.append(petal);
  }
}

/** Optional original gentle instrumental ambience, created in WebAudio, no external file. */
let audioContext=null,musicInterval=null,chordIndex=0;
const chordProgression=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,293.66],[196,246.94,293.66]];
function scheduleChord() {
  if(!musicOn||!audioContext)return;
  const notes=chordProgression[chordIndex++%chordProgression.length];
  const time=audioContext.currentTime+.04;
  notes.forEach((freq,i)=>{
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(freq,time);
    gain.gain.setValueAtTime(0,time);
    gain.gain.linearRampToValueAtTime(.015/(i+1),time+.36);
    gain.gain.setTargetAtTime(0,time+1.0,1.8);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(time);osc.stop(time+6.5);
  });
}
async function setMusic(shouldPlay) {
  const toggle=$('#musicToggle');
  musicOn=shouldPlay;
  toggle.setAttribute('aria-pressed',String(shouldPlay));
  toggle.setAttribute('aria-label',shouldPlay?'Turn background music off':'Turn background music on');
  toggle.title=shouldPlay?'Mute instrumental music':'Play gentle instrumental music';
  if(musicInterval){clearInterval(musicInterval);musicInterval=null;}
  if(shouldPlay) {
    // Never overlap the optional story music with the envelope soundtrack.
    stopOpeningSound();
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass){musicOn=false;showToast('Your browser does not support background music.');return;}
    audioContext=audioContext||new AudioContextClass();
    await audioContext.resume();scheduleChord();musicInterval=setInterval(scheduleChord,2800);
  } else if(audioContext) {
    await audioContext.suspend();
  }
}
$('#musicToggle').addEventListener('click',()=>setMusic(!musicOn));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&musicOn){audioContext?.suspend();}
  else if(!document.hidden&&musicOn){audioContext?.resume();}
});

/** Calendar file with India Standard Time converted to UTC (UTC +05:30). */
function toUTCString(localISO) {
  const date=new Date(localISO+'+05:30');
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
}
function addMinutesIST(localISO,minutes){
  const date=new Date(new Date(localISO+'+05:30').getTime()+minutes*60*1000);
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
}
function icsEscape(s) {return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function buildICS() {
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  function oneEvent(name,event,slug) {
    return ['BEGIN:VEVENT','UID:'+slug+'-giripriya-2027@invitation','DTSTAMP:'+stamp,'DTSTART:'+toUTCString(event.startLocal),'DTEND:'+addMinutesIST(event.startLocal,event.calendarDurationMinutes),'SUMMARY:'+icsEscape(name),'LOCATION:'+icsEscape(event.venue+', '+event.locality),'DESCRIPTION:'+icsEscape('You are invited to celebrate with Giridharan and Padma Priya! Time shown is a personal calendar hold; please refer to the invitation for event timing.'),'END:VEVENT'].join('\r\n');
  }
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Giri Priya//Animated Invitation//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',oneEvent('Marriage — Giridharan & Padma Priya',CONFIG.wedding,'wedding'),oneEvent('Reception — Giridharan & Padma Priya',CONFIG.reception,'reception'),'END:VCALENDAR'].join('\r\n');
}
$('#calendarDownload').addEventListener('click',()=>{
  const file=new Blob([buildICS()],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download='Giridharan-Padma-Priya-Invitation.ics';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
  showToast('Calendar invitation saved!');
});
$('#shareInvite').addEventListener('click',async()=>{
  const message=`From childhood friendship to forever! ♥\nYou're invited to the wedding celebrations of Giridharan & Padma Priya.\nReception: Monday, 8 February 2027, evening, at Sri Alwaar Palace, Kattankulathur.\n${window.location.href.split('#')[0]}`;
  try {
    if(navigator.share){await navigator.share({title:CONFIG.couple+' — Wedding Invitation',text:message,url:window.location.href.split('#')[0]});return;}
    if(navigator.clipboard){await navigator.clipboard.writeText(message);showToast('Invitation details copied!');return;}
  }catch(err){if(err?.name==='AbortError')return;}
  const el=document.createElement('textarea');el.value=message;document.body.append(el);el.select();document.execCommand('copy');el.remove();showToast('Invitation details copied!');
});

// Boot. Every effect is a reversible function of scroll position, not a one-way autoplay.
fillEventDetails();
buildCalendar();
createPetals();
requestAnimationFrame(()=>requestAnimationFrame(()=>{buildTrail();update();}));
if(document.fonts?.ready) document.fonts.ready.then(()=>{buildTrail();requestFrame();});
// Keep the single continuous trail aligned after venue images load.
$$('.venue-art img').forEach(img => {
  if (!img.complete) img.addEventListener('load', () => { buildTrail(); requestFrame(); }, {once:true});
});

// Keep the opening video paused on its poster until the guest taps; on reduced-motion
// devices the text remains legible without revealing it before the tap.


/* Reveal the temple and reception illustrations when visitors scroll to them.
   Default styling stays visible if JavaScript or IntersectionObserver is unavailable. */
const venueIllustrations = [...document.querySelectorAll('.venue-art')];
if (!reduceMotion && 'IntersectionObserver' in window) {
  const venueObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.13, rootMargin: '0px 0px -4% 0px' });
  venueIllustrations.forEach(illustration => {
    illustration.classList.add('animated-venue');
    venueObserver.observe(illustration);
  });
} else {
  venueIllustrations.forEach(illustration => illustration.classList.add('in-view'));
}


// Decorative particles and floating illustrations pause when their chapter
// is outside the phone's viewport, then resume as it returns.
if(mobileOptimized.matches && 'IntersectionObserver' in window){
  document.body.classList.add('mobile-lite');
  const chapterObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      entry.target.classList.toggle('in-view',entry.isIntersecting);
    }
  },{rootMargin:'130px 0px 130px 0px',threshold:0});
  chapters.forEach(chapter=>chapterObserver.observe(chapter));
}
