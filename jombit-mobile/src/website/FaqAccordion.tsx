import { useState } from "react";
import { questions } from "./content";

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="m-faq-list">{questions.map(({ question, answer }, index) => <div className="m-faq-item" key={question}>
    <h3><button type="button" id={`faq-question-${index}`} aria-expanded={open === index} aria-controls={`faq-answer-${index}`} onClick={() => setOpen(open === index ? null : index)}>{question}<span className="m-faq-plus" aria-hidden="true" /></button></h3>
    <div id={`faq-answer-${index}`} className={`m-faq-answer ${open === index ? "is-open" : ""}`} role="region" aria-labelledby={`faq-question-${index}`} aria-hidden={open !== index} inert={open !== index}><div><p>{answer}</p></div></div>
  </div>)}</div>;
}
