# Third-party integration policy

ScholarFlow uses stable package/API boundaries instead of copying third-party source into business code:

- OpenAlex is called through its public HTTP API.
- PDF parsing uses the `pypdf` adapter included in the minimal runtime; the API boundary is compatible with a future Docling deployment.
- Evidence QA uses local, citation-returning retrieval when an LLM key is absent.
- Pandas, NumPy, SciPy and Matplotlib perform numerical analysis.

GPT Researcher, PaperQA2 and Docling were not vendored into the default demo because their model/runtime dependencies would substantially increase setup risk. They can be added as isolated services behind the existing tool API without changing the frontend or GeniOS schemas. No GPL source is copied into ScholarFlow.
