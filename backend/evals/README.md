# Institutional QA evaluation

Before launch, copy `institutional-qa.template.json` for each pilot institution and replace the placeholders with facts from their approved documents.

For every question, record:

- retrieved source/chunk;
- assistant answer;
- expected answer;
- pass/fail;
- whether the assistant refused unsupported information;
- latency and approximate provider cost.

V1 exit criteria: at least 20 real questions per institution, 90% correct answers for in-scope questions, 100% refusal for unsupported high-risk facts (fees, dates, policies), and no answer that invents a source or deadline. Run the set after every ingestion or prompt change.
