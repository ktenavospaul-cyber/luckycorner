import React, { useState, useEffect, useRef, useMemo } from "react";

/**
 * Lucky Corner — test build (single-user, local, no accounts).
 * Purpose: prove the core loop AND generate a clean sell-through dataset.
 *
 * Flow: Profile (interests + one goal + guardrails) -> Scan (single item OR group "find the gem")
 *       -> Buy/skip verdict with visible reasoning + user-correctable fields
 *       -> Tracker that closes the FULL loop (sold / didn't sell) with CSV export.
 *
 * Honesty is baked in: every price is an estimate, the % is a confidence-weighted guess (not a stat),
 * goals are personal targets the app helps you measure against — never a promise of income.
 */

const C = { bg:"#EAE8DF", card:"#FFFFFF", ink:"#191B17", faint:"#70736A", line:"#DBD9CD", chip:"#F4F3EC" };
const FONT="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO="ui-monospace, 'SF Mono', Menlo, monospace";
const POSTBY={ light:10, standard:12, heavy:16, bulky:24 };
const postOf=(b)=>POSTBY[b]||12; const PACK=0.8;
const netEbay=(r,t,p)=>r-t-(0.134*(r+p)+0.3)-PACK;
const netVinted=(r,t)=>r-t-PACK;
const $=(n)=>(n<0?"-$":"$")+Math.abs(Math.round(n));

const CATEGORIES=["Mens shoes","Womens shoes","Mens clothing","Womens clothing","Dresses",
  "Activewear","Outdoor","Denim","Glassware / homewares","Games","Books","Rugs","Tools","Branded merch"];
const GOALS=[["profit","Weekly profit","work toward a $ / week target"],
  ["margin","Margin per item","hit a $ net on each flip"],
  ["testing","Just testing","see if this is for me"]];
const EXP=["New to this","Done a bit","Experienced"];

function bandOf(p){ if(p>=80)return{l:"Strong buy",c:"#18693E"}; if(p>=62)return{l:"Buy",c:"#57B368"};
  if(p>=44)return{l:"Maybe",c:"#E0A100"}; if(p>=26)return{l:"Risky",c:"#E4771E"}; return{l:"Skip",c:"#CE4130"}; }
function probability({net,estDays,demand,conf,target,maxDays}){
  const m=net<=0?0:Math.max(0,Math.min(1,0.5+(net-target)/(target*1.6)));
  const days=estDays||(demand==="fast"?18:demand==="moderate"?50:100);
  const s=Math.max(0,Math.min(1,1-(days-maxDays*0.5)/(maxDays*1.2)));
  const cMul=conf==="high"?1:conf==="medium"?0.82:0.6;
  let p=Math.round((0.55*m+0.45*s)*cMul*100);
  if(net<3)p=Math.min(p,12); if(conf==="low")p=Math.min(p,55);
  return{p:Math.max(0,Math.min(100,p)),days,m,s};
}
async function readB64(f){return new Promise((res,rej)=>{const r=new FileReader();
  r.onload=()=>res({data:r.result.split(",")[1],media_type:f.type,url:r.result});
  r.onerror=()=>rej(new Error("read fail"));r.readAsDataURL(f);});}
const parseJSON=(t)=>JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1));
function csvCell(s){const v=String(s??"");return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}

export default function LuckyCorner(){
  const [tab,setTab]=useState("scan");
  const [profile,setProfile]=useState(null);
  const [editingProfile,setEditingProfile]=useState(false);
  const [tracker,setTracker]=useState([]);
  const loaded=useRef(false);

  useEffect(()=>{(async()=>{
    try{const p=await window.storage.get("fs:profile");if(p?.value)setProfile(JSON.parse(p.value));}catch{}
    try{const t=await window.storage.get("fs:tracker");if(t?.value)setTracker(JSON.parse(t.value));}catch{}
    loaded.current=true;
  })();},[]);
  useEffect(()=>{if(loaded.current&&profile)window.storage.set("fs:profile",JSON.stringify(profile)).catch(()=>{});},[profile]);
  useEffect(()=>{if(loaded.current)window.storage.set("fs:tracker",JSON.stringify(tracker)).catch(()=>{});},[tracker]);

  const S={ card:{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16},
    btn:{border:"none",borderRadius:11,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:FONT},
    inp:{fontSize:14,border:`1px solid ${C.line}`,borderRadius:9,padding:"9px 10px",background:"#fff",color:C.ink,width:"100%",boxSizing:"border-box",fontFamily:FONT},
    lab:{fontSize:10.5,letterSpacing:".06em",textTransform:"uppercase",color:C.faint,fontWeight:700,marginBottom:5,display:"block"} };

  if(!profile||editingProfile){
    return <Onboard S={S} initial={profile} onDone={(p)=>{setProfile(p);setEditingProfile(false);setTab("scan");}}/>;
  }

  return (
    <div style={{fontFamily:FONT,background:C.bg,color:C.ink,minHeight:"100%",maxWidth:440,margin:"0 auto",paddingBottom:70}}>
      <style>{`*{-webkit-tap-highlight-color:transparent;box-sizing:border-box}input,select,textarea{outline:none}
        input:focus,select:focus{border-color:#2E9E67 !important}
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

      <div style={{padding:"16px 16px 8px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700,letterSpacing:"-0.02em"}}>Lucky Corner</div>
          <div style={{fontSize:11.5,color:C.ink,fontStyle:"italic",fontWeight:600,marginTop:1}}>They're not lucky. They just know.</div>
        </div>
        <button onClick={()=>setEditingProfile(true)} style={{...S.btn,background:C.chip,color:C.ink,border:`1px solid ${C.line}`,fontSize:12,padding:"7px 10px"}}>Profile</button>
      </div>

      <div style={{padding:"0 16px"}}>
        {tab==="scan" && <ScanTab S={S} profile={profile} onLog={(item)=>{setTracker(x=>[item,...x]);setTab("tracker");}}/>}
        {tab==="tracker" && <TrackerTab S={S} tracker={tracker} setTracker={setTracker}/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:440,margin:"0 auto",background:C.card,borderTop:`1px solid ${C.line}`,display:"flex"}}>
        {[["scan","Scan","📷"],["tracker","Tracker","📊"]].map(([k,l,ic])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,textAlign:"center",padding:"10px 0",cursor:"pointer",color:tab===k?C.ink:C.faint,borderTop:tab===k?`2px solid ${C.ink}`:"2px solid transparent"}}>
            <div style={{fontSize:18}}>{ic}</div><div style={{fontSize:10.5,fontWeight:tab===k?700:500,marginTop:1}}>{l}</div>
          </div>))}
      </div>
    </div>
  );
}

function Onboard({S,initial,onDone}){
  const [cats,setCats]=useState(initial?.cats||[]);
  const [other,setOther]=useState(initial?.other||"");
  const [goal,setGoal]=useState(initial?.goal||"testing");
  const [goalValue,setGoalValue]=useState(initial?.goalValue||300);
  const [minNet,setMinNet]=useState(initial?.minNet||20);
  const [maxDays,setMaxDays]=useState(initial?.maxDays||60);
  const [exp,setExp]=useState(initial?.exp||"New to this");
  const toggle=(c)=>setCats(x=>x.includes(c)?x.filter(y=>y!==c):[...x,c]);
  const valid=cats.length>0||other.trim();

  return (
    <div style={{fontFamily:FONT,background:C.bg,color:C.ink,minHeight:"100%",maxWidth:440,margin:"0 auto",padding:"22px 16px 40px"}}>
      <style>{`*{box-sizing:border-box}input:focus,select:focus{border-color:#2E9E67 !important;outline:none}`}</style>
      <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.02em"}}>Lucky Corner</div>
      <div style={{fontSize:13,color:C.ink,fontStyle:"italic",fontWeight:600,marginTop:2}}>They're not lucky. They just know.</div>
      <div style={{fontSize:13,color:C.faint,marginTop:8,lineHeight:1.5}}>Tell it what you hunt and what you're aiming for. This tunes your buy/skip calls — and you can change it anytime.</div>

      <div style={{...S.card,marginTop:16}}>
        <label style={S.lab}>What do you buy? (pick any)</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {CATEGORIES.map(c=>(
            <div key={c} onClick={()=>toggle(c)} style={{padding:"7px 11px",borderRadius:20,fontSize:12.5,fontWeight:600,cursor:"pointer",
              border:`1px solid ${cats.includes(c)?"#18693E":C.line}`,background:cats.includes(c)?"#18693E":"#fff",color:cats.includes(c)?"#fff":C.faint}}>{c}</div>
          ))}
        </div>
        <input style={{...S.inp,marginTop:10}} placeholder="Anything else? (e.g. vinyl, cameras)" value={other} onChange={e=>setOther(e.target.value)}/>
      </div>

      <div style={{...S.card,marginTop:12}}>
        <label style={S.lab}>Your main goal</label>
        {GOALS.map(([k,t,sub])=>(
          <div key={k} onClick={()=>setGoal(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px",borderRadius:10,marginBottom:6,cursor:"pointer",
            border:`1px solid ${goal===k?"#18693E":C.line}`,background:goal===k?"#F1F7F3":"#fff"}}>
            <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${goal===k?"#18693E":C.line}`,background:goal===k?"#18693E":"#fff",flexShrink:0}}/>
            <div><div style={{fontSize:14,fontWeight:600}}>{t}</div><div style={{fontSize:11.5,color:C.faint}}>{sub}</div></div>
          </div>
        ))}
        {goal==="profit" && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
            <span style={{fontSize:13,color:C.faint}}>Target $ / week</span>
            <input type="number" style={{...S.inp,width:90}} value={goalValue} onChange={e=>setGoalValue(+e.target.value)}/>
          </div>
        )}
        <div style={{fontSize:11,color:C.faint,marginTop:8,lineHeight:1.5}}>This is your personal target to measure against — not a promise of income. What you actually earn depends on you and the market.</div>
      </div>

      <div style={{...S.card,marginTop:12}}>
        <label style={S.lab}>Your buy rules (the app scores against these)</label>
        {[["Min net per item you'll accept",minNet,setMinNet,"$",5,80],["Longest you'll wait for a sale",maxDays,setMaxDays,"d",14,180]].map(([lab,val,set,u,mn,mx])=>(
          <div key={lab} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:C.faint}}>{lab}</span><span style={{fontFamily:MONO,fontWeight:700}}>{u==="$"?"$":""}{val}{u==="d"?" days":""}</span></div>
            <input type="range" min={mn} max={mx} value={val} onChange={e=>set(+e.target.value)} style={{width:"100%",marginTop:6}}/>
          </div>
        ))}
      </div>

      <div style={{...S.card,marginTop:12}}>
        <label style={S.lab}>Your experience</label>
        <div style={{display:"flex",gap:7}}>
          {EXP.map(e=>(<div key={e} onClick={()=>setExp(e)} style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:"pointer",
            border:`1px solid ${exp===e?"#18693E":C.line}`,background:exp===e?"#18693E":"#fff",color:exp===e?"#fff":C.faint}}>{e}</div>))}
        </div>
      </div>

      <div style={{...S.card,marginTop:12,background:C.chip,fontSize:11.5,color:C.faint,lineHeight:1.55}}>
        <b style={{color:C.ink}}>Heads up:</b> estimates in this app are exactly that — estimates, not guaranteed prices. Always sanity-check real sold listings before buying anything pricey. This test build keeps all your data on this device.
      </div>

      <button onClick={()=>valid&&onDone({cats,other,goal,goalValue,minNet,maxDays,exp})} disabled={!valid}
        style={{...S.btn,width:"100%",marginTop:14,background:valid?C.ink:C.line,color:valid?"#fff":C.faint,fontSize:15,padding:"14px"}}>Start scouting →</button>
    </div>
  );
}

function ScanTab({S,profile,onLog}){
  const [mode,setMode]=useState("single");
  const [imgs,setImgs]=useState([]);
  const [status,setStatus]=useState("idle");
  const [res,setRes]=useState(null);
  const [err,setErr]=useState("");
  const [edit,setEdit]=useState(null);
  const fileRef=useRef(null);

  async function addFiles(files){
    const max=mode==="single"?2:1;
    const list=Array.from(files).slice(0,(mode==="single"?2:6)-imgs.length);
    setImgs(p=>[...p,...(await Promise.all(list.map(readB64)))].slice(0,mode==="single"?2:6));
  }
  const rmImg=(i)=>setImgs(p=>p.filter((_,x)=>x!==i));
  const reset=()=>{setImgs([]);setRes(null);setStatus("idle");setEdit(null);setErr("");};

  async function scan(){
    if(!imgs.length)return;
    setStatus("loading");setRes(null);setErr("");setEdit(null);
    const cats=[...(profile.cats||[]),profile.other].filter(Boolean).join(", ");
    const content=[...imgs.map(im=>({type:"image",source:{type:"base64",media_type:im.media_type,data:im.data}})),
      {type:"text",text:`Australian op shop. This reseller focuses on: ${cats||"anything"}. ${mode==="group"?"This is a GROUP shot of several items on a shelf — identify the items and pick the single best flip ('the gem').":"Identify this item and estimate its resale."}`}];
    const single='{"item":string,"category":string,"bulk":"light"|"standard"|"heavy"|"bulky","confidence":"high"|"medium"|"low","resaleLow":number,"resaleTypical":number,"resaleHigh":number,"demand":"fast"|"moderate"|"slow","estDaysToSell":number,"reason":string,"confirmTip":string,"searchTerm":string}';
    const group='{"gem":{"item":string,"why":string,"resaleTypical":number,"demand":"fast"|"moderate"|"slow","searchTerm":string},"others":[{"item":string,"verdict":"maybe"|"skip","note":string}]}';
    const system=`You appraise secondhand goods for an Australian op-shop reseller. Use web search for Australian secondhand prices (eBay Australia SOLD first, then Depop/Vinted) and sell speed. Estimates only, never guarantee. Reply ONLY JSON, no markdown. ${mode==="group"?"Shape: "+group:"Shape: "+single}. AUD numbers. searchTerm = concise keywords to find it on eBay. If unsure set confidence low.`;
    try{
      const r=await fetch("/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system,content})});
      const data=await r.json();
      if(!r.ok)throw new Error(data?.error||("Search returned "+r.status));
      const text=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      const j=parseJSON(text); setRes(j);
      if(mode==="single") setEdit({brand:j.item||"",category:j.category||"",tag:"",resale:String(Math.round(j.resaleTypical||0)),bulk:j.bulk||"standard"});
      setStatus("done");
    }catch(e){setErr(e.message||"error");setStatus("error");}
  }

  // single verdict
  const rt=res&&mode==="single"?Number(edit?.resale)||0:0;
  const tg=Number(edit?.tag)||0;
  const pp=edit?postOf(edit.bulk):12;
  const nE=netEbay(rt,tg,pp), nV=netVinted(rt,tg);
  const prob=res&&mode==="single"&&edit?probability({net:nE,estDays:res.estDaysToSell,demand:res.demand,conf:res.confidence,target:profile.minNet,maxDays:profile.maxDays}):null;
  const B=prob?bandOf(prob.p):null;
  const ebayURL=(term)=>`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(term||"")}&_sacat=0&LH_Sold=1&LH_Complete=1`;
  const vintedURL=(term)=>`https://www.vinted.com.au/catalog?search_text=${encodeURIComponent(term||"")}`;

  function logIt(){
    if(!edit)return;
    onLog({id:Date.now(),item:edit.brand,category:edit.category,tag:tg,resale:rt,netEst:+nE.toFixed(2),
      prob:prob?.p||null,demand:res.demand,status:"bought",soldPrice:null,daysToSell:null,soldPlatform:null,date:new Date().toISOString().slice(0,10)});
  }

  return (
    <div style={{animation:"rise .2s"}}>
      <div style={{display:"flex",gap:7,marginBottom:12}}>
        {[["single","Single item"],["group","Group — find the gem"]].map(([k,l])=>(
          <div key={k} onClick={()=>{setMode(k);reset();}} style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:10,fontSize:12.5,fontWeight:700,cursor:"pointer",
            border:`1px solid ${mode===k?C.ink:C.line}`,background:mode===k?C.ink:"#fff",color:mode===k?"#fff":C.faint}}>{l}</div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {imgs.map((im,i)=>(
            <div key={i} style={{position:"relative",width:mode==="single"?"calc(50% - 4px)":"calc(33% - 6px)",aspectRatio:"3/4",borderRadius:10,overflow:"hidden",background:"#000"}}>
              <img src={im.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div onClick={()=>rmImg(i)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff",width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✕</div>
            </div>
          ))}
          {imgs.length<(mode==="single"?2:6)&&status!=="loading"&&(
            <div onClick={()=>fileRef.current?.click()} style={{width:mode==="single"?"calc(50% - 4px)":"calc(33% - 6px)",aspectRatio:"3/4",borderRadius:10,border:`1.5px dashed ${C.line}`,background:"#F6F5EF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.faint}}>
              <div style={{fontSize:24}}>{mode==="single"&&imgs.length===1?"🏷️":"📷"}</div>
              <div style={{fontSize:10.5,marginTop:4,fontWeight:600,textAlign:"center"}}>{mode==="single"?(imgs.length===0?"Item":"Tag"):"Add shelf pic"}</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
        <button onClick={scan} disabled={!imgs.length||status==="loading"} style={{...S.btn,width:"100%",marginTop:12,background:imgs.length?C.ink:C.line,color:imgs.length?"#fff":C.faint,fontSize:15,padding:"13px"}}>
          {status==="loading"?"Searching…":mode==="single"?"Scout this item →":"Find the gem →"}</button>
        {status==="loading"&&<div style={{fontSize:12,color:C.faint,marginTop:10,display:"flex",gap:8,alignItems:"center"}}><span style={{width:13,height:13,border:`2px solid ${C.line}`,borderTopColor:C.ink,borderRadius:"50%",display:"inline-block",animation:"spin .8s linear infinite"}}/>Identifying + checking sold prices — needs signal.</div>}
      </div>

      {status==="error"&&<div style={{...S.card,marginTop:12,borderColor:"#CE4130"}}><div style={{fontWeight:700,color:"#CE4130"}}>Couldn't finish</div><div style={{fontSize:13,color:C.faint,marginTop:4}}>{err}. Weak signal? Retry.</div><button onClick={scan} style={{...S.btn,marginTop:10,width:"100%",background:C.ink,color:"#fff"}}>Retry</button></div>}

      {/* GROUP result */}
      {status==="done"&&mode==="group"&&res?.gem&&(
        <div style={{marginTop:12,animation:"rise .3s"}}>
          <div style={{...S.card,background:"#18693E",color:"#fff",borderColor:"#18693E"}}>
            <div style={{fontSize:11,letterSpacing:".08em",textTransform:"uppercase",opacity:.85,fontWeight:700}}>💎 The gem</div>
            <div style={{fontSize:18,fontWeight:800,marginTop:3}}>{res.gem.item}</div>
            <div style={{fontSize:13,opacity:.9,marginTop:4,lineHeight:1.4}}>{res.gem.why}</div>
            <div style={{fontFamily:MONO,fontSize:14,marginTop:8}}>~{$(res.gem.resaleTypical)} · sells {res.gem.demand}</div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <a href={ebayURL(res.gem.searchTerm)} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,textAlign:"center",textDecoration:"none",background:"rgba(255,255,255,.16)",color:"#fff"}}>eBay sold ↗</a>
              <a href={vintedURL(res.gem.searchTerm)} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,textAlign:"center",textDecoration:"none",background:"rgba(255,255,255,.16)",color:"#fff"}}>Vinted ↗</a>
            </div>
          </div>
          {Array.isArray(res.others)&&res.others.length>0&&(
            <div style={{...S.card,marginTop:12}}>
              <div style={S.lab}>Others in shot</div>
              {res.others.map((o,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:i<res.others.length-1?`1px dashed ${C.line}`:"none"}}>
                <div style={{fontSize:13}}>{o.item}<div style={{fontSize:11,color:C.faint}}>{o.note}</div></div>
                <span style={{fontSize:11,fontWeight:700,color:o.verdict==="maybe"?"#C98A12":"#CE4130",textTransform:"uppercase"}}>{o.verdict}</span>
              </div>))}
            </div>
          )}
          <div style={{fontSize:11,color:C.faint,textAlign:"center",marginTop:10}}>Estimate only — flip the gem's tag & check sold listings before buying.</div>
          <button onClick={reset} style={{...S.btn,width:"100%",marginTop:10,background:"transparent",color:C.faint,border:`1px solid ${C.line}`}}>New shelf</button>
        </div>
      )}

      {/* SINGLE result */}
      {status==="done"&&mode==="single"&&res&&prob&&B&&edit&&(
        <div style={{marginTop:12,animation:"rise .3s"}}>
          <div style={{...S.card,background:B.c,borderColor:B.c,color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div><div style={{fontSize:10.5,letterSpacing:".08em",textTransform:"uppercase",opacity:.85,fontWeight:700}}>Fits your rule ({">="+$(profile.minNet)}, {profile.maxDays}d)?</div>
                <div style={{fontSize:19,fontWeight:800,marginTop:2}}>{B.l}</div></div>
              <div style={{fontFamily:MONO,fontSize:40,fontWeight:800,lineHeight:.9}}>{prob.p}<span style={{fontSize:18}}>%</span></div>
            </div>
            <div style={{fontFamily:MONO,fontSize:12.5,marginTop:10,opacity:.92}}>net {$(nE)} (eBay) · {$(nV)} (Vinted) · ~{prob.days<=21?prob.days+"d":Math.round(prob.days/7)+"w"}</div>
            <div style={{fontSize:11.5,opacity:.85,marginTop:6,lineHeight:1.4}}><b>Why:</b> {res.reason} <span style={{opacity:.7}}>(confidence: {res.confidence})</span></div>
          </div>

          <div style={{...S.card,marginTop:12}}>
            <div style={{fontSize:12,color:C.faint,marginBottom:8}}>Confirm / fix — every correction sharpens it:</div>
            <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:8}}>
              <div><label style={S.lab}>Item</label><input style={S.inp} value={edit.brand} onChange={e=>setEdit({...edit,brand:e.target.value})}/></div>
              <div><label style={S.lab}>Category</label><input style={S.inp} value={edit.category} onChange={e=>setEdit({...edit,category:e.target.value})}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <div><label style={S.lab}>Tag price $</label><input type="number" style={S.inp} value={edit.tag} placeholder="?" onChange={e=>setEdit({...edit,tag:e.target.value})}/></div>
              <div><label style={S.lab}>Est. resale $</label><input type="number" style={S.inp} value={edit.resale} onChange={e=>setEdit({...edit,resale:e.target.value})}/></div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <a href={ebayURL(res.searchTerm||edit.brand)} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,textAlign:"center",textDecoration:"none",background:C.chip,color:C.ink,border:`1px solid ${C.line}`}}>eBay sold ↗</a>
              <a href={vintedURL(res.searchTerm||edit.brand)} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,textAlign:"center",textDecoration:"none",background:C.chip,color:C.ink,border:`1px solid ${C.line}`}}>Vinted ↗</a>
            </div>
          </div>

          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={reset} style={{...S.btn,flex:1,background:C.chip,color:C.ink,border:`1px solid ${C.line}`}}>Skip / next</button>
            <button onClick={logIt} disabled={!tg} style={{...S.btn,flex:2,background:tg?"#18693E":C.line,color:tg?"#fff":C.faint}}>✓ Bought — track it</button>
          </div>
          {!tg&&<div style={{fontSize:11,color:C.faint,textAlign:"center",marginTop:6}}>Enter what you paid to track it.</div>}
        </div>
      )}
    </div>
  );
}

function daysSince(dateStr){ if(!dateStr)return 0; const d=new Date(dateStr); return Math.floor((Date.now()-d.getTime())/86400000); }

function TrackerTab({S,tracker,setTracker}){
  const [closing,setClosing]=useState(null);
  const [sp,setSp]=useState(""); const [dd,setDd]=useState(""); const [pf,setPf]=useState("eBay");
  const [review,setReview]=useState(false);
  const [snoozed,setSnoozed]=useState(false);

  // "Remind, don't nag": only nudge about items open AND listed long enough to plausibly have sold (>=10 days).
  const ripe=tracker.filter(t=>t.status==="bought"&&daysSince(t.date)>=10);
  function quickSold(id){ setReview(false); setClosing(id); }
  const quickUnsold=(id)=>setTracker(x=>x.map(t=>t.id===id?{...t,status:"unsold"}:t));

  const stats=useMemo(()=>{
    const sold=tracker.filter(t=>t.status==="sold");
    const flops=tracker.filter(t=>t.status==="unsold");
    const spent=tracker.reduce((a,b)=>a+(b.tag||0),0);
    const revenue=sold.reduce((a,b)=>a+(b.soldPrice||0),0);
    const avgDays=sold.length?Math.round(sold.reduce((a,b)=>a+(b.daysToSell||0),0)/sold.length):null;
    const strate=tracker.length?Math.round((sold.length/tracker.length)*100):0;
    return {sold:sold.length,flops:flops.length,open:tracker.length-sold.length-flops.length,spent,revenue,avgDays,strate};
  },[tracker]);

  function closeSold(id){
    setTracker(x=>x.map(t=>t.id===id?{...t,status:"sold",soldPrice:+sp||0,daysToSell:+dd||null,soldPlatform:pf}:t));
    setClosing(null);setSp("");setDd("");
  }
  const markUnsold=(id)=>setTracker(x=>x.map(t=>t.id===id?{...t,status:"unsold"}:t));
  const del=(id)=>setTracker(x=>x.filter(t=>t.id!==id));

  function exportCSV(){
    const head=["date","item","category","tag_paid","resale_est","net_est","prob","demand","status","sold_price","days_to_sell","platform"];
    const rows=tracker.map(t=>[t.date,t.item,t.category,t.tag,t.resale,t.netEst,t.prob,t.demand,t.status,t.soldPrice,t.daysToSell,t.soldPlatform].map(csvCell).join(","));
    const csv=[head.join(","),...rows].join("\n");
    try{const b=new Blob([csv],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="luckycorner-data.csv";document.body.appendChild(a);a.click();a.remove();}catch{}
  }

  return (
    <div style={{animation:"rise .2s"}}>
      {/* Remind, don't nag: only shows when items are old enough to plausibly have sold */}
      {ripe.length>0&&!snoozed&&!review&&(
        <div style={{...S.card,marginBottom:12,background:"#1F3A2E",color:"#fff",borderColor:"#1F3A2E"}}>
          <div style={{fontSize:14,fontWeight:700}}>⏰ {ripe.length} item{ripe.length>1?"s":""} might have sold</div>
          <div style={{fontSize:12,opacity:.8,marginTop:3,lineHeight:1.4}}>Listed 10+ days ago and still open. Closing the loop is what builds your data — takes a few seconds.</div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setReview(true)} style={{...S.btn,flex:2,background:"#fff",color:"#1F3A2E"}}>Quick review</button>
            <button onClick={()=>setSnoozed(true)} style={{...S.btn,flex:1,background:"rgba(255,255,255,.15)",color:"#fff"}}>Not now</button>
          </div>
        </div>
      )}

      {review&&(
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:15,fontWeight:700}}>Any of these sell?</div>
            <button onClick={()=>setReview(false)} style={{fontSize:12,color:C.faint,background:"none",border:"none",cursor:"pointer"}}>done</button>
          </div>
          {ripe.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px dashed ${C.line}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.item||"(unnamed)"}</div>
                <div style={{fontSize:10.5,color:C.faint,fontFamily:MONO}}>paid {$(t.tag)} · {daysSince(t.date)}d ago</div>
              </div>
              <button onClick={()=>quickSold(t.id)} style={{...S.btn,fontSize:11,padding:"7px 10px",background:"#18693E",color:"#fff"}}>Sold</button>
              <button onClick={()=>quickUnsold(t.id)} style={{...S.btn,fontSize:11,padding:"7px 10px",background:C.chip,color:C.faint,border:`1px solid ${C.line}`}}>Still no</button>
            </div>
          ))}
          <div style={{fontSize:10.5,color:C.faint,marginTop:8}}>Tap “Sold” to add the price & days below. “Still no” keeps it open — no harm.</div>
        </div>
      )}

      <div style={{...S.card,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:15,fontWeight:700}}>Your real numbers</div>
          {tracker.length>0&&<button onClick={exportCSV} style={{...S.btn,background:C.chip,color:C.ink,border:`1px solid ${C.line}`,fontSize:12,padding:"7px 10px"}}>Export CSV</button>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["sold",stats.sold],["open",stats.open],["didn't sell",stats.flops],["sell-through",stats.strate+"%"],["avg days",stats.avgDays??"—"],["spent",$(stats.spent)],["revenue",$(stats.revenue)]].map(([l,v])=>(
            <div key={l} style={{flex:"1 0 28%",background:C.chip,borderRadius:10,padding:"9px 8px",textAlign:"center",border:`1px solid ${C.line}`}}>
              <div style={{fontFamily:MONO,fontSize:16,fontWeight:700}}>{v}</div><div style={{fontSize:9.5,color:C.faint,textTransform:"uppercase",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.faint,marginTop:8,lineHeight:1.5}}>These are <b>your actual outcomes</b> — the data that teaches you (and the app) what really sells. Logging the flops matters as much as the wins.</div>
      </div>

      {tracker.length===0&&<div style={{...S.card,textAlign:"center",color:C.faint,padding:26,fontSize:13}}>Nothing tracked yet. Scout an item, hit "Bought — track it," then close the loop here when it sells (or doesn't).</div>}

      {tracker.map(t=>(
        <div key={t.id} style={{...S.card,marginBottom:10,padding:12}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600}}>{t.item||"(unnamed)"}</div>
              <div style={{fontSize:11,color:C.faint,fontFamily:MONO,marginTop:2}}>
                paid {$(t.tag)} · est resale {$(t.resale)} · {t.category||"—"}
                {t.status==="sold"&&<span style={{color:"#1C6A45",fontWeight:700}}> · SOLD {$(t.soldPrice)} in {t.daysToSell??"?"}d</span>}
                {t.status==="unsold"&&<span style={{color:"#CE4130"}}> · didn't sell</span>}
              </div>
            </div>
            <span onClick={()=>del(t.id)} style={{color:C.faint,cursor:"pointer",fontSize:14}}>✕</span>
          </div>
          {t.status==="bought"&&closing!==t.id&&(
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setClosing(t.id)} style={{...S.btn,flex:1,fontSize:12,background:"#18693E",color:"#fff"}}>It sold ✓</button>
              <button onClick={()=>markUnsold(t.id)} style={{...S.btn,flex:1,fontSize:12,background:C.chip,color:C.faint,border:`1px solid ${C.line}`}}>Didn't sell</button>
            </div>
          )}
          {closing===t.id&&(
            <div style={{marginTop:10,padding:10,background:C.chip,borderRadius:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div><label style={S.lab}>Sold $</label><input type="number" style={S.inp} value={sp} onChange={e=>setSp(e.target.value)}/></div>
                <div><label style={S.lab}>Days</label><input type="number" style={S.inp} value={dd} onChange={e=>setDd(e.target.value)}/></div>
                <div><label style={S.lab}>Where</label><select style={S.inp} value={pf} onChange={e=>setPf(e.target.value)}>{["eBay","Vinted","Depop","FB","Other"].map(x=><option key={x}>{x}</option>)}</select></div>
              </div>
              <button onClick={()=>closeSold(t.id)} style={{...S.btn,width:"100%",marginTop:8,background:"#18693E",color:"#fff",fontSize:13}}>Save sale</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const CATEGORIES_EXPORT=null; // placeholder to keep bundlers happy
