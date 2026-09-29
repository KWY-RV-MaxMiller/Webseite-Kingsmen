const {readSession,clearSession}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const s=readSession(req);

  if(!s || s.authVersion!=='kingsmen-v1' || !['full','limited'].includes(s.access)){
    clearSession(res);
    return res.status(401).json({authenticated:false});
  }

  return res.status(200).json({
    authenticated:true,
    access:s.access,
    user:{id:s.id,username:s.username}
  });
};
