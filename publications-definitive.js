(() => {
  const IMAGE='Wiley_article_first_page_2x.png';
  const isPub=()=>location.hash.toLowerCase().includes('publications') ||
    [...document.querySelectorAll('a')].some(a=>a.classList.contains('active') && /publications/i.test(a.textContent));

  function removeScholar(){
    const nodes=[...document.querySelectorAll('body *')];
    const leaf=nodes.find(e=>e.children.length===0 && e.textContent.trim()==='Google Scholar');
    if(!leaf) return;
    let n=leaf;
    let best=null;
    for(let i=0;i<8 && n && n!==document.body;i++,n=n.parentElement){
      const t=(n.innerText||'').trim(), r=n.getBoundingClientRect();
      if(/Google Scholar/.test(t) && (/Open profile/i.test(t)||/Scholar publications/i.test(t)||/Citations/.test(t)) && r.width>400) best=n;
    }
    if(best) best.remove();
  }

  function fullPageHero(){
    let title=[...document.querySelectorAll('body *')].find(e=>e.children.length===0 && e.textContent.trim()==='PUBLICATIONS');
    if(!title) return;
    let hero=title;
    for(let i=0;i<7 && hero.parentElement && hero.parentElement!==document.body;i++){
      const p=hero.parentElement, r=p.getBoundingClientRect();
      if(r.width>innerWidth*.75 && r.height>250){hero=p; break;}
      hero=p;
    }
    if(!hero || hero===document.body) return;
    hero.style.setProperty('position','relative','important');
    hero.style.setProperty('height','auto','important');
    hero.style.setProperty('min-height','0','important');
    hero.style.setProperty('background-image','none','important');
    hero.style.setProperty('overflow','hidden','important');

    let img=hero.querySelector(':scope > img[data-wiley-fullpage]');
    if(!img){
      img=document.createElement('img');
      img.dataset.wileyFullpage='1';
      img.src=IMAGE;
      img.alt='CNN5Conv2FC Wiley article first page';
      hero.prepend(img);
    }
    Object.assign(img.style,{
      display:'block', width:'100%', height:'auto', maxWidth:'100%',
      objectFit:'contain', objectPosition:'center top'
    });
    img.style.setProperty('position','relative','important');
    img.style.setProperty('z-index','0','important');

    title.style.setProperty('position','absolute','important');
    title.style.setProperty('left','50%','important');
    title.style.setProperty('top','50%','important');
    title.style.setProperty('transform','translate(-50%,-50%)','important');
    title.style.setProperty('z-index','2','important');
    title.style.setProperty('width','100%','important');
    title.style.setProperty('text-align','center','important');
  }

  function apply(){ if(!isPub()) return; removeScholar(); fullPageHero(); }
  const run=()=>{apply();setTimeout(apply,150);setTimeout(apply,600);setTimeout(apply,1400)};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  addEventListener('hashchange',run);
  document.addEventListener('click',()=>setTimeout(apply,100));
})();
