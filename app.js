const S={reviews:[],currentText:""};
const $=id=>document.getElementById(id);
const els={token:$("token"),btnRandom:$("btnRandom"),btnSent:$("btnSent"),btnNouns:$("btnNouns"),spin:$("spin"),err:$("err"),review:$("review"),sentIcon:$("sentIcon"),nounIcon:$("nounIcon")};
const MODEL_URL="https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
function setSpin(v){els.spin.style.display=v?"inline-block":"none";els.btnRandom.disabled=v;els.btnSent.disabled=v;els.btnNouns.disabled=v}
function setErr(t){if(!t){els.err.style.display="none";els.err.textContent="";return}els.err.style.display="block";els.err.textContent=t}
function setReview(t){S.currentText=t;els.review.textContent=t;els.review.classList.remove("muted")}
function randItem(a){return a[Math.floor(Math.random()*a.length)]}
Papa.parse("reviews_test.tsv",{download:true,header:true,delimiter:"\t",skipEmptyLines:true,complete:r=>{S.reviews=(r.data||[]).map(x=>x.text).filter(Boolean);[els.btnRandom,els.btnSent,els.btnNouns].forEach(b=>b.disabled=false)},error:e=>setErr("Failed to load TSV")});
els.btnRandom.onclick=()=>{if(!S.reviews.length){setErr("No data");return}setErr("");setReview(randItem(S.reviews))};
els.btnSent.onclick=async()=>{if(!S.currentText){els.btnRandom.click()}setErr("");setSpin(true);try{const prompt="Classify this review as positive, negative, or neutral: ";const out=await callApi(prompt,S.currentText);const modelLabel=extractLabel(out,["positive","negative","neutral"]);const icon=modelLabel==="positive"?"👍":modelLabel==="negative"?"👎":modelLabel==="neutral"?"❓":"❓";els.sentIcon.textContent=icon;const local=localSentiment(S.currentText);els.sentIcon.title="local "+(local.score>=0?"positive":"negative")+" "+Math.round(local.confidence*100)+"%"}catch(e){const local=localSentiment(S.currentText);els.sentIcon.textContent=local.score>=0?"👍":"👎";els.sentIcon.title="fallback local"}finally{setSpin(false)}};
els.btnNouns.onclick=async()=>{if(!S.currentText){els.btnRandom.click()}setErr("");setSpin(true);try{const prompt="Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ";const out=await callApi(prompt,S.currentText);const lbl=extractLabel(out,["high","medium","low","many","few"]);const norm=lbl==="many"?"high":lbl==="few"?"low":lbl;els.nounIcon.textContent=norm==="high"?"🟢":norm==="medium"?"🟡":norm==="low"?"🔴":"🔴"}catch(e){const local=nounLevel(S.currentText);els.nounIcon.textContent=local==="high"?"🟢":local==="medium"?"🟡":"🔴"}finally{setSpin(false)}};
async function callApi(prefix,text){const body={inputs:prefix+text};const headers={"Content-Type":"application/json","Accept":"application/json"};const t=els.token.value.trim();if(t)headers.Authorization="Bearer "+t;const r=await fetch(MODEL_URL,{method:"POST",headers,body:JSON.stringify(body)});if(r.status===402){setErr("402 Payment required or gated model");throw new Error("402")}if(r.status===429){setErr("429 Rate limit");throw new Error("429")}if(r.status===503){setErr("503 Model loading");throw new Error("503")}if(!r.ok){setErr("API error "+r.status);throw new Error(String(r.status))}const j=await r.json();const t1=Array.isArray(j)&&j.length&&j[0].generated_text?String(j[0].generated_text):typeof j.generated_text==="string"?j.generated_text:JSON.stringify(j);return t1}
function extractLabel(s,labels){const L=labels.map(x=>x.toLowerCase());const txt=String(s||"").toLowerCase();for(const l of L){if(txt.includes(l))return l}const first=(txt.split(/\r?\n/)[0]||"").trim();for(const l of L){if(first===l||first.startsWith(l))return l}return""}
function localSentiment(raw){const text=String(raw||"");const cleaned=text.replace(/https?:\/\/\S+/gi," ").replace(/\S+@\S+\.\S+/g," ").replace(/@\w+/g," ").toLowerCase();
const tokens=Array.from(cleaned.matchAll(/[\p{L}]+|[.!?,:;]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu)).map(m=>m[0]);
const negators=new Set(["не","нет","no","not","never"]);
const intensifiers=new Set(["very","очень"]);
const mitigators=new Set(["slightly","немного","чуть"]);
const posLex={"good":1,"great":1.5,"love":1.6,"excellent":1.8,"amazing":1.8,"wonderful":1.6,"delicious":1.4,"like":0.8,"recommend":1.2,"best":1.4,"perfect":1.6,"refreshing":1.2,"better":0.8,"lol":0.3,"супер":1.5,"класс":1.2,"нравится":1.2,"люблю":1.6,"отличный":1.5,"отлично":1.5,"хороший":1.0,"хорошо":1.0,"прекрасно":1.6,"рекомендую":1.2,"удобно":0.8,"легко":0.8,"вкусно":1.4,"👍":1,"😊":1,"❤️":1.8,"😍":1.6,"😂":0.4,"😁":0.8,"🙂":0.6,"⭐":1};
const negLex={"bad":-1.2,"terrible":-1.8,"awful":-1.7,"hate":-1.6,"worst":-1.8,"poor":-1.0,"disgusting":-1.6,"gross":-1.4,"harsh":-0.8,"greasy":-1.2,"problem":-0.7,"problems":-0.7,"smells":-0.6,"tastes":-0.6,"isnt":-0.4,"wasnt":-0.4,"dont":-0.4,"can't":-0.4,"cannot":-0.4,"плохо":-1.0,"плохой":-1.0,"ужасно":-1.7,"ненавижу":-1.6,"худший":-1.8,"жирный":-0.8,"проблема":-0.7,"проблемы":-0.7,"резкий":-0.7,"воняет":-1.4,"невкусно":-1.4,"тяжелый":-0.6,"👎":-1,"😡":-1.5,"😠":-1.2,"😞":-1,"😢":-0.8,"🤮":-1.6,"☹":-0.8};
function lemma(w){if(!w)return w;let s=w.toLowerCase();if(/[a-z]/.test(s)){if(s.endsWith("ies")&&s.length>4)s=s.slice(0,-3)+"y";else if(s.endsWith("ing")&&s.length>5)s=s.slice(0,-3);else if(s.endsWith("ed")&&s.length>4)s=s.slice(0,-2);else if(s.endsWith("es")&&s.length>3)s=s.slice(0,-2);else if(s.endsWith("s")&&s.length>3)s=s.slice(0,-1);s=s.replace(/[^a-z]/g,"")}else{s=s.replace(/[^а-яё]/g,"");const ends=["иями","ями","ами","иями","иях","иях","ией","ием","ию","ии","ие","ий","ого","ему","ыми","ыми","ые","ая","ою","ую","ый","ий","ое","его","ому","ами","ями","ах","ях","ов","ев","ом","ем","а","я","у","ю","о","е","ы","и","ь","ия","ие"];for(const e of ends){if(s.endsWith(e)&&s.length>3){s=s.slice(0,-e.length);break}}}return s}
let rawScore=0,considered=0;
const excl=Math.min(3,(text.match(/!/g)||[]).length);
const exclMul=1+0.1*excl;
let lastNegDist=Infinity;
for(let i=0;i<tokens.length;i++){
  const tok=tokens[i];
  if(/[.!?,:;]/.test(tok)){lastNegDist=Infinity;continue}
  const isWord=/[\p{L}]/u.test(tok);
  const base=isWord?lemma(tok):tok;
  if(negators.has(base)){lastNegDist=0;continue}
  if(lastNegDist<Infinity)lastNegDist++;
  let w=0;
  if(posLex[base])w=posLex[base];
  else if(negLex[base])w=negLex[base];
  if(w!==0){
    if(lastNegDist>=1&&lastNegDist<=3)w*=-1;
    const prev=tokens[i-1]?lemma(tokens[i-1]):"";
    if(intensifiers.has(prev))w*=1.5;
    if(mitigators.has(prev))w*=0.6;
    w*=exclMul;
    rawScore+=w;
    considered++;
  }
}
let score=considered?rawScore/Math.sqrt(considered):0;
score=Math.max(-4,Math.min(4,score));
const confidence=Math.min(1,Math.abs(score)/2);
return{score,confidence}
}
function nounLevel(t){const text=String(t||"");const words=Array.from(text.matchAll(/[\p{L}]+|[.!?]/gu)).map(m=>m[0]);let count=0;let start=true;const det=new Set(["a","an","the","this","that","these","those","my","our","his","her","its","their"]);for(let i=0;i<words.length;i++){const w=words[i];if(/[.!?]/.test(w)){start=true;continue}const isEn=/[a-z]/i.test(w);const isRu=/[а-яё]/i.test(w);if(isEn){const prev=words[i-1]||"";const cap=/^[A-Z]/.test(w);if(cap&&!start&&w!=="I")count++;const lower=w.toLowerCase();const suff=["tion","ment","ness","ity","ism","ist","ship","age","ance","ence","er","or"];if(suff.some(s=>lower.endsWith(s)))count++;if(det.has((prev||"").toLowerCase()))count++}else if(isRu){const prev=words[i-1]||"";const cap=/^[А-ЯЁ]/.test(w);if(cap&&!start)count++;const lw=w.toLowerCase();const ends=["ие","ия","ость","ция","ник","тель","ство","ок","ка","тие","ство","изм","логия","ент","ант","атор","ность"];if(ends.some(s=>lw.endsWith(s)))count++}start=false}
return count>15?"high":count>=6?"medium":"low"}
