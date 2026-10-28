(() => {
  const norm = s => (s || '').replace(/\s+/g,' ').trim();
  function removeCard(){
    const nodes = [...document.querySelectorAll('body *')];
    const label = nodes.find(e => e.children.length===0 && norm(e.textContent)==='Scholar publications (not synced)')
      || nodes.find(e => e.children.length===0 && norm(e.textContent)==='Google Scholar');
    if(!label) return;
    let n=label, found=null;
    for(let i=0;i<12 && n && n!==document.body;i++,n=n.parentElement){
      const t=norm(n.textContent);
      if(t.includes('Google Scholar') && t.includes('Citations') && t.includes('h-index') && t.includes('i10-index')){
        found=n;
        break;
      }
    }
    if(found) found.remove();
  }
  function init(){
    removeCard();
    let busy=false;
    new MutationObserver(()=>{
      if(busy)return;
      busy=true;
      queueMicrotask(()=>{busy=false;removeCard()});
    }).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',removeCard);
    document.addEventListener('click',()=>setTimeout(removeCard,100));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
