import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';

const categories = new Set(['watches','shop']);
const prefix = category => category === 'watches' ? 'preorderWatches' : 'preorderShop';
export function createPreorderToken(category, revision, expires, secret=process.env.SESSION_SECRET) {
  if (!secret) throw Error('Secure preorder links are not configured.');
  const payload=Buffer.from(JSON.stringify({purpose:'preorder',category,revision,expires})).toString('base64url');
  return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyPreorderToken(token, settings, secret=process.env.SESSION_SECRET, now=Date.now()) {
  if (!secret || typeof token!=='string' || token.length>1024) return null;
  const [payload,signature,extra]=token.split('.');
  if (!payload||!signature||extra) return null;
  const expected=createHmac('sha256',secret).update(payload).digest('base64url');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
  try {
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    const key=prefix(data.category);
    return data.purpose==='preorder'&&categories.has(data.category)&&Number.isFinite(data.expires)&&data.expires>now&&
      settings[key+'Enabled']===true&&data.revision===(settings[key+'Revision']||'initial') ? data : null;
  } catch {return null;}
}
export function preorderAccess(getSettings) {
  return async req=>{
    const original=await getSettings(req);
    const settings={...original};
    if(settings.watchesMode==='preorder' && settings.watchPreviewEnabled!==true && settings.preorderFulfillmentNote?.trim()){
      settings.preorderWatchesActive=true;
      settings.publicWatchPreorder=true;
      settings.watchesMode='shop';
    }
    if(settings.shopWaitlistEnabled===true)settings.shopEnabled=false;
    const header=req?.headers?.['x-preorder-access'];
    const tokens=typeof header==='string'&&header.length<2100 ? header.split(',').slice(0,2) : [];
    for(const token of tokens) {
      const access=verifyPreorderToken(token,original);
      if(!access){settings.preorderAccessInvalid=true;continue;}
      if(access.category==='watches'){
        settings.preorderWatchesActive=true;settings.watchesMode='shop';settings.watchPreviewEnabled=false;
      }else{settings.preorderShopActive=true;settings.shopEnabled=true;}
    }
    return settings;
  };
}
export function registerPreorderRoutes(app,{getSettings,updateSettings}) {
  app.post('/api/admin/preorder-links',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      const {category,expiresAt}=req.body||{},expires=new Date(expiresAt).getTime();
      if(!categories.has(category))throw Error('Choose watches or shop.');
      if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+30*86400000)throw Error('Choose an expiry within the next 30 days.');
      const settings=await getSettings(),key=prefix(category);
      if(settings[key+'Enabled']!==true)throw Error('Enable preorders for this category first.');
      const token=createPreorderToken(category,settings[key+'Revision']||'initial',expires);
      res.json({url:`/${category==='watches'?'watches':'shop'}.html?preorder=${encodeURIComponent(token)}`,expiresAt:new Date(expires).toISOString()});
    }catch(e){res.status(400).json({error:e.message});}
  });
  app.post('/api/admin/preorder-links/revoke',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      if(!categories.has(req.body?.category))throw Error('Choose watches or shop.');
      await updateSettings({[prefix(req.body.category)+'Revision']:randomUUID()});
      res.json({revoked:true});
    }catch(e){res.status(400).json({error:e.message});}
  });
}
