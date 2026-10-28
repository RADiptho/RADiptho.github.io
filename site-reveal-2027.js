
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
