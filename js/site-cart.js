/* One cart and one item count across every public section. */
(function(){
  function connect(){
    var links=Array.from(document.querySelectorAll('a[href="cart.html"]')).filter(function(a){return !a.hidden&&!a.closest('[hidden]');});
    if(!links.length){
      var link=document.createElement('a');link.href='cart.html';link.className='site-cart-access';link.textContent='Cart ';
      var style=document.createElement('style');style.textContent='.site-cart-access{position:fixed;top:max(16px,env(safe-area-inset-top));right:16px;z-index:100;color:#e8c4a0;background:rgba(14,18,17,.92);border:1px solid rgba(196,149,106,.35);padding:12px 16px;text-decoration:none;font:400 11px/1.5 Montserrat,sans-serif;letter-spacing:.12em}.site-cart-access:focus-visible{outline:2px solid #e8c4a0;outline-offset:3px}';
      document.head.appendChild(style);document.body.appendChild(link);links=[link];
    }
    links.forEach(function(link){if(!link.querySelector('[data-cart-count]')){var count=document.createElement('span');count.dataset.cartCount='';link.append(' ',count);}});
    SharedCart.subscribe(function(state){
      var count=state.items.reduce(function(sum,item){return sum+item.quantity;},0);
      document.querySelectorAll('[data-cart-count]').forEach(function(el){el.textContent=String(count);});
      links.forEach(function(link){link.setAttribute('aria-label','Cart, '+count+' items');});
    });
  }
  if(window.SharedCart)connect();
  else {var script=document.createElement('script');script.src='js/shared-cart.js?v=29';script.onload=connect;document.head.appendChild(script);}
})();
