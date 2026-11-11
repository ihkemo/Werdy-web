import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../desktop-web.js',import.meta.url),'utf8');
const dataContext=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../assets/quran/quran-data.js',import.meta.url),'utf8'),dataContext);
const data=dataContext.window.WERDY_QURAN_DATA;
const verses=data.surahs.flatMap(s=>s.verses.map(v=>({...v,surah:s.number})));
const nodes=new Map(),events=new Map(),frames=new Map(),storage=new Map();let active='khatmaScreen',frameId=0,clock=0;
function flushFrame(delta=1000/60){clock+=delta;const tasks=[...frames.values()];frames.clear();for(const callback of tasks)callback(clock)}
function element(id=''){
  const classes=new Set(),listeners=new Map();let html='';
  const n={id,dataset:{},children:[],parentElement:null,scrollTop:0,clientHeight:600,textContent:'',hidden:false,disabled:false,
    classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
    setAttribute(k,v){this[k]=v},addEventListener(k,v){listeners.set(k,v)},listeners,
    before(){},after(child){body.appendChild(child)},focus(){},
    appendChild(child){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(c=>c!==child);this.children.push(child);child.parentElement=this;return child},
    getBoundingClientRect(){return{top:100,bottom:700,height:600,width:20}},
    style:{setProperty(key,value){this[key]=value}},closest(){return null},contains(target){return target===this},setPointerCapture(){},
    querySelectorAll(){return this.words||[]},
    querySelector(selector){const m=selector.match(/data-surah="(\d+)".*data-ayah="(\d+)"/);return m?this.words?.find(v=>Number(v.dataset.surah)===Number(m[1])&&Number(v.dataset.ayah)===Number(m[2])):null}
  };
  if(id==='desktopReadingScroll'){let scroll=0;Object.defineProperty(n,'scrollHeight',{get:()=>Math.max(600,(nodes.get('desktopReadingText')?.words?.length||0)*40+48)});Object.defineProperty(n,'scrollTop',{get:()=>scroll,set:value=>{scroll=Math.round(Math.max(0,Math.min(n.scrollHeight-n.clientHeight,value)))}})}
  Object.defineProperty(n,'innerHTML',{get:()=>html,set:value=>{
    html=value;
    if(id==='desktopReadingText'){
      if (value.startsWith('<')) { n.words=[]; return; }
      const meta=JSON.parse(value);
      n.words=verses.slice(meta.start,meta.end+1).map((v,i)=>({dataset:{surah:String(v.surah),ayah:String(v.ayah)},previousElementSibling:null,getBoundingClientRect:()=>({top:124+i*40-nodes.get('desktopReadingScroll').scrollTop,bottom:160+i*40-nodes.get('desktopReadingScroll').scrollTop})}));
    }else for(const [,name]of value.matchAll(/id="([^"]+)"/g))node(name);
  }});
  return n;
}
function node(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id)}
const body=element('body'),shell=node('appShell'),nav=node('nav'),mushafNav=node('mushafNav');body.appendChild(shell);shell.appendChild(nav);
node('quranText').words=[];node('freeQuranText').words=[];
const eveningTab=node('eveningAdhkarTab');
eveningTab.dataset.adhkar='evening';
eveningTab.onclick=()=>{};
const wide={matches:true,addEventListener:(type,callback)=>{wide.changed=callback}};
const state={language:'ar',quranLanguage:'ar',fontSize:26,selectedId:1,dayIndex:0,lastMushaf:{surah:'الفاتحة',ayah:1},khatmas:[{id:1,name:'First',parts:0,quarters:2,readings:{},total:0},{id:2,name:'Second',parts:0,quarters:4,readings:{},total:0}]};
const amount=k=>k.parts*8+k.quarters;
const rangeFor=(k,day)=>{const start=data.quarters[Math.min(239,day*amount(k))],end=data.quarters[Math.min(239,day*amount(k)+amount(k)-1)];return{startIndex:start.startIndex,endIndex:end.endIndex}};
const document={body,readyState:'complete',fullscreenElement:null,createElement:()=>element(),createComment:()=>element(),addEventListener:(type,callback)=>events.set(type,callback),querySelectorAll:s=>s==='.adhkar-tab'?[eveningTab]:[],querySelector:s=>s==='.app-shell'?shell:s==='.bottom-nav'?nav:s==='.screen.active'?node(active):mushafNav};
document.documentElement={dir:'rtl',requestFullscreen:async()=>{document.fullscreenElement=document.documentElement;events.get('fullscreenchange')?.()}};
document.exitFullscreen=async()=>{document.fullscreenElement=null;events.get('fullscreenchange')?.()};
document.getSelection=()=>({isCollapsed:true});
const context=vm.createContext({document,matchMedia:()=>wide,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},quranData:data,requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId},cancelAnimationFrame:id=>frames.delete(id),$:node,state,quranVerses:verses,surahs:data.surahs.map(s=>[s.name||String(s.number)]),surahEnglishNames:data.surahs.map(s=>s.transliteratedName),L:(ar,en)=>state.language==='en'?en:ar,selected:()=>state.khatmas.find(k=>k.id===state.selectedId),amount,rangeFor,reading:(k,i)=>k.readings[i]||0,scheduleDate:(k,i)=>new Date(2026,10,1+i),dateKey:d=>d.toISOString().slice(0,10),hasEarlierUnread:()=>false,allowWerdReading:async()=>true,setReading:(k,i,v)=>{k.readings[i]=v},reconcileKhatmaReadings:k=>{k.total=Object.values(k.readings).reduce((a,b)=>a+b,0)},persist(){},shareWird(){},showScreen:id=>{active=id;if(id==='khatmaScreen')state.dayIndex=0},showMushafPosition(){},applyLanguage:()=>{document.documentElement.dir=state.language==='en'?'ltr':'rtl'},renderState(){},renderQuranPassage:(start,end,prefix)=>JSON.stringify({start,end,prefix,language:state.quranLanguage})});
mushafNav.onclick=()=>context.showScreen('mushafScreen');
context.activeAdhkar='morning';
context.renderAdhkar=()=>{node('adhkarList').innerHTML=`<article>${context.activeAdhkar}</article>`};
vm.runInContext(source,context);
const workspace=body.children.find(n=>n.className==='desktop-workspace');
assert.equal(shell.parentElement,node('desktopControlScroll'));
assert.equal(nav.parentElement,node('desktopControls'));
assert.equal(workspace.dataset.readerMode,'mushaf');
assert.equal(workspace.dataset.readerEnd,String(verses.length-1));
context.showScreen('readingScreen');
assert.equal(active,'khatmaScreen','Reading must not replace the control screen');
assert.equal(workspace.dataset.readerMode,'werd');
assert.equal(workspace.dataset.readerEnd,String(rangeFor(state.khatmas[0],0).endIndex));
const passage=node('desktopReadingText').innerHTML;
node('desktopReadingScroll').scrollTop=712;
state.selectedId=2;state.dayIndex=3;context.renderState();context.showScreen('settingsScreen');
assert.equal(node('desktopReadingText').innerHTML,passage,'Changing the selected Khatma must not replace the open Werd');
assert.equal(node('desktopReadingScroll').scrollTop,712,'Control navigation must preserve reader scroll');
await node('desktopCompleteWerd').onclick();
assert.equal(state.khatmas[0].readings[0],2,'Completion must target the Werd open in the reader');
assert.equal(state.khatmas[1].total,0);
assert.equal(state.selectedId,2);assert.equal(state.dayIndex,3);
context.showScreen('mushafScreen');
assert.equal(active,'settingsScreen');
state.language='en';state.quranLanguage='en';context.applyLanguage();
assert.equal(document.documentElement.dir,'ltr');assert.equal(node('desktopReadingText').lang,'en');
assert.equal(node('desktopReaderMode').textContent,'Complete Quran');
await node('desktopFullscreen').onclick();assert.equal(document.fullscreenElement,document.documentElement);
assert.equal(node('desktopFullscreen').textContent,'Exit Full Screen');
await node('desktopFullscreen').onclick();assert.equal(document.fullscreenElement,null);
wide.matches=false;wide.changed();
assert.equal(shell.parentElement,body);assert.equal(nav.parentElement,shell);
context.showScreen('readingScreen');state.selectedId=2;state.dayIndex=3;
wide.matches=true;wide.changed();
assert.equal(workspace.dataset.readerStart,String(rangeFor(state.khatmas[1],3).startIndex),'Expanding a narrow window must retain the open Werd, even when Home resets the selected day');
console.log('✓ Independent navigation and scroll, captured Werd completion, full Quran bounds, Arabic/English direction, fullscreen enter/exit, and responsive window transitions');

// Desktop font controls must never change the app-wide Quran font preference.
const appFont=state.fontSize;
assert.equal(node('desktopReadingText').style['--desktop-reading-size'],'28px');
node('desktopFontPlus').onclick();
assert.equal(node('desktopReadingText').style['--desktop-reading-size'],'32px');
assert.equal(state.fontSize,appFont);
for(let i=0;i<12;i++)node('desktopFontPlus').onclick();
assert.equal(node('desktopFontPlus').disabled,true);
assert.equal(node('desktopReadingText').style['--desktop-reading-size'],'44px');
node('desktopFontRange').oninput({target:{value:'2'}});
assert.equal(workspace.dataset.fontStep,'2');
assert.equal(storage.get('werdy_desktop_font_step'),'2');
assert.equal(state.fontSize,appFont);
const pane=node('desktopReadingScroll'),rail=node('desktopReadingRail');
frames.clear();pane.scrollTop=0;
node('desktopAutoToggle').onclick();
for(let i=0;i<120;i++)flushFrame();
assert.ok(pane.scrollTop>5&&pane.scrollTop<40,'Slow scrolling must accumulate fractional movement even with an integer scrollTop');
assert.equal(workspace.dataset.autoScrolling,'true');
pane.scrollTop+=240;const manual=pane.scrollTop;flushFrame();
assert.ok(pane.scrollTop>=manual);assert.equal(workspace.dataset.autoScrolling,'true','Manual scrolling must not pause auto scroll');
pane.listeners.get('click')({target:node('desktopReadingText')});
assert.equal(workspace.dataset.autoScrolling,'false','Clicking the reading text must pause');
const paused=pane.scrollTop;for(let i=0;i<20;i++)flushFrame();assert.equal(pane.scrollTop,paused);
pane.listeners.get('click')({target:node('desktopReadingText')});
assert.equal(workspace.dataset.autoScrolling,'true','A second click must resume');
context.showScreen('settingsScreen');assert.equal(workspace.dataset.autoScrolling,'true');
for(let i=0;i<10;i++)node('desktopSpeedPlus').onclick();
assert.equal(workspace.dataset.speedStep,'4');assert.equal(node('desktopSpeedPlus').disabled,true);
rail.listeners.get('keydown')({key:'PageDown',preventDefault(){}});
assert.equal(workspace.dataset.autoScrolling,'true','Dragging or seeking the rail must keep auto scroll running');
pane.scrollTop=pane.scrollHeight-pane.clientHeight;flushFrame();
assert.equal(workspace.dataset.autoScrolling,'false','Auto scroll must stop at the end');
assert.equal(rail['aria-valuenow'],'100');
state.lastMushaf={surah:context.surahs[17][0],ayah:10};
context.showMushafPosition(true);flushFrame();
assert.equal(workspace.dataset.readerMode,'surah');
assert.equal(workspace.dataset.readerStart,String(data.surahs[17].start));
assert.equal(workspace.dataset.readerEnd,String(data.surahs[17].start+data.surahs[17].ayahCount-1));
assert.equal(node('desktopReadingText').words.length,110,'An explicitly selected Kahf must contain only its 110 verses');
rail.listeners.get('keydown')({key:'End',preventDefault(){}});
assert.equal(workspace.dataset.readerMode,'surah','Seeking to the end alone must not expand the selected Surah');
const last=node('desktopReadingText').words.at(-1),endOffset=last.getBoundingClientRect().top;
pane.listeners.get('wheel')({deltaY:60});
assert.equal(workspace.dataset.readerMode,'mushaf','Continuing beyond the Surah must return to full Quran scope');
assert.equal(node('desktopReadingText').words.length,6236);
const restored=node('desktopReadingText').querySelector('[data-surah="18"][data-ayah="110"]');
assert.ok(Math.abs(restored.getBoundingClientRect().top-endOffset)<=1,'Expanding the scope must keep the last verse in place');
context.showMushafPosition(true);flushFrame();
node('desktopNextSurah').onclick();
assert.equal(workspace.dataset.readerMode,'mushaf');
assert.equal(workspace.dataset.readerEnd,'6235');
console.log('✓ Seven desktop-only font steps, five speed limits, smooth fractional motion, click pause/resume, manual scrolling while running, end stop, permanent rail, selected-Surah scope and anchored expansion');

context.renderAdhkar();
context.showScreen('adhkarScreen');
assert.equal(workspace.dataset.readerMode,'adhkar');
assert.equal(workspace.dataset.readerStart,undefined);
assert.equal(node('desktopReaderTitle').textContent,'Morning Adhkar');
assert.equal(node('desktopReadingText').innerHTML,'<article>morning</article>');
eveningTab.onclick();
assert.equal(node('desktopReaderTitle').textContent,'Evening Adhkar');
assert.equal(node('desktopReadingText').innerHTML,'<article>evening</article>');
assert.match(node('desktopReadingRail')['aria-valuetext'],/Evening Adhkar/);
state.language='ar';
context.applyLanguage();
assert.equal(node('desktopReadingText').lang,'ar');
assert.equal(node('desktopReaderTitle').textContent,'أذكار المساء');
mushafNav.onclick();
assert.equal(workspace.dataset.readerMode,'mushaf');
console.log('✓ Desktop Adhkar selection, language, scrollbar scope, and return to Quran');
