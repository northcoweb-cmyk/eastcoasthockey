/* Subtle scroll-linked detail in the hero: a stick in the lower-left corner taps a puck along the ice line.
   Driven only by scroll position; no pinning, no effect on the hero copy. */
(function(){
  var hero=document.getElementById('top'),svg=document.getElementById('heroScene');
  if(!hero||!svg)return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches){svg.style.display='none';return;}
  var header=document.getElementById('header');
  var $=function(id){return document.getElementById(id);};
  var gStick=$('hsStick'),gPuck=$('hsPuck'),gShadow=$('hsShadow'),gTrail=$('hsTrail'),ice=$('hsIce');
  var W=0,H=0,k=1,y0=0,heel0=0,puckX=0,hdr=72,ticking=false,last=-1;

  function clamp(v,a,b){return v<a?a:v>b?b:v;}
  function lerp(a,b,t){return a+(b-a)*t;}
  function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function easeOut(t){return 1-Math.pow(1-t,3);}

  function layout(){
    hdr=header?header.offsetHeight:72;
    W=hero.clientWidth;H=hero.clientHeight;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    k=clamp(W/2400,.3,.56);
    var mq=hero.querySelector('.marquee');
    y0=Math.round(mq?mq.offsetTop+parseFloat(getComputedStyle(mq).paddingTop)-8:H*.82);
    heel0=W<700?W*.02:W*.075;
    puckX=heel0+(211+46)*k+W*.035;
    ice.setAttribute('d','M0,'+y0+' L'+W+','+y0);
    update(true);
  }

  function update(force){
    var r=hero.getBoundingClientRect();
    var p=clamp((hdr-r.top)/(hero.offsetHeight*.85),0,1);
    if(!force&&Math.abs(p-last)<.0005)return;
    last=p;
    svg.style.visibility=p>=1?'hidden':'visible';

    /* stick: slow lift and tap forward, then settle */
    var a=clamp(p/.38,0,1),b=clamp((p-.38)/.62,0,1);
    var swing=easeInOut(a),follow=easeOut(b);
    var hx=heel0+swing*W*.035+follow*W*.03;
    var hy=y0-Math.sin(swing*Math.PI)*H*.035*(1-follow);
    var th=lerp(-9,3,swing)-follow*7;
    gStick.setAttribute('transform','translate('+hx.toFixed(1)+','+hy.toFixed(1)+') rotate('+th.toFixed(2)+') scale('+k.toFixed(3)+')');

    /* puck: waits, then glides a short way and fades */
    var u=clamp((p-.34)/.66,0,1),e=easeOut(u);
    var px=puckX+e*W*.34,py=y0;
    gPuck.setAttribute('transform','translate('+px.toFixed(1)+','+py.toFixed(1)+') scale('+k.toFixed(3)+')');
    gPuck.style.opacity=(1-clamp((u-.55)/.45,0,1)).toFixed(2);
    gShadow.setAttribute('transform','translate('+px.toFixed(1)+','+(y0+3).toFixed(1)+') scale('+k.toFixed(3)+')');
    gShadow.style.opacity=(.9*(1-clamp((u-.55)/.45,0,1))).toFixed(2);
    var tl=Math.min(120*k*6,e*W*.34)*.5*(u>0&&u<1?1:0);
    gTrail.setAttribute('transform','translate('+px.toFixed(1)+','+py.toFixed(1)+') scale('+k.toFixed(3)+')');
    gTrail.style.opacity=(u>0?.55*(1-clamp((u-.55)/.45,0,1)):0).toFixed(2);
    var ln=gTrail.children;for(var i=0;i<ln.length;i++){ln[i].setAttribute('x1',(-tl/k*(1-i*.3)).toFixed(1));ln[i].setAttribute('x2','0');}
  }

  function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(function(){ticking=false;update();});}}
  window.addEventListener('scroll',onScroll,{passive:true});
  var rz;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(layout,120);});
  window.addEventListener('load',layout);
  layout();
})();
