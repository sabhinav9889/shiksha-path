---
id: apt1-04-letter-patterns
track: aptitude
module: aptitude-1
topic: letter patterns
level: 1
order: 4
review: pending
title: { hi: अक्षरों का पैटर्न, en: Letter patterns }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? A, C, E, G, ?", en: "What comes next? A, C, E, G, ?" }
    options:
      - { id: a, text: { hi: "I", en: "I" }, correct: true }
      - id: b
        text: { hi: "H", en: "H" }
        why_wrong: { hi: "हर बार एक अक्षर छूट रहा है। G के बाद H छोड़कर I आएगा।", en: "One letter is skipped each time. After G, skip H and write I." }
      - id: c
        text: { hi: "K", en: "K" }
        why_wrong: { hi: "यहाँ सिर्फ़ एक अक्षर छोड़ना है, तीन नहीं।", en: "Skip only one letter, not three." }
    explanation: { hi: "A (B) C (D) E (F) G (H) I – हर बार एक अक्षर छूटता है।", en: "A (B) C (D) E (F) G (H) I – one letter is skipped each time." }
  - id: q2
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? B, D, F, H, ?", en: "What comes next? B, D, F, H, ?" }
    options:
      - { id: a, text: { hi: "J", en: "J" }, correct: true }
      - id: b
        text: { hi: "I", en: "I" }
        why_wrong: { hi: "I, H के ठीक बाद है। यहाँ एक अक्षर छोड़ना है।", en: "I comes right after H. Here one letter is skipped." }
      - id: c
        text: { hi: "K", en: "K" }
        why_wrong: { hi: "K तक जाने में दो अक्षर छूटते हैं। सिर्फ़ एक छोड़ना है।", en: "Going to K skips two letters. Skip only one." }
    explanation: { hi: "B (C) D (E) F (G) H (I) J – हर बार एक अक्षर छूटता है।", en: "B (C) D (E) F (G) H (I) J – one letter is skipped each time." }
  - id: q3
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? Z, Y, X, W, ?", en: "What comes next? Z, Y, X, W, ?" }
    options:
      - { id: a, text: { hi: "V", en: "V" }, correct: true }
      - id: b
        text: { hi: "X", en: "X" }
        why_wrong: { hi: "अक्षर उल्टे क्रम में चल रहे हैं। W के बाद पीछे की ओर V आता है।", en: "The letters go backwards. Going back from W gives V." }
      - id: c
        text: { hi: "U", en: "U" }
        why_wrong: { hi: "हर बार सिर्फ़ एक अक्षर पीछे जाना है। U में V छूट गया।", en: "Go back only one letter each time. U skips V." }
    explanation: { hi: "Z, Y, X, W, V – हर बार एक अक्षर पीछे।", en: "Z, Y, X, W, V – one letter back each time." }
  - id: q4
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? P, Q, R, S, ?", en: "What comes next? P, Q, R, S, ?" }
    options:
      - { id: a, text: { hi: "T", en: "T" }, correct: true }
      - id: b
        text: { hi: "U", en: "U" }
        why_wrong: { hi: "यहाँ कोई अक्षर नहीं छूट रहा। S के ठीक बाद T आता है।", en: "No letter is skipped here. T comes right after S." }
      - id: c
        text: { hi: "R", en: "R" }
        why_wrong: { hi: "R पहले ही आ चुका है। अक्षर आगे बढ़ रहे हैं।", en: "R has already come. The letters move forward." }
    explanation: { hi: "P, Q, R, S, T – हर बार अगला अक्षर।", en: "P, Q, R, S, T – the next letter each time." }
  - id: q5
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? A, D, G, J, ?", en: "What comes next? A, D, G, J, ?" }
    options:
      - { id: a, text: { hi: "M", en: "M" }, correct: true }
      - id: b
        text: { hi: "K", en: "K" }
        why_wrong: { hi: "K, J के ठीक बाद है। यहाँ हर बार दो अक्षर छोड़ने हैं।", en: "K comes right after J. Here two letters are skipped each time." }
      - id: c
        text: { hi: "L", en: "L" }
        why_wrong: { hi: "यहाँ दो अक्षर छोड़ने हैं, एक नहीं: J (K, L) M।", en: "Skip two letters, not one: J (K, L) M." }
    explanation: { hi: "A (B, C) D (E, F) G (H, I) J (K, L) M – हर बार दो अक्षर छूटते हैं।", en: "A (B, C) D (E, F) G (H, I) J (K, L) M – two letters are skipped each time." }
  - id: q6
    type: aptitude
    prompt: { hi: "अगला अक्षर क्या है? Y, W, U, S, ?", en: "What comes next? Y, W, U, S, ?" }
    options:
      - { id: a, text: { hi: "Q", en: "Q" }, correct: true }
      - id: b
        text: { hi: "R", en: "R" }
        why_wrong: { hi: "पीछे जाते हुए हर बार एक अक्षर छूट रहा है। S के बाद R छोड़कर Q आएगा।", en: "Going back, one letter is skipped each time. After S, skip R and write Q." }
      - id: c
        text: { hi: "T", en: "T" }
        why_wrong: { hi: "अक्षर उल्टे क्रम में चल रहे हैं, आगे नहीं।", en: "The letters go backwards, not forwards." }
    explanation: { hi: "Y (X) W (V) U (T) S (R) Q – पीछे की ओर, हर बार एक अक्षर छूटता है।", en: "Y (X) W (V) U (T) S (R) Q – going backwards, one letter is skipped each time." }
---
<!-- lang:hi -->
अक्षरों के पैटर्न में **A से Z तक का क्रम** याद रखें। फिर देखें कि हर कदम पर क्या हो रहा है:

- अक्षर **आगे** जा रहे हैं या **पीछे**?
- बीच में **कितने अक्षर छूट** रहे हैं?

उदाहरण: A, C, E, G – हर बार **एक अक्षर छूट** रहा है (B, D, F)। G के बाद H छोड़ें, तो अगला अक्षर **I** है।

मदद के लिए कागज़ पर A से Z तक लिख लें और उँगली से गिनें।
<!-- lang:en -->
For letter patterns, remember the **order from A to Z**. Then see what happens at each step:

- Are the letters going **forwards** or **backwards**?
- **How many letters are skipped** in between?

Example: A, C, E, G – **one letter is skipped** each time (B, D, F). Skip H after G, so the next letter is **I**.

To help, write A to Z on paper and count with your finger.
