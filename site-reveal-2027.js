
(() => {
  const replaceYear = () => {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.parentElement?.closest('script,style'))continue;
      node.textContent=node.textContent.replace(/(Open.{0,45}PhD.{0,55}?)2026/gi,'$1'+'2027');
    }
  };
  const start=()=>{
    replaceYear();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const style=document.createElement('style');
    style.textContent='html{scroll-behavior:smooth}.site-reveal-2027{opacity:0;transform:translateY(20px);transition:opacity .75s ease,transform .75s ease}.site-reveal-2027.site-visible{opacity:1;transform:none}';
    document.head.append(style);

    // Real scroll-linked movement: the header image and site logo move as the page scrolls.
    const banner=document.querySelector('header#banner.banner');
    const logo=document.querySelector('header#banner .site-name');
    let pending=false;
    function animateScroll(){
      pending=false;
      const y=Math.max(0,window.scrollY||window.pageYOffset||0);
      if(banner){
        const travel=Math.min(y,700);
        banner.style.setProperty('background-position','center calc(50% + '+(travel*.17).toFixed(1)+'px)','important');
      }
      if(logo){
        const shift=Math.min(y*.11,22);
        logo.style.transform='translate3d(0,'+shift.toFixed(1)+'px,0)';
      }
    }
    window.addEventListener('scroll',()=>{
      if(!pending){pending=true;requestAnimationFrame(animateScroll)}
    },{passive:true});
    window.addEventListener('hashchange',()=>requestAnimationFrame(animateScroll));
    animateScroll();

    if(!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('site-visible');observer.unobserve(entry.target)}});
    },{threshold:.08,rootMargin:'0px 0px 45px 0px'});
    document.querySelectorAll('main .view h2,main .view h3,main .view p,main .view img,main .view article').forEach(el=>{
      if(el.closest('[hidden]'))return;
      el.classList.add('site-reveal-2027');
      observer.observe(el);
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
