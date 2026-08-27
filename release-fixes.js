/* Werdy release fixes kept separate so web and native builds run identical code. */
let timelineExpanded=false;

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
function isScheduledToday(k){const today=effectiveWerdDate(),start=new Date(`${k.startDate}T12:00:00`);return today>=start&&k.days.includes(jsDays[today.getDay()])}
function nextScheduledDate(k){if(!k.days.length)return null;const today=effectiveWerdDate(),start=new Date(`${k.startDate}T12:00:00`),cursor=new Date(today<start?start:today);cursor.setHours(12,0,0,0);while(!k.days.includes(jsDays[cursor.getDay()]))cursor.setDate(cursor.getDate()+1);return cursor}
function scheduledWerdCount(k){const start=new Date(`${k.startDate}T12:00:00`),end=effectiveWerdDate(),cursor=new Date(start);let count=0;if(end<start)return 0;while(cursor<=end){if(k.days.includes(jsDays[cursor.getDay()]))count++;cursor.setDate(cursor.getDate()+1)}return count}
function scheduleProgress(k){const a=amount(k),due=scheduledWerdCount(k),todayIndex=Math.max(0,currentScheduleIndex(k)),todayComplete=reading(k,todayIndex)>=a,expected=Math.max(0,due-(isScheduledToday(k)&&!todayComplete?1:0)),completed=Object.values(k.readings||{}).filter(value=>Number(value)>=a).length;return{completed,expected,delta:completed-expected}}
renderScheduleDelta=()=>{const {completed,expected,delta}=scheduleProgress(selected());$('scheduleDelta').textContent=delta>0?L(`متقدم ${delta} يوم`,`${delta} Day${delta===1?'':'s'} Ahead`):delta<0?L(`متأخر ${Math.abs(delta)} يوم`,`${Math.abs(delta)} Day${Math.abs(delta)===1?'':'s'} Behind`):L('في الموعد','On Schedule');$('scheduleDeltaDetail').textContent=L(`${completed} من ${expected} وِرد مستحق`,`${completed} Of ${expected} Due Werd${expected===1?'':'s'}`)};
// A completed Werd remains today's Werd. Rest days preview the next scheduled one.
function displayedWerdIndex(k){
  const totalDays=Math.ceil(240/amount(k));
  return Math.min(totalDays-1,isScheduledToday(k)?currentScheduleIndex(k):scheduledWerdCount(k));
}
function scheduleVerification(k,index=firstUnreadIndex(k)){
  const date=scheduleDate(k,index),day=date.toLocaleDateString(isEn()?'en-GB':'ar-EG-u-nu-latn',{weekday:'long'});
  return L(`موعد الوِرد رقم ${index+1}: ${day}، ${localizedDate(date)}`,`Werd ${index+1} Is Scheduled For ${day}, ${localizedDate(date)}`);
}
function updateKhatmaSchedulePreview(){
  const k=selected(),draft={...k,startDate:$('khatmaStartDateInput').value||dateKey()};
  const todayIndex=displayedWerdIndex(draft);
  $('khatmaStartDateDisplay').textContent=localizedDate(draft.startDate);
  $('khatmaSchedulePreview').textContent=scheduleVerification(draft,todayIndex);
}

const openOptionsCalendarCore=openOptions;
openOptions=(isNew=false)=>{
  openOptionsCalendarCore(isNew);const k=selected(),locked=!isNew&&hasStartedReading(k);
  $('khatmaStartDateInputLabel').textContent=L('تاريخ بداية الختمة','Khatma Start Date');
  $('khatmaStartDateInput').value=k.startDate||dateKey();$('khatmaStartDateInput').readOnly=locked;$('khatmaStartDateInput').dataset.locked=String(locked);
  updateKhatmaSchedulePreview();
};
$('khatmaStartDateInput').oninput=updateKhatmaSchedulePreview;
const saveOptionsCalendarCore=$('saveKhatmaOptionsBtn').onclick;
let settingsReturnKhatmaId=null;
$('saveKhatmaOptionsBtn').onclick=async()=>{
  const k=selected(),locked=!editingNewKhatma&&hasStartedReading(k);
  if(!locked){const {p,q}=normalizeOptions('save');k.parts=p;k.quarters=q;k.startDate=$('khatmaStartDateInput').value||dateKey()}
  state.dayIndex=displayedWerdIndex(k);
  await saveOptionsCalendarCore();
  if(settingsReturnKhatmaId!==null&&$('khatmaOptionsModal').classList.contains('hidden')){state.selectedId=settingsReturnKhatmaId;settingsReturnKhatmaId=null;state.dayIndex=displayedWerdIndex(selected());persist();renderState()}
};
const cancelOptionsStableCore=$('cancelKhatmaOptionsBtn').onclick;
$('cancelKhatmaOptionsBtn').onclick=()=>{cancelOptionsStableCore();if(settingsReturnKhatmaId!==null){state.selectedId=settingsReturnKhatmaId;settingsReturnKhatmaId=null;state.dayIndex=displayedWerdIndex(selected());persist();renderState()}};
const renderSettingsKhatmasStableCore=renderSettingsKhatmas;
renderSettingsKhatmas=()=>{renderSettingsKhatmasStableCore();document.querySelectorAll('.edit-khatma-name').forEach(button=>button.onclick=()=>{settingsReturnKhatmaId=state.selectedId;state.selectedId=Number(button.dataset.id);openOptions(false)})};

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
      const old=reading(k,index);k.readings[String(index)]=0;k.total=Math.max(0,k.total-old);k.reopenDay=index;state.dayIndex=index;persist();renderState();
    };
  }
  $('timelineToggleLabel').textContent=timelineExpanded?L('إخفاء السجل','Hide History'):L('إظهار الكل','Show All');
  $('timelineToggle').classList.toggle('expanded',timelineExpanded);
};
$('timelineToggle').onclick=()=>{timelineExpanded=!timelineExpanded;renderTimeline()};

const renderStateReleaseCore=renderState;
renderState=()=>{
  renderStateReleaseCore();const k=selected(),a=amount(k),done=reading(k,state.dayIndex),restDay=!isScheduledToday(k),{delta}=scheduleProgress(k),nextDate=nextScheduledDate(k);
  $('khatmaStartCard').disabled=done>=a||restDay;
  $('khatmaQuickCompleteBtn').disabled=done>=a||restDay;$('khatmaQuickCompleteBtn').classList.toggle('completed',done>=a);
  $('khatmaQuickCompleteBtn').setAttribute('aria-label',done>=a?L('تمت قراءة وِرد اليوم','Today’s Werd Has Been Read'):L('تسجيل وِرد اليوم كمقروء','Mark Today’s Werd As Read'));
  $('khatmaShareBtn').disabled=restDay;$('khatmaShareBtn').setAttribute('aria-disabled',String(restDay));$('khatmaShareBtn').tabIndex=restDay?-1:0;
  $('khatmaStartCard').textContent=restDay?L('الوِرد القادم','Next Scheduled Werd'):done>=a?L('تمت قراءة وِرد اليوم ✓','Today’s Werd Has Been Read ✓'):L('ابدأ وِرد اليوم','Start Today’s Werd');
  $('khatmaScheduleStatus').textContent=delta>0?L(`أنت متقدم عن موعد الختمة الطبيعي بـ ${delta} يوم`,`You Are ${delta} Day${delta===1?'':'s'} Ahead Of The Natural Khatma Schedule`):delta<0?L(`أنت متأخر عن موعد الختمة الطبيعي بـ ${Math.abs(delta)} يوم`,`You Are ${Math.abs(delta)} Day${Math.abs(delta)===1?'':'s'} Behind The Natural Khatma Schedule`):L('أنت في موعد الختمة الطبيعي','You Are On The Natural Khatma Schedule');
  $('khatmaStageLine').textContent=`${$('khatmaStageLine').textContent} · ${scheduleVerification(k,state.dayIndex)}`;
  $('khatmaRestNote').classList.toggle('hidden',!restDay);$('khatmaRestNote').textContent=restDay?(nextDate?L(`اليوم إجازة من هذا الوِرد. الوِرد القادم ${nextDate.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long'})}، ${localizedDate(nextDate)}.`,`Today Is A Rest Day For This Werd. The Next Werd Is ${nextDate.toLocaleDateString('en-GB',{weekday:'long'})}, ${localizedDate(nextDate)}.`):L('اختر يوم قراءة واحدًا على الأقل من إعدادات الختمة.','Choose At Least One Reading Day In The Khatma Settings.')):'';
  document.querySelector('.khatma-summary').classList.toggle('rest-day',restDay);document.querySelector('.khatma-action-strip').classList.toggle('rest-day',restDay);
};
$('khatmaQuickCompleteBtn').onclick=async()=>{if(!isScheduledToday(selected()))return;const approved=await appDialog({title:L('تأكيد قراءة الوِرد','Confirm Werd Reading'),message:L('هل أنت متأكد أنك تريد تسجيل هذا الوِرد كمقروء؟','Are You Sure You Want To Mark This Werd As Read?'),confirmText:L('نعم','Yes'),cancelText:L('لا','No'),showCancel:true});if(!approved||!await completeCurrentWird())return;renderState()};

$('settingsHeaderBtn').onclick=()=>showScreen('settingsScreen');
const adhkarNav=document.querySelector('.nav-item[data-target="adhkarScreen"]');
adhkarNav.onclick=()=>{renderAdhkar();showScreen('adhkarScreen')};
const applyLanguageReleaseCore=applyLanguage;
applyLanguage=()=>{
  applyLanguageReleaseCore();adhkarNav.querySelector('span').textContent=L('الأذكار','Adhkar');
  $('settingsHeaderBtn').setAttribute('aria-label',L('الإعدادات','Settings'));
  $('completeWirdDayBtn').textContent=L('تمت قراءة وِرد اليوم','Mark Today’s Werd As Read');
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
  if(id==='khatmaScreen')state.dayIndex=displayedWerdIndex(selected());
  showScreenReleaseCore(id);
  if(id==='khatmaScreen')renderState();
  if(id==='mushafScreen')document.body.classList.remove('mushaf-controls-hidden');
};
$('khatmaSelector').onchange=event=>{state.selectedId=Number(event.target.value);state.dayIndex=displayedWerdIndex(selected());persist();renderState()};

for(const id of ['khatmaReminderTime','kahfNotificationTime','khatmaStartDateInput']){
  const input=$(id),shell=input?.closest('.time-field-shell');
  const pickerShell=shell||input?.closest('.date-field-shell');
  pickerShell?.addEventListener('click',()=>{if(input.readOnly||input.disabled)return;input.focus({preventScroll:true});try{input.showPicker?.()}catch{}});
}

state.dayIndex=displayedWerdIndex(selected());renderState();loadPrayerTimes();
