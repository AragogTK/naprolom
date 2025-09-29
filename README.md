# naprolom
Role 
You are an expert JavaScript developer who writes clean, minimal code for GitHub Pages. Follow every requirement exactly—no extra libraries, comments, or text. 
Context • Static site only (index.html + app.js)
• Data file: reviews_test.tsv (has a text column)
• Papa Parse via CDN must load & parse TSV.
• One optional input field for Hugging Face API token.
• Use ONE free model endpoint: tiiuae/falcon-7b-instruct 
 – task =text-generation (request body { "inputs": PROMPT })
• UI buttons 1. Select Random Review → show random review text. 2. Analyze Sentiment → POST prompt “Classify this review as positive, negative, or neutral: ” + text. 3. Count Nouns → POST prompt “Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6).” + text.
• Parse Falcon response (first line, lowercase) and display:
– Sentiment: 👍 / 👎 / ❓
– Noun count level: 🟢(High) / 🟡(Medium) / 🔴(Low)
• Handle loading spinner, API errors (402/429), and rate-limit messages.
• All logic in vanilla JS (fetch, async/await).
• No server-side code. Samples from reviews_test.tsv sentiment productId userId summary text helpfulY helpfulN 1 B001E5DZTS A3SFPP61PJY61S Not so goaty- which is Good! Wonderful product! I began to use it for my daughter who was about to turn a year old. She took it with no problems! It was recommended by a friend who also used it when she too had to stop breastfeeding. Much better for a child in my eyes. I had tried a formula sample I had received in the mail- it left a greasy film in the bottle... gross. This does not! My daughter will drink it warm or cold- so easy for on the go as well. The canned was a bit harsh and she wasn't into it.. it tastes like a goat smells- this just has a suttle hint of goat. LoL 0 0 1 B002JX7GVM A3KNE6IZQU0MJV O.N.E. Coconut Water! I got the O.N.E. Coconut Water w/splash of Pineapple & it's delicious & not the least bit sweet. Just very refreshing!! LOVE IT and will continue using it. Saw this on Dr. Oz as he recommended it. 1 0 
Instruction Generate the complete code for “Review Analyzer”: 1. index.html
– Responsive UI with minimal CSS.
– Token input, three buttons, result card, error div, spinner.
– Link Font Awesome 6.4 CDN and Papa Parse 5.4.1 CDN. 2. app.js
– TSV fetch + Papa Parse → reviews array.
– Event handlers for each button.
– Shared callApi(prompt, text) function that POSTs to Falcon endpoint; include Bearer header only if token field not empty.
– Sentiment logic: Remove URLs, emails, and @mentions, lowercase the text, tokenize into words and emoji, and lemmatize (ru/en). For each token, retrieve a base sentiment weight from a lexicon (positive, negative, or 0). If a token falls within three tokens after a negator (не, нет, no, not, never) and before punctuation, invert its weight. Apply modifiers: multiply by 1.5 after an intensifier (very, очень) or by 0.6 after a mitigator (slightly, немного). If a sentence contains exclamation marks, multiply affected weights by (1 + 0.1 × min(3, count of “!”)). Sum all adjusted weights to get raw_score, then normalize as score = raw_score / √(number of considered tokens) and clamp to [−4, +4]. Classify with label 👍 if score ≥ 0, otherwise 👎, and compute confidence = min(1, |score| / 2). 
– Noun-level logic: Count the number of nouns (POS: NOUN or PROPN) in this review and return only one label: many (>15), medium (6–15), or few (<6). 
– Graceful error handling & UI reset. 
Output Format 1. A single code block containing the full index.html. 2. A single code block containing the full app.js.
No prose, no explanations, no extra files
