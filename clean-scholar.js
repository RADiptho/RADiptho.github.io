(function(){
  function apply(){
    const leaves=[...document.querySelectorAll('*')].filter(e=>e.children.length===0);
    const scholarHeading=leaves.find(e=>e.textContent.trim()==='Google Scholar');
    if(!scholarHeading)return;
    const panel=scholarHeading.closest('section,article,.card') || scholarHeading.parentElement?.parentElement?.parentElement;
    if(!panel)return;

    const labels=['Scholar publications (not synced)','Scholar publications','Citations','h-index','i10-index'];
    labels.forEach(label=>{
      const el=[...panel.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent.trim()===label);
      if(el){
        let card=el.parentElement;
        while(card && card!==panel && card.parentElement!==panel && card.children.length<8) card=card.parentElement;
        if(card && card!==panel) card.style.display='none';
      }
    });

    [...panel.querySelectorAll('*')].forEach(el=>{
      if(el.children.length===0){
        const t=el.textContent.trim();
        if(t.startsWith('Google Scholar metrics manually verified') ||
           t.includes('Daily automatic sync is configured') ||
           t.includes('HTTP 403')){
          el.style.display='none';
        }
      }
    });

    const open=[...panel.querySelectorAll('a')].find(a=>a.textContent.trim()==='Open profile');
    if(open) open.textContent='View Google Scholar Profile';
    panel.style.paddingBottom='18px';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,700));
  else setTimeout(apply,700);
  document.addEventListener('click',()=>setTimeout(apply,250));
})();
