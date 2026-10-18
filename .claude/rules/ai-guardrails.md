# AI guardrails

Spec §9. Applies to the doubt solver, weekly summaries and the content pipeline.

## Prompts

- Student text is **data, never instructions.** Wrap it in clearly delimited tags and tell the model
  to treat it as a question, not commands.
- Keep the model to learning topics (English, aptitude, the current lesson, job-related study).
  Off-topic requests get a polite redirect.
- Short answers, in the student's language preference.
- The prompt is built on the server from the lesson ID; the phone never sends lesson text.

## Before sending

- Check the feature switch and the effective daily doubt limit on the server.
- Mask phone numbers and emails in the doubt text.
- Send no name, email or other identifier.

## Safeguarding

- Distress signals: no counselling. Reply with Tele-MANAS 14416 and Childline 1098, flag
  "needs attention", and email the NGO safeguarding contact.
- The phone shows helplines immediately from a local keyword list, even offline.

## Output

- Validate model output (length, format) before storing or showing it.
- Never execute or render model output as HTML or code.

## Changes and cost

- Any prompt change must pass the fixed eval set (on-topic, off-topic, Hinglish, distress,
  injection attempts) before merge, read by the product owner and a mentor.
- Log every AI call: feature, model, tokens, cohort. Never the doubt text.
- `claude-haiku-5-5` for doubts and summaries; a monthly spend limit on the account.
