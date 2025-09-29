const S={};

// Works: controls loading indicator and disables/enables buttons
function setSpin(v){
  S.spin.style.display=v?"inline-flex":"none";
  S.btnRandom.disabled=v; S.btnSent.disabled=v; S.btnNouns.disabled=v;
}

// Works: shows/hides and fills the error area
function setErr(t){
  if(!t){ S.err.style.display="none"; S.err.textContent=""; return; }
  S.err.style.display="block"; S.err.textContent=t;
}

// Works: maps sentiment label → icon/class/fontawesome icon
function mapSentIcon(lbl){
  if(lbl==="positive")return["👍","good","fa-regular fa-face-smile"];
  if(lbl==="negative")return["👎","bad","fa-regular fa-face-frown"];
  if(lbl==="neutral") return["❓","warn","fa-regular fa-face-meh"];
  return["❓","warn","fa-regular fa-face-meh"];
}

// Works: maps noun level → icon/class
function mapNounIcon(lbl){
  if(lbl==="high"||lbl==="many")return["🟢","good"];
  if(lbl==="medium")return["🟡","warn"];
  if(lbl==="low"||lbl==="few")return["🔴","bad"];
  return["—","warn"];
}

// Works: takes the first line, lowercases, and trims
function firstLineLower(t){ return (t||"").split(/\r?\n/)[0].toLowerCase().trim(); }

// Works: normalizes model response to positive/negative/neutral
function normalizeResp(raw){
  let s=firstLineLower(raw).replace(/^[^a-zа-яё]+/i,"");
  if(/positive|positif|положит|хорош|good/.test(s))return"positive";
  if(/negative|negatif|отрицат|плох|bad/.test(s))return"negative";
  if(/neutral|нейтр/.test(s))return"neutral";
  return s;
}

// Works: normalizes many/high/medium/low according to rules
function normalizeLevel(raw){
  let s=firstLineLower(raw);
  if(/\b(high|many|>?\s*15|\bmore than 15\b|более\s*15|много)\b/.test(s))return"high";
  if(/\b(medium|6-15|6 to 15|средн|от\s*6\s*до\s*15)\b/.test(s))return"medium";
  if(/\b(low|few|<\s*6|мало|менее\s*6)\b/.test(s))return"low";
  return s;
}

/* ===================== HF models and helpers ===================== */
// Works: generative (fallback if task-specific models are unavailable)
const TEXTGEN_MODELS=[
  "HuggingFaceH4/smol-llama-3.2-1.7B-instruct",
  "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
];
// Works: task-specific models (often more available and faster)
const SENTIMENT_MODEL="cardiffnlp/twitter-xlm-roberta-base-sentiment"; // multi-lang, outputs negative/neutral/positive
const POS_MODELS=[
  "vblagoje/bert-english-uncased-finetuned-pos",
  "vblagoje/bert-english-cased-finetuned-pos"
];

let ACTIVE_TEXTGEN_MODEL=TEXTGEN_MODELS[0];
let ACTIVE_SENT_MODEL=SENTIMENT_MODEL;
let ACTIVE_POS_MODEL=POS_MODELS[0];

// Works: safely reads token from input; returns Authorization header or null
function getAuthHeader(){
  const el=S.token;
  const tok=el && el.value ? el.value.trim().replace(/[\s\r\n\t]+/g,"") : "";
  return tok ? ("Bearer "+tok) : null;
}

// Works: generic POST to HF Inference API
async function hfRequest(modelId, body){
  const url=`https://api-inference.huggingface.co/models/${modelId}`;
  const headers={
    "Accept":"application/json",
    "Content-Type":"application/json"
  };
  const auth=getAuthHeader();
  if(auth) headers["Authorization"]=auth;

  const r=await fetch(url,{method:"POST",mode:"cors",cache:"no-store",headers,body:JSON.stringify(body)});
  if(r.status===401) throw new Error("401 Unauthorized (укажите валидный HF токен hf_… с правом Read)");
  if(r.status===402) throw new Error("402 Payment required");
  if(r.status===429) throw new Error("429 Rate limited");
  if(r.status===404||r.status===403) throw new Error(`Model ${modelId} unavailable (${r.status})`);
  if(!r.ok){ const e=await r.text(); throw new Error(`API error ${r.status}: ${e.slice(0,200)}`); }
  return r.json();
}

/* ===================== Task calls to HF ===================== */

// Works: sentiment via text-classification (preferred)
async function callSentimentHF(text){
  const data=await hfRequest(SENTIMENT_MODEL,{inputs:text, options:{wait_for_model:true,use_cache:false}});
  // Response may be [{label,score}, …] or [[{…}]]
  const arr=Array.isArray(data)&&Array.isArray(data[0]) ? data[0] : (Array.isArray(data)?data:[]);
  // Normalize labels to positive/neutral/negative
  // cardiffnlp usually returns "positive"/"neutral"/"negative" in label
  let best=arr.reduce((a,b)=> (a&&a.score>b.score)?a:b, null) || arr[0];
  if(!best) throw new Error("Empty response from sentiment model");
  const lbl=best.label.toLowerCase();
  if(/pos/.test(lbl)) return "positive";
  if(/neu/.test(lbl)) return "neutral";
  if(/neg/.test(lbl)) return "negative";
  // If unexpected labels — fall back to a generative model
  return await callTextGenHF(
    "Classify this review as positive, negative, or neutral. Return only one word.",
    text
  ).then(normalizeResp);
}

// Works: POS via token-classification; counts NOUN+PROPN and maps to high/medium/low
async function callNounsPOSHF(text){
  let lastErr=null;
  for(const m of POS_MODELS){
    try{
      const data=await hfRequest(m,{inputs:text, options:{wait_for_model:true,use_cache:false}});
      // Possible formats: [{entity_group, word, score, start, end}, …] or [[…]]
      const flat=Array.isArray(data)&&Array.isArray(data[0]) ? data[0] : (Array.isArray(data)?data:[]);
      if(!flat.length) throw new Error("Empty POS response");
      let count=0;
      for(const tok of flat){
        const tag=(tok.entity_group||tok.entity||"").toUpperCase();
        if(tag.includes("NOUN")||tag.includes("PROPN")||tag==="NN"||tag==="NNS"||tag==="NNP"||tag==="NNPS"){
          count++;
        }
      }
      ACTIVE_POS_MODEL=m;
      return count>15?"high":count>=6?"medium":"low";
    }catch(e){ lastErr=e; }
  }
  // If POS models are unavailable — fallback to a generative HF model
  const out=await callTextGenHF(
    "Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). Return only one of: High, Medium, Low.",
    text
  );
  return normalizeLevel(out);
}

// Works: text generation (fallback)
async function callTextGenHF(prompt,text){
  let lastErr=null;
  for(const m of TEXTGEN_MODELS){
    try{
      const data=await hfRequest(m,{
        inputs:`${prompt}\n\nTEXT:\n${text}\n\nANSWER:`,
        parameters:{ max_new_tokens:32, temperature:0, return_full_text:false },
        options:{ wait_for_model:true, use_cache:false }
      });
      const txt=Array.isArray(data)&&data[0]?.generated_text
        ? data[0].generated_text
        : (data?.generated_text ?? (typeof data==="string"?data:JSON.stringify(data)));
      ACTIVE_TEXTGEN_MODEL=m;
      return txt;
    }catch(e){ lastErr=e; }
  }
  throw lastErr||new Error("All text-generation models unavailable");
}

/* ===================== UI Actions (HF-only) ===================== */

// Works: shows a random review and resets badges
function rand(){
  if(!S.reviews.length){ setErr("No reviews loaded."); return; }
  const i=Math.floor(Math.random()*S.reviews.length);
  S.textEl.textContent=S.reviews[i].text||"";
  S.sent.querySelector("span").textContent="Sentiment: —";
  S.sent.className="pill";
  S.sent.querySelector("i").className="fa-regular fa-face-meh";
  S.nouns.querySelector("span").textContent="Noun level: —";
  S.nouns.className="pill";
  setErr("");
}

// Works: HF-only — sentiment via classification model; with generative fallback
asy
