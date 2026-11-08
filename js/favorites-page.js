(function(){
  'use strict';
  const list=document.getElementById('favorites-list'),status=document.getElementById('favorites-status');
  let generation=0;
  const keys={watch:'sd-watch-favorites-v1',shop:'sd-shop-favorites-v1',design:'sd-watch-designs-v1'};
  function read(key){const value=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(value))throw Error('Saved favorites could not be read.');return value;}
  function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
  async function render(){
    const request=++generation;list.textContent='';status.textContent='';
    try{
      const entries=[];
      const watches=read(keys.watch),shop=read(keys.shop),designs=read(keys.design);
      watches.forEach(id=>{
        const model={'black-black':['black','black'],'black-camouflage':['black','camouflage'],'red-red':['red','red'],'blue-blue':['blue','blue'],'green-green':['green','green']}[id];
        if(model)entries.push({key:keys.watch,value:id,name:model.join(' / '),face:model[0],band:model[1],href:'watches.html'});
      });
      designs.forEach(d=>{
        if(!d||!['black','red','blue','green'].includes(d.face)||!['black','red','blue','green','camouflage'].includes(d.band))return;
        entries.push({key:keys.design,value:d,name:'Saved design · '+d.face+' / '+d.band,face:d.face,band:d.band,href:'watches.html'});
      });
      if(shop.length){
        let products=[];
        try{const response=await fetch('/api/products?category=shop');if(!response.ok)throw Error();products=(await response.json()).data||[];}
        catch(_){status.textContent='Shop details could not load. Refresh to retry; your favorites are kept.';}
        shop.forEach(id=>{const p=products.find(p=>p.id===id);entries.push({key:keys.shop,value:id,name:p?p.name:'Saved shop item · currently unavailable',image:p?.images?.[0],href:'product.html?id='+encodeURIComponent(id)});});
      }
      if(request!==generation)return;
      if(!entries.length)status.textContent='No favorites yet. Favorite a watch or shop item, or save a custom watch design.';
      entries.forEach(e=>{
        const card=node('article');card.className='favorite-card';
        const image=node('div');image.className='favorite-image';
        const sources=e.face?['band-'+e.band,'case','face-'+e.face].map(x=>'img/watch-atelier-v6/'+x+'.png'):e.image?[e.image]:[];
        sources.forEach(src=>{if(!/^(https?:\/\/|\/?(?:img\/))/.test(src))return;const img=node('img');img.src=src;img.alt='';img.loading='lazy';image.appendChild(img);});
        card.append(image,node('h2',e.name));
        const open=node('a',e.face?'View watches':'View in shop');open.href=e.href;card.appendChild(open);
        const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+e.name);
        remove.onclick=()=>{try{const saved=read(e.key);localStorage.setItem(e.key,JSON.stringify(saved.filter(x=>JSON.stringify(x)!==JSON.stringify(e.value))));render();}catch(_){status.textContent='Could not remove this favorite. Check browser storage.';}};
        card.appendChild(remove);list.appendChild(card);
      });
    }catch(e){status.textContent=e.message;}
  }
  window.addEventListener('storage',render);window.addEventListener('focus',render);render();
})();
