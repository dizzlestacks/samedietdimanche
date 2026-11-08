/* Update18: base identity survives customization; preview quotes are ephemeral, never stored. */
(function () {
  'use strict';
  var key='sd-shared-cart-v1', legacy='sd-watch-cart-v1', sessionKey='sd-cart-session-v1', items=[], quote=null, busy=false, error='', warning='', generation=0;
  var migrated=false, listeners=[], canPersist=true, repriced=false;
  var models=[
    {id:'black-black',face:'black',band:'black'}, {id:'black-camouflage',face:'black',band:'camouflage'},
    {id:'red-red',face:'red',band:'red'}, {id:'blue-blue',face:'blue',band:'blue'}, {id:'green-green',face:'green',band:'green'}
  ];
  function inferBase(face,band){return (models.find(function(m){return m.face===face&&m.band===band;})||models[0]).id;}
  function validBase(id){return models.some(function(m){return m.id===id;});}
  function migrateList(list){
    if(!Array.isArray(list))throw Error('Invalid stored cart.');
    return list.map(function(x){
      if(x&&x.type==='watch'){
        var band=x.band==='violet'?'blue':x.band;
        if(!x.baseId){repriced=true;return Object.assign({},x,{band:band,baseId:inferBase(x.face,band)});}
        return Object.assign({},x,{band:band});
      }
      return x;
    });
  }
  function normalize(list) {
    if(!Array.isArray(list)||list.length>100) throw Error('Invalid stored cart.');
    var result=new Map(), ids=/^[A-Za-z0-9_-]{1,128}$/;
    list.forEach(function(x){
      if(!x||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>20) throw Error('Quantity must be an integer from 1 to 20.');
      var clean;
      if(x.type==='watch'&&validBase(x.baseId)&&Object.keys(x).every(function(k){return ['type','baseId','face','band','quantity'].includes(k);})&&['black','red','blue','green'].includes(x.face)&&['black','red','blue','green','camouflage'].includes(x.band)) clean={type:'watch',baseId:x.baseId,face:x.face,band:x.band,quantity:x.quantity};
      else if(x.type==='shop'&&Object.keys(x).every(function(k){return ['type','productId','priceId','variantId','quantity'].includes(k);})&&typeof x.productId==='string'&&ids.test(x.productId)&&typeof x.priceId==='string'&&ids.test(x.priceId)&&(x.variantId===undefined||typeof x.variantId==='string'&&ids.test(x.variantId))) clean=Object.assign({type:'shop',productId:x.productId,priceId:x.priceId,quantity:x.quantity},x.variantId===undefined?{}:{variantId:x.variantId});
      else throw Error('Invalid stored item.');
      var token=identity(clean);clean.quantity+=(result.get(token)||{quantity:0}).quantity;
      if(clean.quantity>20) throw Error('Maximum quantity is 20 per exact item.');
      result.set(token,clean);
    });return Array.from(result.values());
  }
  function identity(x){return x.type==='watch'?'watch:'+x.baseId+':'+x.face+':'+x.band:'shop:'+x.productId+':'+x.priceId+(x.variantId?':'+x.variantId:'');}
  function persist(){
    var value=JSON.stringify({version:1,pricingVersion:2,watchBasesMigrated:repriced,legacyMigrated:migrated,items:items});
    try{
      if(!canPersist)throw Error('Unreadable storage');
      localStorage.setItem(key,value);warning='';
      try{sessionStorage.removeItem(sessionKey);}catch(_){}
    }catch(_){
      try{sessionStorage.setItem(sessionKey,value);warning='Device storage is unavailable. Your cart is kept in this browser tab session only.';}
      catch(_){warning='Device storage is unavailable. Cart changes stay in this page session; cross-page persistence is not available.';}
    }
  }
  function read(){
    try{
      var session=null;try{session=sessionStorage.getItem(sessionKey);}catch(_){}
      var raw=session||localStorage.getItem(key), stored=raw?JSON.parse(raw):null;
      if(stored&&(stored.version!==1||!Array.isArray(stored.items))) throw Error('Stored cart could not be read; it has not been overwritten.');
      repriced=!!(stored&&stored.watchBasesMigrated);
      var next=normalize(migrateList(stored?stored.items:[]));migrated=!!(stored&&stored.legacyMigrated);
      if(!migrated){
        var old=JSON.parse(localStorage.getItem(legacy)||'[]');
        next=normalize(next.concat(migrateList(old.map(function(x){return {type:'watch',face:x.face,band:x.band,quantity:x.quantity};}))));
        migrated=true;
      }
      items=next;canPersist=true;persist();
    }catch(e){canPersist=false;warning=e.message==='Stored cart could not be read; it has not been overwritten.'?e.message:'Device cart storage could not be read. Existing data was not deleted; this page uses a session cart.';}
  }
  function notice(){return [warning,repriced?'Older watch items were assigned their matching original model (otherwise Black / Black) and repriced under the base + change-fee policy. Review current totals before proceeding.':''].filter(Boolean).join(' ');}
  function state(){return {items:items.map(function(x){return Object.assign({},x);}),quote:quote,busy:busy,error:error,warning:notice()};}
  function emit(){
    document.querySelectorAll('[data-cart-count]').forEach(function(n){n.textContent=items.reduce(function(s,x){return s+x.quantity;},0);});
    document.querySelectorAll('[data-cart-notice]').forEach(function(n){n.textContent=notice();});
    listeners.forEach(function(fn){fn(state());});
  }
  async function api(list){
    var r=await fetch('/api/cart-quote',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:list})});
    var data;try{data=await r.json();}catch(_){throw Error('Current cart pricing is unavailable. Please retry.');}
    if(!r.ok)throw Error(data.error||'Current cart pricing is unavailable.');
    return data;
  }
  async function refresh(candidate,adding){
    var request=++generation, next=normalize(candidate||items);busy=true;quote=null;error='';emit();
    if(!adding){items=next;persist();emit();}
    try{
      var fresh=await api(next);if(request!==generation){if(adding)throw Error('Cart changed in another tab. Please retry your selection.');return;}
      if(adding&&!fresh.lines.some(function(l){return identity(l)===identity(adding)&&l.available;}))throw Error('This selection is currently unavailable and was not added.');
      items=next;quote=fresh;persist();
    }catch(e){if(request!==generation){if(adding)throw e;return;}error=e.message;throw e;}
    finally{if(request===generation){busy=false;emit();}}
  }
  function retry(){return refresh(items).catch(function(){});}
  window.SharedCart={
    state:state,identity:identity,inferWatchBase:inferBase,validWatchBase:validBase,
    subscribe:function(fn){listeners.push(fn);fn(state());return function(){listeners=listeners.filter(function(x){return x!==fn;});};},
    add:async function(item){
      if(busy)throw Error('Please wait for current cart pricing.');
      var next=normalize(items.concat([item]));return refresh(next,item);
    },
    replace:async function(token,item){
      if(busy)throw Error('Please wait for current cart pricing.');
      var original=items.find(function(x){return identity(x)===token;});
      if(!original)throw Error('The original cart item was removed. Return to the cart and try again.');
      var updated=Object.assign({},item,{quantity:original.quantity});
      return refresh(normalize(items.filter(function(x){return identity(x)!==token;}).concat([updated])),updated);
    },
    quantity:function(token,qty){
      if(!Number.isInteger(qty)||qty<1||qty>20)throw Error('Quantity must be an integer from 1 to 20.');
      return refresh(items.map(function(x){return identity(x)===token?Object.assign({},x,{quantity:qty}):x;}));
    },
    remove:function(token){return refresh(items.filter(function(x){return identity(x)!==token;}));},
    complete:function(purchased){
      // Remove only purchased quantities; preserve items added in another tab.
      read();
      var counts=new Map(purchased.map(function(x){return [identity(x),x.quantity];}));
      return refresh(items.map(function(x){return Object.assign({},x,{quantity:Math.max(0,x.quantity-(counts.get(identity(x))||0))});}).filter(function(x){return x.quantity>0;}));
    },
    refresh:retry
  };
  window.addEventListener('storage',function(e){if(e.key===key||e.key===legacy||e.key===null){read();retry();}});
  window.addEventListener('focus',function(){if(!busy)retry();});
  window.addEventListener('watch:mode',function(event){
    if(event.detail.settings&&(event.detail.settings.watchPreviewEnabled===true||(quote&&quote.priceHidden)))retry();
  });
  window.addEventListener('pageshow',function(e){if(e.persisted){read();retry();}});
  read();emit();retry();
})();
