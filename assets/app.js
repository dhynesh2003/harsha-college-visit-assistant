
(() => {
"use strict";
const cfg=window.HARSHA_SUPABASE_CONFIG||{};
const configured=()=>cfg.url?.startsWith("https://") && !cfg.url.includes("PASTE_") && cfg.anonKey && !cfg.anonKey.includes("PASTE_");
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=v=>v?new Date(v).toLocaleString([], {dateStyle:"medium",timeStyle:"short"}):"—";
const isoLocal=v=>v?new Date(v).toISOString():"";
const localNow=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const CACHE_KEY="harsha_supabase_cache_v1";
let sb=null,user=null,month=new Date(),selectedDay="",loadAllPromise=null;
let db={colleges:[],contacts:[],meetings:[],reminders:[],requirements:[],calendarNotes:[]};
let oneSignalReady=false,oneSignalInstance=null;

function cacheSave(){localStorage.setItem(CACHE_KEY,JSON.stringify(db))}
function cacheLoad(){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY));if(x)db={colleges:x.colleges||[],contacts:x.contacts||[],meetings:x.meetings||[],reminders:x.reminders||[],requirements:x.requirements||[],calendarNotes:x.calendarNotes||[]}}catch{}}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1500)}
function setSync(state,text){$("syncBadge").className="sync-badge "+state;$("syncText").textContent=text}
function collegeName(id,fallback=""){return db.colleges.find(c=>c.id===id)?.name||fallback||"No college"}
function recordCollegeName(record){return collegeName(record?.collegeId,record?.collegeName||"")}
function refreshCollegeSuggestions(){
  const el=$("collegeSuggestions"); if(!el)return;
  const names=[...new Set([
    ...db.colleges.map(c=>c.name),
    ...db.contacts.map(x=>x.collegeName).filter(Boolean),
    ...db.meetings.map(x=>x.collegeName).filter(Boolean),
    ...db.reminders.map(x=>x.collegeName).filter(Boolean),
    ...db.requirements.map(x=>x.collegeName).filter(Boolean)
  ])].sort((a,b)=>a.localeCompare(b));
  el.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join("");
}
function findCollegeByName(name){
  const clean=(name||"").trim().toLowerCase();
  return db.colleges.find(c=>c.name.trim().toLowerCase()===clean)||null;
}
async function resolveCollege(name,createIfMissing=false){
  const clean=(name||"").trim();
  if(!clean)return {collegeId:null,collegeName:null};
  const existing=findCollegeByName(clean);
  if(existing)return {collegeId:existing.id,collegeName:existing.name};
  if(!createIfMissing)return {collegeId:null,collegeName:clean};
  const {data,error}=await sb.from("colleges").insert({
    user_id:user.id,name:clean,stage:"New Lead",interest:"Unknown",updated_at:new Date().toISOString()
  }).select().single();
  if(error)throw error;
  return {collegeId:data.id,collegeName:data.name};
}
function closeDialog(id){const d=$(id);if(d?.open)d.close()}
function showAuth(){$("authView").classList.remove("hidden");$("appView").classList.add("hidden")}
function showApp(){
  $("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("userEmail").textContent=user?.email||"";
  // Paint cached data immediately so navigation never waits for the network.
  renderAll();
  setTimeout(refreshPushStatus,200);setTimeout(initOneSignalForUser,250);
  window.dispatchEvent(new CustomEvent("harsha:app-ready"));
}



async function withOneSignal(fn){
  return await new Promise((resolve,reject)=>{
    if(!cfg.oneSignalAppId || cfg.oneSignalAppId.includes("PASTE_")) return reject(new Error("OneSignal App ID is not configured in assets/config.js."));
    window.OneSignalDeferred=window.OneSignalDeferred||[];
    window.OneSignalDeferred.push(async function(OneSignal){
      try{
        if(!oneSignalReady){
          await OneSignal.init({
            appId:cfg.oneSignalAppId,
            serviceWorkerPath:"push/onesignal/OneSignalSDKWorker.js",
            serviceWorkerParam:{scope:"/push/onesignal/"},
            notifyButton:{enable:false},
            allowLocalhostAsSecureOrigin:["localhost","127.0.0.1"].includes(location.hostname)
          });
          oneSignalReady=true;
          oneSignalInstance=OneSignal;
        }
        resolve(await fn(OneSignal));
      }catch(e){reject(e)}
    });
  });
}
async function initOneSignalForUser(){
  if(!user || !cfg.oneSignalAppId || cfg.oneSignalAppId.includes("PASTE_")){refreshNotificationCenter();return}
  try{
    await withOneSignal(async OneSignal=>{
      await OneSignal.login(user.id);
      OneSignal.User.PushSubscription.addEventListener("change",()=>refreshNotificationCenter());
      OneSignal.Notifications.addEventListener("permissionChange",()=>refreshNotificationCenter());
    });
  }catch(e){console.warn("OneSignal init:",e)}
  await refreshNotificationCenter();
}
function setHealth(id,text,state){
  const el=$(id),dot=$(id.replace("State","Dot"));
  if(el)el.textContent=text;
  if(dot)dot.className="health-dot "+(state||"");
}
async function refreshNotificationCenter(){
  const origin=$("notifOrigin");if(origin)origin.textContent=location.origin;
  if($("notifExternalId"))$("notifExternalId").textContent=user?.id||"—";
  const sdkConfigured=!!(cfg.oneSignalAppId&&!cfg.oneSignalAppId.includes("PASTE_"));
  setHealth("notifProviderState",sdkConfigured?"Configured":"Needs App ID",sdkConfigured?"good":"bad");
  let supported=false,permission=false,opted=false,subscriptionId=null,externalId=null;
  try{
    if(sdkConfigured){
      await withOneSignal(async OneSignal=>{
        supported=OneSignal.Notifications.isPushSupported();
        permission=!!OneSignal.Notifications.permission;
        opted=!!OneSignal.User.PushSubscription.optedIn;
        subscriptionId=OneSignal.User.PushSubscription.id||null;
        externalId=OneSignal.User.externalId||null;
      });
    }
  }catch(e){console.warn(e)}
  if(!sdkConfigured){
    setHealth("notifPermissionState","Not configured","bad");
    setHealth("notifDeviceState","Not registered","bad");
    setHealth("notifIdentityState","Not linked","bad");
  }else if(!supported){
    setHealth("notifPermissionState","Unsupported browser","bad");
    setHealth("notifDeviceState","Unavailable","bad");
    setHealth("notifIdentityState",externalId?"Linked":"Not linked",externalId?"good":"warn");
  }else{
    setHealth("notifPermissionState",permission?"Allowed":Notification.permission==="denied"?"Blocked":"Not allowed",permission?"good":Notification.permission==="denied"?"bad":"warn");
    setHealth("notifDeviceState",subscriptionId&&opted?"Subscribed":subscriptionId?"Opted out":"Not registered",subscriptionId&&opted?"good":"warn");
    setHealth("notifIdentityState",externalId===user?.id?"Linked to account":"Not linked",externalId===user?.id?"good":"warn");
  }
  if($("notifSubscriptionId"))$("notifSubscriptionId").textContent=subscriptionId||"—";
  const ready=sdkConfigured&&supported&&permission&&opted&&subscriptionId&&externalId===user?.id;
  if($("notifHeroTitle"))$("notifHeroTitle").textContent=ready?"External push is ready":"Notification setup needs attention";
  if($("notifHeroText"))$("notifHeroText").textContent=ready?"This browser is registered with OneSignal and linked to your signed-in Supabase account.":"Use Enable notifications and allow the browser prompt. Your production Vercel origin must exactly match the OneSignal Web configuration.";
  if($("oneSignalEnableBtn"))$("oneSignalEnableBtn").textContent=ready?"Notifications enabled":"Enable notifications";
  const checks=$("notificationChecklist")?.children;
  if(checks){
    const vals=[
      location.protocol==="https:"||["localhost","127.0.0.1"].includes(location.hostname),
      permission,
      sdkConfigured&&oneSignalReady,
      !!subscriptionId&&opted,
      externalId===user?.id
    ];
    [...checks].forEach((x,i)=>x.className=vals[i]?"good":"bad");
  }
  await loadNotificationDeliveryLog();
}
async function enableOneSignalNotifications(){
  if(!user)return alert("Sign in first.");
  try{
    await withOneSignal(async OneSignal=>{
      await OneSignal.login(user.id);
      await OneSignal.Notifications.requestPermission();
      if(OneSignal.Notifications.permission) await OneSignal.User.PushSubscription.optIn();
    });
    toast("Notification registration updated");
  }catch(e){alert("Could not enable OneSignal notifications: "+(e.message||String(e)))}
  await refreshNotificationCenter();
}
async function sendTestNotification(){
  if(!user)return alert("Sign in first.");
  const btn=$("sendTestNotificationBtn");if(btn){btn.disabled=true;btn.textContent="Sending…"}
  try{
    const {data,error}=await sb.functions.invoke("send-test-notification",{body:{title:"Harsha College Assistant",message:"Test notification successful — external push delivery is working."}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||"Test push was not accepted.");
    toast("Test push accepted by OneSignal");
    setTimeout(loadNotificationDeliveryLog,800);
  }catch(e){alert("Test notification failed: "+(e.message||String(e)))}
  finally{if(btn){btn.disabled=false;btn.textContent="Send test notification"}}
}
async function loadNotificationDeliveryLog(){
  const list=$("notificationDeliveryList");if(!list||!sb||!user)return;
  const {data,error}=await sb.from("notification_delivery_log").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
  if(error){
    list.innerHTML='<div class="empty">Delivery log table is not ready yet. Run <b>onesignal-notification-migration.sql</b> once in Supabase SQL Editor.</div>';
    return;
  }
  list.innerHTML=data?.length?data.map(x=>`<div class="delivery-row"><div><div class="title">${esc(x.title||"Notification")}</div><div class="meta">${esc(x.message||"")} · ${fmt(x.created_at)} · ${esc(x.provider||"OneSignal")}</div>${x.error_message?`<div class="meta">${esc(x.error_message)}</div>`:""}</div><span class="delivery-status ${x.status==="accepted"||x.status==="sent"?"success":x.status==="failed"?"failed":""}">${esc(x.status||"unknown")}</span></div>`).join(""):'<div class="empty">No delivery attempts yet. Use Send test notification.</div>';
}

function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function getServiceWorkerRegistration(){
  if(!("serviceWorker" in navigator)) throw new Error("Service workers are not supported on this device.");
  return await navigator.serviceWorker.ready;
}
async function refreshPushStatus(){
  const el=$("pushStatus"),btn=$("enablePushBtn");
  if(!el||!btn)return;
  if(!("Notification" in window)||!("PushManager" in window)||!("serviceWorker" in navigator)){
    el.textContent="Push notifications are not supported in this browser";btn.disabled=true;return;
  }
  if(location.protocol!=="https:" && location.hostname!=="localhost" && location.hostname!=="127.0.0.1"){
    el.textContent="Deploy with HTTPS to enable push notifications";btn.disabled=true;return;
  }
  try{
    const reg=await getServiceWorkerRegistration();
    const sub=await reg.pushManager.getSubscription();
    if(Notification.permission==="granted"&&sub){el.textContent="Notifications enabled on this device";btn.textContent="Refresh notification registration";}
    else if(Notification.permission==="denied"){el.textContent="Notifications blocked in browser settings";btn.textContent="Notifications blocked";}
    else {el.textContent="Not enabled on this device";btn.textContent="Enable notifications";}
  }catch(e){el.textContent=e.message}
}
async function enablePushNotifications(){
  if(!user)return alert("Sign in first.");
  if(!cfg.vapidPublicKey||cfg.vapidPublicKey.includes("PASTE_"))return alert("VAPID public key is not configured in assets/config.js.");
  if(!("Notification" in window)||!("PushManager" in window))return alert("Push notifications are not supported in this browser.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){await refreshPushStatus();return alert("Notification permission was not granted.");}
  try{
    const reg=await getServiceWorkerRegistration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});
    }
    const json=sub.toJSON();
    const payload={
      user_id:user.id,
      endpoint:sub.endpoint,
      p256dh:json.keys?.p256dh||"",
      auth:json.keys?.auth||"",
      user_agent:navigator.userAgent,
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from("push_subscriptions").upsert(payload,{onConflict:"endpoint"});
    if(error)throw error;
    await reg.showNotification("Harsha College Assistant",{body:"Notifications are enabled on this device.",tag:"push-enabled",icon:"./icon-192.png"});
    toast("Notifications enabled");
    await refreshPushStatus();
  }catch(e){alert("Could not enable notifications: "+e.message);await refreshPushStatus();}
}

async function loadAll(){
  if(!user)return;
  // Prevent duplicate six-table refreshes during auth/session events or rapid saves.
  if(loadAllPromise)return loadAllPromise;
  loadAllPromise=(async()=>{
    setSync("saving","Syncing");
    const [c,ct,m,r,q,n]=await Promise.all([
      sb.from("colleges").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      sb.from("contacts").select("*").eq("user_id",user.id).order("name"),
      sb.from("meeting_notes").select("*").eq("user_id",user.id).order("meeting_at",{ascending:false}),
      sb.from("reminders").select("*").eq("user_id",user.id).order("remind_at"),
      sb.from("requirements").select("*").eq("user_id",user.id).order("updated_at",{ascending:false}),
      sb.from("calendar_notes").select("*").eq("user_id",user.id)
    ]);
    const err=[c,ct,m,r,q,n].find(x=>x.error)?.error;
    if(err){setSync("error","Sync failed");toast(err.message);return}
    db={
      colleges:c.data.map(x=>({id:x.id,name:x.name,location:x.location||"",students:x.relevant_students||0,affiliationType:x.affiliation_type||"Anna University Affiliated",parentUniversity:x.parent_university||"",stage:x.stage||"New Lead",interest:x.interest||"Unknown",contactName:x.main_contact_name||"",contactDesignation:x.main_contact_designation||"",contactPhone:x.main_contact_phone||"",contactEmail:x.main_contact_email||"",nextAction:x.next_action||"",nextDate:x.next_action_at||"",blocker:x.blocker||"",notes:x.notes||""})),
      contacts:ct.data.map(x=>({id:x.id,collegeId:x.college_id,collegeName:x.college_name||"",name:x.name,designation:x.designation||"",phone:x.phone||"",email:x.email||"",department:x.department||"",preferred:x.preferred_contact||"Phone",note:x.note||""})),
      meetings:m.data.map(x=>({id:x.id,collegeId:x.college_id,collegeName:x.college_name||"",topic:x.topic,notes:x.notes,person:x.person_met||"",feedback:x.feedback||"Neutral",date:x.meeting_at,action:x.next_action||"",followup:x.followup_at||""})),
      reminders:r.data.map(x=>({id:x.id,collegeId:x.college_id,collegeName:x.college_name||"",text:x.reminder_text,when:x.remind_at,type:x.reminder_type||"Follow-up",done:!!x.done,note:x.note||"",alertBefore:Number(x.alert_before_minutes||0),notificationSent:!!x.notification_sent})),
      requirements:q.data.map(x=>({id:x.id,collegeId:x.college_id,collegeName:x.college_name||"",title:x.title,description:x.description,priority:x.priority||"Medium",status:x.status||"New",requestedBy:x.requested_by||"",updatedAt:x.updated_at})),
      calendarNotes:n.data.map(x=>({id:x.id,date:x.note_date,text:x.note_text}))
    };
    cacheSave();setSync("online","Cloud saved");renderAll();
    // CRM Professional can now re-render against the fresh college/reminder data.
    window.dispatchEvent(new CustomEvent("harsha:base-data-ready"));
  })();
  try{return await loadAllPromise}finally{loadAllPromise=null}
}

async function init(){
  cacheLoad();
  if(!configured() || !window.supabase){$("configWarning").classList.remove("hidden");showAuth();return}
  sb=window.supabase.createClient(cfg.url,cfg.anonKey);
  const {data}=await sb.auth.getSession();
  if(data.session){user=data.session.user;showApp();await loadAll()} else showAuth();
  sb.auth.onAuthStateChange(async(_,session)=>{if(session){user=session.user;showApp();await loadAll()}else{user=null;showAuth()}});
}
$("signInBtn").onclick=async()=>{if(!configured())return $("configWarning").classList.remove("hidden");const {error}=await sb.auth.signInWithPassword({email:$("authEmail").value.trim(),password:$("authPassword").value});if(error)alert(error.message)};
$("signUpBtn").onclick=async()=>{if(!configured())return $("configWarning").classList.remove("hidden");const {error}=await sb.auth.signUp({email:$("authEmail").value.trim(),password:$("authPassword").value});alert(error?error.message:"Account created. Check your email if confirmation is enabled.")};
$("forgotBtn").onclick=async()=>{if(!configured())return $("configWarning").classList.remove("hidden");const email=$("authEmail").value.trim();if(!email)return alert("Enter your email first.");const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});alert(error?error.message:"Password reset email sent.")};
$("signOutBtn").onclick=()=>sb.auth.signOut();
$("enablePushBtn").onclick=enablePushNotifications;

const primaryMobileViews=new Set(["today","colleges","pipeline","calendar"]);
function renderView(v){
  if(v==="today")renderToday();
  else if(v==="colleges")renderColleges();
  else if(v==="calendar")renderCalendar();
  else if(v==="meetings")renderMeetings();
  else if(v==="contacts")renderContacts();
  else if(v==="reminders")renderReminders();
  else if(v==="requirements")renderRequirements();
  else if(v==="notifications")refreshNotificationCenter();
  window.HARSHA_CRM_PRO?.renderView?.(v);
}
function activateView(v){
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===v));
  document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
  const more=$("mobileMoreBtn");if(more)more.classList.toggle("active",!primaryMobileViews.has(v));
  closeDialog("mobileMoreDialog");
  // Only render the page the user opened. Previously every click rebuilt every screen.
  renderView(v);
  window.scrollTo({top:0,behavior:"auto"});
}
document.querySelectorAll("[data-view]").forEach(btn=>btn.onclick=()=>activateView(btn.dataset.view));
if($("oneSignalEnableBtn"))$("oneSignalEnableBtn").onclick=enableOneSignalNotifications;
if($("sendTestNotificationBtn"))$("sendTestNotificationBtn").onclick=sendTestNotification;
if($("refreshNotificationStatusBtn"))$("refreshNotificationStatusBtn").onclick=refreshNotificationCenter;

document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>closeDialog(btn.dataset.close));
document.querySelectorAll("dialog").forEach(d=>d.onclick=e=>{if(e.target===d)d.close()});
document.querySelectorAll("[data-open]").forEach(btn=>btn.onclick=()=>openForm(btn.dataset.open));
$("quickAddTop").onclick=()=>$("quickDialog").showModal();$("mobileFab").onclick=()=>$("quickDialog").showModal();
if($("mobileMoreBtn"))$("mobileMoreBtn").onclick=()=>$("mobileMoreDialog").showModal();
document.querySelectorAll("[data-quick]").forEach(btn=>btn.onclick=()=>{closeDialog("quickDialog");openForm(btn.dataset.quick)});

function openForm(type,id="",date=""){
  /* College is optional for notes, contacts, reminders and requirements. */
  if(type==="college"){$("collegeForm").reset();$("collegeId").value="";if($("collegeDialogTitle"))$("collegeDialogTitle").textContent="Add college";if(id){const c=db.colleges.find(x=>x.id===id);if(c){$("collegeId").value=c.id;$("collegeName").value=c.name;$("collegeLocation").value=c.location;$("collegeStudents").value=c.students||0;$("collegeAffiliationType").value=c.affiliationType||"Anna University Affiliated";$("collegeParentUniversity").value=c.parentUniversity||"";$("collegeStage").value=c.stage;$("collegeInterest").value=c.interest;$("collegeContactName").value=c.contactName;$("collegeContactDesignation").value=c.contactDesignation;$("collegeContactPhone").value=c.contactPhone;$("collegeContactEmail").value=c.contactEmail;$("collegeNextAction").value=c.nextAction;$("collegeNextDate").value=c.nextDate?c.nextDate.slice(0,16):"";$("collegeBlocker").value=c.blocker;$("collegeNotes").value=c.notes;if($("collegeDialogTitle"))$("collegeDialogTitle").textContent="Edit college"}}$("collegeDialog").showModal()}
  if(type==="meeting"){$("meetingForm").reset();$("meetingId").value="";$("meetingDate").value=date?date+"T09:00":localNow();$("meetingDialogTitle").textContent="Notes & meeting";if(id){const m=db.meetings.find(x=>x.id===id);if(m){$("meetingId").value=m.id;$("meetingCollegeName").value=recordCollegeName(m)==="No college"?"":recordCollegeName(m);$("meetingTopic").value=m.topic;$("meetingNotes").value=m.notes;$("meetingPerson").value=m.person;$("meetingFeedback").value=m.feedback;$("meetingDate").value=m.date.slice(0,16);$("meetingAction").value=m.action;$("meetingFollowup").value=m.followup?m.followup.slice(0,16):"";$("meetingDialogTitle").textContent="Edit note / meeting"}}$("meetingDialog").showModal()}
  if(type==="contact"){$("contactForm").reset();$("contactId").value="";$("contactDialogTitle").textContent="Add contact";if(id){const c=db.contacts.find(x=>x.id===id);if(c){$("contactId").value=c.id;$("contactCollegeName").value=recordCollegeName(c)==="No college"?"":recordCollegeName(c);$("contactName").value=c.name;$("contactDesignation").value=c.designation;$("contactPhone").value=c.phone;$("contactEmail").value=c.email;$("contactDepartment").value=c.department;$("contactPreferred").value=c.preferred;$("contactNote").value=c.note;$("contactDialogTitle").textContent="Edit contact"}}$("contactDialog").showModal()}
  if(type==="reminder"){$("reminderForm").reset();$("reminderId").value="";$("reminderDialogTitle").textContent="Add reminder";const d=date?new Date(date+"T09:00"):new Date(Date.now()+3600000);$("reminderDate").value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");$("reminderTime").value=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");if(id){const r=db.reminders.find(x=>x.id===id);if(r){$("reminderId").value=r.id;$("reminderText").value=r.text;$("reminderDate").value=r.when.slice(0,10);$("reminderTime").value=new Date(r.when).toTimeString().slice(0,5);$("reminderCollegeName").value=recordCollegeName(r)==="No college"?"":recordCollegeName(r);$("reminderType").value=r.type;$("reminderStatus").value=r.done?"Completed":"Pending";$("reminderNote").value=r.note;$("reminderAlertBefore").value=String(r.alertBefore||0);$("reminderDialogTitle").textContent="Edit reminder"}}$("reminderDialog").showModal()}
  if(type==="requirement"){$("requirementForm").reset();$("requirementId").value="";$("requirementDialogTitle").textContent="Add requirement";if(id){const r=db.requirements.find(x=>x.id===id);if(r){$("requirementId").value=r.id;$("requirementCollegeName").value=recordCollegeName(r)==="No college"?"":recordCollegeName(r);$("requirementTitle").value=r.title;$("requirementDescription").value=r.description;$("requirementPriority").value=r.priority;$("requirementStatus").value=r.status;$("requirementBy").value=r.requestedBy;$("requirementDialogTitle").textContent="Edit requirement"}}$("requirementDialog").showModal()}
}

$("collegeForm").onsubmit=async e=>{
  e.preventDefault();setSync("saving","Saving");
  const id=$("collegeId")?.value||"";
  const payload={user_id:user.id,name:$("collegeName").value.trim(),location:$("collegeLocation").value.trim(),relevant_students:Number($("collegeStudents").value||0),affiliation_type:$("collegeAffiliationType").value,parent_university:$("collegeParentUniversity").value.trim(),stage:$("collegeStage").value,interest:$("collegeInterest").value,main_contact_name:$("collegeContactName").value.trim(),main_contact_designation:$("collegeContactDesignation").value.trim(),main_contact_phone:$("collegeContactPhone").value.trim(),main_contact_email:$("collegeContactEmail").value.trim(),next_action:$("collegeNextAction").value.trim(),next_action_at:$("collegeNextDate").value?new Date($("collegeNextDate").value).toISOString():null,blocker:$("collegeBlocker").value.trim(),notes:$("collegeNotes").value.trim(),updated_at:new Date().toISOString()};
  let result;
  if(id)result=await sb.from("colleges").update(payload).eq("id",id).select().single();
  else result=await sb.from("colleges").insert(payload).select().single();
  if(result.error){setSync("error","Save failed");return alert(result.error.message)}
  if(!id && $("collegeContactName").value.trim()){await sb.from("contacts").insert({user_id:user.id,college_id:result.data.id,college_name:payload.name,name:$("collegeContactName").value.trim(),designation:$("collegeContactDesignation").value.trim(),phone:$("collegeContactPhone").value.trim(),email:$("collegeContactEmail").value.trim(),preferred_contact:"Phone",note:"Main contact"})}
  closeDialog("collegeDialog");await loadAll();toast(id?"College updated":"College saved");
};
$("meetingForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    setSync("saving","Saving");
    const id=$("meetingId").value;
    const link=await resolveCollege($("meetingCollegeName").value,$("meetingCreateCollege").checked);
    const payload={
      user_id:user.id,
      college_id:link.collegeId,
      college_name:link.collegeName,
      topic:$("meetingTopic").value.trim(),
      notes:$("meetingNotes").value.trim(),
      person_met:$("meetingPerson").value.trim(),
      feedback:$("meetingFeedback").value,
      meeting_at:new Date($("meetingDate").value||localNow()).toISOString(),
      next_action:$("meetingAction").value.trim(),
      followup_at:$("meetingFollowup").value?new Date($("meetingFollowup").value).toISOString():null,
      updated_at:new Date().toISOString()
    };
    const res=id?await sb.from("meeting_notes").update(payload).eq("id",id):await sb.from("meeting_notes").insert(payload);
    if(res.error)throw res.error;
    if(!id&&payload.next_action&&payload.followup_at){
      await sb.from("reminders").insert({
        user_id:user.id,college_id:link.collegeId,college_name:link.collegeName,
        reminder_text:payload.next_action,remind_at:payload.followup_at,reminder_type:"Follow-up",
        note:"Created from meeting notes",alert_before_minutes:0,notification_sent:false
      });
    }
    closeDialog("meetingDialog");await loadAll();toast("Notes saved");
  }catch(err){setSync("error","Save failed");alert(err.message||String(err))}
};
$("contactForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$("contactId").value;
    const link=await resolveCollege($("contactCollegeName").value,$("contactCreateCollege").checked);
    const payload={
      user_id:user.id,college_id:link.collegeId,college_name:link.collegeName,
      name:$("contactName").value.trim(),designation:$("contactDesignation").value.trim(),
      phone:$("contactPhone").value.trim(),email:$("contactEmail").value.trim(),
      department:$("contactDepartment").value.trim(),preferred_contact:$("contactPreferred").value,
      note:$("contactNote").value.trim(),updated_at:new Date().toISOString()
    };
    const res=id?await sb.from("contacts").update(payload).eq("id",id):await sb.from("contacts").insert(payload);
    if(res.error)throw res.error;
    closeDialog("contactDialog");await loadAll();toast("Contact saved");
  }catch(err){alert(err.message||String(err))}
};
$("reminderForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$("reminderId").value;
    const link=await resolveCollege($("reminderCollegeName").value,false);
    const when=new Date($("reminderDate").value+"T"+$("reminderTime").value).toISOString();
    const payload={
      user_id:user.id,college_id:link.collegeId,college_name:link.collegeName,
      reminder_text:$("reminderText").value.trim(),remind_at:when,
      reminder_type:$("reminderType").value,done:$("reminderStatus").value==="Completed",
      note:$("reminderNote").value.trim(),alert_before_minutes:Number($("reminderAlertBefore").value||0),
      notification_sent:false,notification_sent_at:null,updated_at:new Date().toISOString()
    };
    const res=id?await sb.from("reminders").update(payload).eq("id",id):await sb.from("reminders").insert(payload);
    if(res.error)throw res.error;
    closeDialog("reminderDialog");await loadAll();toast("Reminder saved");
  }catch(err){alert(err.message||String(err))}
};
$("requirementForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$("requirementId").value;
    const link=await resolveCollege($("requirementCollegeName").value,$("requirementCreateCollege").checked);
    const payload={
      user_id:user.id,college_id:link.collegeId,college_name:link.collegeName,
      title:$("requirementTitle").value.trim(),description:$("requirementDescription").value.trim(),
      priority:$("requirementPriority").value,status:$("requirementStatus").value,
      requested_by:$("requirementBy").value.trim(),updated_at:new Date().toISOString()
    };
    const res=id?await sb.from("requirements").update(payload).eq("id",id):await sb.from("requirements").insert(payload);
    if(res.error)throw res.error;
    closeDialog("requirementDialog");await loadAll();toast("Requirement saved");
  }catch(err){alert(err.message||String(err))}
};

function reminderCard(r){const d=new Date(r.when),now=new Date(),cls=r.done?"done":d<now?"overdue":d.toDateString()===now.toDateString()?"today":"upcoming";const alertLabel=r.alertBefore===1440?"1 day before":r.alertBefore===60?"1 hour before":r.alertBefore?`${r.alertBefore} min before`:"at reminder time";return`<div class="task ${cls}"><div><div class="title">${esc(r.text)}</div><div class="meta">${esc(recordCollegeName(r))} · ${fmt(r.when)} · ${esc(r.type)}</div><div class="meta">Notify: ${alertLabel}${r.notificationSent?" · Sent":""}</div></div><div class="button-row"><button class="btn ghost toggleR" data-id="${r.id}">${r.done?"Undo":"Done"}</button><button class="btn ghost editR" data-id="${r.id}">Edit</button><button class="btn danger deleteR" data-id="${r.id}">Delete</button></div></div>`}
function bindReminder(){document.querySelectorAll(".toggleR").forEach(b=>b.onclick=async()=>{const r=db.reminders.find(x=>x.id===b.dataset.id);const {error}=await sb.from("reminders").update({done:!r.done,updated_at:new Date().toISOString()}).eq("id",r.id);if(error)return alert(error.message);await loadAll()});document.querySelectorAll(".editR").forEach(b=>b.onclick=()=>openForm("reminder",b.dataset.id));document.querySelectorAll(".deleteR").forEach(b=>b.onclick=async()=>{if(confirm("Delete this reminder?")){const {error}=await sb.from("reminders").delete().eq("id",b.dataset.id);if(error)return alert(error.message);await loadAll()}})}
function renderToday(){const start=new Date();start.setHours(0,0,0,0);const end=new Date();end.setHours(23,59,59,999);$("todayDate").textContent=new Date().toLocaleDateString([],{weekday:"long",year:"numeric",month:"long",day:"numeric"});$("statColleges").textContent=db.colleges.length;$("statToday").textContent=db.meetings.filter(m=>new Date(m.date)>=start&&new Date(m.date)<=end).length+db.reminders.filter(r=>!r.done&&new Date(r.when)>=start&&new Date(r.when)<=end).length;$("statOverdue").textContent=db.reminders.filter(r=>!r.done&&new Date(r.when)<start).length;$("statHigh").textContent=db.colleges.filter(c=>c.interest==="Hot").length;const tasks=db.reminders.filter(r=>!r.done&&new Date(r.when)<=end);$("todayTasks").innerHTML=tasks.length?tasks.map(reminderCard).join(""):'<div class="empty">Nothing overdue or scheduled for today.</div>';$("attentionList").innerHTML=db.colleges.filter(c=>!c.nextAction).map(c=>`<div class="list-card"><div class="title">${esc(c.name)}</div><div class="meta">No next action set</div></div>`).join("")||'<div class="empty">All colleges have clear next actions.</div>';bindReminder()}
function renderColleges(){
  const q=$("collegeSearch").value.toLowerCase();
  const rows=db.colleges.filter(c=>[c.name,c.location,c.contactName,c.affiliationType,c.parentUniversity,c.stage].join(" ").toLowerCase().includes(q));
  $("collegeGrid").innerHTML=rows.length?rows.map(c=>`<article class="entity-card">
    <div class="entity-top">
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="meta">${esc(c.location||"Location not added")}</div>
        <div class="college-affiliation-line"><span>${esc(c.affiliationType||"Affiliation not set")}</span>${c.parentUniversity?`<b>${esc(c.parentUniversity)}</b>`:""}</div>
      </div>
      <span class="pill">${esc(c.interest)}</span>
    </div>
    <div class="college-stage-strip">${esc(c.stage||"New Lead")}</div>
    <div class="contact-box">
      <div class="title">${esc(c.contactName||"No main contact")}</div>
      <div class="meta">${esc(c.contactDesignation||"Designation not added")}</div>
      <div class="meta">${esc(c.contactPhone||"Phone not added")}</div>
    </div>
    <div class="next-box ${!c.nextAction?"warn":""}">
      <div class="title">Next: ${esc(c.nextAction||"No next action set")}</div>
      <div class="meta">${fmt(c.nextDate)}</div>
    </div>
    <div class="button-row" style="margin-top:10px">
      <button class="btn ghost editCollege" data-id="${c.id}">Edit</button>
      <button class="btn soft timelineCollege" data-id="${c.id}">Timeline</button>
    </div>
  </article>`).join(""):'<div class="empty">No colleges added yet.</div>';
  document.querySelectorAll(".editCollege").forEach(b=>b.onclick=()=>openForm("college",b.dataset.id));
  document.querySelectorAll(".timelineCollege").forEach(b=>b.onclick=()=>window.HARSHA_CRM_PRO?.openCollegeTimeline?.(b.dataset.id));
}
function renderMeetings(){$("meetingList").innerHTML=db.meetings.length?db.meetings.map(m=>`<article class="list-card"><div class="entity-top"><div><div class="title">${esc(m.topic)}</div><div class="meta">${esc(recordCollegeName(m))} · ${fmt(m.date)}</div></div><span class="pill">${esc(m.feedback)}</span></div><div style="margin-top:8px">${esc(m.notes)}</div><div class="button-row" style="margin-top:10px"><button class="btn ghost editM" data-id="${m.id}">Edit</button><button class="btn danger deleteM" data-id="${m.id}">Delete</button></div></article>`).join(""):'<div class="empty">No meeting notes saved.</div>';document.querySelectorAll(".editM").forEach(b=>b.onclick=()=>openForm("meeting",b.dataset.id));document.querySelectorAll(".deleteM").forEach(b=>b.onclick=async()=>{if(confirm("Delete this meeting note?")){const {error}=await sb.from("meeting_notes").delete().eq("id",b.dataset.id);if(error)return alert(error.message);await loadAll()}})}
function renderReminders(){$("reminderList").innerHTML=db.reminders.length?db.reminders.map(reminderCard).join(""):'<div class="empty">No reminders added yet.</div>';bindReminder()}
function renderRequirements(){const f=$("requirementFilter").value;const rows=db.requirements.filter(r=>!f||r.collegeId===f);$("requirementList").innerHTML=rows.length?rows.map(r=>`<article class="list-card"><div class="title">${esc(r.title)}</div><div class="meta">${esc(recordCollegeName(r))} · ${esc(r.priority)} · ${esc(r.status)}</div><div style="margin-top:8px">${esc(r.description)}</div><div class="button-row" style="margin-top:10px"><button class="btn ghost editQ" data-id="${r.id}">Edit</button><button class="btn danger deleteQ" data-id="${r.id}">Delete</button></div></article>`).join(""):'<div class="empty">No requirements found.</div>';document.querySelectorAll(".editQ").forEach(b=>b.onclick=()=>openForm("requirement",b.dataset.id));document.querySelectorAll(".deleteQ").forEach(b=>b.onclick=async()=>{if(confirm("Delete this requirement?")){const {error}=await sb.from("requirements").delete().eq("id",b.dataset.id);if(error)return alert(error.message);await loadAll()}})}
function renderCalendar(){const y=month.getFullYear(),m=month.getMonth();$("calendarTitle").textContent=month.toLocaleDateString([],{month:"long",year:"numeric"});const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();let h=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="dow">${x}</div>`).join("");for(let i=0;i<first.getDay();i++)h+='<div class="day blank"></div>';for(let d=1;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;const ev=[...db.calendarNotes.filter(n=>n.date===iso).map(n=>({c:"n",t:n.text})),...db.reminders.filter(r=>r.when.slice(0,10)===iso).map(r=>({c:"r",t:r.text})),...db.meetings.filter(x=>x.date.slice(0,10)===iso).map(x=>({c:"m",t:x.topic}))];h+=`<div class="day ${new Date(y,m,d).toDateString()===new Date().toDateString()?"today":""}" data-day="${iso}"><b>${d}</b>${ev.slice(0,3).map(e=>`<div class="event ${e.c}">${esc(e.t)}</div>`).join("")}</div>`}$("calendarGrid").innerHTML=h;document.querySelectorAll("[data-day]").forEach(x=>x.onclick=()=>openDay(x.dataset.day))}
function openDay(date){selectedDay=date;$("dayHeading").textContent=new Date(date+"T12:00").toLocaleDateString([],{weekday:"long",year:"numeric",month:"long",day:"numeric"});$("dayNote").value=db.calendarNotes.find(n=>n.date===date)?.text||"";$("dayItems").innerHTML=[...db.reminders.filter(r=>r.when.slice(0,10)===date).map(r=>r.text),...db.meetings.filter(m=>m.date.slice(0,10)===date).map(m=>m.topic+" — "+recordCollegeName(m))].map(x=>`<div class="list-card">${esc(x)}</div>`).join("")||'<div class="empty">No activities on this date.</div>';$("dayDialog").showModal()}
$("prevMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderCalendar()};$("nextMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderCalendar()};$("dayReminder").onclick=()=>{closeDialog("dayDialog");openForm("reminder","",selectedDay)};$("dayMeeting").onclick=()=>{closeDialog("dayDialog");openForm("meeting","",selectedDay)};$("saveDayNote").onclick=async()=>{const text=$("dayNote").value.trim();const existing=db.calendarNotes.find(n=>n.date===selectedDay);let res;if(existing)res=await sb.from("calendar_notes").update({note_text:text,updated_at:new Date().toISOString()}).eq("id",existing.id);else res=await sb.from("calendar_notes").insert({user_id:user.id,note_date:selectedDay,note_text:text});if(res.error)return alert(res.error.message);closeDialog("dayDialog");await loadAll();toast("Date note saved")};$("deleteDayNote").onclick=async()=>{const existing=db.calendarNotes.find(n=>n.date===selectedDay);if(existing){const {error}=await sb.from("calendar_notes").delete().eq("id",existing.id);if(error)return alert(error.message)}closeDialog("dayDialog");await loadAll()}
function renderAll(){refreshCollegeSuggestions();$("requirementFilter").innerHTML='<option value="">All linked college profiles</option>'+db.colleges.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");renderToday();renderColleges();renderMeetings();renderContacts();renderReminders();renderRequirements();renderCalendar()}
$("collegeSearch").oninput=renderColleges;$("requirementFilter").onchange=renderRequirements;
function download(name,text,type){const a=document.createElement("a"),blob=new Blob([text],{type});a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}function exportJSON(){download("harsha-college-assistant-backup.json",JSON.stringify(db,null,2),"application/json")}$("exportTop").onclick=exportJSON;$("jsonExport").onclick=exportJSON;$("csvExport").onclick=()=>{const rows=["College,Location,Students,Main Contact,Designation,Phone,Email"];db.colleges.forEach(c=>rows.push([c.name,c.location,c.students,c.contactName,c.contactDesignation,c.contactPhone,c.contactEmail].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")));download("harsha-colleges.csv",rows.join("\n"),"text/csv")};

window.HARSHA_CRM={get sb(){return sb},get user(){return user},get db(){return db},loadAll,toast,esc,fmt,recordCollegeName,localNow,openForm,closeDialog,activateView,renderView};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
init();
})();
