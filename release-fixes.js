/* Werdy release fixes kept separate so web and native builds run identical code. */
let timelineExpanded=false;
let viewedWerdDate=null;
let khatmaPositionExpanded=false;

function effectiveWerdDate(now=new Date()){
  const effective=new Date(now);
  effective.setHours(23,59,59,999);
  return effective;
}
// A Werd follows the device's local calendar day and changes at midnight.
// Only the reading days configured on this individual Khatma are counted.
currentScheduleIndex=k=>{
  const start=new Date(`${k.startDate}T12:00:00`),end=effectiveWerdDate(),cursor=new Date(start);let count=0;
  while(cursor<=end){if(k.days.includes(jsDays[cursor.getDay()]))count++;cursor.setDate(cursor.getDate()+1)}
  return Math.max(0,count-1);
};
function isScheduledToday(k){const today=effectiveWerdDate(),start=new Date(`${k.startDate}T12:00:00`);return today>=start&&k.days.includes(jsDays[today.getDay()])}
function normalizedWerdDate(value){const date=new Date(value);date.setHours(12,0,0,0);return date}
function activeViewedWerdDate(){if(viewedWerdDate)return normalizedWerdDate(viewedWerdDate);const today=effectiveWerdDate(),start=normalizedWerdDate(`${selected().startDate}T12:00:00`);return normalizedWerdDate(today<start?start:today)}
function sameWerdDate(a,b){return normalizedWerdDate(a).getTime()===normalizedWerdDate(b).getTime()}
function isScheduledOn(k,date){const start=normalizedWerdDate(`${k.startDate}T12:00:00`),day=normalizedWerdDate(date);return day>=start&&k.days.includes(jsDays[day.getDay()])}
function scheduledIndexOn(k,date){const start=normalizedWerdDate(`${k.startDate}T12:00:00`),end=normalizedWerdDate(date),cursor=new Date(start);let count=0;if(end<start)return 0;while(cursor<=end){if(k.days.includes(jsDays[cursor.getDay()]))count++;cursor.setDate(cursor.getDate()+1)}return Math.max(0,count-(isScheduledOn(k,end)?1:0))}
function nextScheduledDateFrom(k,date){if(!k.days.length)return null;const cursor=normalizedWerdDate(date),start=normalizedWerdDate(`${k.startDate}T12:00:00`);if(cursor<start)cursor.setTime(start.getTime());while(!k.days.includes(jsDays[cursor.getDay()]))cursor.setDate(cursor.getDate()+1);return cursor}
function lastScheduledDate(k){const total=Math.ceil(240/amount(k));return scheduleDate(k,Math.max(0,total-1))}
function syncViewedWerdIndex(){const k=selected(),total=Math.ceil(240/amount(k));state.dayIndex=Math.min(total-1,scheduledIndexOn(k,activeViewedWerdDate()))}
function resetViewedWerdToToday(render=true){viewedWerdDate=null;state.dayIndex=displayedWerdIndex(selected());if(render)renderState()}
function nextScheduledDate(k){if(!k.days.length)return null;const today=effectiveWerdDate(),start=new Date(`${k.startDate}T12:00:00`),cursor=new Date(today<start?start:today);cursor.setHours(12,0,0,0);while(!k.days.includes(jsDays[cursor.getDay()]))cursor.setDate(cursor.getDate()+1);return cursor}
function scheduledWerdCount(k){const start=new Date(`${k.startDate}T12:00:00`),end=effectiveWerdDate(),cursor=new Date(start);let count=0;if(end<start)return 0;while(cursor<=end){if(k.days.includes(jsDays[cursor.getDay()]))count++;cursor.setDate(cursor.getDate()+1)}return count}
function reconcileKhatmaReadings(k){
  const a=amount(k),totalDays=Math.ceil(240/a),readingDates={},legacyReadings={};k.readingDates=k.readingDates||{};k.readingMeta=k.readingMeta||{};k.readings=k.readings||{};
  let recorded=0;
  for(let index=0;index<totalDays;index++){
    const clean=Math.max(0,Math.min(a,reading(k,index)));
    if(clean){const key=readingDateForIndex(k,index);readingDates[key]=clean;legacyReadings[String(index)]=clean;recorded+=clean}
  }
  let missing=Math.max(0,Math.min(240,Number(k.total)||0)-recorded);
  for(let index=0;missing>0&&index<totalDays;index++){
    const key=readingDateForIndex(k,index),current=Number(readingDates[key]||0),add=Math.min(a-current,missing);
    if(add>0){readingDates[key]=current+add;legacyReadings[String(index)]=current+add;recorded+=add;missing-=add}
  }
  k.readingDates=readingDates;k.readings=legacyReadings;k.readingSchema=2;k.total=Math.min(240,recorded);
}
state.khatmas.forEach(reconcileKhatmaReadings);persist();
function scheduleProgress(k){const a=amount(k),due=scheduledWerdCount(k),todayIndex=Math.max(0,currentScheduleIndex(k)),todayComplete=reading(k,todayIndex)>=a,expected=Math.max(0,due-(isScheduledToday(k)&&!todayComplete?1:0)),completed=Object.values(k.readingDates||{}).filter(value=>Number(value)>=a).length;return{completed,expected,delta:completed-expected}}
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
  const k=selected();editingKhatmaSnapshot=isNew?null:cloneKhatma(k);editingNewKhatmaId=isNew?k.id:null;
  openOptionsCalendarCore(isNew);const locked=!isNew&&hasStartedReading(k);
  $('khatmaStartDateInputLabel').textContent=L('تاريخ بداية الختمة','Khatma Start Date');
  $('khatmaStartDateInput').value=k.startDate||dateKey();$('khatmaStartDateInput').readOnly=locked;$('khatmaStartDateInput').dataset.locked=String(locked);
  updateKhatmaSchedulePreview();
};
$('khatmaStartDateInput').oninput=updateKhatmaSchedulePreview;
const saveOptionsCalendarCore=$('saveKhatmaOptionsBtn').onclick;
let settingsReturnKhatmaId=null;
window.openKhatmaOptionsFromAwrad=id=>{settingsReturnKhatmaId=state.selectedId;state.selectedId=Number(id);openOptions(false)};
$('addWerdFromHomeBtn').onclick=()=>{const base=L('وِرد جديد','New Werd'),used=new Set(state.khatmas.map(k=>k.name));let name=base,suffix=2;while(used.has(name))name=`${base} ${suffix++}`;const k=newKhatma(name);editingReturnSelectedId=state.selectedId;state.khatmas.push(k);state.selectedId=k.id;renderState();openOptions(true)};
$('deleteKhatmaFromOptionsBtn').onclick=async()=>{const k=selected();if(state.khatmas.length===1){await appDialog({title:L('لا يمكن حذف الختمة','Khatma Cannot Be Deleted'),message:L('لابد من وجود ختمة واحدة على الأقل في البرنامج.','The App Must Contain At Least One Khatma.')});return}const approved=await appDialog({title:L('تأكيد الحذف','Confirm Deletion'),message:L(`هل تريد حذف «${k.name}» نهائيًا؟`,`Permanently Delete “${k.name}”?`),confirmText:L('حذف','Delete'),showCancel:true,danger:true});if(!approved)return;state.khatmas=state.khatmas.filter(item=>item.id!==k.id);const fallback=state.khatmas.find(item=>item.id===settingsReturnKhatmaId)||state.khatmas[0];settingsReturnKhatmaId=null;state.selectedId=fallback.id;viewedWerdDate=null;state.dayIndex=displayedWerdIndex(fallback);editingNewKhatma=false;$('khatmaOptionsModal').classList.add('hidden');persist();renderState()};
$('saveKhatmaOptionsBtn').onclick=async()=>{
  const k=selected(),locked=!editingNewKhatma&&hasStartedReading(k);
  if(!locked){const {p,q}=normalizeOptions('save');if(p*8+q===0)return;if(!k.days.length){await appDialog({message:L('اختر يوم قراءة واحدًا على الأقل.','Choose At Least One Reading Day.')});return}}
  if(!locked){const {p,q}=normalizeOptions('save');k.parts=p;k.quarters=q;k.startDate=$('khatmaStartDateInput').value||dateKey()}
  state.dayIndex=displayedWerdIndex(k);
  await saveOptionsCalendarCore();
  if($('khatmaOptionsModal').classList.contains('hidden')){
    editingKhatmaSnapshot=null;editingNewKhatmaId=null;editingReturnSelectedId=null;
    const today=normalizedWerdDate(new Date()),pastCount=pastScheduledWerdCount(k,today);
    if(!locked&&pastCount>0){
      const markPast=await appDialog({title:L('الأوراد السابقة','Earlier Werds'),message:L(`تاريخ بداية الختمة قبل اليوم. هل تريد تحديد الأوراد السابقة لليوم (${pastCount} وِرد) كمقروءة؟ وِرد اليوم سيبقى متاحًا للقراءة.`,`This Khatma Starts Before Today. Mark The ${pastCount} Earlier Werds As Read? Today’s Werd Will Remain Available.`),confirmText:L('تحديد السابقة كمقروءة','Mark Earlier Werds As Read'),cancelText:L('تركها للقراءة','Leave Them Unread'),showCancel:true});
      if(markPast){for(let index=0;index<pastCount;index++)setReading(k,index,amount(k));reconcileKhatmaReadings(k);if(k.total>=240&&!k.completionDate)k.completionDate=dateKey();}
      persist();renderState();
    }
  }
  if(settingsReturnKhatmaId!==null&&$('khatmaOptionsModal').classList.contains('hidden')){state.selectedId=settingsReturnKhatmaId;settingsReturnKhatmaId=null;state.dayIndex=displayedWerdIndex(selected());persist();renderState()}
};
const cancelOptionsStableCore=$('cancelKhatmaOptionsBtn').onclick;
$('cancelKhatmaOptionsBtn').onclick=()=>{if(editingNewKhatmaId!==null){state.khatmas=state.khatmas.filter(k=>k.id!==editingNewKhatmaId);state.selectedId=state.khatmas.some(k=>k.id===editingReturnSelectedId)?editingReturnSelectedId:state.khatmas[0].id}else if(editingKhatmaSnapshot){const index=state.khatmas.findIndex(k=>k.id===editingKhatmaSnapshot.id);if(index>=0)state.khatmas[index]=editingKhatmaSnapshot}editingKhatmaSnapshot=null;editingNewKhatmaId=null;editingReturnSelectedId=null;cancelOptionsStableCore();if(settingsReturnKhatmaId!==null){state.selectedId=settingsReturnKhatmaId;settingsReturnKhatmaId=null;state.dayIndex=displayedWerdIndex(selected());persist()}renderState()};
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
      const old=reading(k,index);setReading(k,index,0);k.total=Math.max(0,k.total-old);k.reopenDay=index;state.dayIndex=index;persist();renderState();
    };
  }
  $('timelineToggleLabel').textContent=timelineExpanded?L('إخفاء السجل','Hide History'):L('إظهار الكل','Show All');
  $('timelineToggle').classList.toggle('expanded',timelineExpanded);
};
$('timelineToggle').onclick=()=>{timelineExpanded=!timelineExpanded;renderTimeline()};
function updateKhatmaPositionDisclosure(){
  $('khatmaPositionToggle').setAttribute('aria-expanded',String(khatmaPositionExpanded));
  $('khatmaStageLine').classList.add('hidden');
}
function collapseKhatmaPosition(){khatmaPositionExpanded=false;updateKhatmaPositionDisclosure()}
$('khatmaPositionToggle').onclick=event=>{event.stopPropagation();khatmaPositionExpanded=true;updateKhatmaPositionDisclosure();openKhatmaInfo($('khatmaPositionToggleLabel').textContent,$('khatmaStageLine').textContent)};

const renderStateReleaseCore=renderState;
renderState=()=>{
  if(document.querySelector('.screen.active')?.id==='khatmaScreen')syncViewedWerdIndex();
  const k=selected();reconcileKhatmaReadings(k);renderStateReleaseCore();const a=amount(k),done=reading(k,state.dayIndex),viewDate=activeViewedWerdDate(),today=effectiveWerdDate(),restDay=!isScheduledOn(k,viewDate),viewingToday=sameWerdDate(viewDate,today),past=viewDate<normalizedWerdDate(today),future=viewDate>normalizedWerdDate(today),readDisabled=restDay||future||done>=a||hasEarlierUnread(k,state.dayIndex),{delta}=scheduleProgress(k),nextDate=nextScheduledDateFrom(k,viewDate);
  $('khatmaStartCard').disabled=readDisabled;
  $('khatmaQuickCompleteBtn').disabled=readDisabled;$('khatmaQuickCompleteBtn').classList.toggle('completed',done>=a);
  $('khatmaQuickCompleteBtn').setAttribute('aria-label',done>=a?L('تمت قراءة وِرد اليوم','Today’s Werd Has Been Read'):L('تسجيل وِرد اليوم كمقروء','Mark Today’s Werd As Read'));
  $('khatmaShareBtn').disabled=restDay;$('khatmaShareBtn').setAttribute('aria-disabled',String(restDay));$('khatmaShareBtn').tabIndex=restDay?-1:0;
  $('khatmaStartCard').textContent=restDay?L('يوم إجازة من الوِرد','Werd Rest Day'):future?L('وِرد قادم — للعرض فقط','Upcoming Werd — View Only'):done>=a?L(past?'تمت قراءة هذا الوِرد ✓':'تمت قراءة وِرد اليوم ✓',past?'This Werd Has Been Read ✓':'Today’s Werd Has Been Read ✓'):past?L('ابدأ قراءة الوِرد السابق','Start Previous Werd'):L('ابدأ وِرد اليوم','Start Today’s Werd');
  const scheduleStatus=delta>0?L(`متقدم عن الموعد بـ ${delta} يوم`,`${delta} Day${delta===1?'':'s'} Ahead`):delta<0?L(`متأخر عن الموعد بـ ${Math.abs(delta)} يوم`,`${Math.abs(delta)} Day${Math.abs(delta)===1?'':'s'} Behind`):L('أنت في موعد الختمة الطبيعي','On The Natural Khatma Schedule');
  $('khatmaScheduleStatus').textContent=`${scheduleStatus} — ${L(`وِرد اليوم رقم ${state.dayIndex+1}`,`Werd Day ${state.dayIndex+1}`)}`;
  const regularStageLine=`${$('khatmaStageLine').textContent} · ${scheduleVerification(k,state.dayIndex)} · ${L('المعروض','Viewing')}: ${viewDate.toLocaleDateString(isEn()?'en-GB':'ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`;
  $('khatmaStageLine').textContent=restDay?(nextDate?L(`اليوم إجازة من القراءة\nالوِرد القادم: ${nextDate.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long'})}، ${localizedDate(nextDate)}`,`Today Is A Rest Day\nNext Werd: ${nextDate.toLocaleDateString('en-GB',{weekday:'long'})}, ${localizedDate(nextDate)}`):L('اليوم إجازة من القراءة\nاختر يوم قراءة واحدًا على الأقل من إعدادات الختمة.','Today Is A Rest Day\nChoose At Least One Reading Day In The Khatma Settings.')):regularStageLine;
  $('khatmaPositionToggleLabel').textContent=restDay?L('يوم إجازة من القراءة','Werd Rest Day'):L('المرحلة الحالية','Current Position');
  $('khatmaPositionToggle').setAttribute('aria-expanded',String(khatmaPositionExpanded));$('khatmaStageLine').classList.add('hidden');
  $('khatmaRestNote').classList.add('hidden');$('khatmaRestNote').textContent='';
  document.querySelector('.khatma-summary').classList.toggle('rest-day',restDay);document.querySelector('.khatma-action-strip').classList.toggle('rest-day',restDay);
  $('homePreviousWirdBtn').disabled=viewDate<=normalizedWerdDate(`${k.startDate}T12:00:00`);
  $('homeNextWirdBtn').disabled=viewDate>=normalizedWerdDate(lastScheduledDate(k));
  $('homePreviousWirdBtn').setAttribute('aria-label',L('اليوم السابق','Previous Day'));
  $('homeNextWirdBtn').setAttribute('aria-label',L('اليوم التالي','Next Day'));
};
completeCurrentWird=async()=>{const k=selected(),a=amount(k);if(!await allowWerdReading(k,state.dayIndex))return false;setReading(k,state.dayIndex,a);reconcileKhatmaReadings(k);if(k.total>=240&&!k.completionDate)k.completionDate=dateKey();delete k.reopenDay;persist();return true};
$('khatmaQuickCompleteBtn').onclick=async()=>{const k=selected(),viewDate=activeViewedWerdDate();if(!isScheduledOn(k,viewDate)||viewDate>normalizedWerdDate(effectiveWerdDate()))return;const approved=await appDialog({title:L('تأكيد قراءة الوِرد','Confirm Werd Reading'),message:L('هل أنت متأكد أنك تريد تسجيل هذا الوِرد كمقروء؟','Are You Sure You Want To Mark This Werd As Read?'),confirmText:L('نعم','Yes'),cancelText:L('لا','No'),showCancel:true});if(!approved||!await completeCurrentWird())return;renderState()};

$('settingsHeaderBtn').onclick=()=>showScreen('settingsScreen');
$('globalQuranSearch').onclick=event=>{if(event.target===$('globalQuranSearch'))$('globalQuranSearch').classList.add('hidden')};
const adhkarNav=document.querySelector('.nav-item[data-target="adhkarScreen"]');
adhkarNav.onclick=()=>{renderAdhkar();showScreen('adhkarScreen')};
const applyLanguageReleaseCore=applyLanguage;
applyLanguage=()=>{
  applyLanguageReleaseCore();adhkarNav.querySelector('span').textContent=L('الأذكار','Adhkar');
  $('settingsHeaderBtn').setAttribute('aria-label',L('الإعدادات','Settings'));
  $('globalQuranGoBtn').textContent=L('اذهب','Go');
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
  await loadPrayerTimesReleaseCore(...args);const keys=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'],times={};
  [...document.querySelectorAll('.prayer-row strong')].forEach((node,index)=>{
    const match=node.textContent.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);if(!match||!keys[index])return;
    let hour=Number(match[1]);if(match[3]){if(match[3].toUpperCase()==='PM'&&hour<12)hour+=12;if(match[3].toUpperCase()==='AM'&&hour===12)hour=0}
    times[keys[index]]=`${String(hour).padStart(2,'0')}:${match[2]}`;
  });
  if(times.Fajr){state.prayer.times=times;state.prayer.fajr=times.Fajr;state.prayer.updatedAt=new Date().toISOString();persist();return}
  if(state.prayer.times?.Fajr){
    const names={Fajr:L('الفجر','Fajr'),Sunrise:L('وقت الشروق','Sunrise Time'),Dhuhr:L('الظهر','Dhuhr'),Asr:L('العصر','Asr'),Maghrib:L('المغرب','Maghrib'),Isha:L('العشاء','Isha')};
    $('prayerTimes').innerHTML=Object.entries(names).map(([key,name])=>{if(key==='Sunrise')return`<article class="prayer-row sunrise-row"><span>${name}</span><span aria-hidden="true">☀</span><strong>${state.prayer.times[key]?formatTime(state.prayer.times[key]):'—'}</strong></article>`;const mode=state.prayer.alerts?.[key]||'off',alert=prayerAlertMarkup(mode);return`<article class="prayer-row"><span>${name}</span><button class="prayer-alert ${mode}" data-prayer="${key}" title="${alert.label}" aria-label="${name}: ${alert.label}">${alert.html}</button><strong>${formatTime(state.prayer.times[key])}</strong></article>`}).join('');
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
  if(id==='khatmaScreen')resetViewedWerdToToday(false);
  showScreenReleaseCore(id);
  if(id==='khatmaScreen')renderState();
  if(id==='mushafScreen'||id==='readingScreen')document.body.classList.remove('mushaf-controls-hidden');
};
for(const screen of [$('mushafScreen'),$('readingScreen')]){
  let tap=null;screen.onclick=null;
  screen.addEventListener('pointerdown',event=>{tap=event.isPrimary?{x:event.clientX,y:event.clientY,time:performance.now(),scroll:readerPane()?.scrollTop}:null});
  screen.addEventListener('pointercancel',()=>tap=null);
  screen.addEventListener('pointerup',event=>{
    if(!tap||pinchSuppressClick||!event.isPrimary||event.target.closest('button,input,select,a,[role="scrollbar"]'))return;
    const valid=Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<10&&performance.now()-tap.time<500&&Math.abs((readerPane()?.scrollTop||0)-(tap.scroll||0))<4;tap=null;
    if(valid)setReadingChromeVisible(document.body.classList.contains('mushaf-controls-hidden'))
  });
}
$('khatmaSelector').onchange=event=>{collapseKhatmaPosition();state.selectedId=Number(event.target.value);viewedWerdDate=null;state.dayIndex=displayedWerdIndex(selected());persist();renderState()};

function moveViewedWerdDay(delta){
  const k=selected(),current=activeViewedWerdDate(),target=new Date(current);target.setDate(target.getDate()+delta);
  const start=normalizedWerdDate(`${k.startDate}T12:00:00`),end=normalizedWerdDate(lastScheduledDate(k));
  if(target<start||target>end)return false;
  viewedWerdDate=target;syncViewedWerdIndex();renderState();return true;
}
function canMoveViewedWerdDay(delta){const k=selected(),target=activeViewedWerdDate();target.setDate(target.getDate()+delta);return target>=normalizedWerdDate(`${k.startDate}T12:00:00`)&&target<=normalizedWerdDate(lastScheduledDate(k))}
$('homePreviousWirdBtn').onclick=event=>{event.stopPropagation();queueViewedWerdDay(-1)};
$('homeNextWirdBtn').onclick=event=>{event.stopPropagation();queueViewedWerdDay(1)};
const khatmaSummaryCard=$('khatmaSummaryCard'),khatmaCarouselViewport=$('khatmaCarouselViewport');let cardPointerId=null,cardStartX=0,cardStartY=0,cardStartTime=0,cardDragX=0,cardDragging=false,carouselAnimating=false,carouselCommandQueue=[],suppressCarouselClickUntil=0,cardPeer=null,cardPeerDelta=0,cardPeerSide=0,carouselRenderingPeer=false,carouselPeerCache=new Map(),carouselPeerCacheKey='',carouselPeerCacheTimer=0;
khatmaCarouselViewport.addEventListener('click',event=>{if(performance.now()<suppressCarouselClickUntil){event.preventDefault();event.stopPropagation();return}if(!carouselAnimating)return;const rect=khatmaCarouselViewport.getBoundingClientRect(),edge=48,x=event.clientX;if(x>rect.left+edge&&x<rect.right-edge)return;event.preventDefault();event.stopPropagation();const left=x<rect.left+rect.width/2;queueViewedWerdDay(left?(isEn()?-1:1):(isEn()?1:-1))},true);
function clearCardPeer(){cardPeer?.remove();cardPeer=null;cardPeerDelta=0;cardPeerSide=0}
function stripCarouselCloneIds(node){node.removeAttribute?.('id');node.querySelectorAll?.('[id]').forEach(child=>child.removeAttribute('id'))}
function currentCarouselCacheKey(){return`${selected().id}:${activeViewedWerdDate().getTime()}:${state.language}:${state.theme}:${selected().total}:${JSON.stringify(selected().readings||{})}`}
function cloneRenderedSummary(){const clone=khatmaSummaryCard.cloneNode(true);stripCarouselCloneIds(clone);clone.classList.remove('werd-card-dragging','werd-card-settling');clone.classList.add('khatma-summary-peer');clone.setAttribute('aria-hidden','true');clone.querySelectorAll('button,select,input').forEach(control=>control.tabIndex=-1);return clone}
function buildCarouselPeerCache(){
  if(!$('khatmaScreen').classList.contains('active'))return;
  if(cardDragging){scheduleCarouselPeerCache();return}const key=currentCarouselCacheKey(),savedViewed=viewedWerdDate?new Date(viewedWerdDate):null,savedIndex=state.dayIndex,nextCache=new Map();carouselRenderingPeer=true;
  for(const delta of [-1,1]){viewedWerdDate=savedViewed;state.dayIndex=savedIndex;if(!canMoveViewedWerdDay(delta))continue;const target=activeViewedWerdDate();target.setDate(target.getDate()+delta);viewedWerdDate=target;syncViewedWerdIndex();renderState();nextCache.set(delta,cloneRenderedSummary())}
  viewedWerdDate=savedViewed;state.dayIndex=savedIndex;renderState();carouselRenderingPeer=false;carouselPeerCache=nextCache;carouselPeerCacheKey=key
}
function scheduleCarouselPeerCache(){clearTimeout(carouselPeerCacheTimer);carouselPeerCacheTimer=setTimeout(buildCarouselPeerCache,80)}
function prepareCardPeer(delta,side){
  if(!canMoveViewedWerdDay(delta)||carouselPeerCacheKey!==currentCarouselCacheKey()||!carouselPeerCache.has(delta)){clearCardPeer();return false}
  if(cardPeer&&cardPeerDelta===delta)return true;
  clearCardPeer();cardPeer=carouselPeerCache.get(delta).cloneNode(true);cardPeer.classList.add('werd-card-dragging');cardPeerDelta=delta;cardPeerSide=side;khatmaCarouselViewport.appendChild(cardPeer);return true
}
function positionCarouselCards(dx){khatmaSummaryCard.style.transform=`translate3d(${dx}px,0,0)`;if(cardPeer)cardPeer.style.transform=`translate3d(calc(${cardPeerSide*100}% + ${dx}px),0,0)`}
khatmaSummaryCard.addEventListener('pointerdown',event=>{if(event.target.closest('button')||carouselAnimating)return;collapseKhatmaPosition();clearTimeout(carouselPeerCacheTimer);clearCardPeer();cardPointerId=event.pointerId;cardStartX=event.clientX;cardStartY=event.clientY;cardStartTime=performance.now();cardDragX=0;cardDragging=false});
khatmaSummaryCard.addEventListener('pointermove',event=>{if(event.pointerId!==cardPointerId)return;const dx=event.clientX-cardStartX,dy=event.clientY-cardStartY;if(!cardDragging){if(Math.abs(dx)<8)return;if(Math.abs(dx)<=Math.abs(dy)*1.2){cardPointerId=null;scheduleCarouselPeerCache();return}cardDragging=true;khatmaSummaryCard.setPointerCapture?.(event.pointerId);khatmaSummaryCard.classList.add('werd-card-dragging')}event.preventDefault();const delta=isEn()?(dx<0?1:-1):(dx<0?-1:1),side=dx<0?1:-1,available=prepareCardPeer(delta,side),limit=khatmaSummaryCard.clientWidth;cardDragX=available?Math.max(-limit,Math.min(limit,dx)):0;positionCarouselCards(cardDragX);if(available&&Math.abs(cardDragX)>=72){khatmaSummaryCard.releasePointerCapture?.(event.pointerId);cardPointerId=null;cardDragging=false;startAssistedSwipe(delta,side)}});
function settleCardHome(){khatmaSummaryCard.classList.remove('werd-card-dragging');khatmaSummaryCard.classList.add('werd-card-settling');cardPeer?.classList.remove('werd-card-dragging');cardPeer?.classList.add('werd-card-settling');positionCarouselCards(0);if(cardPeer)cardPeer.style.transform=`translate3d(${cardPeerSide*100}%,0,0)`;setTimeout(()=>{khatmaSummaryCard.classList.remove('werd-card-settling');khatmaSummaryCard.style.transform='';clearCardPeer();scheduleCarouselPeerCache()},245)}
function completeCarouselTransition(delta,side,duration=245){carouselAnimating=true;khatmaSummaryCard.classList.remove('werd-card-dragging');khatmaSummaryCard.classList.add('werd-card-settling');cardPeer.classList.remove('werd-card-dragging');cardPeer.classList.add('werd-card-settling');khatmaSummaryCard.style.transform=`translate3d(${-side*100}%,0,0)`;cardPeer.style.transform='translate3d(0,0,0)';setTimeout(()=>{const target=activeViewedWerdDate();target.setDate(target.getDate()+delta);viewedWerdDate=target;syncViewedWerdIndex();khatmaSummaryCard.classList.add('werd-card-dragging');khatmaSummaryCard.classList.remove('werd-card-settling');renderState();khatmaSummaryCard.style.transform='translate3d(0,0,0)';void khatmaSummaryCard.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>{clearCardPeer();requestAnimationFrame(()=>{khatmaSummaryCard.classList.remove('werd-card-dragging');khatmaSummaryCard.style.transform='';khatmaSummaryCard.style.removeProperty('--carousel-duration');carouselAnimating=false;scheduleCarouselPeerCache();runNextCarouselCommand()})}))},duration)}
function animateViewedWerdDay(delta){if(carouselAnimating||!canMoveViewedWerdDay(delta))return false;if(carouselPeerCacheKey!==currentCarouselCacheKey()||!carouselPeerCache.has(delta))buildCarouselPeerCache();const side=isEn()?delta:-delta;if(!prepareCardPeer(delta,side))return false;khatmaSummaryCard.style.setProperty('--carousel-duration','667ms');cardPeer.style.setProperty('--carousel-duration','667ms');khatmaSummaryCard.classList.add('werd-card-dragging');khatmaSummaryCard.style.transform='translate3d(0,0,0)';cardPeer.style.transform=`translate3d(${side*100}%,0,0)`;void khatmaSummaryCard.offsetWidth;requestAnimationFrame(()=>completeCarouselTransition(delta,side,672));return true}
function runNextCarouselCommand(){if(carouselAnimating)return;while(carouselCommandQueue.length){const delta=carouselCommandQueue.shift();if(animateViewedWerdDay(delta))return}}
function queueViewedWerdDay(delta){collapseKhatmaPosition();carouselCommandQueue.push(delta);runNextCarouselCommand()}
function startAssistedSwipe(delta,side){if(!cardPeer)return;suppressCarouselClickUntil=performance.now()+800;carouselAnimating=true;khatmaSummaryCard.style.setProperty('--carousel-duration','667ms');cardPeer.style.setProperty('--carousel-duration','667ms');requestAnimationFrame(()=>completeCarouselTransition(delta,side,672))}
function finishCardSwipe(event){if(event.pointerId!==cardPointerId)return;const wasDragging=cardDragging,dx=cardDragX,delta=cardPeerDelta,side=cardPeerSide,elapsed=Math.max(1,performance.now()-cardStartTime),velocity=Math.abs(dx)/elapsed;cardPointerId=null;cardDragging=false;const commit=Math.abs(dx)>=72||(Math.abs(dx)>=24&&velocity>.42);if(!wasDragging||!commit||!cardPeer||!delta){settleCardHome();return}startAssistedSwipe(delta,side)}
khatmaSummaryCard.addEventListener('pointerup',finishCardSwipe);khatmaSummaryCard.addEventListener('pointercancel',finishCardSwipe);
const renderStateCarouselCacheCore=renderState;renderState=()=>{renderStateCarouselCacheCore();if(!carouselRenderingPeer)scheduleCarouselPeerCache()};scheduleCarouselPeerCache();
let midnightRefreshTimer=0;
function scheduleMidnightRefresh(){clearTimeout(midnightRefreshTimer);const now=new Date(),next=new Date(now);next.setHours(24,0,0,80);midnightRefreshTimer=setTimeout(()=>{resetViewedWerdToToday();$('todayLabel').textContent=new Date().toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'});scheduleMidnightRefresh()},Math.max(250,next-now))}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){resetViewedWerdToToday();scheduleMidnightRefresh()}});
window.addEventListener('pageshow',()=>{resetViewedWerdToToday();scheduleMidnightRefresh()});
scheduleMidnightRefresh();

for(const id of ['khatmaReminderTime','kahfNotificationTime','khatmaStartDateInput']){
  const input=$(id),shell=input?.closest('.time-field-shell');
  const pickerShell=shell||input?.closest('.date-field-shell');
  pickerShell?.addEventListener('click',()=>{if(input.readOnly||input.disabled)return;input.focus({preventScroll:true});try{input.showPicker?.()}catch{}});
}

// Reading order is shared by Home, Werd details, and completion actions.
function pastScheduledWerdCount(k,today=normalizedWerdDate(new Date())){
  const limit=Math.ceil(240/amount(k));let count=0;
  while(count<limit&&normalizedWerdDate(scheduleDate(k,count))<today)count++;
  return count;
}
function hasEarlierUnread(k,index){for(let i=0;i<index;i++)if(reading(k,i)<amount(k))return true;return false}
async function allowWerdReading(k,index){
  if(hasEarlierUnread(k,index)){
    await appDialog({title:L('اقرأ الوِرد السابق أولًا','Read The Earlier Werd First'),message:L(`ابدأ بوِرد اليوم رقم ${firstUnreadIndex(k)+1} وأكمله قبل قراءة هذا الوِرد.`,`Complete Werd Day ${firstUnreadIndex(k)+1} Before Reading This Werd.`)});return false;
  }
  if(normalizedWerdDate(scheduleDate(k,index))>normalizedWerdDate(new Date())){
    await appDialog({title:L('وِرد قادم','Upcoming Werd'),message:L('هذا الوِرد متاح للقراءة في موعده.','This Werd Will Be Available On Its Scheduled Date.')});return false;
  }
  return true;
}
const openWerdReadingOrderedCore=openWerdReading;
openWerdReading=async()=>{if(await allowWerdReading(selected(),state.dayIndex))openWerdReadingOrderedCore()};
$('startReadingBtn').onclick=()=>openWerdReading();

let infoReturnFocus=null;
function openKhatmaInfo(title,body){
  infoReturnFocus=document.activeElement;$('khatmaInfoTitle').textContent=title;$('khatmaInfoBody').textContent=body;
  $('khatmaInfoClose').setAttribute('aria-label',L('إغلاق','Close'));
  $('khatmaInfoModal').classList.remove('hidden');$('khatmaInfoModal').querySelector('[role="dialog"]').focus();
}
function closeKhatmaInfo(){
  $('khatmaInfoModal').classList.add('hidden');collapseKhatmaPosition();infoReturnFocus?.focus({preventScroll:true});
}
$('khatmaInfoClose').onclick=closeKhatmaInfo;
$('khatmaInfoModal').onclick=event=>{if(event.target===$('khatmaInfoModal'))closeKhatmaInfo()};
$('khatmaTodayText').onclick=()=>{
  const range=rangeFor(selected(),state.dayIndex);
  openKhatmaInfo(L('تفاصيل وِرد اليوم','Today’s Werd Details'),`${range.text}\n\n${verseText(range.startIndex)}`);
};
document.addEventListener('keydown',event=>{
  if($('khatmaInfoModal').classList.contains('hidden'))return;
  if(event.key==='Escape')closeKhatmaInfo();
  if(event.key==='Tab'){event.preventDefault();$('khatmaInfoClose').focus()}
});

// Each reader has a single scroll pane. Its rail covers exactly that passage.
function readerPane(){return document.body.classList.contains('reading-mode')?$('quranText'):document.body.classList.contains('mushaf-mode')?$('freeQuranText'):null}
function setReadingChromeVisible(visible){
  const pane=readerPane(),scrollTop=pane?.scrollTop||0;
  const atEnd=pane&&pane.scrollHeight>pane.clientHeight&&Math.abs(pane.scrollHeight-pane.clientHeight-scrollTop)<2;
  document.body.classList.toggle('mushaf-controls-hidden',!visible);
  if(pane)pane.scrollTop=atEnd?pane.scrollHeight-pane.clientHeight:scrollTop;
  updateReaderPosition();requestAnimationFrame(updateReaderPosition);
}
function updateReaderPosition(){
  const pane=readerPane(),brand=$('themeBrandBtn');
  if(!pane){brand.querySelector('.brand-ar').textContent='وِردي';brand.querySelector('.brand-en').textContent='Werdy';return}
  const rail=pane.parentElement.querySelector('.reader-scrollbar'),max=Math.max(0,pane.scrollHeight-pane.clientHeight),ratio=max?Math.max(0,Math.min(1,pane.scrollTop/max)):0;
  if(rail){
    const height=rail.clientHeight,thumb=rail.firstElementChild,size=Math.min(height,Math.max(32,height*pane.clientHeight/Math.max(1,pane.scrollHeight)));
    thumb.style.height=`${size}px`;thumb.style.transform=`translateY(${ratio*(height-size)}px)`;
    rail.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    rail.setAttribute('aria-valuetext',L(`${Math.round(ratio*100)}٪ من ${pane.id==='quranText'?'الوِرد':'المصحف'}`,`${Math.round(ratio*100)}% Of ${pane.id==='quranText'?'Werd':'Quran'}`));
  }
  const verses=pane.querySelectorAll('.ayah[data-surah]'),line=pane.getBoundingClientRect().top+pane.clientHeight/3;
  let lo=0,hi=verses.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(verses[mid].getBoundingClientRect().bottom<line)lo=mid+1;else hi=mid}
  const verse=verses[lo];if(!verse)return;
  const number=Number(verse.dataset.surah);
  brand.querySelector('.brand-ar').textContent=`سورة ${surahs[number-1][0]}`;
  brand.querySelector('.brand-en').textContent=`Surah ${surahEnglishNames[number-1]}`;
}
for(const pane of [$('quranText'),$('freeQuranText')]){
  const rail=document.createElement('div');rail.className='reader-scrollbar';rail.tabIndex=0;
  rail.setAttribute('role','scrollbar');rail.setAttribute('aria-controls',pane.id);rail.setAttribute('aria-orientation','vertical');rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.setAttribute('aria-valuenow','0');rail.innerHTML='<span></span>';pane.parentElement.appendChild(rail);
  let frame=0,dragging=false;
  pane.addEventListener('scroll',()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;updateReaderPosition()})},{passive:true});
  const seek=event=>{const rect=rail.getBoundingClientRect(),size=rail.firstElementChild.clientHeight,ratio=Math.max(0,Math.min(1,(event.clientY-rect.top-size/2)/Math.max(1,rect.height-size)));pane.scrollTop=ratio*(pane.scrollHeight-pane.clientHeight);updateReaderPosition()};
  rail.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();dragging=true;rail.setPointerCapture(event.pointerId);seek(event)});
  rail.addEventListener('pointermove',event=>{if(dragging)seek(event)});
  rail.addEventListener('pointerup',()=>dragging=false);rail.addEventListener('pointercancel',()=>dragging=false);
  rail.addEventListener('keydown',event=>{const steps={ArrowDown:80,ArrowUp:-80,PageDown:pane.clientHeight,PageUp:-pane.clientHeight};if(event.key==='Home')pane.scrollTop=0;else if(event.key==='End')pane.scrollTop=pane.scrollHeight;else if(event.key in steps)pane.scrollTop+=steps[event.key];else return;event.preventDefault();updateReaderPosition()});
  new ResizeObserver(()=>requestAnimationFrame(updateReaderPosition)).observe(pane);
}
window.addEventListener('werdy:reader-position',updateReaderPosition);
const showScreenReaderCore=showScreen;
showScreen=id=>{showScreenReaderCore(id);if(id==='readingScreen')$('quranText').scrollTop=0;updateReaderPosition();requestAnimationFrame(updateReaderPosition)};
function displayedWeekday(date,english=false){
  const arabic=['الْأَحَد','الاِثْنَيْن','الثُّلَاثَاء','الْأَرْبِعَاء','الْخَمِيس','الْجُمُعَة','السَّبْت'];
  return english?date.toLocaleDateString('en-GB',{weekday:'long'}):arabic[date.getDay()];
}
const renderStateReaderCore=renderState;
renderState=()=>{
  renderStateReaderCore();
  $('khatmaWeekday').textContent=displayedWeekday(activeViewedWerdDate(),isEn());
  const k=selected(),blocked=hasEarlierUnread(k,state.dayIndex)||normalizedWerdDate(scheduleDate(k,state.dayIndex))>normalizedWerdDate(new Date());
  for(const id of ['startReadingBtn','completeWirdDayBtn','finishQuarterBtn'])$(id).disabled=blocked||reading(k,state.dayIndex)>=amount(k);
  if(hasEarlierUnread(k,state.dayIndex))$('khatmaStartCard').textContent=L(`اقرأ الوِرد رقم ${firstUnreadIndex(k)+1} أولًا`,`Read Werd ${firstUnreadIndex(k)+1} First`);
  requestAnimationFrame(updateReaderPosition);
};

state.dayIndex=displayedWerdIndex(selected());renderState();loadPrayerTimes();
