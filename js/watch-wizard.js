/* Update18: selected-base workflow; preview saves without exposing monetary values. */
(function(){
  'use strict';
  var host=document.getElementById('watch-experience');if(!host)return;
  var step=0,current={baseId:'black-black',face:'black',band:'black',ready:false},catalog=null,loading=false,priceRequest=0;
  var query=new URLSearchParams(location.search),editing=null;
  var panels=['wa-face-selector','wa-band-selector','wa-review'],cards=Array.from(document.querySelectorAll('[data-watch-product]'));
  var cardReady={},cardLoading={},pendingRestore=null,queryHandled=false;
  var money=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',currencyDisplay:'code'});
  function el(id){return document.getElementById(id);}
  function title(x){return x[0].toUpperCase()+x.slice(1);}
  function preview(){return window.sdWatchPreviewEnabled===true||!!(catalog&&catalog.previewEnabled===true);}
  function amount(x){return preview()?'Price available at launch':x===null||x===undefined?'Unavailable':money.format(x/100);}
  function model(id){return catalog&&catalog.models.find(function(m){return m.id===id;});}
  function show(next,focus){
    step=Math.max(0,Math.min(2,next));
    panels.forEach(function(id,i){el(id).hidden=i!==step;});
    document.querySelectorAll('[data-wizard-step]').forEach(function(b){
      if(Number(b.dataset.wizardStep)===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    });
    el('wa-back').disabled=step===0;el('wa-next').hidden=step===2;
    el('wa-next').textContent=step===0?'Next: band':'Next: review';
    el('wa-step-caption').textContent='Step '+(step+1)+' of 3 · '+['Face','Band','Review'][step];
    if(focus)el(panels[step]).focus({preventScroll:true});
  }
  function open(nextStep){
    if(window.sdWatchMode!=='shop')return;
    el('watch-catalog').hidden=true;el('watch-customizer').hidden=false;
    show(nextStep,true);
    el('watch-customizer').scrollIntoView({block:'start',behavior:'auto'});
  }
  function configure(baseId,face,band){
    if(window.sdWatchMode!=='shop')return;
    window.dispatchEvent(new CustomEvent('watch:select-base',{detail:{baseId:baseId}}));
    editing=null;el('wa-add-cart').textContent='Add to cart';el('wa-add-status').textContent='';el('wa-view-cart').hidden=true;
    current={baseId:baseId,face:face,band:band,ready:false};open(0);render();
    window.dispatchEvent(new CustomEvent('watch:configure',{detail:current}));
  }
  function render(){
    var state=SharedCart.state(),m=model(current.baseId),f=null,b=null,priced=false;
    var hidden=preview();
    var selected=model(el('watch-catalog').dataset.selectedBase||'black-black');
    el('wa-customize-selected').disabled=window.sdWatchMode!=='shop'||!model('black-black');
    el('wa-selected-model').textContent=selected?'Selected model: '+selected.name+'. '+(hidden?'Preview. Price available at launch.':'Original price '+amount(selected.cents)+'.'):'Select an original watch model. Loading catalog.';
    if(m){f=current.face===m.face?0:catalog.fees.face;b=current.band===m.band?0:catalog.fees.band;priced=m.cents!==null&&f!==null&&b!==null;}
    el('wa-review-face').textContent=title(current.face)+' face';el('wa-review-band').textContent=title(current.band)+' band';
    el('wa-base-name').textContent=m?m.name:current.baseId.replace(/-/g,' / ');
    el('wa-base-origin').textContent=m?'Original: '+title(m.face)+' face / '+title(m.band)+' band. This original model stays with your design.':'Loading original model…';
    el('wa-base-price').textContent=m?amount(m.cents):loading?'Checking…':'Unavailable';
    el('wa-face-price').textContent=m?amount(f):'Unavailable';el('wa-band-price').textContent=m?amount(b):'Unavailable';
    el('wa-selection-price').textContent=priced?amount(m.cents+f+b):'Unavailable';
    if(hidden)el('wa-selection-price').textContent='Price available at launch';
    ['wa-face-price','wa-band-price'].forEach(function(id){if(el(id).parentElement)el(id).parentElement.hidden=hidden;});
    el('wa-add-cart').disabled=window.sdWatchMode!=='shop'||loading||state.busy||!current.ready||!m||(!hidden&&!priced);
    el('wa-add-cart').textContent=hidden?(editing?'Update saved cart watch':'Save to cart'):(editing?'Update cart watch':'Add to cart');
    el('wa-price-notice').textContent=hidden?(!catalog&&!loading?'The watch catalog could not load. Retry catalog before saving to cart.':'Preview mode. Save your design or save it to your cart. Prices will be available at launch; checkout is unavailable.') :!catalog?'Pricing must load before adding.':!priced?'The base or an applicable change fee is unpriced; preview and saving remain available.':!current.ready?'Preparing selected artwork…':'Each change fee applies once against the original model. Reverting to its original color removes that fee. Continue to your cart for shipping, taxes and payment.';
    el('wa-pricing-retry').textContent=hidden?'Retry catalog':'Retry pricing';
    el('wa-catalog-retry').textContent=hidden?'Retry catalog':'Retry pricing';
    cards.forEach(function(card){
      var id=card.dataset.watchProduct,product=model(id);
      card.querySelector('[data-product-price]').textContent=hidden?'Preview':product?amount(product.cents):loading?'Checking current price…':'Pricing unavailable';
      var add=card.querySelector('[data-product-add]');
      add.textContent=hidden?'Save to cart':'Add to cart';
      add.setAttribute('aria-label',(hidden?'Save ':'Add ')+card.querySelector('h2').textContent+' watch to cart');
      add.disabled=window.sdWatchMode!=='shop'||loading||state.busy||!cardReady[id]||!product||(!hidden&&product.cents===null);
    });
  }
  async function prices(){
    var request=++priceRequest;loading=true;catalog=null;render();
    try{var r=await fetch('/api/watch-catalog',{credentials:'include',cache:'no-store'});if(!r.ok)throw Error();var fresh=await r.json();if(request!==priceRequest)return;catalog=fresh;el('wa-pricing-retry').hidden=true;el('wa-catalog-retry').hidden=true;}
    catch(_){if(request===priceRequest){el('wa-pricing-retry').hidden=false;el('wa-catalog-retry').hidden=false;}}
    finally{if(request===priceRequest){loading=false;render();}}
  }
  async function prepareCard(card){
    var id=card.dataset.watchProduct;if(cardLoading[id])return;
    cardLoading[id]=true;cardReady[id]=false;card.querySelector('[data-product-status]').textContent='Preparing watch preview…';render();
    try{
      await Promise.all(Array.from(card.querySelectorAll('img')).map(function(img){
        return new Promise(function(resolve,reject){var copy=new Image();copy.onload=function(){(copy.decode?copy.decode():Promise.resolve()).then(resolve,reject);};copy.onerror=reject;copy.src=img.src;});
      }));
      if(card.querySelector('.wa-product-photo').dataset.error)card.querySelectorAll('img').forEach(function(img){img.src=img.src;});
      cardReady[id]=true;delete card.querySelector('.wa-product-photo').dataset.error;
      card.querySelector('[data-product-retry]').hidden=true;card.querySelector('[data-product-status]').textContent='';
    }catch(_){card.querySelector('.wa-product-photo').dataset.error='Preview unavailable';card.querySelector('[data-product-retry]').hidden=false;card.querySelector('[data-product-status]').textContent='The watch preview could not load. Retry before adding.';}
    finally{cardLoading[id]=false;render();}
  }
  cards.forEach(function(card){
    var name=card.querySelector('h2').textContent;
    card.querySelector('[data-product-add]').setAttribute('aria-label','Add '+name+' watch to cart');
    card.querySelector('[data-product-retry]').onclick=function(){prepareCard(card);};
    card.querySelector('[data-product-add]').onclick=async function(){
      if(this.disabled||window.sdWatchMode!=='shop')return;
      var p=model(card.dataset.watchProduct),status=card.querySelector('[data-product-status]');
      status.textContent=preview()?'Saving watch…':'Checking current price…';
      try{await SharedCart.add({type:'watch',baseId:p.id,face:p.face,band:p.band,quantity:1});status.textContent='Added to your cart. ';card.querySelector('[data-product-cart]').hidden=false;}
      catch(e){status.textContent=e.message;}
      prices();
    };
    prepareCard(card);
  });
  el('wa-customize-selected').onclick=function(){
    if(model('black-black'))configure('black-black','black','black');
  };
  el('wa-return-catalog').onclick=function(){if(window.sdWatchMode!=='shop')return;el('watch-customizer').hidden=true;el('watch-catalog').hidden=false;window.dispatchEvent(new CustomEvent('watch:catalog-visible'));el('watch-catalog').scrollIntoView({block:'start',behavior:'auto'});};
  window.addEventListener('watch:preview-state',function(e){current=e.detail;render();});
  function restore(e){
    if(window.sdWatchMode!=='shop'){pendingRestore=e;return;}
    if(e.detail&&SharedCart.validWatchBase(e.detail.baseId)){
      current.baseId=e.detail.baseId;
      window.dispatchEvent(new CustomEvent('watch:select-base',{detail:{baseId:current.baseId}}));
    }
    if(!e.detail||!e.detail.edit){editing=null;el('wa-add-cart').textContent='Add to cart';}
    open(2);render();
  }
  window.addEventListener('watch:restore-design',restore);
  window.addEventListener('watch:base-selected',render);
  document.querySelectorAll('[data-wizard-step],[data-edit-step]').forEach(function(b){b.addEventListener('click',function(){show(Number(b.dataset.wizardStep||b.dataset.editStep),true);});});
  el('wa-back').addEventListener('click',function(){show(step-1,true);});el('wa-next').addEventListener('click',function(){show(step+1,true);});
  el('wa-pricing-retry').onclick=prices;el('wa-catalog-retry').onclick=prices;
  el('wa-add-cart').onclick=async function(){
    if(this.disabled||window.sdWatchMode!=='shop')return;
    var chosen={type:'watch',baseId:current.baseId,face:current.face,band:current.band,quantity:1};
    el('wa-add-status').textContent='Checking your selection…';
    try{
      if(editing)await SharedCart.replace(editing,chosen);else await SharedCart.add(chosen);
      if(editing)editing=SharedCart.identity(chosen);
      el('wa-add-status').textContent=(editing?'Updated ':'Added ')+title(chosen.face)+' face / '+title(chosen.band)+' band. ';el('wa-view-cart').hidden=false;
    }catch(e){el('wa-add-status').textContent=e.message;}
    prices();
  };
  if(query.get('edit')==='watch'){
    var base=query.get('baseId')||SharedCart.inferWatchBase(query.get('face'),query.get('band'));
    var original=SharedCart.state().items.find(function(x){return x.type==='watch'&&x.baseId===base&&x.face===query.get('face')&&x.band===query.get('band');});
    if(original){editing=SharedCart.identity(original);el('wa-add-cart').textContent='Update cart watch';}
  }
  SharedCart.subscribe(function(state){el('wa-device-notices').hidden=window.sdWatchMode!=='shop'||!state.warning;render();});window.addEventListener('focus',prices);
  show(0,false);prices();
  function modeChanged(){
    render();
    if(window.sdWatchMode!=='shop')return;
    el('wa-device-notices').hidden=!SharedCart.state().warning;
    if(pendingRestore){var restoreEvent=pendingRestore;pendingRestore=null;queryHandled=true;restore(restoreEvent);}
    else if(!queryHandled&&query.get('customize')==='watch'&&query.get('edit')!=='watch'){
      queryHandled=true;setTimeout(function(){configure('black-black','black','black');},0);
    }
  }
  window.addEventListener('watch:mode',modeChanged);modeChanged();
})();
