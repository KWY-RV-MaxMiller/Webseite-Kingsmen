const crypto=require('crypto');
const {setSession}=require('./_auth');

function safeEqual(a,b){
  const aa=Buffer.from(String(a||''),'utf8');
  const bb=Buffer.from(String(b||''),'utf8');
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Methode nicht erlaubt'});

  const password=String(req.body?.password || '');
  const admin=String(process.env.ADMIN_PASSWORD || '');
  const member=String(process.env.MEMBER_PASSWORD || '');

  let access='';
  if(admin && safeEqual(password,admin)) access='full';
  else if(member && safeEqual(password,member)) access='limited';
  else return res.status(401).json({authenticated:false,error:'Falsches Passwort.'});

  const user=access==='full'
    ? {id:'admin',username:'Admin'}
    : {id:'member',username:'Mitglied'};

  setSession(res,{
    id:user.id,
    username:user.username,
    access,
    authVersion:'kingsmen-v1',
    exp:Date.now()+12*60*60*1000
  });

  return res.status(200).json({authenticated:true,access,user});
};
