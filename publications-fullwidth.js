(() => {
  function fix(){
    const title=[...document.querySelectorAll('body *')].find(e=>e.children.length===0 && e.textContent.trim()==='PUBLICATIONS');
    if(!title) return;
    const img=[...document.images].find(i=>decodeURI(i.src).includes('Wiley-Style Mango Disease Research Article.png'));
    if(!img) return;
    let hero=img.parentElement;
    if(!hero) return;

    // Let the uploaded image determine the complete hero height.
    hero.style.setProperty('width','100%','important');
    hero.style.setProperty('max-width','none','important');
    hero.style.setProperty('height','auto','important');
    hero.style.setProperty('min-height','0','important');
    hero.style.setProperty('max-height','none','important');
    hero.style.setProperty('overflow','visible','important');
    hero.style.setProperty('padding','0','important');
    hero.style.setProperty('margin','0','important');

    img.style.setProperty('display','block','important');
    img.style.setProperty('width','100%','important');
    img.style.setProperty('max-width','none','important');
    img.style.setProperty('height','auto','important');
    img.style.setProperty('max-height','none','important');
    img.style.setProperty('object-fit','contain','important');
    img.style.setProperty('object-position','center top','important');
    img.style.setProperty('margin','0','important');

    // Keep Publications label centered over the image.
    title.style.setProperty('position','absolute','important');
    title.style.setProperty('top','20%','important');
    title.style.setProperty('left','50%','important');
    title.style.setProperty('transform','translate(-50%,-50%)','important');
    title.style.setProperty('z-index','5','important');
    title.style.setProperty('width','100%','important');
    title.style.setProperty('text-align','center','important');

    // Remove height clipping from a few immediate wrappers.
    let n=hero.parentElement;
    for(let i=0;i<3 && n && n!==document.body;i++,n=n.parentElement){
      n.style.setProperty('max-height','none','important');
      n.style.setProperty('overflow','visible','important');
      if(getComputedStyle(n).height!=='auto') n.style.setProperty('height','auto','important');
    }
  }
  const run=()=>{fix();setTimeout(fix,200);setTimeout(fix,800)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  addEventListener('hashchange',run);
  addEventListener('resize',()=>setTimeout(fix,100));
})();
