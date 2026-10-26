---
id: apt1-08-time-and-calendar
track: aptitude
module: aptitude-1
topic: time and calendar
level: 1
order: 8
review: pending
title: { hi: समय और कैलेंडर, en: Time and calendar }
items:
  - id: q1
    type: aptitude
    prompt: { hi: "आज सोमवार है। 3 दिन बाद कौन-सा दिन होगा?", en: "Today is Monday. What day will it be after 3 days?" }
    options:
      - { id: a, text: { hi: गुरुवार, en: Thursday }, correct: true }
      - id: b
        text: { hi: बुधवार, en: Wednesday }
        why_wrong: { hi: "आज (सोमवार) को नहीं गिनना है। अगले दिन से गिनें: मंगलवार 1, बुधवार 2, गुरुवार 3।", en: "Do not count today (Monday). Start from the next day: Tuesday 1, Wednesday 2, Thursday 3." }
      - id: c
        text: { hi: शुक्रवार, en: Friday }
        why_wrong: { hi: "शुक्रवार 4 दिन बाद आता है, 3 दिन बाद नहीं।", en: "Friday comes after 4 days, not 3." }
    explanation: { hi: "सोमवार → मंगलवार (1) → बुधवार (2) → गुरुवार (3)", en: "Monday → Tuesday (1) → Wednesday (2) → Thursday (3)" }
  - id: q2
    type: aptitude
    prompt: { hi: "क्लास सुबह 9 बजे शुरू होती है और 2 घंटे चलती है। क्लास कब ख़त्म होगी?", en: "A class starts at 9 in the morning and lasts 2 hours. When does it end?" }
    options:
      - { id: a, text: { hi: "सुबह 11 बजे", en: "11 in the morning" }, correct: true }
      - id: b
        text: { hi: "सुबह 10 बजे", en: "10 in the morning" }
        why_wrong: { hi: "10 बजे तक सिर्फ़ 1 घंटा होता है। क्लास 2 घंटे की है।", en: "Until 10 is only 1 hour. The class is 2 hours long." }
      - id: c
        text: { hi: "सुबह 7 बजे", en: "7 in the morning" }
        why_wrong: { hi: "ख़त्म होने का समय बाद में आता है, इसलिए 2 घंटे जोड़ें, घटाएँ नहीं।", en: "The end time comes later, so add 2 hours, do not subtract." }
    explanation: { hi: "9 + 2 = 11, यानी सुबह 11 बजे।", en: "9 + 2 = 11, so 11 in the morning." }
  - id: q3
    type: aptitude
    prompt: { hi: "एक हफ़्ते में कितने दिन होते हैं?", en: "How many days are there in a week?" }
    options:
      - { id: a, text: { hi: "7", en: "7" }, correct: true }
      - id: b
        text: { hi: "5", en: "5" }
        why_wrong: { hi: "सोमवार से शुक्रवार 5 दिन हैं, पर शनिवार और रविवार भी हफ़्ते में आते हैं।", en: "Monday to Friday is 5 days, but Saturday and Sunday are also in the week." }
      - id: c
        text: { hi: "6", en: "6" }
        why_wrong: { hi: "रविवार को भी गिनना है। कुल 7 दिन होते हैं।", en: "Count Sunday too. There are 7 days in all." }
    explanation: { hi: "सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार = 7 दिन", en: "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday = 7 days" }
  - id: q4
    type: aptitude
    prompt: { hi: "मार्च के बाद कौन-सा महीना आता है?", en: "Which month comes after March?" }
    options:
      - { id: a, text: { hi: अप्रैल, en: April }, correct: true }
      - id: b
        text: { hi: मई, en: May }
        why_wrong: { hi: "मई, अप्रैल के बाद आता है। मार्च के ठीक बाद अप्रैल है।", en: "May comes after April. April comes right after March." }
      - id: c
        text: { hi: फ़रवरी, en: February }
        why_wrong: { hi: "फ़रवरी, मार्च से पहले आता है, बाद में नहीं।", en: "February comes before March, not after." }
    explanation: { hi: "जनवरी, फ़रवरी, मार्च, अप्रैल – मार्च के बाद अप्रैल।", en: "January, February, March, April – April comes after March." }
  - id: q5
    type: aptitude
    prompt: { hi: "आज शुक्रवार है। कल (बीता हुआ) कौन-सा दिन था?", en: "Today is Friday. What day was yesterday?" }
    options:
      - { id: a, text: { hi: गुरुवार, en: Thursday }, correct: true }
      - id: b
        text: { hi: शनिवार, en: Saturday }
        why_wrong: { hi: "शनिवार आने वाला कल है। बीता हुआ कल गुरुवार था।", en: "Saturday is tomorrow. Yesterday was Thursday." }
      - id: c
        text: { hi: बुधवार, en: Wednesday }
        why_wrong: { hi: "बुधवार 2 दिन पहले था। कल सिर्फ़ 1 दिन पहले है।", en: "Wednesday was 2 days ago. Yesterday is just 1 day ago." }
    explanation: { hi: "शुक्रवार से 1 दिन पीछे = गुरुवार।", en: "One day before Friday = Thursday." }
  - id: q6
    type: aptitude
    prompt: { hi: "रिया की परीक्षा 2 हफ़्ते बाद है। यह कितने दिन बाद है?", en: "Riya's exam is 2 weeks away. How many days is that?" }
    options:
      - { id: a, text: { hi: "14 दिन", en: "14 days" }, correct: true }
      - id: b
        text: { hi: "7 दिन", en: "7 days" }
        why_wrong: { hi: "7 दिन सिर्फ़ 1 हफ़्ता है। यहाँ 2 हफ़्ते हैं।", en: "7 days is only 1 week. Here it is 2 weeks." }
      - id: c
        text: { hi: "9 दिन", en: "9 days" }
        why_wrong: { hi: "7 + 2 नहीं, 7 × 2 करना है।", en: "Do 7 × 2, not 7 + 2." }
    explanation: { hi: "1 हफ़्ता = 7 दिन। 7 × 2 = 14 दिन", en: "1 week = 7 days. 7 × 2 = 14 days" }
---
<!-- lang:hi -->
दिनों और महीनों का **क्रम याद** रखें:

- दिन: सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार (हफ़्ते में 7 दिन)
- महीने: जनवरी, फ़रवरी, मार्च, अप्रैल, मई, जून, जुलाई, अगस्त, सितंबर, अक्टूबर, नवंबर, दिसंबर (साल में 12 महीने)

"3 दिन बाद" गिनते समय **आज को न गिनें**, अगले दिन से 1, 2, 3 गिनें।

समय में: शुरू होने का समय + कितने घंटे = ख़त्म होने का समय। जैसे 9 बजे + 2 घंटे = **11 बजे**।
<!-- lang:en -->
Remember the **order** of days and months:

- Days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (7 days in a week)
- Months: January, February, March, April, May, June, July, August, September, October, November, December (12 months in a year)

When counting "3 days after", **do not count today**. Count 1, 2, 3 from the next day.

For time: start time + number of hours = end time. For example, 9 o'clock + 2 hours = **11 o'clock**.
