/* Update18: price-hidden watch lines never produce a misleading mixed subtotal. */
(function(){
  'use strict';
  var money=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',currencyDisplay:'code'});
  function el(id){return document.getElementById(id);}
  function node(tag,text,cls){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function amount(x){return x===null||x===undefined?'Unavailable':money.format(x/100);}
  function action(promise){Promise.resolve(promise).catch(function(){});}
  SharedCart.subscribe(function(s){
    el('shared-cart').setAttribute('aria-busy',String(s.busy));
    // Keep the current rows and their height during repricing. Replacing them
    // with temporary text removes preorder notes and makes mobile controls jump.
    if(s.busy && el('cart-lines').children.length){
      el('cart-lines').querySelectorAll('button,input').forEach(function(control){control.disabled=true;});
      el('cart-status').textContent='Checking current prices…';
      return;
    }
    el('cart-empty').hidden=s.items.length!==0;el('cart-lines').textContent='';
    s.items.forEach(function(item){
      var token=SharedCart.identity(item),line=s.quote&&s.quote.lines.find(function(x){return SharedCart.identity(x)===token;});
      var title=line?line.name:item.type==='watch'?item.face+' face / '+item.band+' band':'Collection piece';
      var li=node('li',undefined,'wa-cart-item');li.dataset.item=token;
      var thumb=node('div',undefined,'wa-cart-thumb');thumb.setAttribute('aria-hidden','true');
      function image(src,cls){var img=node('img',undefined,cls);img.src=src;img.alt='';img.loading='lazy';img.onerror=function(){thumb.dataset.error='Preview unavailable';};thumb.appendChild(img);}
      if(item.type==='watch') ['band','case','face'].forEach(function(k){image('img/watch-atelier-v6/'+k+(k==='case'?'':'-'+item[k])+'.png?v=watch14','wa-layer wa-layer-'+k);});
      else if(line&&line.image)image(line.image,'');else thumb.dataset.error='Collection piece';
      var detail=node('div',undefined,'wa-cart-detail');detail.appendChild(node('strong',title));
      detail.appendChild(node('p',s.busy?'Checking current prices…':!line?'Prices unverified':line.priceHidden?'Preview · Base '+line.baseName+'. Price available at launch.':item.type==='watch'?'Base '+line.baseName+' '+amount(line.baseCents)+' · Face change '+amount(line.faceChangeCents)+' · Band change '+amount(line.bandChangeCents):!line.available?line.reason:amount(line.unitCents)+' each','wa-notice'));
      if(line&&!line.available)detail.appendChild(node('p',line.reason,'wa-notice'));
      if(line&&line.preorder)detail.appendChild(node('p','PREORDER · Paid in full now. '+line.fulfillmentNote,'wa-notice'));
      if(item.type==='watch'){var edit=node('a','Edit watch','wa-cart-link');edit.href='watches.html?edit=watch&baseId='+encodeURIComponent(item.baseId)+'&face='+encodeURIComponent(item.face)+'&band='+encodeURIComponent(item.band);detail.appendChild(edit);}
      var controls=node('div',undefined,'wa-quantity'),input=node('input');
      input.type='number';input.min='1';input.max='20';input.step='1';input.value=item.quantity;input.disabled=s.busy;input.setAttribute('aria-label','Quantity: '+title);
      function quantity(q){try{action(SharedCart.quantity(token,q));}catch(e){input.value=item.quantity;el('cart-status').textContent=e.message;}}
      input.addEventListener('change',function(){quantity(/^\d+$/.test(input.value)?Number(input.value):NaN);});
      var minus=node('button','−'),plus=node('button','+'),remove=node('button','Remove','wa-remove');
      minus.disabled=s.busy||item.quantity===1;plus.disabled=s.busy||item.quantity===20;remove.disabled=s.busy;
      [minus,plus,remove].forEach(function(b){b.type='button';b.setAttribute('aria-label',b.textContent+' '+title);});
      minus.onclick=function(){quantity(item.quantity-1);};plus.onclick=function(){quantity(item.quantity+1);};remove.onclick=function(){action(SharedCart.remove(token));};
      controls.append(minus,input,plus,remove);detail.appendChild(controls);
      li.append(thumb,detail,node('strong',s.busy?'Checking…':line&&line.priceHidden?'Price available at launch':line?amount(line.lineCents):'Unverified','wa-cart-line-total'));el('cart-lines').appendChild(li);
    });
    el('cart-total').textContent=s.busy?'Checking…':s.quote&&s.quote.priceHidden?'Not shown in preview':s.quote?amount(s.quote.totalCents):'Unverified';
    el('shared-cart').dataset.totalCents=s.quote&&s.quote.totalCents!==null?s.quote.totalCents:'';
    el('cart-status').textContent=s.error || (s.quote&&s.quote.priceHidden?'Watch prices will be available at launch. No complete subtotal is shown; clothing line prices remain visible. Checkout is unavailable.':s.quote&&!s.quote.available?'One or more items are unavailable. A complete subtotal cannot be calculated.':'');
    el('cart-retry').hidden=!s.error;
  });
  el('cart-retry').onclick=function(){SharedCart.refresh();};
})();
