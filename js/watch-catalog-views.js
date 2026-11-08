/* Update18: compact native view choice; revised grid default, one preserved original. */
(function(){
  'use strict';
  var catalog=document.getElementById('watch-catalog'),track=document.getElementById('wa-product-track');
  if(!catalog||!track)return;
  var views=['carousel','grid','list','compact'],key='sd-watch-catalog-view-v2',view='grid',index=0,frame=0,target=null;
  var select=document.getElementById('wa-view-select');
  var cards=Array.from(track.querySelectorAll('[data-watch-product]'));
  var previous=document.getElementById('wa-carousel-prev'),next=document.getElementById('wa-carousel-next');
  var controls=document.getElementById('wa-carousel-controls'),position=document.getElementById('wa-carousel-position');
  var status=document.getElementById('wa-view-status'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function announce(){
    previous.disabled=index===0;next.disabled=index===cards.length-1;
    position.textContent=(index+1)+' / '+cards.length;catalog.dataset.activeIndex=String(index);
    var selected=cards[index].dataset.watchProduct,changed=catalog.dataset.selectedBase!==selected;
    catalog.dataset.selectedBase=selected;
    cards.forEach(function(card,i){card.querySelector('[data-product-select]').setAttribute('aria-pressed',String(i===index));});
    if(changed)window.dispatchEvent(new CustomEvent('watch:base-selected',{detail:{baseId:selected}}));
  }
  function measure(){
    frame=0;
    if(view!=='carousel'||catalog.hidden||!track.clientWidth)return;
    if(target!==null){if(Math.abs(cards[target].offsetLeft-track.scrollLeft)>2)return;target=null;}
    var nearest=0,distance=Infinity;
    cards.forEach(function(card,i){var delta=Math.abs(card.offsetLeft-track.scrollLeft);if(delta<distance){distance=delta;nearest=i;}});
    index=nearest;announce();
  }
  function queue(){if(!frame)frame=requestAnimationFrame(measure);}
  function go(to,smooth){
    index=Math.max(0,Math.min(cards.length-1,to));announce();
    if(view!=='carousel'||catalog.hidden)return;
    target=index;
    var left=cards[index].offsetLeft;
    if(track.scrollTo)track.scrollTo({left:left,behavior:smooth&&!reduced.matches?'smooth':'instant'});
    else track.scrollLeft=left;
  }
  function choose(value,persist){
    target=null;view=views.includes(value)?value:'grid';catalog.dataset.view=view;
    controls.hidden=view!=='carousel';
    select.value=view;
    track.setAttribute('aria-label',view==='carousel'?'Watch models. Swipe or use left and right arrow keys.':'Watch models — '+view+' view');
    if(view==='carousel')track.setAttribute('aria-roledescription','carousel');else track.removeAttribute('aria-roledescription');
    cards.forEach(function(card,i){
      if(view==='carousel'){card.setAttribute('role','group');card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label',(i+1)+' of '+cards.length+': '+card.querySelector('h2').textContent);}
      else{card.removeAttribute('role');card.removeAttribute('aria-roledescription');card.removeAttribute('aria-label');}
    });
    if(persist)try{localStorage.setItem(key,view);status.textContent='';}catch(_){status.textContent='View preference stays in this page only. Device storage is unavailable.';}
    requestAnimationFrame(function(){if(view==='carousel')go(index,false);else track.scrollLeft=0;});
  }
  select.addEventListener('change',function(){choose(select.value,true);});
  previous.addEventListener('click',function(){go(index-1,true);});
  next.addEventListener('click',function(){go(index+1,true);});
  cards.forEach(function(card,i){card.querySelector('[data-product-select]').addEventListener('click',function(){go(i,false);});});
  track.addEventListener('scroll',queue,{passive:true});
  ['wheel','touchstart','pointerdown'].forEach(function(name){track.addEventListener(name,function(){target=null;},{passive:true});});
  track.addEventListener('keydown',function(event){
    if(view!=='carousel'||event.altKey||event.ctrlKey||event.metaKey)return;
    var target=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:event.key==='Home'?0:event.key==='End'?cards.length-1:null;
    if(target!==null){event.preventDefault();go(target,true);}
  });
  window.addEventListener('resize',function(){if(view==='carousel')go(index,false);});
  if(window.ResizeObserver)new ResizeObserver(function(){if(view==='carousel')go(index,false);}).observe(track);
  window.addEventListener('watch:catalog-visible',function(){
    requestAnimationFrame(function(){go(index,false);});
  });
  window.addEventListener('watch:select-base',function(event){
    var selected=cards.findIndex(function(card){return card.dataset.watchProduct===event.detail.baseId;});
    if(selected!==-1)go(selected,false);
  });
  window.addEventListener('storage',function(event){if(event.key===key)choose(event.newValue,false);});
  try{
    view=localStorage.getItem(key);
    if(!view){
      var old=localStorage.getItem('sd-watch-catalog-view-v1');
      view=views.includes(old)&&old!=='carousel'?old:'grid';
      localStorage.setItem(key,view);
    }
  }catch(_){status.textContent='View preference stays in this page only. Device storage is unavailable.';}
  choose(view,false);announce();
})();
