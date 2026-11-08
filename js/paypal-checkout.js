/* PayPal shared-cart checkout: all money and availability are server validated. */
(function(){
  'use strict';
  var el=function(id){return document.getElementById(id);}, form=el('checkout-address'), config, session, draft, pending, buttons, working=false, version='';
  var money=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'});
  function message(text){el('checkout-message').textContent=text;}
  function stored(key,value){try{if(value===undefined)return sessionStorage.getItem(key);if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value);}catch(e){throw Error('Enable browser storage to use secure checkout.');}}
  function checkoutKey(){
    var key=stored('sd-paypal-key');
    if(!key){key=Array.from(crypto.getRandomValues(new Uint8Array(32)),function(b){return b.toString(16).padStart(2,'0');}).join('');stored('sd-paypal-key',key);}
    return key;
  }
  async function api(path,body){
    var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Checkout-Key':checkoutKey()},body:JSON.stringify(body)});
    var data=await r.json();if(!r.ok)throw Error(data.error||'Checkout unavailable. Please retry.');return data;
  }
  function invalidate(){
    draft=null;el('checkout-summary').textContent='';
    if(buttons){buttons.close();buttons=null;}el('paypal-buttons').textContent='';
  }
  function displayTotal(t){
    el('checkout-summary').textContent='';
    [['Subtotal',t.subtotalCents],['Shipping',t.shippingCents],[t.taxLabel,t.taxCents],['Total · CAD',t.totalCents]].forEach(function(pair){
      var p=document.createElement('p'),label=document.createElement('span'),value=document.createElement('strong');
      label.textContent=pair[0];value.textContent=money.format(pair[1]/100);p.append(label,value);el('checkout-summary').appendChild(p);
    });
  }
  async function loadSdk(){
    if(window.paypal)return;
    await new Promise(function(resolve,reject){
      var script=document.createElement('script');
      script.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(config.clientId)+'&currency=CAD&intent=capture&components=buttons';
      script.onload=resolve;script.onerror=function(){script.remove();reject(Error('PayPal could not load. Check your connection or content blocker and review the total again.'));};
      document.head.appendChild(script);
    });
  }
  async function capture(){
    if(!pending || working)return;
    working=true;message('Confirming payment with PayPal. Please do not start another payment.');
    try{
      var result=await api('/api/checkout/'+encodeURIComponent(pending.checkoutId)+'/capture',{});
      if(result.status==='paid'){
        var receiptId=pending.checkoutId;
        stored('sd-last-receipt',receiptId);
        var purchased=pending.items;pending=null;stored('sd-paypal-pending',null);
        invalidate();el('checkout-recover').hidden=true;
        el('checkout-cancel').hidden=true;
        await SharedCart.complete(purchased).catch(function(){});
        message('Payment confirmed. PayPal order '+result.orderId+'. Total '+money.format(result.total.totalCents/100)+'. Keep this reference for your records.');
        form.hidden=true;
        window.location.assign('/receipt.html');
      }else{
        message('PayPal is still processing this payment. Do not pay again. Use Check payment status to refresh.');
      }
    }catch(e){message(e.message);}
    finally{working=false;}
  }
  form.addEventListener('input',function(){invalidate();message('Review your updated total before paying.');});
  form.addEventListener('submit',async function(event){
    event.preventDefault();if(working||pending)return;
    invalidate();working=true;message('Checking prices, destination and taxes…');
    try{
      if(!session||session.busy||!session.quote)throw Error('Wait for your cart to finish updating.');
      var current=JSON.stringify(session.items), address=Object.fromEntries(new FormData(form));
      var total=await api('/api/checkout/quote',{items:session.items,address:address});
      el('preorder-confirmation').hidden=!total.preorder;
      if(el('preorder-shipping-note').textContent!==total.fulfillmentNote)el('preorder-accepted').checked=false;
      el('preorder-shipping-note').textContent=total.fulfillmentNote||'';
      if(total.preorder&&!el('preorder-accepted').checked)throw Error('Please confirm the preorder payment and shipping timeframe, then review your total again.');
      if(current!==JSON.stringify(SharedCart.state().items))throw Error('Cart changed. Review your total again.');
      draft={items:JSON.parse(current),address:address,requestId:crypto.randomUUID(),preorderAccepted:total.preorder&&el('preorder-accepted').checked};
      displayTotal(total);await loadSdk();
      if(!draft)throw Error('Address changed. Review your total again.');
      buttons=paypal.Buttons({
        style:{layout:'vertical',color:'gold',label:'pay'},
        createOrder:async function(){
          if(!draft || JSON.stringify(draft.items)!==JSON.stringify(SharedCart.state().items))throw Error('Cart changed. Review your total again.');
          var snapshot=draft, order=await api('/api/checkout',snapshot);
          pending={checkoutId:order.checkoutId,items:snapshot.items};stored('sd-paypal-pending',JSON.stringify(pending));
          el('checkout-recover').hidden=false;
          el('checkout-cancel').hidden=false;
          return order.orderId;
        },
        onApprove:capture,
        onCancel:function(){
          pending=null;stored('sd-paypal-pending',null);el('checkout-recover').hidden=true;
          el('checkout-cancel').hidden=true;
          invalidate();message('Payment cancelled. Your cart is unchanged. Review your total to try again.');
        },
        onError:function(){message('PayPal could not finish. If you approved payment, use Check payment status before trying again.');},
      });
      await buttons.render('#paypal-buttons');message('Review the total above, then pay securely with PayPal.');
    }catch(e){message(e.message);}
    finally{working=false;}
  });
  el('checkout-recover').onclick=capture;
  el('checkout-cancel').onclick=async function(){
    if(!pending||working)return;
    working=true;
    try{
      await api('/api/checkout/'+encodeURIComponent(pending.checkoutId)+'/cancel',{});
      pending=null;stored('sd-paypal-pending',null);invalidate();
      el('checkout-recover').hidden=true;el('checkout-cancel').hidden=true;
      message('Unpaid checkout cancelled. Review your total to start again.');
    }catch(e){message(e.message);}finally{working=false;}
  };
  el('cart-checkout').onclick=function(){el('checkout-panel').hidden=false;form.hidden=false;form.elements.name.focus();};
  SharedCart.subscribe(function(s){
    session=s;
    var next=JSON.stringify(s.items);
    if(version && next!==version)invalidate();
    version=next;
    var can=!!(config&&config.enabled&&!s.busy&&s.items.length&&s.quote&&s.quote.available&&!s.quote.priceHidden&&s.quote.lines.every(function(l){return l.type!=='watch'||l.saleAvailable;}));
    el('cart-checkout').disabled=!can;
    el('cart-checkout').textContent=config&&!config.enabled?'Checkout unavailable':can?'Continue to PayPal':'Checkout unavailable for this cart';
    if(!can&&draft)invalidate();
  });
  fetch('/api/paypal/config').then(function(r){if(!r.ok)throw Error('Checkout configuration unavailable.');return r.json();}).then(function(c){
    config=c;
    el('checkout-tax-notice').textContent = c.salesTaxEnabled === false ? 'No sales tax is added at checkout.' : 'Canadian GST/HST is added for Canadian delivery.';
    var names=new Intl.DisplayNames(['en'],{type:'region'});
    c.countries.sort(function(a,b){return names.of(a).localeCompare(names.of(b));}).forEach(function(code){
      var option=document.createElement('option');option.value=code;option.textContent=names.of(code);form.elements.country.appendChild(option);
    });
    form.elements.country.value='CA';
    c.provinces.forEach(function(code){var option=document.createElement('option');option.value=code;el('checkout-provinces').appendChild(option);});
    var cached=stored('sd-paypal-pending');
    if(cached){pending=JSON.parse(cached);el('checkout-panel').hidden=false;el('checkout-recover').hidden=false;el('checkout-cancel').hidden=false;message('A previous PayPal checkout needs confirmation. Check its payment status before paying again.');}
    SharedCart.refresh();
  }).catch(function(e){el('cart-checkout').textContent='Checkout unavailable';el('checkout-panel').hidden=false;message(e.message);});
})();
