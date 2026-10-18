---
id: apt1-01-patterns
track: aptitude
module: aptitude-1
topic: number patterns
level: 1
order: 1
review: approved
title: { hi: संख्याओं का पैटर्न, en: Number patterns }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "अगली संख्या क्या है? 2, 4, 6, 8, ?", en: "What comes next? 2, 4, 6, 8, ?" }
    options:
      - { id: a, text: { hi: "10", en: "10" }, correct: true }
      - id: b
        text: { hi: "9", en: "9" }
        why_wrong: { hi: "हर बार 2 जुड़ रहा है, 1 नहीं।", en: "Each step adds 2, not 1." }
    explanation: { hi: "8 + 2 = 10", en: "8 + 2 = 10" }
  - id: q2
    type: aptitude
    prompt: { hi: "अगली संख्या क्या है? 5, 10, 15, 20, ?", en: "What comes next? 5, 10, 15, 20, ?" }
    options:
      - { id: a, text: { hi: "25", en: "25" }, correct: true }
      - id: b
        text: { hi: "30", en: "30" }
        why_wrong: { hi: "हर बार 5 जुड़ रहा है, 10 नहीं।", en: "Each step adds 5, not 10." }
    explanation: { hi: "20 + 5 = 25", en: "20 + 5 = 25" }
  - id: q3
    type: aptitude
    prompt: { hi: "अगली संख्या क्या है? 1, 2, 4, 8, ?", en: "What comes next? 1, 2, 4, 8, ?" }
    options:
      - { id: a, text: { hi: "16", en: "16" }, correct: true }
      - id: b
        text: { hi: "10", en: "10" }
        why_wrong: { hi: "हर संख्या पिछली की दुगनी है।", en: "Each number doubles the one before." }
    explanation: { hi: "8 × 2 = 16", en: "8 × 2 = 16" }
  - id: q4
    type: aptitude
    prompt: { hi: "अगली संख्या क्या है? 20, 17, 14, 11, ?", en: "What comes next? 20, 17, 14, 11, ?" }
    options:
      - { id: a, text: { hi: "8", en: "8" }, correct: true }
      - id: b
        text: { hi: "9", en: "9" }
        why_wrong: { hi: "हर बार 3 घट रहा है।", en: "Each step takes away 3." }
    explanation: { hi: "11 − 3 = 8", en: "11 − 3 = 8" }
  - id: q5
    type: aptitude
    prompt: { hi: "अगली संख्या क्या है? 3, 6, 9, 12, ?", en: "What comes next? 3, 6, 9, 12, ?" }
    options:
      - { id: a, text: { hi: "15", en: "15" }, correct: true }
      - id: b
        text: { hi: "14", en: "14" }
        why_wrong: { hi: "हर बार 3 जुड़ रहा है, 2 नहीं।", en: "Each step adds 3, not 2." }
    explanation: { hi: "12 + 3 = 15", en: "12 + 3 = 15" }
---
<!-- lang:hi -->
पैटर्न वाली पहेली में देखें कि **हर कदम पर क्या बदल रहा है**: जुड़ रहा है, घट रहा है, या दुगना हो रहा है।

उदाहरण: 2, 4, 6, 8 – हर बार **2 जुड़ रहा है**, तो अगली संख्या 10 है।

IT कंपनियों के hiring test में ऐसे सवाल अक्सर आते हैं।
<!-- lang:en -->
In a pattern puzzle, look at **what changes at each step**: something is added, taken away, or doubled.

Example: 2, 4, 6, 8 – each step **adds 2**, so the next number is 10.

IT companies often use questions like these in hiring tests.
