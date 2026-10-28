(function(){
  const IMG='Wiley_article_first_page_2x.png';
  function onPublications(){
    return /publications/i.test(location.hash) ||
      document.body.innerText.includes('Newest first. Author names as published');
  }
  function apply(){
    if(!onPublications()) return;

    // Remove the entire Google Scholar card/section, not only its metrics.
    const all=[...document.querySelectorAll('*')];
    const scholar=all.find(e=>e.children.length===0 && e.textContent.trim()==='Google Scholar');
    if(scholar){
      let box=scholar;
      while(box.parentElement && box.parentElement!==document.body){
        const p=box.parentElement;
        const r=p.getBoundingClientRect();
        const txt=p.innerText||'';
        if(txt.includes('Google Scholar') && (txt.includes('Open profile') || txt.includes('View Google Scholar Profile')) && r.width>500){
          box=p;
        } else if(box!==scholar) break;
        else box=p;
      }
      if(box && box!==document.body) box.remove();
    }

    // Locate the large Publications hero and show the complete uploaded Wiley page.
    const candidates=[...document.querySelectorAll('header,section,div')].filter(el=>{
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.width>window.innerWidth*.65 && r.height>180 && r.top<520 && cs.backgroundImage!=='none';
    }).sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width);
    const hero=candidates[0];
    if(hero){
      const ratio=2022/2048;
      const desired=Math.round(Math.min(window.innerHeight*.92, Math.max(650, window.innerWidth*ratio*.62)));
      hero.style.setProperty('background-image','url("'+IMG+'")','important');
      hero.style.setProperty('background-size','contain','important');
      hero.style.setProperty('background-repeat','no-repeat','important');
      hero.style.setProperty('background-position','center top','important');
      hero.style.setProperty('background-color','#292725','important');
      hero.style.setProperty('height',desired+'px','important');
      hero.style.setProperty('min-height',desired+'px','important');
      hero.style.setProperty('max-height','none','important');
    }
  }
  function run(){ setTimeout(apply,120); setTimeout(apply,700); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  addEventListener('hashchange',run);
  addEventListener('resize',()=>setTimeout(apply,100));
  document.addEventListener('click',()=>setTimeout(apply,220));
})();
