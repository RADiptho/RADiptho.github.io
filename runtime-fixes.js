(function(){
  function textLeaves(root=document){
    return [...root.querySelectorAll('*')].filter(e=>e.children.length===0);
  }
  function fixScholar(){
    const leaf=textLeaves().find(e=>e.textContent.trim()==='Scholar publications (not synced)');
    if(!leaf)return;
    const card=leaf.parentElement;
    if(!card)return;
    const value=[...card.querySelectorAll('*')].find(e=>e.children.length===0 && ['—','0'].includes(e.textContent.trim()));
    // Keep unknown count honest until a verified count is available.
    if(value)value.textContent='—';
    leaf.textContent='Scholar publications';
  }
  function fixPublicationsBanner(){
    const nav=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Publications');
    const candidates=[...document.querySelectorAll('header,section,div')].filter(el=>{
      const cs=getComputedStyle(el);
      return cs.backgroundImage && cs.backgroundImage!=='none' && el.getBoundingClientRect().height>180;
    });
    // On Publications view, use the largest visible background region above the content.
    const hero=candidates.sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];
    if(!hero)return;
    const pageText=document.body.innerText;
    if(!pageText.includes('Journal Articles:') && !pageText.includes('Newest first. Author names as published'))return;
    hero.style.setProperty('background-size','contain','important');
    hero.style.setProperty('background-repeat','no-repeat','important');
    hero.style.setProperty('background-position','center top','important');
    hero.style.setProperty('min-height','min(78vh,760px)','important');
    hero.style.setProperty('background-color','#2b2927','important');
  }
  function apply(){fixScholar();fixPublicationsBanner()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,500));
  else setTimeout(apply,500);
  document.addEventListener('click',()=>setTimeout(apply,250));
  addEventListener('hashchange',()=>setTimeout(apply,250));
})();
