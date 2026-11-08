/* Private access survives navigation even when embedded browsers block cookies. */
(function () {
  var key='sd-private-watch-access', token='';
  try { token=sessionStorage.getItem(key)||''; } catch (_) {}
  var incoming=new URLSearchParams(location.search).get('early');
  if(incoming && incoming.includes('.')) {
    token=incoming;
    try {sessionStorage.setItem(key,token);} catch (_) {}
  }
  if(!token)return;
  var original=window.fetch;
  window.fetch=function(input,options){
    var url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin || !url.pathname.startsWith('/api/'))return original.call(window,input,options);
    var next=Object.assign({},options);
    next.headers=new Headers(next.headers || (input instanceof Request?input.headers:undefined));
    next.headers.set('X-Watch-Access',token);
    return original.call(window,input,next);
  };
})();
