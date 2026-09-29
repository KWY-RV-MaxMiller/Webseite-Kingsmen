const {clearSession}=require('./_auth');
module.exports=async function handler(req,res){clearSession(res);res.redirect(302,'/');};
