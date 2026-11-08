/* Signed preorder access is carried only to same-origin APIs, never PayPal. */
(function(){
  var key='sd-private-preorders', tokens={},incoming=new URLSearchParams(location.search).get('preorder');
  try{tokens=JSON.parse(sessionStorage.getItem(key)||'{}')||{};}catch(_){}
  if(incoming){
    var category='invalid';
    try{
      var payload=JSON.parse(atob(incoming.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
      if(['shop','watches'].includes(payload.category))category=payload.category;
    }catch(_){}
    if(incoming.length<=1024)tokens[category]=incoming;
    try{sessionStorage.setItem(key,JSON.stringify(tokens));}catch(_){}
    var url=new URL(location.href);url.searchParams.delete('preorder');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  var values=['watches','shop','invalid'].map(function(k){return tokens[k];}).filter(function(t){return typeof t==='string'&&t.length<=1024;}).slice(0,2);
  if(!values.length)return;
  var original=window.fetch;
  window.fetch=function(input,options){
    var url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original.call(window,input,options);
    var next=Object.assign({},options);
    next.headers=new Headers(next.headers||(input instanceof Request?input.headers:undefined));
    next.headers.set('X-Preorder-Access',values.join(','));
    return original.call(window,input,next);
  };
})();
