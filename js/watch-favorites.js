/* Update18: favorites contain model IDs only; custom designs remain separate. */
(function(){
  'use strict';
  var key='sd-watch-favorites-v1',cards=Array.from(document.querySelectorAll('[data-watch-product]'));
  if(!cards.length)return;
  var ids=cards.map(function(card){return card.dataset.watchProduct;}),chosen=new Set();
  var status=document.createElement('p');status.className='wa-notice';status.setAttribute('role','status');
  status.id='wa-favorites-status';document.querySelector('.wa-view-toolbar').after(status);
  function read(raw){
    var list=JSON.parse(raw||'[]');
    if(!Array.isArray(list)||list.some(function(id){return !ids.includes(id);}))throw Error();
    return new Set(list);
  }
  function draw(){
    cards.forEach(function(card){
      var id=card.dataset.watchProduct,button=card.querySelector('[data-product-favorite]'),on=chosen.has(id);
      button.setAttribute('aria-pressed',String(on));button.textContent=on?'Favorited':'Favorite';
      button.setAttribute('aria-label',(on?'Remove favorite: ':'Favorite: ')+card.querySelector('h2').textContent);
    });
  }
  cards.forEach(function(card){
    var button=document.createElement('button');button.type='button';button.className='wa-save wa-save-secondary';
    button.setAttribute('data-product-favorite','');card.querySelector('.wa-product-actions').appendChild(button);
    button.addEventListener('click',function(){
      var id=card.dataset.watchProduct;if(chosen.has(id))chosen.delete(id);else chosen.add(id);
      try{localStorage.setItem(key,JSON.stringify(Array.from(chosen)));status.textContent='';}
      catch(_){status.textContent='Favorites stay on this page only. Device storage is unavailable.';}
      draw();
    });
  });
  try{chosen=read(localStorage.getItem(key));}catch(_){status.textContent='Saved favorites could not be read. You can favorite watches on this page.';}
  draw();
  window.addEventListener('storage',function(event){
    if(event.key!==key&&event.key!==null)return;
    try{chosen=read(event.key===null?null:event.newValue);status.textContent='';draw();}
    catch(_){status.textContent='Favorites could not be synchronized. Your current choices remain on this page.';}
  });
})();
