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
const storyBook = $('#storyBook');
const chapters = $$('.chapter');
const path = $('#trailDots');
const maskLine = $('#trailReveal');
const plane = $('#travellingPlane');
const planeSvg = $('#trailSvg');
const video = $('#openingVideo');
const chapterName = $('#chapterName');
const chapterCounter = $('#chapterCounter');
const progressDots = $$('.progress-dot');
const toast = $('#toast');
let pathLength = 0;
let rafPending = false;
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
const openingTap = $('#openingTap');
let openingStarted = false;
let openingFallbackTimer = null;

function revealOpeningText() {
  if (!openingStarted || introFinished) return;
  introFinished = true;
  if (openingFallbackTimer !== null) window.clearTimeout(openingFallbackTimer);
  opening.classList.remove('is-playing');
  opening.classList.add('is-revealed');
  openingTap.hidden = true;
  document.body.classList.remove('intro-locked');
  document.documentElement.classList.remove('intro-locked');
  requestFrame();
}

function startEnvelopeVideo() {
  if (openingStarted) return;
  openingStarted = true;
  openingTap.hidden = true;
  opening.classList.add('is-playing');
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

$('#enterStory').addEventListener('click', () => {
  video.pause();
  goTo('chapter-1');
});
$('#skipToInvite').addEventListener('click', () => {
  video.pause();
  goTo('chapter-8');
});
$('#replayStory').addEventListener('click', () => goTo('chapter-1'));
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
function buildTrail() {
  const w = Math.max(300, storyBook.clientWidth);
  const h = Math.max(1000, storyBook.scrollHeight);
  planeSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const positions=[];
  chapters.forEach((chapter,i) => {
    const y = chapter.offsetTop;
    const sectionH = chapter.offsetHeight;
    const left = i%2===0;
    positions.push({x:w*(left?.20:.80),y:y+Math.min(170,sectionH*.16)});
    positions.push({x:w*(left?.83:.17),y:y+sectionH*.69});
  });
  const endH = $('#endHeart');
  const box = endH.getBoundingClientRect();
  const parent = storyBook.getBoundingClientRect();
  positions.push({x: w*.51, y: box.top - parent.top + box.height*.5});
  positions.sort((a,b)=>a.y-b.y);
  let d=`M ${positions[0].x.toFixed(1)} ${positions[0].y.toFixed(1)}`;
  for(let i=0;i<positions.length-1;i++) {
    const p0 = positions[Math.max(i-1,0)],p1=positions[i],p2=positions[i+1],p3=positions[Math.min(i+2,positions.length-1)];
    const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
    d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  path.setAttribute('d',d);
  maskLine.setAttribute('d',d);
  pathLength=path.getTotalLength();
  maskLine.style.strokeDasharray = `${pathLength} ${pathLength}`;
  requestFrame();
}

function currentChapterIndex(scrollY) {
  const center = scrollY + window.innerHeight*.50;
  let idx=0;
  chapters.forEach((chapter,i) => {const top=storyBook.offsetTop+chapter.offsetTop;if(center>=top) idx=i;});
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
      $$('.path-sketch',chapter).forEach((line,i)=>{
        const len=line.getTotalLength();line.style.strokeDasharray=`${len} ${len}`;
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
      const open=ease((reducedP-.08)*1.65);
      $('.left-curtain',chapter).style.transform=`translateX(${-open*105}%)`;
      $('.right-curtain',chapter).style.transform=`translateX(${open*105}%)`;
      const f=ease((reducedP-.30)*2.5);
      $('.reveal-copy',chapter).style.opacity=String(f);
      $('.reveal-copy',chapter).style.transform=`translateY(${lerp(38,0,f)}px) scale(${lerp(.90,1,f)})`;
      $('.mandapam-art',chapter).style.opacity=String(.12+.72*f);
      const backdrop=$('.reveal-background',chapter);
      if(backdrop && !reduceMotion){
        backdrop.style.opacity=String(lerp(.7,1,f));
        backdrop.style.transform=`translate3d(0,${lerp(16,0,f)}px,0) scale(${lerp(1.055,1.015,f)})`;
      }
      $('#petalField').style.opacity=String(f);
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
  if(!pathLength || reduceMotion) { plane.style.opacity='0'; return; }
  const relative = scrollY - storyBook.offsetTop;
  const remaining = storyBook.offsetHeight-window.innerHeight*.4;
  const t=clamp((relative+window.innerHeight*.56)/remaining);
  const length=pathLength*t;
  maskLine.style.strokeDashoffset=String(pathLength-length);
  const here=path.getPointAtLength(length);
  const before=path.getPointAtLength(Math.max(0,length-10));
  const after=path.getPointAtLength(Math.min(pathLength,length+10));
  const degrees=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
  plane.style.left=here.x+'px';plane.style.top=here.y+'px';
  plane.style.transform=`translate(-50%,-50%) rotate(${degrees}deg)`;
  plane.style.opacity=(relative > -window.innerHeight*.4 && relative < storyBook.offsetHeight-180) ? '1' : '0';
}
function update() {
  rafPending=false;
  const y=window.scrollY;
  const storyTop=storyBook.offsetTop;
  document.body.classList.toggle('story-started',y+window.innerHeight*.32>=storyTop);
  if(y < storyTop-window.innerHeight) return;
  const idx=currentChapterIndex(y);
  chapterName.textContent=chapters[idx]?.dataset.name||'OUR STORY';
  chapterCounter.textContent=`${String(idx+1).padStart(2,'0')} — 08`;
  progressDots.forEach((dot,i)=>dot.classList.toggle('active',i===idx));
  chapters.forEach((chapter)=>{
    if (chapter.classList.contains('last-chapter')) return;
    const top=storyTop+chapter.offsetTop;
    const range=Math.max(1,chapter.offsetHeight-window.innerHeight);
    const p=clamp((y-top)/range);
    if (y>top-window.innerHeight*1.4 && y<top+chapter.offsetHeight+window.innerHeight*.5) animateChapter(chapter,p);
  });
  const finalTop=storyTop+chapters[7].offsetTop;
  const finalP=ease((y-finalTop)/Math.max(1,chapters[7].offsetHeight*.6));
  $('#endHeart').style.transform=`scale(${lerp(.65,1.2,finalP)})`;
  updatePlane(y);
}
function requestFrame(){if(rafPending)return;rafPending=true;requestAnimationFrame(update)}
window.addEventListener('scroll',requestFrame,{passive:true});
window.addEventListener('resize',()=>{buildTrail();requestFrame()},{passive:true});
window.addEventListener('pageshow',()=>{buildTrail();requestFrame()});

function createPetals() {
  const field=$('#petalField');
  // Seeded positions make the effect stable and don't shift around between page views.
  for(let i=0;i<27;i++) {
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
