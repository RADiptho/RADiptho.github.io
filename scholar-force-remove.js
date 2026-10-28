(() => {
  function kill(){
    const els=[...document.querySelectorAll('body *')];
    const matches=els.filter(e=>{
      const t=(e.innerText||'').replace(/\s+/g,' ');
      return t.includes('Google Scholar') &&
             t.includes('Scholar publications') &&
             t.includes('Citations') &&
             t.includes('h-index') &&
             t.includes('i10-index') &&
             (t.includes('Open profile') || t.includes('HTTP 403'));
    });
    if(!matches.length) return;
    // Smallest element containing the complete Scholar UI is the card.
    matches.sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height);
    const card=matches.find(e=>{
      const r=e.getBoundingClientRect();
      return r.width>600 && r.height>120 && r.height<500;
    }) || matches[0];
    if(card && card!==document.body && card.tagName!=='HTML') card.remove();
  }
  function start(){
    kill();
    const observer=new MutationObserver(kill);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    [50,150,300,600,1000,2000,4000].forEach(ms=>setTimeout(kill,ms));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
