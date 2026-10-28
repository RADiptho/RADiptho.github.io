(function(){
  const IMG='Wiley_article_first_page_2x.png';
  function isPublications(){
    return document.body.innerText.includes('Journal Articles:') ||
           document.body.innerText.includes('Newest first. Author names as published');
  }
  function apply(){
    if(!isPublications()) return;
    const candidates=[...document.querySelectorAll('header,section,div')].filter(el=>{
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.height>180 && r.top<500 && cs.backgroundImage!=='none';
    }).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height);
    const hero=candidates[0];
    if(!hero)return;
    hero.style.setProperty('background-image','url("'+IMG+'")','important');
    hero.style.setProperty('background-size','contain','important');
    hero.style.setProperty('background-repeat','no-repeat','important');
    hero.style.setProperty('background-position','center top','important');
    hero.style.setProperty('background-color','#292725','important');
    hero.style.setProperty('min-height','min(78vh,760px)','important');
  }
  function schedule(){setTimeout(apply,100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule); else schedule();
  document.addEventListener('click',()=>setTimeout(apply,180));
  addEventListener('hashchange',()=>setTimeout(apply,180));
})();
