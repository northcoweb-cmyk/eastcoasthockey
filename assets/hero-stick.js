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


  /* ---------- skate carve: a skate glides through the hero and leaves ice scratch marks behind ---------- */
  var NS='http://www.w3.org/2000/svg',marks=null;
  function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k2 in attrs)e.setAttribute(k2,attrs[k2]);if(parent)parent.appendChild(e);return e;}
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  function buildMarks(){
    if(marks)marks.root.remove();
    var root=el('g',{id:'hsMarks'});svg.insertBefore(root,$('hsShadow'));
    /* one long, gently S-shaped carve crossing the hero behind the copy */
    var d='M'+(-0.08*W)+','+(0.27*H)+' C'+(0.10*W)+','+(0.29*H)+' '+(0.22*W)+','+(0.53*H)+' '+(0.44*W)+','+(0.58*H)+
          ' S'+(0.78*W)+','+(0.50*H)+' '+(1.09*W)+','+(0.35*H);
    var main=el('path',{d:d,fill:'none'});            /* invisible guide the skate rides */
    root.appendChild(main);
    var R=rng(7),lines=[];
    function line(dy,a,b,w,op,col){
      var p=el('path',{d:d,fill:'none',stroke:col||'#6B7C8E','stroke-width':w,'stroke-opacity':op,'stroke-linecap':'butt',pathLength:1,transform:'translate(0,'+dy+')'},root);
      p.setAttribute('stroke-dasharray','0 3');lines.push({p:p,a:a,b:b});
    }
    /* soft scuffed band under the cut, then the cut itself, then fine overlapping scratches */
    var soft=el('path',{d:d,fill:'none',stroke:'#8A95A3','stroke-opacity':.16,'stroke-width':15*Math.max(.6,k*1.6),'stroke-linecap':'round',pathLength:1},root);soft.setAttribute('stroke-dasharray','0 3');lines.push({p:soft,a:0,b:1});
    var soft2=el('path',{d:d,fill:'none',stroke:'#7A8695','stroke-opacity':.24,'stroke-width':6*Math.max(.6,k*1.6),'stroke-linecap':'round',pathLength:1},root);soft2.setAttribute('stroke-dasharray','0 3');lines.push({p:soft2,a:0,b:1});
    line(0,0,1,2.8,.62,'#566272');
    for(var i=0;i<9;i++){
      var side=i%2?1:-1,a=R()*.28,b=.55+R()*.45;
      line(side*(1.5+R()*6.5),a,b,.7+R()*1.2,.3+R()*.34,'#5E6A79');
    }
    /* flecks of shaved ice that trail the blade */
    var flecks=[];for(var f=0;f<14;f++)flecks.push({e:el('circle',{r:.7+R()*1.7,fill:f%3?'#8FA3B8':'#FFFFFF','fill-opacity':0},root),dx:6+R()*46,dy:R()*16-4,ph:R()*6.28});
    /* the skate, drawn side-on with the blade on the ice line (0,0), toe to the right */
    var sk=el('g',{id:'hsSkate',opacity:0},root);
    var defs=el('defs',{},sk);
    var g1=el('linearGradient',{id:'skBlade',x1:0,y1:-10,x2:0,y2:0,gradientUnits:'userSpaceOnUse'},defs);
    el('stop',{offset:0,'stop-color':'#F4F7FB'},g1);el('stop',{offset:.5,'stop-color':'#B8C4D2'},g1);el('stop',{offset:1,'stop-color':'#7B8999'},g1);
    var g2=el('linearGradient',{id:'skBoot',x1:0,y1:-104,x2:0,y2:-26,gradientUnits:'userSpaceOnUse'},defs);
    el('stop',{offset:0,'stop-color':'#39404D'},g2);el('stop',{offset:.55,'stop-color':'#1B2029'},g2);el('stop',{offset:1,'stop-color':'#0D1016'},g2);
    el('ellipse',{cx:2,cy:1.5,rx:62,ry:2.6,fill:'#041634','fill-opacity':.16},sk);
    /* steel */
    el('path',{d:'M-47,0 L45,0 C55,0 61,-3 63,-11 L-51,-11 C-53,-6 -51,-2 -47,0 Z',fill:'url(#skBlade)'},sk);
    el('path',{d:'M-46,-.6 L45,-.6',stroke:'#fff','stroke-opacity':.85,'stroke-width':.8},sk);
    /* holder */
    el('path',{d:'M-51,-11 L63,-11 C61,-19 55,-25 47,-27 L-44,-27 C-50,-25 -53,-17 -51,-11 Z',fill:'#171B23'},sk);
    el('path',{d:'M-34,-14 L-8,-14 L-12,-23 L-36,-23 Z M2,-14 L34,-14 L28,-23 L-2,-23 Z',fill:'#0A0C11'},sk);
    el('path',{d:'M-50,-13 L62,-13',stroke:'#E00A1E','stroke-width':1.6,'stroke-opacity':.9},sk);
    /* boot */
    el('path',{d:'M-47,-27 L-45,-62 C-45,-86 -38,-97 -29,-103 L-6,-103 C1,-92 4,-79 15,-72 C35,-68 54,-57 63,-44 C68,-37 67,-30 59,-27 Z',fill:'url(#skBoot)'},sk);
    el('path',{d:'M-8,-103 C0,-92 4,-79 15,-72 L24,-74 C13,-82 8,-94 4,-104 Z',fill:'#E9EEF4'},sk);                    /* tongue */
    el('path',{d:'M-45,-62 L-33,-62 M-44,-78 L-30,-80',stroke:'#fff','stroke-opacity':.15,'stroke-width':1.4},sk);
    el('path',{d:'M34,-60 C48,-56 58,-50 63,-44 C67,-38 66,-31 59,-27 L40,-27 C46,-40 44,-52 34,-60 Z',fill:'#2C3340'},sk);      /* toe cap */
    el('path',{d:'M-47,-34 L-46,-48 C-30,-44 -12,-44 6,-48 L8,-34 Z',fill:'#E00A1E','fill-opacity':.92},sk);                      /* accent band */
    for(var L2=0;L2<5;L2++){var lx=2+L2*8.5,ly=-77+L2*5.2;el('path',{d:'M'+lx+','+ly+' l10,-9',stroke:'#fff','stroke-width':1.7,'stroke-linecap':'round','stroke-opacity':.92},sk);}
    el('path',{d:'M-44,-100 C-40,-92 -41,-80 -45,-66',stroke:'#fff','stroke-opacity':.18,'stroke-width':2.4,fill:'none'},sk);
    marks={root:root,main:main,len:main.getTotalLength(),lines:lines,flecks:flecks,sk:sk};
  }

  function easeS(t){return t*t*(3-2*t);}
  function updateMarks(p){
    if(!marks)return;
    var t=easeS(clamp(p/.42,0,1)),m=marks,ks=clamp(W/1500,.55,.95);
    var pt=m.main.getPointAtLength(t*m.len),pa=m.main.getPointAtLength(clamp(t*m.len-6,0,m.len)),pb=m.main.getPointAtLength(clamp(t*m.len+6,0,m.len));
    var ang=Math.atan2(pb.y-pa.y,pb.x-pa.x);
    m.sk.setAttribute('transform','translate('+pt.x.toFixed(1)+','+pt.y.toFixed(1)+') rotate('+(ang*180/Math.PI*0.6).toFixed(1)+') scale('+ks.toFixed(3)+')');
    m.sk.setAttribute('opacity',(t<=0.001||t>=0.999)?0:Math.min(1,t*14,(1-t)*14).toFixed(2));
    var lag=Math.max(0,t-.008);
    m.lines.forEach(function(l){
      var vis=clamp(Math.min(lag,l.b)-l.a,0,1);
      l.p.setAttribute('stroke-dasharray',vis<=0?'0 3':(l.a>0?'0 '+l.a.toFixed(4)+' '+vis.toFixed(4)+' 3':vis.toFixed(4)+' 3'));
    });
    var tx=Math.cos(ang),ty=Math.sin(ang),live=t>.004&&t<.985;
    m.flecks.forEach(function(f,i){
      var drift=(Math.sin(f.ph+t*38)+1)*.5;
      var x=pt.x-tx*f.dx*ks-ty*0+(-ty)*0,y=pt.y-ty*f.dx*ks-(f.dy+drift*10)*ks*.7;
      f.e.setAttribute('cx',x.toFixed(1));f.e.setAttribute('cy',y.toFixed(1));
      f.e.setAttribute('fill-opacity',live?((1-i/16)*(.25+.45*drift)).toFixed(2):0);
    });
  }

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
    buildMarks();
    update(true);
  }

  function update(force){
    var r=hero.getBoundingClientRect();
    var p=clamp((hdr-r.top)/(hero.offsetHeight*.85),0,1);
    if(!force&&Math.abs(p-last)<.0005)return;
    last=p;
    svg.style.visibility=p>=1.0?'hidden':'visible';
    updateMarks(p);

    /* stick: slow lift and tap forward, then settle */
    var a=clamp(p/.2,0,1),b=clamp((p-.2)/.5,0,1);
    var swing=easeInOut(a),follow=easeOut(b);
    var hx=heel0+swing*W*.035+follow*W*.03;
    var hy=y0-Math.sin(swing*Math.PI)*H*.035*(1-follow);
    var th=lerp(-9,3,swing)-follow*7;
    gStick.setAttribute('transform','translate('+hx.toFixed(1)+','+hy.toFixed(1)+') rotate('+th.toFixed(2)+') scale('+k.toFixed(3)+')');

    /* puck: waits for the tap, then is passed along the ice and off the right edge */
    var u=clamp((p-.17)/.43,0,1),e=1-Math.pow(1-u,1.5);
    var exitX=W+90*k+40,px=puckX+e*(exitX-puckX),py=y0-Math.sin(u*Math.PI)*5*k;
    var out=u>0&&u<1?1:0;
    gPuck.setAttribute('transform','translate('+px.toFixed(1)+','+py.toFixed(1)+') scale('+k.toFixed(3)+')');
    gShadow.setAttribute('transform','translate('+px.toFixed(1)+','+(y0+3).toFixed(1)+') scale('+k.toFixed(3)+')');
    gShadow.style.opacity=(u<1?.9:0).toFixed(2);
    gTrail.setAttribute('transform','translate('+px.toFixed(1)+','+py.toFixed(1)+') scale('+k.toFixed(3)+')');
    gTrail.style.opacity=(out*.5).toFixed(2);
    var tl=Math.min(260,e*W*.6/k)*.5,ln=gTrail.children;
    for(var i=0;i<ln.length;i++){ln[i].setAttribute('x1',(-tl*(1-i*.3)).toFixed(1));ln[i].setAttribute('x2','0');}
  }

  function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(function(){ticking=false;update();});}}
  window.addEventListener('scroll',onScroll,{passive:true});
  var rz;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(layout,120);});
  window.addEventListener('load',layout);
  layout();
})();
