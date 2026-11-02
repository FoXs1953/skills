/* =====================================================================
   videocreation · lib.js — общая библиотека анимации и персонажей
   Подключается build_page.py перед main.js проекта. Всё детерминировано:
   кадр = функция времени t (секунды), никакого requestAnimationFrame.

   АНИМАЦИЯ (вызываются внутри render(t)):
     P(t,start,dur,ease)        прогресс 0..1 с easing (по умолчанию outQuint)
     bell(t,a,b,c)              «колокол» 0→1→0 (вспышки, подпрыгивания)
     H(el,{x,y,s,r,o,b})        transform/opacity/blur для HTML-элемента
     S(el,{x,y,s,r,o})          transform/opacity для SVG-группы
     pop(el,t,tin,tout,{dx,dy,s0,d})   «поп» объекта (outBack 0.34 с)
     slam(el,t,tin,tout,{st,sc,d})     слова влетают по одному (масштаб 1.55→1 + blur)
     scene(id,t,tin,tout,inT,outT,ox,oy)  показ сцены; переходы in: zoom|whip|cut|up,
                                          out: zoom|whip|down|none (0.24–0.28 с)
     sc(...)                    то же + медленный наезд камеры 3.5 % за сцену
     shakeCam(t,IMP)            тряска камеры по списку ударов [[t,px],...]
     flashAt(t,[[t,сила],...])  белая вспышка на больших поворотах
     badgeAnim(id,t,tin,tout)   бейдж серии в углу; speedo(t,v,vmax) — спидометр-HUD
     buildWords()               размечает [data-t] в слова; *слово* → градиент data-g
     blink(t,i)                 моргание персонажей; fmt(n) — пробелы в тысячах
     Ease.{outQuint,outBack,outExpo,inCubic,inOutCubic,spring,...}

   ПЕРСОНАЖИ И ОБЪЕКТЫ (возвращают SVG-строку для innerHTML; *Set — анимация):
     bud(id)
     budSet(id,{x=0,y=0,s=1,sx=1,sy=1,r=0,o=1,mouth='S',lid=0,lx=0,ly=0,aL=0,aR=0,msy=1})
     mini(id)
     miniSet(id,{x=0,y=0,s=1,sx=1,sy=1,o=1,eye=1,r=0})
     aroma(id)
     drop(id)
     blobPath(r0,amp,k,sx=1.12,sy=.92)
     gul(id)
     bact(id,c1='#8EDB5E',c2='#4E9E36')
     planeSVG()
     plate(id)
     steakPlate(id,s=1)
     fishPlate(id,s=1)
     omelet(id)
     pax(id,skin,hair,seat)
     paxSet(id,{x,y,s=1,o=1,sick=0,t=0,k=0})
     pilot(id,skin)
     engine(id)
     sugar(id)
     tomato(id)
     juice(id)
     salt(id)
     chili(id)
     star(id,c)
     cloudSVG(w,op=1)
     cloudG(x,y,s,op)
     cabin(pre)
     victor(id,skin='#E8B796')
     victorSet(id,{evil=0,angry=0,red=0,grin=0}={})
     boss(id)
     cop(id)
     silhouette(id,fill='#1A1D2B')
     bag(id)
     cash(id)
     flame(id,s=1)
     jet(id)
     gold(id)
     car(id,police=false)
     runner(id)
     guard(id,skin='#E8B796')
     anna(id)
     annaSet(id,{grin=0,raise=0}={})
     swat(id)
     caped(id)
     bun(id,s=1)
     boardSVG(id,x,y,w,h,lines)

   ДАННЫЕ: R (общий стор), SKIN, HAIR (палитры), rnd() — детерминированный random.
   Требует defs.svg (градиенты gBud, gVest, gGold, ...) в странице.
   ===================================================================== */
const VW=window.VW||1920, VH=window.VH||1080;   // размер кадра (build_page.py --size)
// ============ helpers ============
const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
const Ease={
  lin:t=>t,
  outCubic:t=>1-Math.pow(1-t,3),
  inCubic:t=>t*t*t,
  inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  outQuint:t=>1-Math.pow(1-t,5),
  outExpo:t=>t>=1?1:1-Math.pow(2,-10*t),
  inExpo:t=>t<=0?0:Math.pow(2,10*t-10),
  outBack:t=>{const c1=1.7,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
  spring:t=>t<=0?0:t>=1?1:1-Math.exp(-7*t)*Math.cos(13*t),
};
const P=(t,s,d,e=Ease.outQuint)=>e(clamp((t-s)/d));
function bell(t,a,b,c){if(t<=a||t>=c)return 0;return t<b?Ease.outCubic((t-a)/(b-a)):1-Ease.inOutCubic((t-b)/(c-b));}
function H(el,{x=0,y=0,s=1,sx,sy,r=0,o=1,b=0}={}){
  o=clamp(o);el.style.opacity=o.toFixed(3);el.style.visibility=o<=0.002?'hidden':'visible';
  el.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${(sx??s).toFixed(4)},${(sy??s).toFixed(4)})`;
  el.style.filter=b>0.3?`blur(${b.toFixed(2)}px)`:'none';
}
function S(el,{x=0,y=0,s=1,sx,sy,r=0,o=1}={}){
  el.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${r.toFixed(3)}) scale(${(sx??s).toFixed(4)} ${(sy??s).toFixed(4)})`);
  el.setAttribute('opacity',clamp(o).toFixed(3));
}
// snappy pop for an HTML element
function pop(el,t,tin,tout=1e9,o={}){
  const d=o.d??.34,pi=clamp((t-tin)/d),po=clamp((t-tout)/(o.dout??.2));
  const e=Ease.outBack(pi),op=clamp(pi*4)*(1-po);
  H(el,{x:(o.x??0)+(o.dx??0)*(1-Ease.outExpo(pi)),y:(o.y??0)+(o.dy??30)*(1-Ease.outExpo(pi))-po*20,s:lerp(o.s0??.55,1,e)*lerp(1,.92,po),o:op,b:po*10});
  return op;
}
// word slam for [data-t] text
function slam(el,t,tin,tout=1e9,o={}){
  const st=o.st??.07,d=o.d??.3,sc=o.sc??1.55,dout=o.dout??.18;let vis=false;
  el._w.forEach((w,i)=>{
    const p=clamp((t-tin-i*st)/d),po=clamp((t-tout-i*.02)/dout);
    const op=clamp(p*5)*(1-po);if(op>0.002)vis=true;
    const s=lerp(sc,1,Ease.outBack(p))*lerp(1,.9,po);
    w.style.opacity=op.toFixed(3);
    w.style.transform=`translateY(${(-po*24).toFixed(2)}px) scale(${s.toFixed(4)})`;
    const b=(1-Ease.outExpo(p))*10+po*10;w.style.filter=b>0.3?`blur(${b.toFixed(2)}px)`:'none';
  });
  el.style.visibility=vis?'visible':'hidden';
}
// scene transitions: zoom / whipL (enter from right, exit to left) / cut
function scene(id,t,tin,tout,inT='zoom',outT='zoom',ox=VW/2,oy=VH/2){
  const el=$(id);
  if(t<tin-0.001||t>tout+0.3){el.style.display='none';return false;}
  el.style.display='block';
  const din=.28,dout=.24;
  const pi=tin<=0?1:Ease.outExpo(clamp((t-tin)/din)),po=Ease.inCubic(clamp((t-tout)/dout));
  let x=0,s=1,b=0,o=1;
  if(inT==='zoom'){s*=lerp(.78,1,pi);b+=(1-pi)*16;o*=clamp(pi*3);}
  if(inT==='whip'){x+=(1-pi)*VW*.68;b+=(1-pi)*30;o*=clamp(pi*4);}
  if(inT==='cut'){}
  if(inT==='up'){s*=lerp(1.25,1,pi);b+=(1-pi)*14;o*=clamp(pi*3);}
  if(outT==='zoom'){s*=lerp(1,1.45,po);b+=po*18;o*=1-po;}
  if(outT==='whip'){x-=po*VW*.68;b+=po*30;o*=1-po*.6;}
  if(outT==='down'){s*=lerp(1,.8,po);b+=po*14;o*=1-po;}
  el.style.transformOrigin=`${ox}px ${oy}px`;
  el.style.opacity=o.toFixed(3);
  el.style.transform=`translateX(${x.toFixed(1)}px) scale(${s.toFixed(4)})`;
  el.style.filter=b>0.4?`blur(${b.toFixed(1)}px)`:'none';
  return true;
}
function hx(h){h=h.replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
function blink(t,i){const b=((t+i*.37)%3.1);return b<.14?Math.max(.08,Math.abs(b-.07)/.07):1;}
function buildWords(){document.querySelectorAll('[data-t]').forEach(el=>{
  const g=el.dataset.g||'gp';
  el.innerHTML=el.dataset.t.split('|').map(line=>line.split(' ').map(w=>{let cls='w';const m=w.match(/^\*(.+)\*$/);if(m){w=m[1];cls+=' '+g;}return `<span class="${cls}">${w}</span>`;}).join(' ')).join('<br>');
  el._w=[...el.querySelectorAll('.w')];});}

// ============ character builders ============
function bud(id){return `<g id="${id}"><g id="${id}-in">
<ellipse cx="0" cy="2" rx="72" ry="10" fill="rgba(110,20,60,.16)"/>
<g transform="translate(-100,-214)">
<clipPath id="${id}-cl"><ellipse cx="72" cy="118" rx="21" ry="25"/></clipPath>
<clipPath id="${id}-cr"><ellipse cx="128" cy="118" rx="21" ry="25"/></clipPath>
<line id="${id}-aL" x1="34" y1="150" x2="6" y2="184" stroke="#EC3D7A" stroke-width="15" stroke-linecap="round"/>
<line id="${id}-aR" x1="166" y1="150" x2="194" y2="184" stroke="#EC3D7A" stroke-width="15" stroke-linecap="round"/>
<path d="M100 22 C152 22 184 72 184 132 C184 190 148 214 100 214 C52 214 16 190 16 132 C16 72 48 22 100 22Z" fill="url(#gBud)"/>
<ellipse cx="66" cy="60" rx="30" ry="12" fill="#fff" opacity=".55" transform="rotate(-28 66 60)"/>
<ellipse cx="48" cy="154" rx="15" ry="8.5" fill="#FF2E6E" opacity=".3"/>
<ellipse cx="152" cy="154" rx="15" ry="8.5" fill="#FF2E6E" opacity=".3"/>
<g clip-path="url(#${id}-cl)"><ellipse cx="72" cy="118" rx="21" ry="25" fill="#fff"/><g id="${id}-pl"><circle cx="74" cy="122" r="12" fill="#1B1530"/><circle cx="78.5" cy="116.5" r="4.6" fill="#fff"/></g><rect id="${id}-ll" x="46" y="88" width="52" height="0" fill="#FF86AE"/></g>
<g clip-path="url(#${id}-cr)"><ellipse cx="128" cy="118" rx="21" ry="25" fill="#fff"/><g id="${id}-pr"><circle cx="130" cy="122" r="12" fill="#1B1530"/><circle cx="134.5" cy="116.5" r="4.6" fill="#fff"/></g><rect id="${id}-lr" x="102" y="88" width="52" height="0" fill="#FF86AE"/></g>
<path id="${id}-mS" d="M84 160 Q100 175 116 160" stroke="#1B1530" stroke-width="6.5" fill="none" stroke-linecap="round"/>
<path id="${id}-mF" d="M88 166 Q100 162 112 166" stroke="#1B1530" stroke-width="6.5" fill="none" stroke-linecap="round" opacity="0"/>
<ellipse id="${id}-mO" cx="100" cy="166" rx="10" ry="13" fill="#1B1530" opacity="0"/>
<g id="${id}-mH" opacity="0"><path d="M80 154 Q100 192 120 154 Z" fill="#1B1530" stroke="#1B1530" stroke-width="4" stroke-linejoin="round"/><path d="M90 172 Q100 184 110 172 Q100 165 90 172Z" fill="#FF5C8A"/></g>
</g></g></g>`;}
function budSet(id,{x=0,y=0,s=1,sx=1,sy=1,r=0,o=1,mouth='S',lid=0,lx=0,ly=0,aL=0,aR=0,msy=1}){
  const g=$(id);if(s<=0.001||o<=0.001){g.setAttribute('opacity',0);return;}
  S(g,{x,y,s,r,o});$(id+'-in').setAttribute('transform',`scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
  ['S','F','O','H'].forEach(m=>$(id+'-m'+m).setAttribute('opacity',m===mouth?1:0));
  $(id+'-mO').setAttribute('ry',(13*msy).toFixed(2));
  $(id+'-ll').setAttribute('height',(lid*56).toFixed(2));$(id+'-lr').setAttribute('height',(lid*56).toFixed(2));
  $(id+'-pl').setAttribute('transform',`translate(${lx} ${ly})`);$(id+'-pr').setAttribute('transform',`translate(${lx} ${ly})`);
  $(id+'-aL').setAttribute('transform',`rotate(${aL.toFixed(2)} 34 150)`);$(id+'-aR').setAttribute('transform',`rotate(${(-aR).toFixed(2)} 166 150)`);
}
function mini(id){return `<g id="${id}"><g id="${id}-in">
<ellipse cx="0" cy="2" rx="34" ry="5" fill="rgba(110,20,60,.15)"/>
<path d="M0 -96 C26 -96 42 -70 42 -42 C42 -12 24 0 0 0 C-24 0 -42 -12 -42 -42 C-42 -70 -26 -96 0 -96Z" fill="url(#gBud)"/>
<ellipse cx="-15" cy="-76" rx="12" ry="5" fill="#fff" opacity=".55" transform="rotate(-28 -15 -76)"/>
<g id="${id}-e"><ellipse cx="-13" cy="-50" rx="8.5" ry="10.5" fill="#fff"/><ellipse cx="13" cy="-50" rx="8.5" ry="10.5" fill="#fff"/><circle cx="-12" cy="-48" r="5.2" fill="#1B1530"/><circle cx="14" cy="-48" r="5.2" fill="#1B1530"/><circle cx="-10" cy="-51" r="1.8" fill="#fff"/><circle cx="16" cy="-51" r="1.8" fill="#fff"/></g>
<path d="M-6 -30 Q0 -25 6 -30" stroke="#1B1530" stroke-width="3" fill="none" stroke-linecap="round"/>
</g></g>`;}
function miniSet(id,{x=0,y=0,s=1,sx=1,sy=1,o=1,eye=1,r=0}){
  const g=$(id);if(s<=0.001){g.setAttribute('opacity',0);return;}
  S(g,{x,y,s,o,r});$(id+'-in').setAttribute('transform',`scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
  $(id+'-e').setAttribute('transform',`translate(0 -50) scale(1 ${Math.max(.08,eye).toFixed(3)}) translate(0 50)`);
}
function aroma(id){return `<g id="${id}"><circle r="42" fill="#FFC24A" opacity=".5" filter="url(#fB8)"/><circle r="24" fill="url(#gAroma)"/><ellipse cx="-8" cy="-11" rx="7" ry="4" fill="#fff" opacity=".65" transform="rotate(-30 -8 -11)"/><circle cx="-7" cy="0" r="3.3" fill="#6A3300"/><circle cx="7" cy="0" r="3.3" fill="#6A3300"/><path d="M-5 7 Q0 11 5 7" stroke="#6A3300" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;}
function drop(id){return `<g id="${id}"><g id="${id}-in">
<ellipse cx="0" cy="4" rx="92" ry="12" fill="rgba(20,60,140,.15)"/>
<path d="M0 -300 C0 -300 112 -165 112 -98 C112 -36 62 0 0 0 C-62 0 -112 -36 -112 -98 C-112 -165 0 -300 0 -300Z" fill="url(#gDrop)"/>
<path d="M-62 -140 C-56 -172 -38 -205 -16 -236" stroke="#fff" stroke-width="13" stroke-linecap="round" opacity=".55" fill="none"/>
<ellipse cx="-36" cy="-112" rx="17" ry="20" fill="#fff"/><ellipse cx="36" cy="-112" rx="17" ry="20" fill="#fff"/>
<circle cx="-34" cy="-108" r="9.5" fill="#10213F"/><circle cx="38" cy="-108" r="9.5" fill="#10213F"/><circle cx="-31" cy="-112" r="3.5" fill="#fff"/><circle cx="41" cy="-112" r="3.5" fill="#fff"/>
<g id="${id}-br" opacity="0"><path d="M-54 -138 L-22 -148" stroke="#10213F" stroke-width="6" stroke-linecap="round"/><path d="M54 -138 L22 -148" stroke="#10213F" stroke-width="6" stroke-linecap="round"/></g>
<path id="${id}-mS" d="M-16 -62 Q0 -50 16 -62" stroke="#10213F" stroke-width="6" fill="none" stroke-linecap="round"/>
<path id="${id}-mW" d="M-16 -56 Q0 -68 16 -56" stroke="#10213F" stroke-width="6" fill="none" stroke-linecap="round" opacity="0"/>
<ellipse cx="-64" cy="-80" rx="13" ry="7" fill="#FF7EA8" opacity=".35"/><ellipse cx="64" cy="-80" rx="13" ry="7" fill="#FF7EA8" opacity=".35"/>
<path id="${id}-sw" d="M86 -190 C86 -190 100 -170 100 -160 C100 -152 94 -147 86 -147 C78 -147 72 -152 72 -160 C72 -170 86 -190 86 -190Z" fill="#D6EEFF" stroke="#8CC8FF" stroke-width="3" opacity="0"/>
</g></g>`;}
function blobPath(r0,amp,k,sx=1.12,sy=.92){let pts=[];for(let i=0;i<=90;i++){const a=i/90*Math.PI*2;const r=r0+amp*Math.sin(a*k);pts.push([Math.cos(a)*r*sx,Math.sin(a)*r*sy]);}return 'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')+'Z';}
function gul(id){return `<g id="${id}"><g id="${id}-w" stroke="#8B97AF" stroke-width="10" fill="none" stroke-linecap="round">
<path d="M-168 -40 Q-188 0 -168 40"/><path d="M-200 -72 Q-236 0 -200 72"/><path d="M168 -40 Q188 0 168 40"/><path d="M200 -72 Q236 0 200 72"/></g>
<path d="${blobPath(118,8,9)}" fill="url(#gGul)"/>
<ellipse cx="-44" cy="-62" rx="42" ry="15" fill="#fff" opacity=".35" transform="rotate(-18 -44 -62)"/>
<ellipse cx="-38" cy="-6" rx="21" ry="23" fill="#fff"/><ellipse cx="38" cy="-6" rx="21" ry="23" fill="#fff"/>
<circle cx="-34" cy="0" r="10.5" fill="#1C2233"/><circle cx="42" cy="0" r="10.5" fill="#1C2233"/>
<path d="M-66 -42 L-18 -26" stroke="#1C2233" stroke-width="9" stroke-linecap="round"/><path d="M66 -42 L18 -26" stroke="#1C2233" stroke-width="9" stroke-linecap="round"/>
<path d="M-30 48 L-15 37 L0 48 L15 37 L30 48" stroke="#1C2233" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;}
function bact(id,c1='#8EDB5E',c2='#4E9E36'){let sp='';for(let k=0;k<10;k++){const a=k/10*Math.PI*2;sp+=`<line x1="${(Math.cos(a)*66).toFixed(1)}" y1="${(Math.sin(a)*58).toFixed(1)}" x2="${(Math.cos(a)*88).toFixed(1)}" y2="${(Math.sin(a)*78).toFixed(1)}" stroke="${c2}" stroke-width="8" stroke-linecap="round"/><circle cx="${(Math.cos(a)*90).toFixed(1)}" cy="${(Math.sin(a)*80).toFixed(1)}" r="8" fill="${c2}"/>`;}
return `<g id="${id}"><g id="${id}-in">${sp}<path d="${blobPath(66,5,7,1,.9)}" fill="${c1}" stroke="${c2}" stroke-width="6"/>
<ellipse cx="-22" cy="-24" rx="18" ry="9" fill="#fff" opacity=".45" transform="rotate(-25 -22 -24)"/>
<ellipse cx="-20" cy="-2" rx="15" ry="17" fill="#fff"/><ellipse cx="20" cy="-2" rx="15" ry="17" fill="#fff"/>
<circle cx="-16" cy="3" r="8" fill="#1C2A12"/><circle cx="24" cy="3" r="8" fill="#1C2A12"/>
<path d="M-40 -26 L-8 -14 M40 -26 L8 -14" stroke="#1C2A12" stroke-width="7" stroke-linecap="round"/>
<path d="M-20 32 L-10 24 L0 32 L10 24 L20 32" stroke="#1C2A12" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g></g>`;}
function planeSVG(){let w='';for(let k=0;k<18;k++)w+=`<rect x="${300+k*30}" y="178" width="16" height="22" rx="8" fill="url(#gWinD)"/>`;
return `<g><path d="M545 192 L652 108 C657 104 665 104 670 108 L690 120 L612 196Z" fill="#C3CEE0"/>
<path d="M178 170 L122 62 C119 55 123 50 131 50 L166 50 C174 50 179 53 183 59 L272 166Z" fill="url(#gFin)"/>
<path d="M140 168 C300 150 700 148 820 150 C905 152 955 180 958 205 C955 228 915 250 840 252 L262 252 C200 252 150 240 118 214 C108 200 112 180 140 168Z" fill="url(#gFus)"/>
<path d="M150 230 C380 238 700 238 950 216" stroke="#FF6F91" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>${w}
<path d="M884 168 C908 171 928 181 938 194 L896 194 C890 186 886 176 884 168Z" fill="url(#gWinD)"/>
<path d="M168 206 L96 246 C92 249 94 253 99 253 L134 253 L246 214Z" fill="#D2DBE9"/>
<path d="M470 222 L372 336 C369 340 372 344 377 344 L414 344 C420 344 425 342 429 338 L602 226Z" fill="#E6ECF4" stroke="#C3CEE0" stroke-width="2"/>
<rect x="418" y="250" width="126" height="46" rx="23" fill="url(#gEng)"/><ellipse cx="540" cy="273" rx="9" ry="21" fill="#3A4560"/></g>`;}
function plate(id){return `<g id="${id}">
<ellipse cx="0" cy="18" rx="272" ry="98" fill="rgba(40,50,90,.16)" filter="url(#fB8)"/>
<ellipse cx="0" cy="0" rx="262" ry="96" fill="#FFFFFF"/><ellipse cx="0" cy="3" rx="202" ry="70" fill="#EEF2F8"/>
<ellipse cx="-62" cy="-8" rx="88" ry="38" fill="#FFF3D6"/>
<g fill="#FFFDF6"><ellipse cx="-90" cy="-20" rx="9" ry="4"/><ellipse cx="-60" cy="-30" rx="9" ry="4" transform="rotate(20 -60 -30)"/><ellipse cx="-30" cy="-14" rx="9" ry="4"/><ellipse cx="-74" cy="2" rx="9" ry="4" transform="rotate(-15 -74 2)"/></g>
<path d="M20 -36 C70 -52 130 -40 140 -14 C148 8 110 22 64 20 C26 18 4 4 6 -12 C8 -22 12 -32 20 -36Z" fill="url(#gMeat)"/>
<path d="M40 -26 L70 6 M66 -36 L98 0 M94 -36 L122 -6" stroke="#8F4A20" stroke-width="5" stroke-linecap="round" opacity=".5"/>
<g><circle cx="-12" cy="30" r="20" fill="#4FAE5C"/><circle cx="12" cy="22" r="22" fill="#5DBE69"/><circle cx="34" cy="36" r="18" fill="#47A353"/><circle cx="6" cy="42" r="16" fill="#58B864"/></g>
<circle cx="-150" cy="18" r="17" fill="url(#gTomato)"/><circle cx="-118" cy="40" r="14" fill="url(#gTomato)"/></g>`;}
function steakPlate(id,s=1){return `<g id="${id}"><g transform="scale(${s})">
<ellipse cx="0" cy="14" rx="200" ry="60" fill="rgba(0,0,0,.25)" filter="url(#fB8)"/>
<ellipse cx="0" cy="0" rx="190" ry="62" fill="#FFFFFF"/><ellipse cx="0" cy="2" rx="146" ry="44" fill="#EEF2F8"/>
<path d="M-90 -18 C-60 -48 50 -50 90 -24 C112 -8 92 22 40 24 C-20 26 -80 18 -98 4 C-104 -4 -98 -12 -90 -18Z" fill="url(#gSteak)"/>
<path d="M-60 -24 L-30 14 M-20 -34 L12 12 M24 -34 L56 6" stroke="#4A200C" stroke-width="7" stroke-linecap="round" opacity=".55"/>
<ellipse cx="-30" cy="-30" rx="26" ry="7" fill="#fff" opacity=".25"/>
<g><circle cx="120" cy="14" r="13" fill="#5DBE69"/><circle cx="132" cy="2" r="12" fill="#4FAE5C"/></g></g></g>`;}
function fishPlate(id,s=1){return `<g id="${id}"><g transform="scale(${s})">
<ellipse cx="0" cy="14" rx="200" ry="60" fill="rgba(0,0,0,.18)" filter="url(#fB8)"/>
<ellipse cx="0" cy="0" rx="190" ry="62" fill="#FFFFFF"/><ellipse cx="0" cy="2" rx="146" ry="44" fill="#EEF2F8"/>
<ellipse cx="-70" cy="0" rx="60" ry="26" fill="#FFF3D6"/>
<path d="M-10 -10 C30 -40 100 -36 120 -8 C100 16 30 20 -10 -6Z" fill="url(#gFish)"/>
<path d="M-10 -8 L-44 -32 L-40 -8 L-46 14Z" fill="#F4A27E"/>
<path d="M40 -26 L46 4 M70 -28 L76 6" stroke="#E07F58" stroke-width="5" stroke-linecap="round" opacity=".6"/>
<circle cx="100" cy="24" r="20" fill="#FFE45C" stroke="#F2C230" stroke-width="5"/></g></g>`;}
function omelet(id){return `<g id="${id}"><g id="${id}-in">
<ellipse cx="0" cy="20" rx="300" ry="70" fill="rgba(120,60,0,.22)" filter="url(#fB8)"/>
<ellipse cx="0" cy="8" rx="290" ry="74" fill="#FFFFFF"/><ellipse cx="0" cy="10" rx="230" ry="52" fill="#EEF2F8"/>
<path d="M-210 10 C-206 -130 -96 -186 0 -186 C96 -186 206 -130 210 10 C126 34 -126 34 -210 10Z" fill="url(#gOm)"/>
<path d="M-210 10 C-126 34 126 34 210 10" stroke="#E9A21E" stroke-width="8" fill="none" opacity=".55"/>
<ellipse cx="-96" cy="-136" rx="50" ry="17" fill="#fff" opacity=".5" transform="rotate(-20 -96 -136)"/>
<g fill="#FF8FA3"><rect x="-160" y="-54" width="54" height="32" rx="11" transform="rotate(-14 -133 -38)"/><rect x="104" y="-62" width="56" height="32" rx="11" transform="rotate(18 132 -46)"/><rect x="-36" y="-30" width="44" height="28" rx="10" transform="rotate(8 -14 -16)"/></g>
<g fill="#6BBF59"><circle cx="62" cy="-20" r="8"/><circle cx="-84" cy="-14" r="7"/><circle cx="160" cy="-16" r="7"/></g>
<g id="${id}-face">
<ellipse cx="-54" cy="-104" rx="30" ry="24" fill="#fff"/><ellipse cx="54" cy="-104" rx="30" ry="24" fill="#fff"/>
<g id="${id}-pu"><circle cx="-42" cy="-98" r="13" fill="#2A1A05"/><circle cx="66" cy="-98" r="13" fill="#2A1A05"/><circle cx="-38" cy="-102" r="4" fill="#fff"/><circle cx="70" cy="-102" r="4" fill="#fff"/></g>
<path d="M-88 -104 L-20 -102 L-20 -132 L-88 -132Z" fill="#FFD75A"/><path d="M20 -102 L88 -104 L88 -132 L20 -132Z" fill="#FFD75A"/>
<path d="M-88 -104 L-20 -102 M20 -102 L88 -104" stroke="#C98A10" stroke-width="5" stroke-linecap="round"/>
<path id="${id}-br" d="M-92 -142 L-26 -126 M92 -142 L26 -126" stroke="#7A4A06" stroke-width="10" stroke-linecap="round"/>
<path d="M-46 -56 Q10 -30 58 -70" stroke="#7A4A06" stroke-width="10" fill="none" stroke-linecap="round"/>
</g></g></g>`;}
function pax(id,skin,hair,seat){return `<g id="${id}"><g id="${id}-in">
<rect x="-46" y="-20" width="92" height="128" rx="28" fill="${seat}"/>
<rect x="-46" y="-20" width="92" height="26" rx="13" fill="#fff" opacity=".16"/>
<g id="${id}-h">
<circle r="36" fill="${skin}"/><circle id="${id}-g" r="36" fill="#95D86B" opacity="0"/>
<path d="M-36 -2 C-38 -32 -17 -47 2 -46 C24 -45 38 -30 36 -4 C27 -21 4 -28 -13 -19 C-21 -15 -30 -9 -36 -2Z" fill="${hair}"/>
<circle cx="-12" cy="5" r="5" fill="#1B1530"/><circle cx="12" cy="5" r="5" fill="#1B1530"/>
<path id="${id}-ms" d="M-10 17 Q0 25 10 17" stroke="#1B1530" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path id="${id}-mw" d="M-13 20 q4.3 -5 8.6 0 q4.3 5 8.6 0 q4.3 -5 8.6 0" stroke="#2F5B1E" stroke-width="4.5" fill="none" stroke-linecap="round" opacity="0"/>
<path id="${id}-sw" d="M32 -28 C32 -28 40 -17 40 -12 C40 -7 36 -4 32 -4 C28 -4 24 -7 24 -12 C24 -17 32 -28 32 -28Z" fill="#CFEBFF" stroke="#7CC4FF" stroke-width="2.5" opacity="0"/>
</g></g></g>`;}
function paxSet(id,{x,y,s=1,o=1,sick=0,t=0,k=0}){
  const g=$(id);if(s<=0.001||o<=0.001){g.setAttribute('opacity',0);return;}
  S(g,{x,y,s,o});
  $(id+'-g').setAttribute('opacity',(sick*.88).toFixed(3));
  const sk=sick>.45;$(id+'-ms').setAttribute('opacity',sk?0:1);$(id+'-mw').setAttribute('opacity',sk?1:0);$(id+'-sw').setAttribute('opacity',sick>.7?1:0);
  const wob=sick*(5*Math.sin(t*9+k)+0);
  $(id+'-h').setAttribute('transform',`translate(${(sick*3*Math.sin(t*7+k)).toFixed(2)} ${(sick*4).toFixed(2)}) rotate(${wob.toFixed(2)})`);
}
function pilot(id,skin){return `<g id="${id}"><g id="${id}-in">
<path d="M-120 330 C-120 170 -70 120 0 120 C70 120 120 170 120 330Z" fill="#1E2C55"/>
<path d="M-30 122 L0 176 L30 122Z" fill="#fff"/><path d="M-8 150 L8 150 L11 220 L0 234 L-11 220Z" fill="#132042"/>
<rect x="-112" y="168" width="58" height="12" rx="6" fill="#F2C14E" transform="rotate(-24 -83 174)"/><rect x="54" y="168" width="58" height="12" rx="6" fill="#F2C14E" transform="rotate(24 83 174)"/>
<rect x="-14" y="96" width="28" height="30" rx="8" fill="${skin}"/>
<g id="${id}-hd"><circle cy="20" r="80" fill="${skin}"/>
<ellipse cx="-56" cy="46" rx="15" ry="9" fill="#FF8A8A" opacity=".35"/><ellipse cx="56" cy="46" rx="15" ry="9" fill="#FF8A8A" opacity=".35"/>
<ellipse cx="-27" cy="22" rx="9" ry="12" fill="#1B1530"/><ellipse cx="27" cy="22" rx="9" ry="12" fill="#1B1530"/><circle cx="-24" cy="18" r="3.5" fill="#fff"/><circle cx="30" cy="18" r="3.5" fill="#fff"/>
<path id="${id}-m" d="M-24 56 Q0 80 24 56 Z" fill="#1B1530"/>
<path d="M-92 -12 C-92 -76 -46 -100 0 -100 C46 -100 92 -76 92 -12Z" fill="#1E2C55"/>
<path d="M-98 -12 L98 -12 L84 10 L-84 10Z" fill="#0F1733"/>
<rect x="-90" y="-28" width="180" height="16" fill="#F2C14E"/>
<circle cy="-56" r="15" fill="#F2C14E"/><path d="M-10 -56 L10 -56 M0 -66 L0 -46" stroke="#1E2C55" stroke-width="4"/>
</g></g></g>`;}
function engine(id){let b='';for(let k=0;k<12;k++)b+=`<path d="M0 0 C30 -40 64 -112 44 -152 L14 -154 C20 -104 8 -42 0 0Z" fill="${k%2?'#56627D':'#4A5672'}" transform="rotate(${k*30})"/>`;
return `<g id="${id}"><circle r="196" fill="url(#gEng)"/><circle r="196" fill="none" stroke="#fff" stroke-width="6" opacity=".7"/><circle r="164" fill="#232B3F"/>
<g id="${id}-fan">${b}<circle r="48" fill="#EEF2F8"/><path d="M0 -48 A48 48 0 0 1 34 34" stroke="#9AA6BC" stroke-width="7" fill="none" stroke-linecap="round"/></g>
<circle r="164" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="10"/></g>`;}
function sugar(id){return `<g id="${id}"><g id="${id}-in">
<ellipse cx="0" cy="6" rx="96" ry="13" fill="rgba(40,50,90,.15)"/>
<g stroke-linejoin="round" stroke-width="16">
<path d="M-86 -150 L0 -110 L0 0 L-86 -40Z" fill="#E6ECF4" stroke="#E6ECF4"/>
<path d="M86 -150 L0 -110 L0 0 L86 -40Z" fill="#D0D9E7" stroke="#D0D9E7"/>
<path d="M0 -190 L86 -150 L0 -110 L-86 -150Z" fill="#FFFFFF" stroke="#FFFFFF"/></g>
<g fill="#fff" opacity=".9"><circle cx="-50" cy="-80" r="4"/><circle cx="-30" cy="-50" r="3"/><circle cx="40" cy="-70" r="3.5"/><circle cx="56" cy="-100" r="3"/></g>
<path id="${id}-sp" d="M62 -228 L68 -210 L86 -204 L68 -198 L62 -180 L56 -198 L38 -204 L56 -210Z" fill="#FFD34D"/>
</g></g>`;}
function tomato(id){return `<g id="${id}"><circle id="${id}-glow" cx="0" cy="-96" r="150" fill="#FF6A4D" opacity="0" filter="url(#fB24)"/><g id="${id}-in">
<ellipse cx="0" cy="5" rx="88" ry="12" fill="rgba(40,50,90,.15)"/>
<path d="M0 -180 C70 -186 108 -130 104 -86 C100 -34 56 0 0 0 C-56 0 -100 -34 -104 -86 C-108 -130 -70 -186 0 -180Z" fill="url(#gTomato)"/>
<ellipse cx="-42" cy="-130" rx="22" ry="12" fill="#fff" opacity=".45" transform="rotate(-30 -42 -130)"/>
<path d="M0 -176 L-34 -196 L-12 -170 L-44 -158 L-8 -162 L-14 -134 L4 -160 L30 -140 L18 -168 L46 -178 L12 -180 L8 -204 Z" fill="#3FA34D" stroke="#3FA34D" stroke-width="4" stroke-linejoin="round"/>
<path d="M4 -182 C6 -198 12 -208 20 -214" stroke="#2F7D3A" stroke-width="7" fill="none" stroke-linecap="round"/>
</g></g>`;}
function juice(id){return `<g id="${id}">
<ellipse cx="0" cy="5" rx="62" ry="9" fill="rgba(40,50,90,.15)"/>
<path d="M14 -330 L-6 -150" stroke="#2F7BFF" stroke-width="13" stroke-linecap="round"/>
<path d="M-51 -200 L51 -200 L44 -10 L-44 -10Z" fill="url(#gJuice)"/>
<path d="M-51 -200 Q0 -190 51 -200" stroke="#FF8A7A" stroke-width="4" fill="none"/>
<path d="M-58 -252 L58 -252 L46 -6 C45 -2 42 0 38 0 L-38 0 C-42 0 -45 -2 -46 -6Z" fill="#fff" fill-opacity=".28" stroke="#fff" stroke-width="4"/>
<path d="M-40 -232 L-31 -30" stroke="#fff" stroke-width="9" opacity=".6" stroke-linecap="round"/>
<g transform="translate(46 -262)"><circle r="26" fill="url(#gTomato)"/><path d="M-30 0 L30 0" stroke="#fff" stroke-width="3" opacity=".0"/></g>
</g>`;}
function salt(id){return `<g id="${id}">
<rect x="-62" y="-78" width="124" height="190" rx="40" fill="#fff" fill-opacity=".92" stroke="#AEB9CC" stroke-width="5"/>
<rect x="-52" y="12" width="104" height="92" rx="30" fill="#EEF2F8"/>
<path d="M-62 -76 C-62 -120 -40 -140 0 -140 C40 -140 62 -120 62 -76Z" fill="url(#gCap)"/>
<g fill="#4F586C"><circle cx="-20" cy="-110" r="5"/><circle cx="0" cy="-120" r="5"/><circle cx="20" cy="-110" r="5"/><circle cx="-10" cy="-94" r="5"/><circle cx="10" cy="-94" r="5"/></g>
<path d="M-40 -60 L-40 80" stroke="#fff" stroke-width="10" opacity=".8" stroke-linecap="round"/></g>`;}
function chili(id){return `<g id="${id}">
<path d="M-90 -10 C-40 -42 40 -38 82 -2 C98 12 94 30 78 26 C42 10 -20 10 -70 30 C-96 40 -112 6 -90 -10Z" fill="#E8352B"/>
<path d="M-60 -16 C-20 -32 30 -30 62 -10" stroke="#FF8F80" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/>
<path d="M-92 -8 C-104 -20 -110 -36 -100 -48" stroke="#3FA34D" stroke-width="10" fill="none" stroke-linecap="round"/><ellipse cx="-90" cy="-8" rx="15" ry="11" fill="#3FA34D"/></g>`;}
function star(id,c){return `<path id="${id}" d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6Z" fill="${c}"/>`;}
function cloudSVG(w,op=1){return `<svg viewBox="0 0 420 200" width="${w}" height="${(w*200/420).toFixed(1)}" style="overflow:visible;display:block;opacity:${op}"><g><ellipse cx="210" cy="148" rx="200" ry="46" fill="#fff"/><circle cx="130" cy="116" r="62" fill="#fff"/><circle cx="215" cy="90" r="80" fill="#fff"/><circle cx="302" cy="120" r="58" fill="#fff"/></g></svg>`;}
function cloudG(x,y,s,op){return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}"><ellipse cx="210" cy="148" rx="200" ry="46" fill="#fff"/><circle cx="130" cy="116" r="62" fill="#fff"/><circle cx="215" cy="90" r="80" fill="#fff"/><circle cx="302" cy="120" r="58" fill="#fff"/></g>`;}


const R={};
const SKIN=['#F6D2B8','#E8B796','#C98E6B','#F1C9A5','#DDA683','#F3D7C3'];
const HAIR=['#2B1D14','#5A3A22','#8A5A33','#1C1C24','#C9A15E','#6B4630','#3A2A20'];
function cabin(pre){
  let w='';for(let k=0;k<10;k++)w+=`<rect x="${210+k*156}" y="350" width="64" height="88" rx="32" fill="url(#gWin)" stroke="#C9D2E0" stroke-width="5"/>`;
  let p='';const list=[];const rows=[[560,.82,'#3A5AA8'],[720,.93,'#3354A0'],[905,1.06,'#2C4A92']];
  rows.forEach(([y,s,seat],r)=>{for(let c=0;c<10;c++){const id=`${pre}p${r}_${c}`;const x=255+c*157+(r===1?40:r===2?-6:20);
    p+=pax(id,SKIN[(r*3+c*5)%SKIN.length],HAIR[(r*5+c*3)%HAIR.length],seat);list.push({id,x,y,s,r,c});}});
  R[pre]=list;
  return `<rect x="80" y="300" width="1760" height="760" rx="120" fill="#E3E9F4"/>
  <rect x="80" y="300" width="1760" height="760" rx="120" fill="none" stroke="#fff" stroke-width="6" opacity=".7"/>
  <rect x="80" y="470" width="1760" height="12" fill="#CBD4E4"/>${w}${p}`;
}

// ================= builders =================
function victor(id,skin='#E8B796'){
  let st='';for(let i=0;i<22;i++){const a=Math.PI*(.12+.76*i/21);st+=`<circle cx="${(Math.cos(a)*62).toFixed(1)}" cy="${(20+Math.sin(a)*66).toFixed(1)}" r="2.6"/>`;}
  return `<g id="${id}"><g id="${id}-in">
<path d="M-125 330 C-125 170 -75 118 0 118 C75 118 125 170 125 330Z" fill="#3B4A63"/>
<path d="M-118 330 L-118 196 C-104 152 -62 130 -30 124 L-18 330Z" fill="url(#gVest)"/><path d="M118 330 L118 196 C104 152 62 130 30 124 L18 330Z" fill="url(#gVest)"/>
<rect x="-118" y="236" width="100" height="18" fill="#EAF56E"/><rect x="18" y="236" width="100" height="18" fill="#EAF56E"/>
<rect x="-118" y="280" width="100" height="18" fill="#EAF56E"/><rect x="18" y="280" width="100" height="18" fill="#EAF56E"/>
<rect x="-15" y="96" width="30" height="32" rx="8" fill="${skin}"/>
<g id="${id}-hd"><circle cy="20" r="80" fill="${skin}"/>
<g fill="#5A3A26" opacity=".35">${st}</g>
<ellipse cx="-56" cy="44" rx="15" ry="9" fill="#FF8A8A" opacity=".3"/><ellipse cx="56" cy="44" rx="15" ry="9" fill="#FF8A8A" opacity=".3"/>
<g id="${id}-eN"><ellipse cx="-27" cy="20" rx="9" ry="12" fill="#1B1530"/><ellipse cx="27" cy="20" rx="9" ry="12" fill="#1B1530"/><circle cx="-24" cy="16" r="3.5" fill="#fff"/><circle cx="30" cy="16" r="3.5" fill="#fff"/></g>
<g id="${id}-eR" opacity="0"><ellipse cx="-27" cy="20" rx="20" ry="14" fill="#FF2E2E" opacity=".35"/><ellipse cx="27" cy="20" rx="20" ry="14" fill="#FF2E2E" opacity=".35"/><ellipse cx="-27" cy="20" rx="11" ry="9" fill="#FF2E2E"/><ellipse cx="27" cy="20" rx="11" ry="9" fill="#FF2E2E"/><circle cx="-27" cy="20" r="3.5" fill="#FFE0E0"/><circle cx="27" cy="20" r="3.5" fill="#FFE0E0"/></g>
<path id="${id}-bN" d="M-46 -8 L-12 -6 M12 -6 L46 -8" stroke="#3A2518" stroke-width="9" stroke-linecap="round"/>
<path id="${id}-bA" d="M-50 -16 L-10 4 M10 4 L50 -16" stroke="#3A2518" stroke-width="11" stroke-linecap="round" opacity="0"/>
<path id="${id}-mN" d="M-20 60 Q0 64 20 60" stroke="#1B1530" stroke-width="6" fill="none" stroke-linecap="round"/>
<path id="${id}-mA" d="M-24 66 Q0 52 24 66" stroke="#1B1530" stroke-width="7" fill="none" stroke-linecap="round" opacity="0"/>
<g id="${id}-mE" opacity="0"><path d="M-38 48 Q0 92 38 48 Q0 62 -38 48Z" fill="#1B1530"/><path d="M-30 52 Q0 64 30 52 L28 58 Q0 70 -28 58Z" fill="#fff"/></g>
<path d="M-90 -16 C-90 -88 -48 -112 0 -112 C48 -112 90 -88 90 -16Z" fill="url(#gHat)"/>
<path d="M-12 -110 L12 -110 L9 -18 L-9 -18Z" fill="#FFD07A" opacity=".8"/>
<rect x="-106" y="-24" width="212" height="20" rx="10" fill="#E8700F"/>
<ellipse cx="-44" cy="-74" rx="22" ry="9" fill="#fff" opacity=".35" transform="rotate(-25 -44 -74)"/>
</g></g></g>`;}
function victorSet(id,{evil=0,angry=0,red=0,grin=0}={}){
  $(id+'-eR').setAttribute('opacity',red.toFixed(3));$(id+'-eN').setAttribute('opacity',(1-red).toFixed(3));
  const a=Math.max(angry,evil);$(id+'-bA').setAttribute('opacity',a>.5?1:0);$(id+'-bN').setAttribute('opacity',a>.5?0:1);
  $(id+'-mE').setAttribute('opacity',grin>.5?1:0);$(id+'-mA').setAttribute('opacity',grin<=.5&&angry>.5?1:0);$(id+'-mN').setAttribute('opacity',grin<=.5&&angry<=.5?1:0);
}
function boss(id){return `<g id="${id}"><g id="${id}-in">
<path d="M-125 330 C-125 170 -75 118 0 118 C75 118 125 170 125 330Z" fill="#5B6478"/>
<path d="M-36 120 L0 200 L36 120Z" fill="#fff"/><path d="M-9 136 L9 136 L13 220 L0 238 L-13 220Z" fill="#D7263D"/>
<rect x="-15" y="96" width="30" height="32" rx="8" fill="#F3C9A8"/>
<circle cy="20" r="80" fill="#F3C9A8"/>
<path d="M-80 24 C-82 -10 -70 -24 -60 -26 L-58 10Z M80 24 C82 -10 70 -24 60 -26 L58 10Z" fill="#8A7A6A"/>
<ellipse cx="-30" cy="-34" rx="26" ry="10" fill="#fff" opacity=".35" transform="rotate(-20 -30 -34)"/>
<g fill="none" stroke="#1B1530" stroke-width="5"><circle cx="-28" cy="18" r="20"/><circle cx="28" cy="18" r="20"/><path d="M-8 16 L8 16"/></g>
<circle cx="-28" cy="18" r="6" fill="#1B1530"/><circle cx="28" cy="18" r="6" fill="#1B1530"/>
<ellipse cx="0" cy="62" rx="12" ry="9" fill="#1B1530"/>
<g transform="translate(60 210)"><rect x="-34" y="-50" width="68" height="80" rx="12" fill="#fff" stroke="#C9D2E0" stroke-width="5"/><path d="M34 -30 C62 -30 62 10 34 10" stroke="#C9D2E0" stroke-width="10" fill="none"/>
<path d="M-12 -60 C-24 -80 0 -92 -12 -112 M12 -60 C0 -80 24 -92 12 -112" stroke="#C9D2E0" stroke-width="6" fill="none" stroke-linecap="round"/></g>
<circle cx="88" cy="214" r="22" fill="#F3C9A8"/>
</g></g>`;}
function cop(id){return `<g id="${id}"><g id="${id}-in">
<path d="M-125 330 C-125 170 -75 118 0 118 C75 118 125 170 125 330Z" fill="#1E3A7A"/>
<path d="M-30 122 L0 170 L30 122Z" fill="#B9C9E8"/><circle cx="-56" cy="200" r="12" fill="#F2C14E"/>
<rect x="-15" y="96" width="30" height="32" rx="8" fill="#C98E6B"/>
<circle cy="20" r="80" fill="#C98E6B"/>
<ellipse cx="-27" cy="22" rx="13" ry="15" fill="#fff"/><ellipse cx="27" cy="22" rx="13" ry="15" fill="#fff"/><circle cx="-25" cy="24" r="7" fill="#1B1530"/><circle cx="29" cy="24" r="7" fill="#1B1530"/>
<ellipse cx="0" cy="64" rx="14" ry="16" fill="#1B1530"/>
<path d="M-92 -14 C-92 -64 -50 -84 0 -84 C50 -84 92 -64 92 -14Z" fill="#14285A"/><path d="M-100 -14 L100 -14 L84 8 L-84 8Z" fill="#0B1838"/>
<path d="M-14 -66 L14 -66 L18 -40 L0 -30 L-18 -40Z" fill="#F2C14E"/>
</g><g id="${id}-hl" transform="translate(-170 120)"><circle r="34" fill="#C98E6B"/></g><g id="${id}-hr" transform="translate(170 120)"><circle r="34" fill="#C98E6B"/></g></g>`;}
function silhouette(id,fill='#1A1D2B'){return `<g id="${id}"><path d="M-100 220 C-100 120 -60 90 0 90 C60 90 100 120 100 220Z" fill="${fill}"/><circle cy="20" r="64" fill="${fill}"/>
<g id="${id}-e" opacity="0"><ellipse cx="-22" cy="20" rx="12" ry="8" fill="#FF2E2E"/><ellipse cx="22" cy="20" rx="12" ry="8" fill="#FF2E2E"/><ellipse cx="-22" cy="20" rx="24" ry="14" fill="#FF2E2E" opacity=".35"/><ellipse cx="22" cy="20" rx="24" ry="14" fill="#FF2E2E" opacity=".35"/></g></g>`;}
function bag(id){return `<g id="${id}"><g id="${id}-in">
<path d="M-40 -150 C-60 -170 -30 -190 0 -176 C30 -190 60 -170 40 -150Z" fill="#7A5634"/>
<path d="M-40 -150 C-150 -110 -150 0 -110 20 C-60 40 60 40 110 20 C150 0 150 -110 40 -150Z" fill="url(#gBag)"/>
<path d="M-46 -150 L46 -150" stroke="#5A3E24" stroke-width="12" stroke-linecap="round"/>
<ellipse cx="-60" cy="-90" rx="26" ry="12" fill="#fff" opacity=".25" transform="rotate(-30 -60 -90)"/>
<text x="0" y="-20" text-anchor="middle" font-family="Inter Display" font-weight="900" font-size="110" fill="#5A3E24">₸</text></g></g>`;}
function cash(id){return `<g id="${id}"><rect x="-60" y="-26" width="120" height="52" rx="6" fill="url(#gCash)" stroke="#1E7A3F" stroke-width="3"/><rect x="-16" y="-26" width="32" height="52" fill="#F2E6B0" opacity=".9"/><circle r="12" fill="none" stroke="#1E7A3F" stroke-width="3"/></g>`;}
function flame(id,s=1){return `<g id="${id}"><g id="${id}-in" transform="scale(${s})"><path d="M0 -150 C40 -90 90 -60 70 0 C60 40 -60 40 -70 0 C-90 -50 -30 -80 0 -150Z" fill="url(#gFire)"/><path d="M0 -80 C20 -50 40 -30 30 0 C20 20 -20 20 -30 0 C-40 -30 -10 -50 0 -80Z" fill="#FFF3B0" opacity=".9"/></g></g>`;}
function jet(id){return `<g id="${id}"><path d="M-420 0 C-300 -14 200 -26 420 -4 C432 -2 432 2 420 4 C200 26 -300 14 -420 0Z" fill="url(#gJet)"/>
<path d="M-200 -8 L40 -110 L120 -110 L80 -12Z M-200 8 L40 110 L120 110 L80 12Z" fill="#1E2130"/>
<path d="M-380 -6 L-330 -70 L-300 -70 L-320 -6Z" fill="#1E2130"/><path d="M300 -10 C330 -16 360 -10 380 -4" stroke="#6E7A99" stroke-width="5" fill="none"/>
<path d="M-430 0 L-560 -10 L-560 10Z" fill="#FF8A3D" opacity=".85"/></g>`;}
function gold(id){return `<g id="${id}"><path d="M-80 0 L80 0 L60 -50 L-60 -50Z" fill="url(#gGold)" stroke="#B7791F" stroke-width="4"/><path d="M-50 -42 L40 -42" stroke="#FFF6CC" stroke-width="6" opacity=".7" stroke-linecap="round"/></g>`;}
function car(id,police=false){return `<g id="${id}"><path d="M-170 0 L-170 -50 C-170 -66 -156 -76 -140 -78 L-90 -80 L-50 -130 C-44 -138 -34 -142 -24 -142 L70 -142 C82 -142 92 -136 98 -128 L140 -80 L160 -76 C172 -72 180 -62 180 -50 L180 0Z" fill="${police?'#F4F6FA':'#3D7BFF'}"/>
${police?'<rect x="-170" y="-46" width="350" height="22" fill="#1E3A7A"/><rect id="'+id+'-lr" x="-30" y="-162" width="44" height="20" rx="6" fill="#FF2E4D"/><rect id="'+id+'-lb" x="16" y="-162" width="44" height="20" rx="6" fill="#2F7BFF"/>':'<circle id="'+id+'-al" cx="150" cy="-60" r="14" fill="#FFD34D" opacity="0"/><circle id="'+id+'-al2" cx="-150" cy="-60" r="14" fill="#FFD34D" opacity="0"/>'}
<path d="M-40 -126 L-8 -126 L-8 -84 L-76 -84Z M6 -126 L64 -126 C72 -126 78 -122 82 -116 L106 -84 L6 -84Z" fill="#A9D4FF"/>
<circle cx="-100" cy="0" r="38" fill="#1B1F2B"/><circle cx="-100" cy="0" r="16" fill="#9AA6BA"/><circle cx="110" cy="0" r="38" fill="#1B1F2B"/><circle cx="110" cy="0" r="16" fill="#9AA6BA"/></g>`;}
function runner(id){
  const sil=(o,dx)=>`<g opacity="${o}" transform="translate(${dx} 0) rotate(12 0 200)"><path d="M-125 330 C-125 170 -75 118 0 118 C75 118 125 170 125 330Z" fill="#FF5A2A"/><circle cy="20" r="80" fill="#FF5A2A"/><path d="M-90 -16 C-90 -88 -48 -112 0 -112 C48 -112 90 -88 90 -16Z" fill="#FF5A2A"/></g>`;
  return `<g id="${id}"><rect id="${id}-tr" x="-1400" y="-60" width="1400" height="360" rx="180" fill="url(#gTrail)"/>
  ${[0,1,2,3,4].map(k=>`<path id="${id}-sl${k}" d="M${-300-k*90} ${-20+k*70} L${-700-k*90} ${-20+k*70}" stroke="#FFE0B0" stroke-width="${10-k}" stroke-linecap="round" opacity=".7"/>`).join('')}
  ${sil(.18,-260)}${sil(.32,-140)}
  <g transform="rotate(12 0 200)">${victor(id+'v')}</g></g>`;}


function runnerAnim(id,t){for(let k=0;k<5;k++){const e=$(id+'-sl'+k);e.setAttribute('transform',`translate(${(-((t*1800+k*170)%500)).toFixed(1)} 0)`);}$(id+'-tr').setAttribute('opacity',(.75+.2*Math.sin(t*30)).toFixed(3));}

function guard(id,skin='#E8B796'){return `<g id="${id}"><g id="${id}-in">
<path d="M-125 330 C-125 170 -75 118 0 118 C75 118 125 170 125 330Z" fill="#4A5A4E"/>
<path d="M-30 122 L0 168 L30 122Z" fill="#DDE3D8"/><rect x="40" y="190" width="40" height="26" rx="5" fill="#F2C14E"/>
<rect x="-15" y="96" width="30" height="32" rx="8" fill="${skin}"/><circle cy="20" r="80" fill="${skin}"/>
<clipPath id="${id}-cl"><ellipse cx="-27" cy="22" rx="15" ry="17"/></clipPath><clipPath id="${id}-cr"><ellipse cx="27" cy="22" rx="15" ry="17"/></clipPath>
<g clip-path="url(#${id}-cl)"><ellipse cx="-27" cy="22" rx="15" ry="17" fill="#fff"/><circle cx="-25" cy="25" r="8" fill="#1B1530"/><rect id="${id}-ll" x="-45" y="4" width="36" height="0" fill="${skin}"/></g>
<g clip-path="url(#${id}-cr)"><ellipse cx="27" cy="22" rx="15" ry="17" fill="#fff"/><circle cx="29" cy="25" r="8" fill="#1B1530"/><rect id="${id}-lr" x="9" y="4" width="36" height="0" fill="${skin}"/></g>
<path d="M-18 62 Q0 68 18 62" stroke="#1B1530" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M-92 -14 C-92 -64 -50 -84 0 -84 C50 -84 92 -64 92 -14Z" fill="#2E3A30"/><path d="M-100 -14 L100 -14 L84 8 L-84 8Z" fill="#1E261F"/><circle cy="-52" r="12" fill="#F2C14E"/>
</g></g>`;}
function anna(id){const sk='#F6D2B8',hr='#6A4630';return `<g id="${id}"><g id="${id}-in">
<path d="M-120 330 C-120 170 -72 120 0 120 C72 120 120 170 120 330Z" fill="#2F8F8A"/>
<path d="M-40 124 L0 196 L40 124Z" fill="#fff"/><path d="M-60 140 L-40 330 M60 140 L40 330" stroke="#24706C" stroke-width="10"/>
${[0,1,2,3,4,5,6].map(k=>`<circle cx="${-30+k*10}" cy="${150+Math.abs(k-3)*-4+12}" r="4.5" fill="#F4F0E6"/>`).join('')}
<rect x="-14" y="96" width="28" height="30" rx="8" fill="${sk}"/>
<g id="${id}-hd"><circle cx="0" cy="-64" r="36" fill="${hr}"/><circle cy="20" r="78" fill="${sk}"/>
<path d="M-80 26 C-86 -48 -40 -66 0 -66 C40 -66 86 -48 80 26 C70 -10 44 -30 0 -32 C-44 -30 -70 -10 -80 26Z" fill="${hr}"/>
<ellipse cx="-50" cy="48" rx="14" ry="8" fill="#FF8A8A" opacity=".35"/><ellipse cx="50" cy="48" rx="14" ry="8" fill="#FF8A8A" opacity=".35"/>
<g id="${id}-e"><ellipse cx="-27" cy="22" rx="7" ry="9" fill="#1B1530"/><ellipse cx="27" cy="22" rx="7" ry="9" fill="#1B1530"/></g>
<g fill="none" stroke="#2A1A10" stroke-width="5"><circle cx="-27" cy="22" r="21"/><circle cx="27" cy="22" r="21"/><path d="M-6 20 L6 20 M-48 18 L-76 10 M48 18 L76 10"/></g>
<path id="${id}-b" d="M-44 -8 L-12 -10 M12 -10 L44 -8" stroke="${hr}" stroke-width="7" stroke-linecap="round"/>
<path id="${id}-bR" d="M-44 -16 L-12 -6 M12 -10 L44 -20" stroke="${hr}" stroke-width="7" stroke-linecap="round" opacity="0"/>
<path id="${id}-m" d="M-16 58 Q0 70 16 58" stroke="#1B1530" stroke-width="6" fill="none" stroke-linecap="round"/>
<path id="${id}-mG" d="M-24 54 Q4 76 28 50" stroke="#1B1530" stroke-width="7" fill="none" stroke-linecap="round" opacity="0"/>
</g></g><g id="${id}-hand" transform="translate(130 210)"><circle r="30" fill="${sk}"/><rect x="-6" y="-58" width="14" height="44" rx="5" fill="#FFFFFF" transform="rotate(20)"/></g></g>`;}
function annaSet(id,{grin=0,raise=0}={}){$(id+'-mG').setAttribute('opacity',grin>.5?1:0);$(id+'-m').setAttribute('opacity',grin>.5?0:1);$(id+'-bR').setAttribute('opacity',raise>.5?1:0);$(id+'-b').setAttribute('opacity',raise>.5?0:1);}
function swat(id){return `<g id="${id}"><path d="M-120 330 C-120 170 -72 120 0 120 C72 120 120 170 120 330Z" fill="#1B1F2A"/><circle cy="20" r="76" fill="#2A2F3C"/><path d="M-80 -6 C-80 -70 -40 -92 0 -92 C40 -92 80 -70 80 -6Z" fill="#14171F"/><rect x="-64" y="4" width="128" height="34" rx="14" fill="#3A6EA8" opacity=".85"/>
<g id="${id}-sh"><rect x="-70" y="110" width="150" height="230" rx="22" fill="#2B3446" stroke="#5B6478" stroke-width="6"/><text x="5" y="236" text-anchor="middle" font-family="Inter Display" font-weight="900" font-size="30" fill="#C9D2E0">СПЕЦНАЗ</text></g></g>`;}
function caped(id){return `<g id="${id}"><path d="M-150 340 C-120 200 -90 140 -60 130 L60 130 C90 140 120 200 150 340Z" fill="#C8323B"/><path d="M-110 330 C-110 180 -70 124 0 124 C70 124 110 180 110 330Z" fill="#2A3A8A"/><circle cy="30" r="74" fill="#F1C9A5"/><rect x="-66" y="8" width="132" height="34" rx="16" fill="#1B1F2A"/><ellipse cx="-26" cy="25" rx="10" ry="7" fill="#fff"/><ellipse cx="26" cy="25" rx="10" ry="7" fill="#fff"/><path d="M-70 -10 C-60 -60 60 -60 70 -10 C40 -30 -40 -30 -70 -10Z" fill="#3A2518"/></g>`;}
function bun(id,s=1){return `<g id="${id}"><g transform="scale(${s})"><ellipse cx="0" cy="0" rx="60" ry="36" fill="url(#gBun)"/><ellipse cx="-14" cy="-14" rx="26" ry="9" fill="#FFE0A8" opacity=".6"/><path d="M-30 -10 L-10 10 M0 -16 L20 8 M28 -10 L40 4" stroke="#9A5A20" stroke-width="5" stroke-linecap="round" opacity=".7"/></g></g>`;}
function boardSVG(id,x,y,w,h,lines){
  let out=`<rect x="${x-18}" y="${y-18}" width="${w+36}" height="${h+36}" rx="18" fill="url(#gWood)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#gBoard)"/>
  <g opacity=".12" fill="#fff">${[...Array(30)].map(()=>`<circle cx="${(x+rnd()*w).toFixed(0)}" cy="${(y+rnd()*h).toFixed(0)}" r="${(2+rnd()*8).toFixed(1)}"/>`).join('')}</g>
  <rect x="${x+20}" y="${y+h-6}" width="${w-40}" height="14" rx="6" fill="#8A5A2E"/>`;
  lines.forEach((L,i)=>{out+=`<clipPath id="${id}-cp${i}"><rect id="${id}-c${i}" x="${L.x}" y="${L.y-L.fs}" width="0" height="${L.fs*1.4}"/></clipPath>
   <text clip-path="url(#${id}-cp${i})" x="${L.x}" y="${L.y}" font-family="Inter Display" font-weight="${L.fw||800}" font-size="${L.fs}" fill="${L.c||'#F4F0E6'}" letter-spacing="-1">${L.t}</text>`;});
  return out;}
function boardReveal(id,lines,t){lines.forEach((L,i)=>{const p=clamp((t-L.t0)/L.d);$(`${id}-c${i}`).setAttribute('width',(p*L.w).toFixed(1));});}



// ============ generic helpers added for the skill ============
// Camera shake: IMP = [[time, amplitude_px], ...]; call shakeCam(t, IMP) at the top of render(t).
function shakeCam(t,IMP,elId='cam'){let x=0,y=0,r=0;for(const [ti,a] of IMP){const d=t-ti;if(d<0||d>.45)continue;const e=a*Math.exp(-d*13);x+=e*Math.sin(d*74);y+=e*Math.cos(d*57)*.8;r+=e*.04*Math.sin(d*63);}
  $(elId).style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg)`;}
// Scene with slow Ken-Burns push-in (+3.5% over the scene). Same args as scene().
function sc(id,t,tin,tout,inT='zoom',outT='zoom',ox=VW/2,oy=VH/2){if(!scene(id,t,tin,tout,inT,outT,ox,oy))return false;const k=1+.035*clamp((t-Math.max(0,tin))/(tout-Math.max(0,tin)));$(id).style.transform+=` scale(${k.toFixed(4)})`;return true;}
// Corner badge (series label) that pops in at tin and fades at tout.
function badgeAnim(id,t,tin=.5,tout=1e9){const el=$(id);const p=P(t,tin,.35,Ease.outBack),po=P(t,tout,.25);el.style.opacity=(clamp(p*3)*(1-po)).toFixed(3);el.style.transform=`scale(${Math.max(.01,p).toFixed(3)})`;}
// White flash peaks: flashAt(t, [[time, strength], ...]) -> opacity for #flash
function flashAt(t,list){let o=0;for(const [ti,s] of list)o=Math.max(o,bell(t,ti-.04,ti+.02,ti+.3)*s);return o;}
// Speedometer HUD (needs hud-speedometer.html snippet). v = value, vmax = top of the log scale.
function speedo(t,v,vmax,{show=true,warn=1000}={}){const el=$('SPD');if(!el)return;el.style.visibility=show?'visible':'hidden';if(!show)return;
  const a=-120+240*Math.log10(v+1)/Math.log10(vmax+1);$('SPD-nd').setAttribute('transform',`rotate(${(a+(v>warn?2*Math.sin(t*40):0)).toFixed(2)} 180 180)`);
  $('SPD-v').textContent=fmt(Math.round(v));$('SPD-v').setAttribute('fill',v>warn?'#FF7A3D':'#fff');}
