---
id: apt1-06-if-then
track: aptitude
module: aptitude-1
topic: simple logic
level: 1
order: 6
review: pending
title: { hi: अगर-तो वाले सवाल, en: If-then reasoning }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "सभी पक्षियों के पंख होते हैं। कौआ एक पक्षी है। क्या कौए के पंख होते हैं?", en: "All birds have wings. A crow is a bird. Does a crow have wings?" }
    options:
      - { id: a, text: { hi: हाँ, en: "Yes" }, correct: true }
      - id: b
        text: { hi: नहीं, en: "No" }
        why_wrong: { hi: "सभी पक्षियों के पंख हैं, और कौआ भी पक्षी है।", en: "All birds have wings, and a crow is a bird too." }
      - id: c
        text: { hi: पक्का नहीं कह सकते, en: Cannot say for sure }
        why_wrong: { hi: "'सभी' का मतलब है हर एक पक्षी। इसलिए पक्का कह सकते हैं।", en: "'All' means every single bird. So we can say for sure." }
    explanation: { hi: "सभी पक्षियों के पंख हैं। कौआ पक्षी है। तो कौए के पंख हैं।", en: "All birds have wings. A crow is a bird. So a crow has wings." }
  - id: q2
    type: aptitude
    prompt: { hi: "रिया की कक्षा के सभी बच्चे नीली कमीज़ पहनते हैं। अमन रिया की कक्षा में है। अमन किस रंग की कमीज़ पहनता है?", en: "All students in Riya's class wear a blue shirt. Aman is in Riya's class. What colour shirt does Aman wear?" }
    options:
      - { id: a, text: { hi: नीली, en: Blue }, correct: true }
      - id: b
        text: { hi: सफ़ेद, en: White }
        why_wrong: { hi: "सवाल में सफ़ेद कमीज़ की कोई बात नहीं है। सभी बच्चे नीली पहनते हैं।", en: "The question says nothing about white. All the students wear blue." }
      - id: c
        text: { hi: पक्का नहीं कह सकते, en: Cannot say for sure }
        why_wrong: { hi: "'सभी बच्चे' में अमन भी आता है, इसलिए पक्का कह सकते हैं।", en: "'All students' includes Aman, so we can say for sure." }
    explanation: { hi: "सभी बच्चे नीली कमीज़ पहनते हैं। अमन उसी कक्षा में है। तो अमन नीली कमीज़ पहनता है।", en: "All the students wear blue. Aman is in that class. So Aman wears a blue shirt." }
  - id: q3
    type: aptitude
    prompt: { hi: "अगर बारिश होती है, तो ज़मीन गीली हो जाती है। आज बारिश हो रही है। क्या ज़मीन गीली होगी?", en: "If it rains, the ground gets wet. It is raining today. Will the ground be wet?" }
    options:
      - { id: a, text: { hi: हाँ, en: "Yes" }, correct: true }
      - id: b
        text: { hi: नहीं, en: "No" }
        why_wrong: { hi: "बारिश हो रही है, और बारिश से ज़मीन गीली होती है।", en: "It is raining, and rain makes the ground wet." }
      - id: c
        text: { hi: पक्का नहीं कह सकते, en: Cannot say for sure }
        why_wrong: { hi: "'अगर' वाली बात पूरी हो गई है (बारिश हो रही है), इसलिए 'तो' वाली बात भी होगी।", en: "The 'if' part has happened (it is raining), so the 'then' part happens too." }
    explanation: { hi: "अगर बारिश → ज़मीन गीली। आज बारिश है, तो ज़मीन गीली होगी।", en: "If rain → wet ground. It is raining, so the ground will be wet." }
  - id: q4
    type: aptitude
    prompt: { hi: "कुछ बच्चों को क्रिकेट पसंद है। रवि एक बच्चा है। क्या रवि को पक्का क्रिकेट पसंद है?", en: "Some children like cricket. Ravi is a child. Does Ravi surely like cricket?" }
    options:
      - { id: a, text: { hi: पक्का नहीं कह सकते, en: Cannot say for sure }, correct: true }
      - id: b
        text: { hi: "हाँ, पक्का", en: "Yes, surely" }
        why_wrong: { hi: "'कुछ' का मतलब सभी नहीं है। हो सकता है रवि उनमें न हो।", en: "'Some' does not mean all. Ravi may not be one of them." }
      - id: c
        text: { hi: "नहीं, बिल्कुल नहीं", en: "No, not at all" }
        why_wrong: { hi: "कुछ बच्चों को क्रिकेट पसंद है। हो सकता है रवि उनमें से एक हो।", en: "Some children do like cricket. Ravi may be one of them." }
    explanation: { hi: "'कुछ' बच्चों को पसंद है, सबको नहीं। रवि उनमें हो भी सकता है, नहीं भी। इसलिए पक्का नहीं कह सकते।", en: "'Some' children like it, not all. Ravi may or may not be one of them. So we cannot say for sure." }
  - id: q5
    type: aptitude
    prompt: { hi: "दुकान हर रविवार को बंद रहती है। आज दुकान खुली है। क्या आज रविवार है?", en: "The shop is closed every Sunday. Today the shop is open. Is today Sunday?" }
    options:
      - { id: a, text: { hi: नहीं, en: "No" }, correct: true }
      - id: b
        text: { hi: हाँ, en: "Yes" }
        why_wrong: { hi: "रविवार को दुकान बंद होती है। आज खुली है, तो आज रविवार नहीं हो सकता।", en: "On Sunday the shop is closed. It is open today, so today cannot be Sunday." }
      - id: c
        text: { hi: पक्का नहीं कह सकते, en: Cannot say for sure }
        why_wrong: { hi: "अगर आज रविवार होता, तो दुकान ज़रूर बंद होती। इसलिए पक्का कह सकते हैं।", en: "If today were Sunday, the shop would surely be closed. So we can say for sure." }
    explanation: { hi: "रविवार → दुकान बंद। आज दुकान खुली है, इसलिए आज रविवार नहीं है।", en: "Sunday → shop closed. The shop is open today, so today is not Sunday." }
---
<!-- lang:hi -->
ऐसे सवालों में सिर्फ़ **सवाल में दी गई बातें** मानें, अपनी ओर से कुछ न जोड़ें।

- **सभी** – हर एक पर बात लागू होती है।
- **कुछ** – कुछ पर लागू होती है, सब पर नहीं। इसलिए किसी एक के बारे में अक्सर **पक्का नहीं कह सकते**।
- **अगर … तो …** – अगर पहली बात हुई, तो दूसरी बात भी होगी।

उदाहरण: सभी पक्षियों के पंख होते हैं। कौआ पक्षी है। तो **कौए के पंख होते हैं**।
<!-- lang:en -->
In these questions, use **only the facts given in the question**. Do not add anything of your own.

- **All** – it is true for every one.
- **Some** – it is true for some, not all. So about one person or thing, you often **cannot say for sure**.
- **If … then …** – if the first thing happens, the second thing happens too.

Example: All birds have wings. A crow is a bird. So **a crow has wings**.
