/* Desktop workspace for the web release only. No native source or bundles depend on it. */
(() => {
  function startDesktopWorkspace() {
    const wide = matchMedia('(min-width: 960px)');
    const shell = document.querySelector('.app-shell');
    const nav = document.querySelector('.bottom-nav');
    const originalPlace = document.createComment('web app original position');
    shell.before(originalPlace);
    const workspace = document.createElement('div');
    workspace.className = 'desktop-workspace';
    workspace.innerHTML = `
      <aside class="desktop-controls" id="desktopControls" aria-label="وردي">
        <div class="desktop-control-scroll" id="desktopControlScroll"></div>
      </aside>
      <section class="desktop-reader" id="desktopReader" aria-labelledby="desktopReaderTitle">
        <header class="desktop-reader-header">
          <div class="desktop-reader-heading"><p id="desktopReaderMode"></p><h1 id="desktopReaderTitle"></h1></div>
          <button type="button" class="desktop-fullscreen" id="desktopFullscreen" aria-pressed="false"></button>
        </header>
        <p class="desktop-reader-context" id="desktopReaderContext"></p>
        <div class="desktop-reading-stage">
          <div class="desktop-reading-scroll" id="desktopReadingScroll" tabindex="0"><article class="desktop-reading-text quran-content quran-passage" id="desktopReadingText"></article></div>
          <div class="desktop-reading-rail" id="desktopReadingRail" role="scrollbar" tabindex="0" aria-controls="desktopReadingScroll" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="desktopReadingThumb"></span></div>
        </div>
        <footer class="desktop-reader-footer" id="desktopReaderFooter">
          <div class="desktop-tool-group">
            <label class="desktop-tool-label" for="desktopFontRange" id="desktopFontLabel"></label>
            <div class="desktop-step-control">
              <button type="button" id="desktopFontMinus">−</button>
              <input type="range" id="desktopFontRange" min="0" max="6" step="1" />
              <button type="button" id="desktopFontPlus">+</button>
              <output id="desktopFontValue" for="desktopFontRange"></output>
            </div>
          </div>
          <div class="desktop-tool-group desktop-auto-group">
            <span class="desktop-tool-label" id="desktopAutoLabel"></span>
            <div class="desktop-auto-controls">
              <button type="button" class="desktop-auto-toggle" id="desktopAutoToggle" aria-pressed="false"></button>
              <div class="desktop-step-control">
                <button type="button" id="desktopSpeedMinus">−</button>
                <output id="desktopSpeedValue"></output>
                <button type="button" id="desktopSpeedPlus">+</button>
              </div>
            </div>
          </div>
          <button type="button" class="small-btn desktop-next-surah" id="desktopNextSurah" hidden></button>
          <div class="desktop-werd-actions" id="desktopWerdActions">
            <span id="desktopWerdProgress"></span>
            <button type="button" class="small-btn" id="desktopShareWerd"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 16V3m0 0L7 8m5-5 5 5"/></svg><span id="desktopShareWerdLabel"></span></button>
            <button type="button" class="primary-btn" id="desktopCompleteWerd"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span id="desktopCompleteWerdLabel"></span></button>
          </div>
        </footer>
        <p class="desktop-reader-status" id="desktopReaderStatus" role="status" aria-live="polite"></p>
      </section>`;
    document.body.appendChild(workspace);
    const controlScroll = $('desktopControlScroll');
    const readerScroll = $('desktopReadingScroll');
    const text = $('desktopReadingText');
    let session = null;
    let controlScreen = document.querySelector('.screen.active')?.id || 'khatmaScreen';
    let lastMushafPosition = null;
    let scrollFrame = 0;
    let completing = false;
    let wordNodes = [];
    const fontSizes = [22,25,28,32,36,40,44];
    const scrollSpeeds = [8,12,18,25,34]; // Pixels per second, independent of refresh rate.
    function savedStep(key,fallback,max){try{const raw=localStorage.getItem(key);if(raw===null)return fallback;const value=Number(raw);return Number.isFinite(value)?Math.max(0,Math.min(max,Math.round(value))):fallback}catch{return fallback}}
    function saveStep(key,value){try{localStorage.setItem(key,String(value))}catch{}}
    let fontStep = savedStep('werdy_desktop_font_step',2,fontSizes.length-1);
    let speedStep = savedStep('werdy_desktop_scroll_speed',1,scrollSpeeds.length-1);
    let autoRunning = false, autoFrame = 0, autoLastTime = null, autoTarget = 0, autoApplied = 0;
    const rail = $('desktopReadingRail'), thumb = $('desktopReadingThumb');
    text.style.setProperty('--desktop-reading-size',`${fontSizes[fontStep]}px`);

    function isQuranSession(){return session?.mode === 'mushaf' || session?.mode === 'surah'}
    function adhkarTitle(){
      return session?.category === 'evening' ? L('أذكار المساء','Evening Adhkar') : L('أذكار الصباح','Morning Adhkar');
    }
    function scrollMaximum(){return Math.max(0,readerScroll.scrollHeight-readerScroll.clientHeight)}
    function updateRail(){
      const height=rail.clientHeight;if(!height)return;
      const max=scrollMaximum();
      if (autoRunning && readerScroll.scrollTop >= max - 1) stopAuto();
      const ratio=max?Math.max(0,Math.min(1,readerScroll.scrollTop/max)):0;
      const size=Math.min(height,Math.max(32,height*readerScroll.clientHeight/Math.max(1,readerScroll.scrollHeight)));
      thumb.style.height=`${size}px`;thumb.style.transform=`translateY(${ratio*(height-size)}px)`;
      rail.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
      rail.setAttribute('aria-label',L('موضع القراءة','Reading Position'));
      const scope=session?.mode==='adhkar'?adhkarTitle():session?.mode==='werd'?L('الوِرد','the Werd'):session?.mode==='surah'?L(`سورة ${surahs[session.surahNumber-1][0]}`,`Surah ${surahEnglishNames[session.surahNumber-1]}`):L('المصحف الكامل','the Complete Quran');
      rail.setAttribute('aria-valuetext',L(`${Math.round(ratio*100)}٪ من ${scope}`,`${Math.round(ratio*100)}% of ${scope}`));
    }
    function updateTools(){
      $('desktopFontLabel').textContent=L('حجم الخط','Text Size');
      $('desktopFontMinus').setAttribute('aria-label',L('تصغير خط القراءة','Decrease Reading Text Size'));
      $('desktopFontPlus').setAttribute('aria-label',L('تكبير خط القراءة','Increase Reading Text Size'));
      $('desktopFontMinus').disabled=fontStep===0;$('desktopFontPlus').disabled=fontStep===fontSizes.length-1;
      $('desktopFontRange').value=String(fontStep);
      $('desktopFontRange').setAttribute('aria-valuetext',L(`حجم ${fontSizes[fontStep]}، الدرجة ${fontStep+1} من 7`,`Size ${fontSizes[fontStep]}, Step ${fontStep+1} of 7`));
      $('desktopFontValue').textContent=String(fontSizes[fontStep]);
      $('desktopAutoLabel').textContent=L('التمرير التلقائي · اضغط على النص للتشغيل أو الإيقاف','Auto Scroll · Click Text to Play or Pause');
      $('desktopAutoToggle').textContent=autoRunning?L('Ⅱ إيقاف','Ⅱ Pause'):L('▷ تشغيل','▷ Play');
      $('desktopAutoToggle').setAttribute('aria-pressed',String(autoRunning));
      $('desktopSpeedMinus').setAttribute('aria-label',L('تقليل سرعة التمرير','Decrease Scroll Speed'));
      $('desktopSpeedPlus').setAttribute('aria-label',L('زيادة سرعة التمرير','Increase Scroll Speed'));
      $('desktopSpeedMinus').disabled=speedStep===0;$('desktopSpeedPlus').disabled=speedStep===scrollSpeeds.length-1;
      $('desktopSpeedValue').textContent=`${speedStep+1} / ${scrollSpeeds.length}`;
      $('desktopSpeedValue').setAttribute('aria-label',L(`السرعة ${speedStep+1} من 5`,`Speed ${speedStep+1} of 5`));
      $('desktopNextSurah').hidden=session?.mode!=='surah'||session.surahNumber>=114;
      $('desktopNextSurah').textContent=L('السورة التالية ←','Next Surah →');
      workspace.dataset.autoScrolling=String(autoRunning);
      workspace.dataset.fontStep=String(fontStep);workspace.dataset.speedStep=String(speedStep);
    }
    function stopAuto(){
      autoRunning=false;if(autoFrame)cancelAnimationFrame(autoFrame);
      autoFrame=0;autoLastTime=null;updateTools();
    }
    function autoTick(time){
      if(!autoRunning)return;
      if(!wide.matches){stopAuto();return}
      const elapsed=autoLastTime===null?0:Math.min(80,Math.max(0,time-autoLastTime));autoLastTime=time;
      // A manual wheel, touch, keyboard, or rail seek changes the origin, not the running state.
      if(Math.abs(readerScroll.scrollTop-autoApplied)>2)autoTarget=readerScroll.scrollTop;
      const max=scrollMaximum();autoTarget=Math.min(max,autoTarget+scrollSpeeds[speedStep]*elapsed/1000);
      readerScroll.scrollTop=autoTarget;autoApplied=readerScroll.scrollTop;
      if(readerScroll.scrollTop>=max-1){readerScroll.scrollTop=max;stopAuto();updateRail();return}
      autoFrame=requestAnimationFrame(autoTick);
    }
    function toggleAuto(){
      if(autoRunning){stopAuto();return}
      if(!session||scrollMaximum()<=0||readerScroll.scrollTop>=scrollMaximum()-1){$('desktopReaderStatus').textContent=L('وصلت إلى نهاية المحتوى المعروض.','You Have Reached the End of This Reading.');return}
      autoRunning=true;autoTarget=readerScroll.scrollTop;autoApplied=autoTarget;autoLastTime=null;
      $('desktopReaderStatus').textContent='';updateTools();autoFrame=requestAnimationFrame(autoTick);
    }
    function setFontStep(value){
      const position=readerAnchor();
      const anchor=session?.mode === 'adhkar'
        ? [...text.children].find(card => card.getBoundingClientRect().bottom > readerScroll.getBoundingClientRect().top)
        : position?text.querySelector(`[data-surah="${position.surah}"][data-ayah="${position.ayah}"]`):null;
      const offset=anchor?anchor.getBoundingClientRect().top-readerScroll.getBoundingClientRect().top:null;
      fontStep=Math.max(0,Math.min(fontSizes.length-1,Math.round(Number(value)||0)));
      text.style.setProperty('--desktop-reading-size',`${fontSizes[fontStep]}px`);
      if(anchor&&offset!==null)readerScroll.scrollTop+=anchor.getBoundingClientRect().top-readerScroll.getBoundingClientRect().top-offset;
      autoTarget=readerScroll.scrollTop;autoApplied=autoTarget;
      saveStep('werdy_desktop_font_step',fontStep);updateTools();updateRail();
    }
    function setSpeedStep(value){speedStep=Math.max(0,Math.min(scrollSpeeds.length-1,value));saveStep('werdy_desktop_scroll_speed',speedStep);updateTools()}


    function readerAnchor() {
      if (!wordNodes.length) return null;
      const line = readerScroll.getBoundingClientRect().top + readerScroll.clientHeight / 3;
      let low = 0, high = wordNodes.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (wordNodes[mid].getBoundingClientRect().bottom < line) low = mid + 1;
        else high = mid;
      }
      const verse = wordNodes[low];
      return {surah:Number(verse.dataset.surah),ayah:Number(verse.dataset.ayah)};
    }
    function goToVerse(position, atThird = true) {
      if (!position) return;
      const verse = text.querySelector(`[data-surah="${position.surah}"][data-ayah="${position.ayah}"]`);
      if (!verse) return;
      let title = verse;
      if(position.ayah===1){let before=verse.previousElementSibling;while(before&&!before.classList.contains('passage-surah-title'))before=before.previousElementSibling;title=before||verse;}
      readerScroll.scrollTop += title.getBoundingClientRect().top - readerScroll.getBoundingClientRect().top - (atThird ? readerScroll.clientHeight / 3 : 24);
      updateCurrentSurah();
    }
    function updateCurrentSurah() {
      const anchor = readerAnchor();
      if (!anchor || !session) return;
      session.position = anchor;
      $('desktopReaderTitle').textContent = L(`سورة ${surahs[anchor.surah-1][0]}`, `Surah ${surahEnglishNames[anchor.surah-1]}`);
    }
    function validWerd() {
      if (session?.mode !== 'werd') return null;
      const k = state.khatmas.find(item => item.id === session.khatmaId);
      if (!k) return null;
      const range = rangeFor(k, session.dayIndex);
      return range.startIndex === session.startIndex && range.endIndex === session.endIndex && dateKey(scheduleDate(k,session.dayIndex)) === session.date ? k : null;
    }
    function updateLabels() {
      $('desktopControls').setAttribute('aria-label', L('برنامج وردي', 'Werdy App'));
      readerScroll.setAttribute('aria-label', L('منطقة القراءة المستقلة', 'Independent Reading Pane'));
      const full = Boolean(document.fullscreenElement);
      $('desktopFullscreen').textContent = full ? L('الخروج من ملء الشاشة', 'Exit Full Screen') : L('ملء الشاشة', 'Full Screen');
      $('desktopFullscreen').setAttribute('aria-pressed', String(full));
      $('desktopReaderMode').textContent = session?.mode === 'adhkar' ? L('الأذكار','Adhkar') : session?.mode === 'werd' ? L('قراءة الوِرد', 'Werd Reading') : session?.mode==='surah'?L('قراءة سورة محددة','Selected Surah'):L('المصحف الكامل', 'Complete Quran');
      $('desktopWerdActions').hidden = session?.mode !== 'werd';
      $('desktopShareWerdLabel').textContent = L('مشاركة الوِرد', 'Share Werd');
      $('desktopCompleteWerdLabel').textContent = L('تمت قراءة الوِرد كاملًا', 'Complete This Werd');
      if (session?.mode === 'werd') {
        const k = validWerd();
        const start = quranVerses[session.startIndex], end = quranVerses[session.endIndex];
        $('desktopReaderContext').textContent = L(`${session.name} · وِرد رقم ${session.dayIndex+1} · من ${surahs[start.surah-1][0]} ${start.ayah} إلى ${surahs[end.surah-1][0]} ${end.ayah}`, `${session.name} · Werd ${session.dayIndex+1} · ${surahEnglishNames[start.surah-1]} ${start.ayah} to ${surahEnglishNames[end.surah-1]} ${end.ayah}`);
        const done = k ? reading(k,session.dayIndex) : 0;
        $('desktopWerdProgress').textContent = k ? L(`${done} من ${amount(k)} ربع`, `${done} of ${amount(k)} quarters`) : L('تم تغيير إعدادات هذا الوِرد', 'This Werd Has Changed');
        $('desktopCompleteWerd').disabled = completing || !k || done >= amount(k) || hasEarlierUnread(k,session.dayIndex);
        $('desktopShareWerd').disabled = !k;
      } else if (session?.mode === 'adhkar') {
        $('desktopReaderTitle').textContent = adhkarTitle();
        $('desktopReaderContext').textContent = state.language === 'en' ? $('adhkarTranslationNote').textContent : '';
      } else if(session?.mode==='surah'){
        $('desktopReaderContext').textContent=L('القراءة وشريط التمرير لهذه السورة فقط. واصل التمرير بعد نهايتها للانتقال إلى المصحف الكامل.','Reading and Scroll Position Cover Only This Surah. Continue Past Its End to Read the Full Quran.');
      } else {
        $('desktopReaderContext').textContent = L('اقرأ هنا، وتنقّل في وردي مع الاحتفاظ بمكانك.', 'Read here while navigating Werdy without losing your place.');
      }
      updateCurrentSurah();updateTools();updateRail();
    }
    function renderSession(position) {
      if (!session) return;
      stopAuto();
      workspace.dataset.readerMode=session.mode;
      if (session.mode === 'adhkar') {
        delete workspace.dataset.readerStart;
        delete workspace.dataset.readerEnd;
        text.lang = state.language;
        text.dir = state.language === 'en' ? 'ltr' : 'rtl';
        text.innerHTML = $('adhkarList').innerHTML;
        session.language = state.language;
        wordNodes = [];
        readerScroll.scrollTop = 0;
        updateLabels();
        return;
      }
      workspace.dataset.readerStart=String(session.startIndex);
      workspace.dataset.readerEnd=String(session.endIndex);
      text.dir = state.quranLanguage === 'en' ? 'ltr' : 'rtl';
      text.lang = state.quranLanguage;
      text.innerHTML = renderQuranPassage(session.startIndex,session.endIndex,'desktop-verse');
      session.language = state.quranLanguage;
      wordNodes = [...text.querySelectorAll('.ayah[data-surah]')];
      readerScroll.scrollTop = 0;
      updateLabels();
      if (position) {
        const current = session;
        requestAnimationFrame(() => { if (session === current) goToVerse(position); });
      }
    }
    function openAdhkar() {
      if (isQuranSession()) lastMushafPosition = readerAnchor();
      if (session?.mode === 'adhkar' && session.category === activeAdhkar && session.language === state.language) return;
      session = {mode:'adhkar', category:activeAdhkar};
      renderSession();
      $('desktopReaderStatus').textContent = '';
    }
    function openMushaf(position=null,selectedSurah=false){
      if(!position&&!isQuranSession())position=lastMushafPosition||savedMushafPosition();
      if(!position&&session?.mode==='surah')position=readerAnchor();
      const number=selectedSurah?Math.max(1,Math.min(114,Number(position?.surah)||1)):null;
      const info=number?quranData.surahs[number-1]:null;
      const mode=selectedSurah?'surah':'mushaf';
      if(session?.mode!==mode||session.language!==state.quranLanguage||(selectedSurah&&session.surahNumber!==number)){
        session={mode,surahNumber:number,startIndex:info?info.start:0,endIndex:info?info.start+info.ayahCount-1:quranVerses.length-1,language:state.quranLanguage};
        renderSession(position);
      }else if(position){stopAuto();requestAnimationFrame(()=>goToVerse(position))}
      $('desktopReaderStatus').textContent='';
    }
    function leaveSurah(direction=1,jumpToNext=false){
      if(session?.mode!=='surah')return false;
      const wasRunning=autoRunning;
      const number=session.surahNumber,next=number+direction;
      if(next<1||next>114)return false;
      const verse=direction>0?wordNodes[wordNodes.length-1]:wordNodes[0];
      const position={surah:Number(verse.dataset.surah),ayah:Number(verse.dataset.ayah)};
      const offset=verse.getBoundingClientRect().top-readerScroll.getBoundingClientRect().top;
      session={mode:'mushaf',startIndex:0,endIndex:quranVerses.length-1,language:state.quranLanguage};
      renderSession();
      if(jumpToNext)goToVerse({surah:next,ayah:1});
      else {const anchor=text.querySelector(`[data-surah="${position.surah}"][data-ayah="${position.ayah}"]`);readerScroll.scrollTop+=anchor.getBoundingClientRect().top-readerScroll.getBoundingClientRect().top-offset;updateCurrentSurah()}
      updateRail();if(wasRunning)toggleAuto();return true;
    }
    function openWerd(k=selected(),index=state.dayIndex) {
      if(isQuranSession())lastMushafPosition=readerAnchor();
      const range = rangeFor(k,index);
      if (session?.mode === 'werd' && session.khatmaId === k.id && session.dayIndex === index && session.startIndex === range.startIndex && session.endIndex === range.endIndex && session.language === state.quranLanguage) return;
      session = {mode:'werd',khatmaId:k.id,name:k.name,dayIndex:index,date:dateKey(scheduleDate(k,index)),startIndex:range.startIndex,endIndex:range.endIndex,language:state.quranLanguage};
      renderSession();
      $('desktopReaderStatus').textContent = '';
    }
    function savedMushafPosition() {
      return {surah:Math.max(1,surahs.findIndex(([name])=>name===state.lastMushaf.surah)+1),ayah:state.lastMushaf.ayah};
    }

    const showScreenCore = showScreen;
    showScreen = id => {
      if (!wide.matches) return showScreenCore(id);
      if (id === 'readingScreen') { openWerd(); return; }
      if (id === 'mushafScreen') { openMushaf(); return; }
      controlScreen = id;
      showScreenCore(id);
      controlScroll.scrollTop = 0;
      if (id === 'adhkarScreen') openAdhkar();
      updateLabels();
    };
    const mushafPositionCore = showMushafPosition;
    showMushafPosition = (shouldScroll=false) => {
      if (!wide.matches) return mushafPositionCore(shouldScroll);
      if (shouldScroll) openMushaf(savedMushafPosition(),true);
    };
    const mushafNav = document.querySelector('.nav-item[data-target="mushafScreen"]');
    const mushafNavCore = mushafNav.onclick;
    mushafNav.onclick = event => wide.matches ? openMushaf() : mushafNavCore.call(mushafNav,event);
    document.querySelectorAll('.adhkar-tab').forEach(tab => {
      const tabCore = tab.onclick;
      tab.onclick = event => {
        if (!wide.matches) return tabCore.call(tab,event);
        activeAdhkar = tab.dataset.adhkar;
        renderAdhkar();
        openAdhkar();
      };
    });
    const languageCore = applyLanguage;
    applyLanguage = () => {
      languageCore();
      if (!wide.matches) return;
      if (session?.mode === 'adhkar') openAdhkar();
      else if (session && session.language !== state.quranLanguage) renderSession(readerAnchor());
      updateLabels();
    };
    const renderCore = renderState;
    renderState = () => { renderCore(); if (wide.matches) updateLabels(); };
    readerScroll.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => { scrollFrame=0;updateCurrentSurah();updateRail(); });
    }, {passive:true});
    $('desktopFontMinus').onclick=()=>setFontStep(fontStep-1);
    $('desktopFontPlus').onclick=()=>setFontStep(fontStep+1);
    $('desktopFontRange').oninput=event=>setFontStep(event.target.value);
    $('desktopSpeedMinus').onclick=()=>setSpeedStep(speedStep-1);
    $('desktopSpeedPlus').onclick=()=>setSpeedStep(speedStep+1);
    $('desktopAutoToggle').onclick=toggleAuto;
    $('desktopNextSurah').onclick=()=>leaveSurah(1,true);
    readerScroll.addEventListener('click',event=>{
      if(event.target.closest('button,input,a,[role="scrollbar"]'))return;
      if(event.target!==readerScroll&&!text.contains(event.target))return;
      if(document.getSelection?.()?.isCollapsed===false)return;
      toggleAuto();
    });
    readerScroll.addEventListener('wheel',event=>{
      if(session?.mode!=='surah')return;
      if(event.deltaY>0&&readerScroll.scrollTop>=scrollMaximum()-2)leaveSurah(1);
      else if(event.deltaY<0&&readerScroll.scrollTop<=2)leaveSurah(-1);
    },{passive:true});
    let touchY=null;
    readerScroll.addEventListener('touchstart',event=>{touchY=event.touches.length===1?event.touches[0].clientY:null},{passive:true});
    readerScroll.addEventListener('touchmove',event=>{
      if(touchY===null||event.touches.length!==1)return;
      const delta=touchY-event.touches[0].clientY;touchY=event.touches[0].clientY;
      if(delta>3&&readerScroll.scrollTop>=scrollMaximum()-2)leaveSurah(1);
      else if(delta< -3&&readerScroll.scrollTop<=2)leaveSurah(-1);
    },{passive:true});
    readerScroll.addEventListener('keydown',event=>{
      if(['ArrowDown','PageDown',' '].includes(event.key)&&!event.shiftKey&&readerScroll.scrollTop>=scrollMaximum()-2)leaveSurah(1);
      else if(['ArrowUp','PageUp'].includes(event.key)&&readerScroll.scrollTop<=2)leaveSurah(-1);
    });
    let railDrag=null;
    function seekRail(event){
      const rect=rail.getBoundingClientRect(),size=thumb.getBoundingClientRect().height;
      const ratio=Math.max(0,Math.min(1,(event.clientY-rect.top-(railDrag?.offset??size/2))/Math.max(1,rect.height-size)));
      readerScroll.scrollTop=ratio*scrollMaximum();autoTarget=readerScroll.scrollTop;autoApplied=autoTarget;updateRail();updateCurrentSurah();
    }
    rail.addEventListener('pointerdown',event=>{
      if(event.isPrimary===false)return;event.preventDefault();
      railDrag={id:event.pointerId,offset:event.target===thumb?event.clientY-thumb.getBoundingClientRect().top:thumb.getBoundingClientRect().height/2};
      rail.setPointerCapture(event.pointerId);seekRail(event);
    });
    rail.addEventListener('pointermove',event=>{if(railDrag?.id===event.pointerId)seekRail(event)});
    rail.addEventListener('pointerup',()=>railDrag=null);rail.addEventListener('pointercancel',()=>railDrag=null);
    rail.addEventListener('keydown',event=>{
      const steps={ArrowDown:60,ArrowUp:-60,PageDown:readerScroll.clientHeight,PageUp:-readerScroll.clientHeight};
      if(event.key==='Home')readerScroll.scrollTop=0;else if(event.key==='End')readerScroll.scrollTop=scrollMaximum();else if(event.key in steps)readerScroll.scrollTop+=steps[event.key];else return;
      event.preventDefault();autoTarget=readerScroll.scrollTop;autoApplied=autoTarget;updateRail();updateCurrentSurah();
    });
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{updateRail()}).observe(readerScroll);
    document.fonts?.ready?.then(updateRail);
    $('desktopShareWerd').onclick = () => { const k=validWerd(); if(k)shareWird(k.id,session.dayIndex); };
    $('desktopCompleteWerd').onclick = async () => {
      const current = session, k=validWerd();
      if (!k || completing || !await allowWerdReading(k,current.dayIndex)) return;
      if (session !== current || !validWerd()) return;
      completing = true; updateLabels();
      try {
        setReading(k,current.dayIndex,amount(k));reconcileKhatmaReadings(k);
        if(k.total>=240&&!k.completionDate)k.completionDate=dateKey();
        delete k.reopenDay;persist();renderState();
        $('desktopReaderStatus').textContent=L('تم تسجيل قراءة هذا الوِرد.', 'This Werd Has Been Marked As Read.');
      } finally { completing=false;updateLabels(); }
    };
    $('desktopFullscreen').onclick = async () => {
      try {
        if(document.fullscreenElement)await document.exitFullscreen();
        else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
        else throw new Error('unsupported');
        $('desktopReaderStatus').textContent='';
      } catch { $('desktopReaderStatus').textContent=L('تعذّر تشغيل ملء الشاشة في هذا المتصفح.', 'Full screen is unavailable in this browser.'); }
      updateLabels();
    };
    document.addEventListener('fullscreenchange',updateLabels);
    const changeLayout = () => {
      if (wide.matches) {
        const active=document.querySelector('.screen.active')?.id;
        const werdKhatma=selected(),werdIndex=state.dayIndex;
        const transfer=active==='readingScreen'||active==='mushafScreen';
        const narrowPosition=transfer?[...(active==='readingScreen'?$('quranText'):$('freeQuranText')).querySelectorAll('.ayah[data-surah]')].find(n=>n.getBoundingClientRect().bottom>100):null;
        document.body.classList.add('desktop-split');
        controlScroll.appendChild(shell);$('desktopControls').appendChild(nav);
        document.body.classList.remove('reading-mode','mushaf-mode','mushaf-controls-hidden');
        showScreenCore(transfer?'khatmaScreen':controlScreen);
        if(active==='readingScreen')openWerd(werdKhatma,werdIndex);
        else if (active === 'adhkarScreen') openAdhkar();
        else if(active==='mushafScreen'||!session)openMushaf(savedMushafPosition());
        if(narrowPosition)requestAnimationFrame(()=>goToVerse({surah:Number(narrowPosition.dataset.surah),ayah:Number(narrowPosition.dataset.ayah)}));
        updateLabels();
      } else {
        stopAuto();
        document.body.classList.remove('desktop-split');
        originalPlace.after(shell);shell.appendChild(nav);
        if(document.querySelector('.screen.active')?.id==='readingScreen'||document.querySelector('.screen.active')?.id==='mushafScreen')return;
        showScreenCore(controlScreen);
      }
    };
    wide.addEventListener('change',changeLayout);
    changeLayout();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startDesktopWorkspace,{once:true});
  else startDesktopWorkspace();
})();
