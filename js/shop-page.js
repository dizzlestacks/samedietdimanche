/* Public shop products only. No checkout calls or invented catalogue entries. */
(function(){
  'use strict';
  var grid=document.getElementById('shop-grid'),status=document.getElementById('shop-cart-status');
  var waitlist=document.getElementById('shop-waitlist'),waitlistForm=document.getElementById('shop-waitlist-form');
  var waitlistStatus=document.getElementById('shop-waitlist-status'),email=document.getElementById('shop-waitlist-email');
  var loading=false,signingUp=false;
  function node(tag,text,cls){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  waitlistForm.addEventListener('submit',async function(event){
    event.preventDefault();if(signingUp)return;
    if(!waitlistForm.reportValidity())return;
    signingUp=true;email.disabled=true;waitlistForm.querySelector('button').disabled=true;
    waitlistStatus.dataset.error='false';waitlistStatus.textContent='Joining the shop waitlist…';
    try{
      var response=await fetch('/api/waitlist',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim(),category:'shop'})});
      var data;try{data=await response.json();}catch(_){throw Error('The server returned an unreadable response. Please try again.');}
      if(!response.ok)throw Error(data.error||'Could not join the waitlist. Please try again.');
      waitlistStatus.textContent='You’re on the shop waitlist. We’ll keep you posted about the collection.';email.value='';
    }catch(error){waitlistStatus.dataset.error='true';waitlistStatus.textContent=error.message||'Could not join the waitlist. Please try again.';}
    finally{signingUp=false;email.disabled=false;waitlistForm.querySelector('button').disabled=false;}
  });
  async function load(){
    if(loading)return;loading=true;
    grid.textContent='Loading collection…';
    try{
      var settingsResponse=await fetch('/api/site-settings',{credentials:'include',cache:'no-store'});
      if(!settingsResponse.ok)throw Error('Shop settings unavailable.');
      var settings=await settingsResponse.json();
      if(window.PreorderNotice)window.PreorderNotice.render(settings);
      var showWaitlist=settings.shopWaitlistEnabled===true&&settings.preorderShopActive!==true;
      waitlist.hidden=!showWaitlist;grid.hidden=showWaitlist;
      var subtitle=document.querySelector('.wl-cta-text .wl-cta-sub');
      subtitle.textContent=showWaitlist?'The collection is coming. Be first to hear.':'Numbered pieces — secured in order of purchase';
      if(showWaitlist){grid.textContent='';status.textContent='';return;}
      if(settings.shopEnabled===false){grid.textContent='Collection coming soon';return;}
      var r=await fetch('/api/products?category=shop',{credentials:'include',cache:'no-store'});if(!r.ok)throw Error();
      var data=await r.json();grid.textContent='';
      var products=(data.data||[]).filter(function(p){return p.category==='shop'&&p.active===true;});
      if(!products.length){grid.appendChild(node('p','The collection is opening soon.','wa-notice'));return;}
      products.forEach(function(p){
        var price=(p.prices||[]).find(function(x){return x.active===true&&String(x.currency).toLowerCase()==='cad'&&Number.isSafeInteger(x.unit_amount)&&x.unit_amount>0&&x.unit_amount<=1000000;});
        if(!price)return;
        var card=node('article',undefined,'watch-shop-card'),info=node('div',undefined,'watch-shop-info');
        var detailUrl='product.html?id='+encodeURIComponent(p.id),wrap=node('a',undefined,'watch-shop-img-wrap product-card-link');wrap.href=detailUrl;wrap.setAttribute('aria-label','View '+p.name);
        if(p.images&&p.images[0]){var img=node('img',undefined,'watch-shop-img');img.src=p.images[0];img.alt=p.name;img.loading='lazy';img.onerror=function(){this.replaceWith(node('p','Photograph unavailable','product-image-empty'));};wrap.appendChild(img);}
        else wrap.appendChild(node('p','Photograph unavailable','product-image-empty'));
        card.appendChild(wrap);
        var nameLink=node('a',undefined,'product-card-link');nameLink.href=detailUrl;nameLink.appendChild(node('h2',p.name,'watch-shop-name'));info.appendChild(nameLink);info.appendChild(node('p',p.description||'','watch-shop-desc'));
        info.appendChild(node('p',new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',currencyDisplay:'code'}).format(price.unit_amount/100),'watch-shop-price'));
        var viewPiece=node('a','View piece →','product-view-link');viewPiece.href=detailUrl;info.appendChild(viewPiece);
        var hasVariants=Array.isArray(p.variants)&&p.variants.length>0;
        var btn=node('button',hasVariants?'Choose options':'Add to cart','wl-btn watch-shop-buy');btn.type='button';
        btn.onclick=async function(){
          if(hasVariants){location.href=detailUrl;return;}
          btn.disabled=true;status.textContent='Checking current pricing…';
          try{await SharedCart.add({type:'shop',productId:p.id,priceId:price.id,quantity:1});status.textContent='Added '+p.name+'. ';var view=node('a','View cart →');view.href='cart.html';status.appendChild(view);}
          catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
        };info.appendChild(btn);card.appendChild(info);grid.appendChild(card);
      });
      if(!grid.children.length)grid.appendChild(node('p','No priced pieces are available yet.','wa-notice'));
    }catch(error){grid.hidden=false;waitlist.hidden=true;grid.textContent='Collection unavailable. '+(error.message||'Please try again.')+' ';var retry=node('button','Retry collection','wl-btn');retry.type='button';retry.onclick=load;grid.appendChild(retry);}
    finally{loading=false;}
  }
  load();window.addEventListener('focus',load);
})();
