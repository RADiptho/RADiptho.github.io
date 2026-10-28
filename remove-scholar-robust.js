(() => {
  const TARGETS=['Scholar publications (not synced)','Google Scholar metrics manually verified','i10-index'];
  function remove(){
    const nodes=[...document.querySelectorAll('body *')];
    const hit=nodes.find(e=>TARGETS.some(t=>(e.textContent||'').includes(t)));
    if(!hit) return false;
    let best=null, n=hit;
    for(let i=0;i<12 && n && n!==document.body;i++,n=n.parentElement){
      const text=(n.innerText||'');
      const r=n.getBoundingClientRect();
      if(text.includes('Google Scholar') &&
         text.includes('Citations') &&
         text.includes('h-index') &&
         text.includes('i10-index') &&
         r.width>500 && r.height>100 && r.height<600){
        best=n;
      }
    }
    if(best){ best.remove(); return true; }
    return false;
  }
  function watch(){
    remove();
    const mo=new MutationObserver(()=>remove());
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{remove();},300);
    setTimeout(()=>{remove();},1000);
    setTimeout(()=>{remove();},2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watch); else watch();
})();
