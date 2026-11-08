(function(){
  var main=document.querySelector('main');if(!main)return;
  var nav=document.createElement('nav');nav.className='shared-nav';nav.setAttribute('aria-label','Collection navigation');
  [['watches.html','Watches'],['shop.html','Shop'],['favorites.html','Favorites'],['cart.html','Cart']].forEach(function(pair){
    var a=document.createElement('a');a.href=pair[0];a.textContent=pair[1];
    if(pair[0]==='cart.html'){var count=document.createElement('span');count.dataset.cartCount='';a.appendChild(count);}nav.appendChild(a);
  });
  main.prepend(nav);
  var notice=document.querySelector('[data-cart-notice]');
  if(!notice){notice=document.createElement('p');notice.dataset.cartNotice='';notice.setAttribute('role','status');nav.after(notice);}
  if(window.SharedCart)SharedCart.subscribe(function(s){nav.querySelector('[data-cart-count]').textContent=s.items.reduce(function(sum,x){return sum+x.quantity;},0);notice.textContent=s.warning;});
})();
