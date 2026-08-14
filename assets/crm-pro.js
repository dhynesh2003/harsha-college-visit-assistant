(()=>{
"use strict";
const $=id=>document.getElementById(id);
const stages=["New Lead","Contacted","Visit Planned","Visited","Interested","Demo Required","Demo Completed","Proposal Required","Proposal Sent","Approval Pending","Negotiation","Won / Onboarding","Lost","Dormant"];
const state={visits:[],activities:[],opportunities:[],files:[],ready:false,error:null};
const crm=()=>window.HARSHA_CRM;
const esc=s=>crm()?.esc?.(s??"")??String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fmt=v=>crm()?.fmt?.(v)||"";
const user=()=>crm()?.user;
const sb=()=>crm()?.sb;
const base=()=>crm()?.db||{colleges:[],contacts:[],meetings:[],reminders:[],requirements:[]};
const nowLocal=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
const collegeByName=name=>base().colleges.find(c=>c.name.toLowerCase()===(name||"").trim().toLowerCase());
const recordCollege=x=>x.college_name||base().colleges.find(c=>c.id===x.college_id)?.name||"No college";
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));

async function load(){
 if(!user()||!sb())return;
 const [v,a,o,f]=await Promise.all([
   sb().from("crm_visits").select("*").eq("user_id",user().id).order("visit_at",{ascending:false}),
   sb().from("crm_activities").select("*").eq("user_id",user().id).order("occurred_at",{ascending:false}),
   sb().from("crm_opportunities").select("*").eq("user_id",user().id).order("updated_at",{ascending:false}),
   sb().from("crm_files").select("*").eq("user_id",user().id).order("created_at",{ascending:false})
 ]);
 const bad=[v,a,o,f].find(x=>x.error);
 if(bad){state.error=bad.error;state.ready=false;renderMigrationNeeded();return}
 state.visits=v.data||[];state.activities=a.data||[];state.opportunities=o.data||[];state.files=f.data||[];state.ready=true;state.error=null;renderAll();
}
function renderMigrationNeeded(){
 ["pipelineBoard","visitList","activityTimeline","fileGrid","reportMetrics"].forEach(id=>{if($(id))$(id).innerHTML='<div class="empty pro-migration-warning"><b>CRM Professional tables are not ready.</b><br>Run <code>CRM_PRO_V4_MIGRATION.sql</code> once in Supabase SQL Editor, then refresh.</div>'});
}
function showView(id){
 document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===id));
 document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===id));
 renderAll();
}
function open(type,id=""){
 if(type==="visit")openVisit(id);
 if(type==="activity")openActivity(id);
 if(type==="opportunity")openOpportunity(id);
 if(type==="file"){$("fileForm").reset();$("fileDialog").showModal()}
}
function close(id){$(id)?.close()}
function fillCollegeInput(id){const c=base().colleges.find(x=>x.id===id);return c?.name||""}
function openVisit(id=""){
 $("visitForm").reset();
 $("visitId").value="";
 $("visitAt").value=nowLocal();
 $("visitResponsiblePerson").value="Harsha";
 $("visitDialogTitle").textContent="Plan visit";
 if(id){
   const x=state.visits.find(v=>v.id===id);
   if(x){
     $("visitId").value=x.id;
     $("visitCollege").value=x.college_name||fillCollegeInput(x.college_id);
     $("visitPurpose").value=x.purpose||"Follow-up";
     $("visitStatus").value=x.status||"Planned";
     $("visitAt").value=x.visit_at?.slice(0,16)||"";
     $("visitLocation").value=x.location||"";
     $("visitAgenda").value=x.agenda||"";
     $("visitMeetingHappened").value=x.meeting_happened||"Pending visit";
     $("visitPersonRole").value=x.person_role||"Not decided / Not met";
     $("visitPeople").value=x.people_met||"";
     $("visitObjectiveAchieved").value=x.objective_achieved||"Pending visit";
     $("visitOutcomeStatus").value=x.outcome_status||"Pending visit";
     $("visitDecisionStage").value=x.decision_stage||"Not assessed";
     $("visitOpportunityStrength").value=x.opportunity_strength||"Unknown";
     $("visitBlockerCategory").value=x.blocker_category||"None / Unknown";
     $("visitInterest").value=x.interest_level||"Unknown";
     $("visitExpectedStudents").value=x.expected_students||"";
     $("visitExpectedValue").value=x.expected_value||"";
     $("visitClassification").value=x.visit_classification||"Planned / Pending";
     $("visitLostReason").value=x.lost_stalled_reason||"Not applicable";
     $("visitNextActionType").value=x.next_action_type||"None";
     $("visitResponsiblePerson").value=x.responsible_person||"Harsha";
     $("visitFollowup").value=x.follow_up_at?.slice(0,16)||"";
     $("visitOutcome").value=x.outcome||"";
     $("visitBlocker").value=x.blocker||"";
     $("visitNextAction").value=x.next_action||"";
     $("visitNotes").value=x.notes||"";
     $("visitDialogTitle").textContent="Edit visit";
   }
 }
 $("visitDialog").showModal();
}
function openActivity(id=""){$("activityForm").reset();$("activityId").value="";$("activityAt").value=nowLocal();$("activityDialogTitle").textContent="Log activity";if(id){const x=state.activities.find(a=>a.id===id);if(x){$("activityId").value=x.id;$("activityType").value=x.activity_type;$("activityAt").value=x.occurred_at?.slice(0,16)||"";$("activityCollege").value=x.college_name||fillCollegeInput(x.college_id);$("activityContact").value=x.contact_name||"";$("activityOutcome").value=x.outcome||"Pending";$("activityTitle").value=x.title;$("activityDetails").value=x.details||"";$("activityNextAction").value=x.next_action||"";$("activityFollowup").value=x.follow_up_at?.slice(0,16)||"";$("activityDialogTitle").textContent="Edit activity"}}$("activityDialog").showModal()}
function openOpportunity(id=""){$("opportunityForm").reset();$("opportunityId").value="";$("opportunityProbability").value="20";$("opportunityDialogTitle").textContent="Add opportunity";if(id){const x=state.opportunities.find(o=>o.id===id);if(x){$("opportunityId").value=x.id;$("opportunityCollege").value=x.college_name||fillCollegeInput(x.college_id);$("opportunityName").value=x.name;$("opportunityStage").value=x.stage;$("opportunityProbability").value=x.probability;$("opportunityValue").value=x.estimated_value||"";$("opportunityClose").value=x.expected_close_date||"";$("opportunityStatus").value=x.status;$("opportunityLostReason").value=x.lost_reason||"";$("opportunityNotes").value=x.notes||"";$("opportunityDialogTitle").textContent="Edit opportunity"}}$("opportunityDialog").showModal()}

async function collegeRef(name){const c=collegeByName(name);return {college_id:c?.id||null,college_name:(name||"").trim()||null}}
async function createFollowup(collegeName,text,at,note=""){
 if(!at)return;const ref=await collegeRef(collegeName);await sb().from("reminders").insert({user_id:user().id,...ref,reminder_text:text,remind_at:new Date(at).toISOString(),reminder_type:"Follow-up",done:false,note,alert_before_minutes:30,notification_sent:false});
}

async function saveVisit(e){
 e.preventDefault();
 const id=$("visitId").value;
 const ref=await collegeRef($("visitCollege").value);
 const payload={
   user_id:user().id,...ref,
   purpose:$("visitPurpose").value,
   status:$("visitStatus").value,
   visit_at:new Date($("visitAt").value).toISOString(),
   location:$("visitLocation").value.trim(),
   agenda:$("visitAgenda").value.trim(),
   meeting_happened:$("visitMeetingHappened").value,
   person_role:$("visitPersonRole").value,
   people_met:$("visitPeople").value.trim(),
   objective_achieved:$("visitObjectiveAchieved").value,
   outcome_status:$("visitOutcomeStatus").value,
   decision_stage:$("visitDecisionStage").value,
   opportunity_strength:$("visitOpportunityStrength").value,
   blocker_category:$("visitBlockerCategory").value,
   interest_level:$("visitInterest").value,
   expected_students:Number($("visitExpectedStudents").value||0),
   expected_value:Number($("visitExpectedValue").value||0),
   visit_classification:$("visitClassification").value,
   lost_stalled_reason:$("visitLostReason").value,
   next_action_type:$("visitNextActionType").value,
   responsible_person:$("visitResponsiblePerson").value.trim()||"Harsha",
   outcome:$("visitOutcome").value.trim(),
   blocker:$("visitBlocker").value.trim(),
   next_action:$("visitNextAction").value.trim(),
   follow_up_at:$("visitFollowup").value?new Date($("visitFollowup").value).toISOString():null,
   notes:$("visitNotes").value.trim(),
   updated_at:new Date().toISOString()
 };
 if(payload.status==="Completed" && payload.outcome_status==="Pending visit"){
   return alert("Choose a structured Outcome Status before marking the visit Completed.");
 }
 if(payload.status==="Completed" && payload.objective_achieved==="Pending visit"){
   return alert("Choose whether the visit objective was achieved before marking the visit Completed.");
 }
 if(payload.status==="Completed" && payload.visit_classification==="Planned / Pending"){
   return alert("Choose a Final Visit Classification before marking the visit Completed.");
 }
 if(["Closed-Lost","Unsuccessful"].includes(payload.visit_classification) && payload.lost_stalled_reason==="Not applicable"){
   return alert("Select the lost / stalled reason for an unsuccessful or closed-lost visit.");
 }
 if(payload.next_action_type!=="None" && payload.next_action_type!=="No Further Action" && !payload.next_action){
   return alert("Enter the exact next action.");
 }

 const r=id
   ?await sb().from("crm_visits").update(payload).eq("id",id)
   :await sb().from("crm_visits").insert(payload);
 if(r.error)return alert(r.error.message);

 if(!id && $("visitFollowup").value){
   await createFollowup(
     $("visitCollege").value,
     `${payload.next_action_type}: ${payload.next_action||payload.purpose}`,
     $("visitFollowup").value,
     `${payload.outcome_status} · ${payload.blocker_category}`
   );
 }

 if(payload.status==="Completed"&&!id){
   await sb().from("crm_activities").insert({
     user_id:user().id,...ref,
     activity_type:"Visit",
     title:`${payload.purpose} visit`,
     details:[payload.outcome_status,payload.objective_achieved!=="Pending visit"?`Objective: ${payload.objective_achieved}`:"",payload.outcome].filter(Boolean).join(" · "),
     occurred_at:payload.visit_at,
     contact_name:payload.people_met,
     outcome:payload.outcome_status,
     next_action:payload.next_action,
     follow_up_at:payload.follow_up_at
   });
 }

 // Keep the college profile useful after every completed visit.
 if(ref.college_id && payload.status==="Completed"){
   const stageMap={
     "Very Interested":"Interested",
     "Interested":"Interested",
     "Need Demo":"Demo Required",
     "Need Proposal":"Proposal Required",
     "Need Approval":"Approval Pending",
     "Converted / Won":"Won / Onboarding",
     "Rejected":"Lost",
     "Not Relevant":"Lost"
   };
   const collegeUpdate={
     interest:payload.opportunity_strength==="Unknown"?$("visitInterest").value:payload.opportunity_strength,
     blocker:payload.blocker||payload.blocker_category,
     next_action:payload.next_action||payload.next_action_type,
     next_action_at:payload.follow_up_at,
     updated_at:new Date().toISOString()
   };
   if(stageMap[payload.outcome_status])collegeUpdate.stage=stageMap[payload.outcome_status];
   await sb().from("colleges").update(collegeUpdate).eq("id",ref.college_id);
 }

 close("visitDialog");
 await crm().loadAll();
 await load();
 crm().toast("Structured visit saved");
}
async function saveActivity(e){e.preventDefault();const id=$("activityId").value,ref=await collegeRef($("activityCollege").value);const payload={user_id:user().id,...ref,activity_type:$("activityType").value,title:$("activityTitle").value.trim(),details:$("activityDetails").value.trim(),occurred_at:new Date($("activityAt").value).toISOString(),contact_name:$("activityContact").value.trim(),outcome:$("activityOutcome").value,next_action:$("activityNextAction").value.trim(),follow_up_at:$("activityFollowup").value?new Date($("activityFollowup").value).toISOString():null,updated_at:new Date().toISOString()};const r=id?await sb().from("crm_activities").update(payload).eq("id",id):await sb().from("crm_activities").insert(payload);if(r.error)return alert(r.error.message);if(!id&&$("activityFollowup").value)await createFollowup($("activityCollege").value,`Follow up: ${payload.title}`,$("activityFollowup").value,payload.next_action);close("activityDialog");await crm().loadAll();await load();crm().toast("Activity saved")}
async function saveOpportunity(e){e.preventDefault();const id=$("opportunityId").value,ref=await collegeRef($("opportunityCollege").value);let stage=$("opportunityStage").value,status=$("opportunityStatus").value;if(stage==="Won / Onboarding")status="Won";if(stage==="Lost")status="Lost";const payload={user_id:user().id,...ref,name:$("opportunityName").value.trim(),stage,probability:Number($("opportunityProbability").value||0),estimated_value:Number($("opportunityValue").value||0),expected_close_date:$("opportunityClose").value||null,status,lost_reason:$("opportunityLostReason").value.trim(),notes:$("opportunityNotes").value.trim(),updated_at:new Date().toISOString()};const r=id?await sb().from("crm_opportunities").update(payload).eq("id",id):await sb().from("crm_opportunities").insert(payload);if(r.error)return alert(r.error.message);close("opportunityDialog");await load();crm().toast("Opportunity saved")}
async function saveFile(e){e.preventDefault();const file=$("fileInput").files[0];if(!file)return;const ref=await collegeRef($("fileCollege").value);const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${user().id}/${Date.now()}-${safe}`;const up=await sb().storage.from("crm-files").upload(path,file,{upsert:false});if(up.error)return alert(up.error.message);const meta=await sb().from("crm_files").insert({user_id:user().id,...ref,category:$("fileCategory").value,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size,note:$("fileNote").value.trim()});if(meta.error){await sb().storage.from("crm-files").remove([path]);return alert(meta.error.message)}close("fileDialog");await load();crm().toast("File uploaded")}

function renderPulse(){const el=$("proPulse");if(!el||!state.ready)return;const open=state.opportunities.filter(x=>x.status==="Open"),weighted=open.reduce((s,x)=>s+Number(x.estimated_value||0)*Number(x.probability||0)/100,0),next7=state.visits.filter(v=>v.status!=="Cancelled"&&new Date(v.visit_at)>=new Date()&&new Date(v.visit_at)<=new Date(Date.now()+7*86400000)).length,noResponse=state.activities.filter(a=>a.outcome==="No Response"&&new Date(a.occurred_at)>new Date(Date.now()-7*86400000)).length;el.innerHTML=`<article><span>Open pipeline</span><strong>${money(open.reduce((s,x)=>s+Number(x.estimated_value||0),0))}</strong></article><article><span>Weighted value</span><strong>${money(weighted)}</strong></article><article><span>Visits next 7 days</span><strong>${next7}</strong></article><article><span>No-response this week</span><strong>${noResponse}</strong></article>`}
function renderPipeline(){if(!$("pipelineBoard")||!state.ready)return;const open=state.opportunities.filter(o=>o.status==="Open"),total=open.reduce((s,x)=>s+Number(x.estimated_value||0),0),weighted=open.reduce((s,x)=>s+Number(x.estimated_value||0)*Number(x.probability||0)/100,0);$("pipelineSummary").innerHTML=`<div><span>Open opportunities</span><strong>${open.length}</strong></div><div><span>Open value</span><strong>${money(total)}</strong></div><div><span>Weighted value</span><strong>${money(weighted)}</strong></div><div><span>Won</span><strong>${state.opportunities.filter(x=>x.status==="Won").length}</strong></div>`;$("pipelineBoard").innerHTML=stages.map(stage=>{const rows=state.opportunities.filter(o=>o.stage===stage);return `<section class="pipeline-column"><header><div><b>${esc(stage)}</b><span>${rows.length}</span></div><small>${money(rows.reduce((s,x)=>s+Number(x.estimated_value||0),0))}</small></header><div class="pipeline-cards">${rows.map(o=>`<article class="pipeline-card"><div class="pipeline-card-top"><strong>${esc(o.name)}</strong><span>${Number(o.probability||0)}%</span></div><div class="meta">${esc(recordCollege(o))}</div><div class="pipeline-value">${money(o.estimated_value)}</div><div class="meta">Close: ${o.expected_close_date||"Not set"}</div><select class="pipeline-stage-move" data-id="${o.id}">${stages.map(s=>`<option ${s===o.stage?"selected":""}>${esc(s)}</option>`).join("")}</select><div class="button-row"><button class="btn ghost editOpp" data-id="${o.id}">Edit</button><button class="btn danger deleteOpp" data-id="${o.id}">Delete</button></div></article>`).join("")||'<div class="pipeline-empty">No opportunities</div>'}</div></section>`}).join("");document.querySelectorAll(".editOpp").forEach(b=>b.onclick=()=>openOpportunity(b.dataset.id));document.querySelectorAll(".deleteOpp").forEach(b=>b.onclick=async()=>{if(confirm("Delete this opportunity?")){await sb().from("crm_opportunities").delete().eq("id",b.dataset.id);await load()}});document.querySelectorAll(".pipeline-stage-move").forEach(s=>s.onchange=async()=>{const stage=s.value,status=stage==="Won / Onboarding"?"Won":stage==="Lost"?"Lost":"Open";await sb().from("crm_opportunities").update({stage,status,updated_at:new Date().toISOString()}).eq("id",s.dataset.id);await load()})}
function renderVisits(){
 if(!$("visitList")||!state.ready)return;
 const q=($("visitSearch")?.value||"").toLowerCase(),st=$("visitStatusFilter")?.value||"";
 const rows=state.visits.filter(v=>(!st||v.status===st)&&[
   recordCollege(v),v.purpose,v.people_met,v.outcome,v.outcome_status,v.decision_stage,
   v.blocker_category,v.visit_classification,v.opportunity_strength
 ].join(" ").toLowerCase().includes(q));
 $("visitList").innerHTML=rows.length?rows.map(v=>`<article class="list-card visit-card">
   <div class="entity-top">
     <div>
       <div class="title">${esc(v.purpose)} · ${esc(recordCollege(v))}</div>
       <div class="meta">${fmt(v.visit_at)} · ${esc(v.location||"Location not set")}</div>
     </div>
     <span class="pill visit-${String(v.status).toLowerCase()}">${esc(v.status)}</span>
   </div>
   <div class="structured-summary-grid">
     <div><span>Meeting</span><b>${esc(v.meeting_happened||"Pending")}</b></div>
     <div><span>Outcome</span><b>${esc(v.outcome_status||"Pending")}</b></div>
     <div><span>Objective</span><b>${esc(v.objective_achieved||"Pending")}</b></div>
     <div><span>Decision stage</span><b>${esc(v.decision_stage||"Not assessed")}</b></div>
     <div><span>Strength</span><b>${esc(v.opportunity_strength||"Unknown")}</b></div>
     <div><span>Classification</span><b>${esc(v.visit_classification||"Pending")}</b></div>
   </div>
   <div class="meta">Met: ${esc(v.person_role||"Not recorded")}${v.people_met?` · ${esc(v.people_met)}`:""} · Blocker: ${esc(v.blocker_category||"None / Unknown")}</div>
   ${(v.expected_students||v.expected_value)?`<div class="meta">Potential: ${Number(v.expected_students||0).toLocaleString("en-IN")} students · ${money(v.expected_value||0)}</div>`:""}
   ${v.outcome?`<div class="visit-outcome"><b>Outcome summary</b>${esc(v.outcome)}</div>`:""}
   <div class="next-box ${!v.next_action?"warn":""}">
     <div class="title">${esc(v.next_action_type||"Next")}: ${esc(v.next_action||"No next action")}</div>
     <div class="meta">Owner: ${esc(v.responsible_person||"Harsha")} · Follow-up: ${fmt(v.follow_up_at)}</div>
   </div>
   <div class="button-row"><button class="btn ghost editVisit" data-id="${v.id}">Edit</button><button class="btn danger deleteVisit" data-id="${v.id}">Delete</button></div>
 </article>`).join(""):'<div class="empty">No visits match this view.</div>';
 document.querySelectorAll(".editVisit").forEach(b=>b.onclick=()=>openVisit(b.dataset.id));
 document.querySelectorAll(".deleteVisit").forEach(b=>b.onclick=async()=>{if(confirm("Delete this visit?")){await sb().from("crm_visits").delete().eq("id",b.dataset.id);await load()}});
}
function combinedTimeline(){const b=base();return [...state.activities.map(x=>({kind:x.activity_type,title:x.title,details:x.details,date:x.occurred_at,college:recordCollege(x),outcome:x.outcome,id:x.id,source:"activity"})),...state.visits.map(x=>({kind:"Visit",title:x.purpose,details:[x.outcome_status,x.objective_achieved&&x.objective_achieved!=="Pending visit"?`Objective ${x.objective_achieved}`:"",x.outcome].filter(Boolean).join(" · ")||x.agenda,date:x.visit_at,college:recordCollege(x),outcome:x.visit_classification||x.status,id:x.id,source:"visit"})),...b.meetings.map(x=>({kind:"Meeting",title:x.topic,details:x.notes,date:x.date,college:b.colleges.find(c=>c.id===x.collegeId)?.name||x.collegeName||"No college",outcome:x.feedback,id:x.id,source:"meeting"})),...b.requirements.map(x=>({kind:"Requirement",title:x.title,details:x.description,date:x.updatedAt,college:b.colleges.find(c=>c.id===x.collegeId)?.name||x.collegeName||"No college",outcome:x.status,id:x.id,source:"requirement"})),...b.reminders.map(x=>({kind:"Reminder",title:x.text,details:x.note,date:x.when,college:b.colleges.find(c=>c.id===x.collegeId)?.name||x.collegeName||"No college",outcome:x.done?"Completed":"Pending",id:x.id,source:"reminder"}))].filter(x=>x.date).sort((a,b)=>new Date(b.date)-new Date(a.date))}
function timelineHtml(rows){return rows.length?rows.map(x=>`<article class="timeline-item"><div class="timeline-marker ${String(x.kind).toLowerCase().replace(/\s+/g,"-")}"></div><div class="timeline-card"><div class="entity-top"><div><span class="timeline-kind">${esc(x.kind)}</span><div class="title">${esc(x.title)}</div><div class="meta">${esc(x.college)} · ${fmt(x.date)}</div></div><span class="pill">${esc(x.outcome||"")}</span></div>${x.details?`<div class="timeline-details">${esc(x.details)}</div>`:""}</div></article>`).join(""):'<div class="empty">No activity yet.</div>'}
function renderActivity(){if(!$("activityTimeline")||!state.ready)return;const q=($("activitySearch")?.value||"").toLowerCase(),type=$("activityTypeFilter")?.value||"";const rows=combinedTimeline().filter(x=>(!type||x.kind===type)&&[x.kind,x.title,x.details,x.college,x.outcome].join(" ").toLowerCase().includes(q));$("activityTimeline").innerHTML=timelineHtml(rows)}
function openCollegeTimeline(id){const c=base().colleges.find(x=>x.id===id);if(!c)return;$("collegeTimelineTitle").textContent=`${c.name} — timeline`;const rows=combinedTimeline().filter(x=>x.college.toLowerCase()===c.name.toLowerCase());$("collegeTimelineBody").innerHTML=`<div class="account-summary"><div><span>Stage</span><b>${esc(c.stage)}</b></div><div><span>Interest</span><b>${esc(c.interest)}</b></div><div><span>Main contact</span><b>${esc(c.contactName||"—")}</b></div><div><span>Next action</span><b>${esc(c.nextAction||"—")}</b></div></div>${timelineHtml(rows)}`;$("collegeTimelineDialog").showModal()}
function renderFiles(){if(!$("fileGrid")||!state.ready)return;const q=($("fileSearch")?.value||"").toLowerCase(),rows=state.files.filter(f=>[f.file_name,f.category,recordCollege(f),f.note].join(" ").toLowerCase().includes(q));$("fileGrid").innerHTML=rows.length?rows.map(f=>`<article class="entity-card file-card"><div class="file-icon">${esc((f.file_name||"F").split(".").pop().slice(0,4).toUpperCase())}</div><h3>${esc(f.file_name)}</h3><div class="meta">${esc(f.category)} · ${esc(recordCollege(f))}</div><div class="meta">${Math.round(Number(f.size_bytes||0)/1024)} KB · ${fmt(f.created_at)}</div>${f.note?`<div class="contact-box">${esc(f.note)}</div>`:""}<div class="button-row"><button class="btn soft downloadFile" data-id="${f.id}">Open</button><button class="btn danger deleteFile" data-id="${f.id}">Delete</button></div></article>`).join(""):'<div class="empty">No files uploaded yet.</div>';document.querySelectorAll(".downloadFile").forEach(b=>b.onclick=()=>downloadFile(b.dataset.id));document.querySelectorAll(".deleteFile").forEach(b=>b.onclick=()=>deleteFile(b.dataset.id))}
async function downloadFile(id){const f=state.files.find(x=>x.id===id);if(!f)return;const {data,error}=await sb().storage.from("crm-files").createSignedUrl(f.storage_path,60);if(error)return alert(error.message);window.open(data.signedUrl,"_blank","noopener")}
async function deleteFile(id){const f=state.files.find(x=>x.id===id);if(!f||!confirm("Delete this file?"))return;await sb().storage.from("crm-files").remove([f.storage_path]);await sb().from("crm_files").delete().eq("id",id);await load()}
function renderReports(){if(!$("reportMetrics")||!state.ready)return;const won=state.opportunities.filter(x=>x.status==="Won"),lost=state.opportunities.filter(x=>x.status==="Lost"),open=state.opportunities.filter(x=>x.status==="Open"),conversion=(won.length+lost.length)?Math.round(won.length/(won.length+lost.length)*100):0,overdue=base().reminders.filter(r=>!r.done&&new Date(r.when)<new Date()).length,monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);const visits=state.visits.filter(v=>new Date(v.visit_at)>=monthStart).length;$("reportMetrics").innerHTML=`<article><span>Open pipeline</span><strong>${money(open.reduce((s,x)=>s+Number(x.estimated_value||0),0))}</strong></article><article><span>Conversion</span><strong>${conversion}%</strong></article><article><span>Overdue follow-ups</span><strong>${overdue}</strong></article><article><span>Visits this month</span><strong>${visits}</strong></article>`;const max=Math.max(1,...stages.map(s=>state.opportunities.filter(o=>o.stage===s).length));$("funnelReport").innerHTML=stages.map(s=>{const n=state.opportunities.filter(o=>o.stage===s).length;return `<div class="funnel-row"><span>${esc(s)}</span><div><i style="width:${Math.max(3,n/max*100)}%"></i></div><b>${n}</b></div>`}).join("");const due=base().reminders.filter(r=>!r.done).sort((a,b)=>new Date(a.when)-new Date(b.when));$("followupReport").innerHTML=`<div class="health-big ${overdue?'risk':'good'}"><strong>${overdue}</strong><span>overdue</span></div>${due.slice(0,5).map(r=>`<div class="mini-row"><span>${esc(r.text)}</span><b>${fmt(r.when)}</b></div>`).join("")||'<div class="empty">No pending follow-ups.</div>'}`;const health=base().colleges.map(c=>{let score=100;if(!c.nextAction)score-=30;if(!c.contactName)score-=20;if(c.blocker)score-=15;const last=combinedTimeline().find(x=>x.college.toLowerCase()===c.name.toLowerCase());if(!last||new Date(last.date)<new Date(Date.now()-14*86400000))score-=25;score=Math.max(0,score);return {c,score,last}}).sort((a,b)=>a.score-b.score);$("collegeHealthReport").innerHTML=health.map(x=>`<div class="health-row"><div><div class="title">${esc(x.c.name)}</div><div class="meta">Last activity: ${x.last?fmt(x.last.date):"Never"} · ${esc(x.c.nextAction||"No next action")}</div></div><div class="health-score ${x.score<50?'risk':x.score<75?'warn':'good'}">${x.score}</div></div>`).join("")||'<div class="empty">Add colleges to see account health.</div>'}
function renderAll(){renderPulse();renderPipeline();renderVisits();renderActivity();renderFiles();renderReports()}
function exportReport(){const rows=[["College","Opportunity","Stage","Status","Probability","Estimated Value","Expected Close"]];state.opportunities.forEach(o=>rows.push([recordCollege(o),o.name,o.stage,o.status,o.probability,o.estimated_value,o.expected_close_date||""]));const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a"),blob=new Blob([csv],{type:"text/csv"});a.href=URL.createObjectURL(blob);a.download="harsha-crm-pipeline-report.csv";a.click();URL.revokeObjectURL(a.href)}
function bind(){
 document.querySelectorAll("[data-pro-open]").forEach(b=>b.onclick=()=>{if(b.closest("dialog"))b.closest("dialog").close();open(b.dataset.proOpen)});
 document.querySelectorAll("[data-pro-close]").forEach(b=>b.onclick=()=>close(b.dataset.proClose));
 $("visitForm").onsubmit=saveVisit;$("activityForm").onsubmit=saveActivity;$("opportunityForm").onsubmit=saveOpportunity;$("fileForm").onsubmit=saveFile;
 $("visitStatusFilter").onchange=renderVisits;$("visitSearch").oninput=renderVisits;$("activityTypeFilter").onchange=renderActivity;$("activitySearch").oninput=renderActivity;$("fileSearch").oninput=renderFiles;$("exportProReport").onclick=exportReport;
 document.querySelectorAll('[data-view="pipeline"],[data-view="visits"],[data-view="activity"],[data-view="files"],[data-view="reports"]').forEach(b=>b.addEventListener("click",()=>setTimeout(renderAll,0)));
}
async function init(){bind();if(user())await load()}
window.HARSHA_CRM_PRO={load,renderAll,openCollegeTimeline,open};
window.addEventListener("harsha:app-ready",()=>load());
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
