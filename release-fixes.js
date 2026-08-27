/* Werdy release fixes kept separate so web and native builds run identical code. */
let timelineExpanded=false;

function seedPriorWerds(k,count){
  const a=amount(k),totalDays=Math.ceil(240/a),safe=Math.max(0,Math.min(totalDays,Number(count)||0));
  k.priorWerds=safe;k.readings={};
  for(let i=0;i<safe;i++)k.readings[String(i)]=Math.min(a,240-i*a);
  k.total=Math.min(240,safe*a);delete k.reopenDay;delete k.lastCompletionAt;
}
function nextFajrAfter(value){
  if(!value)return null;
  const next=new Date(value);next.setDate(next.getDate()+1);
  const [hour,minute]=String(state.prayer.fajr||'05:00').split(':').map(Number);
  next.setHours(hour||0,minute||0,0,0);return next;
}
function dailyWerdLocked(k){const unlock=nextFajrAfter(k.lastCompletionAt);return Boolean(unlock&&new Date()<unlock)}
function effectiveWerdDate(now=new Date()){
  const effective=new Date(now),[hour,minute]=String(state.prayer.fajr||'05:00').split(':').map(Number),todayFajr=new Date(now);
  todayFajr.setHours(hour||0,minute||0,0,0);
  if(now<todayFajr)effective.setDate(effective.getDate()-1);
  effective.setHours(23,59,59,999);
  return effective;
}
// A Werd day changes at Fajr, not at midnight. Only the reading days configured
// on this individual Khatma are counted.
currentScheduleIndex=k=>{
  const start=new Date(`${k.startDate}T12:00:00`),end=effectiveWerdDate(),cursor=new Date(start);let count=0;
  while(cursor<=end){if(k.days.includes(jsDays[cursor.getDay()]))count++;cursor.setDate(cursor.getDate()+1)}
  return Math.max(0,count-1);
};
// The range card, action and collapsed history row all point at this same index.
function displayedWerdIndex(k){
  const scheduled=currentScheduleIndex(k),unread=Math.max(firstUnreadIndex(k),Number(k.priorWerds)||0);
  return dailyWerdLocked(k)?Math.max(scheduled,unread-1):Math.max(scheduled,unread);
}
function scheduleVerification(k,index=firstUnreadIndex(k)){
  const date=scheduleDate(k,index),day=date.toLocaleDateString(isEn()?'en-GB':'ar-EG-u-nu-latn',{weekday:'long'});
  return L(`موعد الوِرد رقم ${index+1}: ${day}، ${localizedDate(date)}`,`Werd ${index+1} Is Scheduled For ${day}, ${localizedDate(date)}`);
}
function updateKhatmaSchedulePreview(){
  const k=selected(),draft={...k,startDate:$('khatmaStartDateInput').value||dateKey(),priorWerds:Number(westernDigits($('khatmaPriorWerds').value))||0};
  const todayIndex=displayedWerdIndex(draft);
  $('khatmaSchedulePreview').textContent=scheduleVerification(draft,todayIndex);
}

const openOptionsCalendarCore=openOptions;
openOptions=(isNew=false)=>{
  openOptionsCalendarCore(isNew);const k=selected(),locked=!isNew&&hasStartedReading(k);
  $('khatmaStartDateInputLabel').textContent=L('تاريخ بداية الختمة','Khatma Start Date');
  $('khatmaPriorWerdsLabel').textContent=L('الأوراد المقروءة سابقًا','Previously Read Werds');
  $('khatmaStartDateInput').value=k.startDate||dateKey();$('khatmaPriorWerds').value=k.priorWerds||0;
  for(const field of [$('khatmaStartDateInput'),$('khatmaPriorWerds')]){field.readOnly=locked;field.dataset.locked=String(locked)}
  updateKhatmaSchedulePreview();
};
$('khatmaStartDateInput').oninput=updateKhatmaSchedulePreview;
$('khatmaPriorWerds').oninput=()=>{$('khatmaPriorWerds').value=Math.max(0,Number(westernDigits($('khatmaPriorWerds').value))||0);updateKhatmaSchedulePreview()};
const saveOptionsCalendarCore=$('saveKhatmaOptionsBtn').onclick;
$('saveKhatmaOptionsBtn').onclick=async()=>{
  const k=selected(),locked=!editingNewKhatma&&hasStartedReading(k);
  if(!locked){const {p,q}=normalizeOptions('save');k.parts=p;k.quarters=q;k.startDate=$('khatmaStartDateInput').value||dateKey();seedPriorWerds(k,$('khatmaPriorWerds').value)}
  state.dayIndex=displayedWerdIndex(k);
  await saveOptionsCalendarCore();
};

const completeCurrentWirdCore=completeCurrentWird;
completeCurrentWird=async()=>{const completed=await completeCurrentWirdCore();if(completed){selected().lastCompletionAt=new Date().toISOString();persist()}return completed};

const renderTimelineFull=renderTimeline;
renderTimeline=()=>{
  renderTimelineFull();const rows=[...$('wirdTimeline').children],current=Math.min(rows.length-1,Math.max(0,state.dayIndex));
  rows.forEach((row,index)=>row.classList.toggle('history-hidden',!timelineExpanded&&index!==current));
  const undoRow=rows.find(row=>row.classList.contains('can-undo'));
  if(undoRow){
    const index=rows.indexOf(undoRow),k=selected();
    undoRow.onclick=async()=>{
      const approved=await appDialog({title:L('تغيير حالة الوِرد','Change Werd Status'),message:L(`هل تريد إعادة وِرد اليوم ${index+1} إلى حالة «غير مقروء»؟`,`Mark Werd Day ${index+1} As Unread?`),confirmText:L('تأكيد','Confirm'),showCancel:true});
      if(!approved)return;
      const old=reading(k,index);k.readings[String(index)]=0;k.total=Math.max(0,k.total-old);k.reopenDay=index;delete k.lastCompletionAt;state.dayIndex=index;persist();renderState();
    };
  }
  $('timelineToggleLabel').textContent=timelineExpanded?L('إخفاء السجل','Hide History'):L('إظهار الكل','Show All');
  $('timelineToggle').classList.toggle('expanded',timelineExpanded);
};
$('timelineToggle').onclick=()=>{timelineExpanded=!timelineExpanded;renderTimeline()};

const renderStateReleaseCore=renderState;
renderState=()=>{
  renderStateReleaseCore();const k=selected(),a=amount(k),done=reading(k,state.dayIndex),locked=dailyWerdLocked(k);
  $('khatmaStartCard').disabled=done>=a||locked;
  $('khatmaShareBtn').disabled=false;$('khatmaShareBtn').setAttribute('aria-disabled','false');$('khatmaShareBtn').tabIndex=0;
  $('khatmaStartCard').textContent=done>=a||locked?L('تمت قراءة وِرد اليوم ✓','Today’s Werd Has Been Read ✓'):L('ابدأ وِرد اليوم','Start Today’s Werd');
  $('khatmaStageLine').textContent=`${$('khatmaStageLine').textContent} · ${scheduleVerification(k,state.dayIndex)}`;
};

$('settingsHeaderBtn').onclick=()=>showScreen('settingsScreen');
const adhkarNav=document.querySelector('.nav-item[data-target="adhkarScreen"]');
adhkarNav.onclick=()=>{renderAdhkar();showScreen('adhkarScreen')};
const applyLanguageReleaseCore=applyLanguage;
applyLanguage=()=>{
  applyLanguageReleaseCore();adhkarNav.querySelector('span').textContent=L('الأذكار','Adhkar');
  $('settingsHeaderBtn').setAttribute('aria-label',L('الإعدادات','Settings'));
};

$('languageSelect').onchange=e=>{
  state.language=e.target.value;state.quranLanguage=e.target.value;$('quranLanguageSelect').value=state.quranLanguage;
  persist();renderSurahs();renderState();loadPrayerTimes();markSettingsDirty();
};
const continueOnboardingReleaseCore=$('continueOnboarding').onclick;
$('continueOnboarding').onclick=()=>{state.quranLanguage=onboardingLanguage;continueOnboardingReleaseCore()};

const loadPrayerTimesReleaseCore=loadPrayerTimes;
loadPrayerTimes=async(...args)=>{
  await loadPrayerTimesReleaseCore(...args);const keys=['Fajr','Dhuhr','Asr','Maghrib','Isha'],times={};
  [...document.querySelectorAll('.prayer-row strong')].forEach((node,index)=>{
    const match=node.textContent.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);if(!match||!keys[index])return;
    let hour=Number(match[1]);if(match[3]){if(match[3].toUpperCase()==='PM'&&hour<12)hour+=12;if(match[3].toUpperCase()==='AM'&&hour===12)hour=0}
    times[keys[index]]=`${String(hour).padStart(2,'0')}:${match[2]}`;
  });
  if(times.Fajr){state.prayer.times=times;state.prayer.fajr=times.Fajr;state.prayer.updatedAt=new Date().toISOString();persist();return}
  if(state.prayer.times?.Fajr){
    const names={Fajr:L('الفجر','Fajr'),Dhuhr:L('الظهر','Dhuhr'),Asr:L('العصر','Asr'),Maghrib:L('المغرب','Maghrib'),Isha:L('العشاء','Isha')};
    $('prayerTimes').innerHTML=Object.entries(names).map(([key,name])=>{const mode=state.prayer.alerts?.[key]||'off',alert=prayerAlertMarkup(mode);return`<article class="prayer-row"><span>${name}</span><button class="prayer-alert ${mode}" data-prayer="${key}" title="${alert.label}" aria-label="${name}: ${alert.label}">${alert.html}</button><strong>${formatTime(state.prayer.times[key])}</strong></article>`}).join('');
    document.querySelectorAll('.prayer-alert').forEach(b=>b.onclick=e=>{e.stopPropagation();cyclePrayerAlert(b.dataset.prayer,b)});
    const updated=state.prayer.updatedAt?localizedDate(new Date(state.prayer.updatedAt)):L('وقت سابق','An Earlier Time');
    $('prayerLocationStatus').textContent=L(`المواقيت المعروضة هي آخر مواقيت محفوظة، وآخر تحديث كان بتاريخ ${updated}.`,`Showing The Last Saved Prayer Times. Last Updated On ${updated}.`);
  }
};

window.addEventListener('werdy:notification-open',event=>{
  const extra=event.detail||{};
  if(extra.type==='werd'){
    const id=Number(extra.khatmaId),k=state.khatmas.find(item=>item.id===id);
    if(k)selectKhatma(id,firstUnreadIndex(k));showScreen('khatmaScreen');
  }else if(extra.type==='prayer')showScreen('groupScreen');
  else if(extra.type==='kahf'){state.lastMushaf={surah:'الكهف',ayah:1};showScreen('mushafScreen');showMushafPosition(true)}
});

const showScreenReleaseCore=showScreen;
showScreen=id=>{
  showScreenReleaseCore(id);
  if(id==='khatmaScreen'){
    const intended=displayedWerdIndex(selected());
    if(state.dayIndex!==intended){state.dayIndex=intended;renderState()}
  }
  if(id==='mushafScreen')document.body.classList.remove('mushaf-controls-hidden');
};

for(const id of ['khatmaReminderTime','kahfNotificationTime']){
  const input=$(id),shell=input?.closest('.time-field-shell');
  shell?.addEventListener('click',()=>{input.focus({preventScroll:true});try{input.showPicker?.()}catch{}});
}

renderState();loadPrayerTimes();
