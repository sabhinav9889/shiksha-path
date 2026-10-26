---
id: apt1-02-odd-one-out
track: aptitude
module: aptitude-1
topic: odd one out
level: 1
order: 2
review: pending
title: { hi: अलग कौन-सा है, en: Odd one out }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "कौन-सा अलग है? 2, 4, 6, 9", en: "Which one is different? 2, 4, 6, 9" }
    options:
      - { id: a, text: { hi: "9", en: "9" }, correct: true }
      - id: b
        text: { hi: "6", en: "6" }
        why_wrong: { hi: "6 एक सम संख्या है, बाक़ी 2, 4, 6 की तरह।", en: "6 is even, like 2 and 4." }
      - id: c
        text: { hi: "2", en: "2" }
        why_wrong: { hi: "2 एक सम संख्या है, बाक़ी 4, 6 की तरह।", en: "2 is even, like 4 and 6." }
    explanation: { hi: "2, 4, 6 सम संख्याएँ हैं। 9 विषम है।", en: "2, 4 and 6 are even. 9 is odd." }
  - id: q2
    type: aptitude
    prompt: { hi: "कौन-सा अलग है? सेब, आम, केला, कुर्सी", en: "Which one is different? Apple, mango, banana, chair" }
    options:
      - { id: a, text: { hi: कुर्सी, en: Chair }, correct: true }
      - id: b
        text: { hi: आम, en: Mango }
        why_wrong: { hi: "आम एक फल है, सेब और केले की तरह।", en: "A mango is a fruit, like apple and banana." }
      - id: c
        text: { hi: केला, en: Banana }
        why_wrong: { hi: "केला एक फल है, सेब और आम की तरह।", en: "A banana is a fruit, like apple and mango." }
    explanation: { hi: "सेब, आम और केला फल हैं। कुर्सी फल नहीं है।", en: "Apple, mango and banana are fruits. A chair is not." }
  - id: q3
    type: aptitude
    prompt: { hi: "कौन-सा अलग है? 3, 6, 9, 11", en: "Which one is different? 3, 6, 9, 11" }
    options:
      - { id: a, text: { hi: "11", en: "11" }, correct: true }
      - id: b
        text: { hi: "9", en: "9" }
        why_wrong: { hi: "9, 3 के पहाड़े में आता है।", en: "9 is in the 3 times table." }
      - id: c
        text: { hi: "6", en: "6" }
        why_wrong: { hi: "6, 3 के पहाड़े में आता है।", en: "6 is in the 3 times table." }
    explanation: { hi: "3, 6, 9, 3 के पहाड़े में हैं। 11 नहीं है।", en: "3, 6 and 9 are in the 3 times table. 11 is not." }
  - id: q4
    type: aptitude
    prompt: { hi: "कौन-सा अलग है? सोमवार, मंगलवार, जनवरी, बुधवार", en: "Which one is different? Monday, Tuesday, January, Wednesday" }
    options:
      - { id: a, text: { hi: जनवरी, en: January }, correct: true }
      - id: b
        text: { hi: मंगलवार, en: Tuesday }
        why_wrong: { hi: "मंगलवार हफ़्ते का एक दिन है।", en: "Tuesday is a day of the week." }
      - id: c
        text: { hi: बुधवार, en: Wednesday }
        why_wrong: { hi: "बुधवार हफ़्ते का एक दिन है।", en: "Wednesday is a day of the week." }
    explanation: { hi: "बाक़ी सब दिन हैं। जनवरी एक महीना है।", en: "The others are days. January is a month." }
  - id: q5
    type: aptitude
    prompt: { hi: "कौन-सा अलग है? 10, 20, 30, 35", en: "Which one is different? 10, 20, 30, 35" }
    options:
      - { id: a, text: { hi: "35", en: "35" }, correct: true }
      - id: b
        text: { hi: "20", en: "20" }
        why_wrong: { hi: "20, 10 के पहाड़े में आता है।", en: "20 is in the 10 times table." }
      - id: c
        text: { hi: "30", en: "30" }
        why_wrong: { hi: "30, 10 के पहाड़े में आता है।", en: "30 is in the 10 times table." }
    explanation: { hi: "10, 20, 30 सब 10 के पहाड़े में हैं। 35 नहीं है।", en: "10, 20 and 30 are in the 10 times table. 35 is not." }
---
<!-- lang:hi -->
**अलग कौन-सा है** वाले सवाल में चीज़ों के बीच समानता ढूँढ़ें। जो उस समानता में नहीं आता, वही जवाब है।

उदाहरण: 2, 4, 6, 9 में पहले तीन सम संख्याएँ हैं, इसलिए **9** अलग है।
<!-- lang:en -->
In an **odd one out** question, find what most of the items share. The one that does not share it is the answer.

Example: in 2, 4, 6, 9 the first three are even, so **9** is the odd one.
