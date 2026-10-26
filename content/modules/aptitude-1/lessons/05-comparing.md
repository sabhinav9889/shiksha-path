---
id: apt1-05-comparing
track: aptitude
module: aptitude-1
topic: comparing
level: 1
order: 5
review: approved
title: { hi: तुलना करना, en: Comparing }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "रवि, अमन से लंबा है। अमन, सीमा से लंबा है। सबसे लंबा कौन है?", en: "Ravi is taller than Aman. Aman is taller than Seema. Who is the tallest?" }
    options:
      - { id: a, text: { hi: रवि, en: Ravi }, correct: true }
      - id: b
        text: { hi: अमन, en: Aman }
        why_wrong: { hi: "अमन, सीमा से लंबा है, पर रवि अमन से भी लंबा है।", en: "Aman is taller than Seema, but Ravi is taller than Aman." }
      - id: c
        text: { hi: सीमा, en: Seema }
        why_wrong: { hi: "सीमा तो सबसे छोटी है। अमन उससे लंबा है।", en: "Seema is the shortest. Aman is taller than her." }
    explanation: { hi: "क्रम: रवि > अमन > सीमा। सबसे लंबा रवि है।", en: "Order: Ravi > Aman > Seema. Ravi is the tallest." }
  - id: q2
    type: aptitude
    prompt: { hi: "रिया, प्रिया से भारी है। प्रिया, सीमा से भारी है। सबसे हल्का कौन है?", en: "Riya is heavier than Priya. Priya is heavier than Seema. Who is the lightest?" }
    options:
      - { id: a, text: { hi: सीमा, en: Seema }, correct: true }
      - id: b
        text: { hi: रिया, en: Riya }
        why_wrong: { hi: "रिया सबसे भारी है। सवाल सबसे हल्के का है।", en: "Riya is the heaviest. The question asks for the lightest." }
      - id: c
        text: { hi: प्रिया, en: Priya }
        why_wrong: { hi: "प्रिया, सीमा से भारी है, इसलिए सबसे हल्की नहीं है।", en: "Priya is heavier than Seema, so she is not the lightest." }
    explanation: { hi: "क्रम: रिया > प्रिया > सीमा। सबसे हल्की सीमा है।", en: "Order: Riya > Priya > Seema. Seema is the lightest." }
  - id: q3
    type: aptitude
    prompt: { hi: "सबसे बड़ी संख्या कौन-सी है? 405, 450, 54, 504", en: "Which is the biggest number? 405, 450, 54, 504" }
    options:
      - { id: a, text: { hi: "504", en: "504" }, correct: true }
      - id: b
        text: { hi: "450", en: "450" }
        why_wrong: { hi: "पहले सैकड़े का अंक देखें। 504 में 5 है, 450 में 4।", en: "Look at the hundreds digit first. 504 has 5, 450 has 4." }
      - id: c
        text: { hi: "54", en: "54" }
        why_wrong: { hi: "54 में सिर्फ़ दो अंक हैं। तीन अंकों वाली संख्या बड़ी होती है।", en: "54 has only two digits. A three-digit number is bigger." }
      - id: d
        text: { hi: "405", en: "405" }
        why_wrong: { hi: "405 में सैकड़े का अंक 4 है, जो 5 से छोटा है।", en: "405 has 4 in the hundreds place, which is less than 5." }
    explanation: { hi: "सैकड़े का अंक: 504 में 5, 450 और 405 में 4। इसलिए 504 सबसे बड़ी है।", en: "Hundreds digit: 5 in 504, 4 in 450 and 405. So 504 is the biggest." }
  - id: q4
    type: aptitude
    prompt: { hi: "सबसे छोटी संख्या कौन-सी है? 98, 89, 809, 890", en: "Which is the smallest number? 98, 89, 809, 890" }
    options:
      - { id: a, text: { hi: "89", en: "89" }, correct: true }
      - id: b
        text: { hi: "98", en: "98" }
        why_wrong: { hi: "98 में दहाई का अंक 9 है, 89 में 8। इसलिए 89 छोटी है।", en: "98 has 9 tens, 89 has 8 tens. So 89 is smaller." }
      - id: c
        text: { hi: "809", en: "809" }
        why_wrong: { hi: "809 तीन अंकों की संख्या है। यह दो अंकों वाली संख्याओं से बड़ी है।", en: "809 has three digits. It is bigger than the two-digit numbers." }
    explanation: { hi: "दो अंकों वाली 98 और 89 छोटी हैं। दहाई में 8 < 9, इसलिए 89 सबसे छोटी है।", en: "The two-digit numbers 98 and 89 are smaller. In the tens, 8 < 9, so 89 is the smallest." }
  - id: q5
    type: aptitude
    prompt: { hi: "अमन, रवि से तेज़ दौड़ता है। प्रिया, अमन से तेज़ दौड़ती है। सबसे धीमा कौन है?", en: "Aman runs faster than Ravi. Priya runs faster than Aman. Who is the slowest?" }
    options:
      - { id: a, text: { hi: रवि, en: Ravi }, correct: true }
      - id: b
        text: { hi: प्रिया, en: Priya }
        why_wrong: { hi: "प्रिया सबसे तेज़ है। सवाल सबसे धीमे का है।", en: "Priya is the fastest. The question asks for the slowest." }
      - id: c
        text: { hi: अमन, en: Aman }
        why_wrong: { hi: "अमन, रवि से तेज़ है, इसलिए सबसे धीमा नहीं है।", en: "Aman is faster than Ravi, so he is not the slowest." }
    explanation: { hi: "क्रम (तेज़ से धीमा): प्रिया > अमन > रवि। सबसे धीमा रवि है।", en: "Order (fast to slow): Priya > Aman > Ravi. Ravi is the slowest." }
  - id: q6
    type: aptitude
    prompt: { hi: "थैला A का वज़न 5 किलो है। थैला B, A से 2 किलो भारी है। थैला C, B से 1 किलो हल्का है। सबसे भारी थैला कौन-सा है?", en: "Bag A weighs 5 kg. Bag B is 2 kg heavier than A. Bag C is 1 kg lighter than B. Which bag is the heaviest?" }
    options:
      - { id: a, text: { hi: थैला B, en: Bag B }, correct: true }
      - id: b
        text: { hi: थैला C, en: Bag C }
        why_wrong: { hi: "C, B से 1 किलो हल्का है: 7 − 1 = 6 किलो।", en: "C is 1 kg lighter than B: 7 − 1 = 6 kg." }
      - id: c
        text: { hi: थैला A, en: Bag A }
        why_wrong: { hi: "A सिर्फ़ 5 किलो का है। B उससे 2 किलो भारी है।", en: "A is only 5 kg. B is 2 kg heavier." }
    explanation: { hi: "A = 5 किलो, B = 5 + 2 = 7 किलो, C = 7 − 1 = 6 किलो। सबसे भारी B है।", en: "A = 5 kg, B = 5 + 2 = 7 kg, C = 7 − 1 = 6 kg. B is the heaviest." }
---
<!-- lang:hi -->
तुलना वाले सवाल में सबको **एक लाइन में क्रम से** लिख लें।

उदाहरण: रवि, अमन से लंबा है। अमन, सीमा से लंबा है।
लाइन बनेगी: **रवि > अमन > सीमा**। अब सबसे लंबा (रवि) और सबसे छोटा (सीमा) आसानी से दिखता है।

संख्याओं की तुलना में:

- ज़्यादा अंकों वाली संख्या बड़ी होती है (504 > 54)।
- अंक बराबर हों, तो **बाईं ओर से** एक-एक अंक मिलाएँ (504 > 450)।
<!-- lang:en -->
In a comparing question, write everyone **in order on one line**.

Example: Ravi is taller than Aman. Aman is taller than Seema.
The line is: **Ravi > Aman > Seema**. Now the tallest (Ravi) and the shortest (Seema) are easy to see.

When comparing numbers:

- A number with more digits is bigger (504 > 54).
- If they have the same number of digits, compare digit by digit **from the left** (504 > 450).
