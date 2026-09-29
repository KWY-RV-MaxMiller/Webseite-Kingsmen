const {readSession}=require('./_auth');
function supabaseRestBase(){
  let base=String(process.env.SUPABASE_URL || '').trim();
  base=base.replace(/^['"]|['"]$/g,'').replace(/\/+$/,'');
  base=base.replace(/\/rest\/v1$/i,'');
  if(!/^https?:\/\//i.test(base)) throw new Error('SUPABASE_URL ist ungültig');
  return `${base}/rest/v1`;
}
async function sb(path,options={}){
  const r=await fetch(`${supabaseRestBase()}/${String(path).replace(/^\/+/, '')}`,{
    ...options,
    headers:{
      apikey:process.env.SUPABASE_SECRET_KEY,
      Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const t=await r.text();
  return t?JSON.parse(t):null;
}
async function readState(){
  const rows=await sb('app_state?select=state,updated_at&id=eq.1');
  return {state:rows?.[0]?.state||null,updatedAt:rows?.[0]?.updated_at||null};
}
async function readVersion(){
  const rows=await sb('app_state?select=updated_at&id=eq.1');
  return {updatedAt:rows?.[0]?.updated_at||null};
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  try{
    if(req.method==='GET'){
      // Polling fragt nur den winzigen Zeitstempel ab. Den kompletten State
      // liefern wir nur beim initialen Laden oder wenn wirklich eine Änderung vorliegt.
      if(req.query?.meta==='1') return res.status(200).json(await readVersion());
      return res.status(200).json(await readState());
    }
    if(req.method==='PUT'){
      const session=readSession(req);
      if(!session || session.authVersion!=='kingsmen-v1') return res.status(401).json({error:'Nicht angemeldet'});
      const state=req.body?.state;
      const expectedUpdatedAt=req.body?.expectedUpdatedAt ?? null;
      if(!state||typeof state!=='object') return res.status(400).json({error:'Ungültiger Zustand'});
      const current=await readState();
      if(current.updatedAt && expectedUpdatedAt !== current.updatedAt){
        return res.status(409).json({
          error:'Der Stand wurde auf einem anderen Gerät geändert.',
          state:current.state,
          updatedAt:current.updatedAt
        });
      }

      const oldCalendar=JSON.stringify(current.state?.calendar ?? {entries:[]});
      const newCalendar=JSON.stringify(state.calendar ?? {entries:[]});
      const calendarChanged=oldCalendar!==newCalendar;
      if(calendarChanged && session.access!=='full'){
        return res.status(403).json({error:'Keine Berechtigung zum Bearbeiten des Kalenders'});
      }

      const updatedAt=new Date().toISOString();

      // app_state row id=1 already exists. Updating that exact row is more robust
      // with Supabase's newer sb_secret_... server keys than an upsert URL.
      let rows=await sb('app_state?id=eq.1',{
        method:'PATCH',
        headers:{Prefer:'return=representation'},
        body:JSON.stringify({state,updated_at:updatedAt})
      });

      // Safety fallback in case the row was accidentally deleted.
      if(!Array.isArray(rows) || !rows.length){
        rows=await sb('app_state',{
          method:'POST',
          headers:{Prefer:'return=representation'},
          body:JSON.stringify({id:1,state,updated_at:updatedAt})
        });
      }

      return res.status(200).json({
        ok:true,
        state:rows?.[0]?.state||state,
        updatedAt:rows?.[0]?.updated_at||updatedAt
      });
    }
    return res.status(405).json({error:'Methode nicht erlaubt'});
  }catch(e){
    return res.status(500).json({error:e.message});
  }
};