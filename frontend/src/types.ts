export type NextAction = { stage: string; title: string; reason: string; instruction: string; progress: number }
export type Project = {
  id: number; name: string; idea: string; direction: string; description: string; stage: string;
  research_questions: string[]; keywords: string[]; research_gap: string; gap_citations: number[];
  hypotheses: string[]; paper_count: number; core_paper_count: number; read_paper_count: number;
  evidence_count: number; claim_count: number; experiment_count: number; completed_experiment_count: number;
  analysis_count: number; manuscript_filled: number; progress: number; next_action: NextAction;
  tasks: { id:number; title:string; phase:string; done:boolean }[]; created_at:string; updated_at:string;
}
export type Paper = {
  id:number; project_id:number; title:string; authors:string[]; year?:number; venue:string; doi?:string;
  cited_by_count:number; abstract:string; source:string; source_id?:string; relevance:number; status:string;
  is_core:boolean; tags:string[]; notes:string; full_text:string; sections:{title:string;content:string}[];
  evidence?: Evidence[];
}
export type Evidence = {
  id:number; project_id:number; paper_id:number; paper_title?:string; problem:string; method:string; dataset:string;
  baseline:string; metric:string; result:string; limitation:string; source_section:string; source_snippet:string; confidence:number;
}
export type ClaimLink = { paper_id:number; paper_title:string; stance:string; snippet:string; evidence_id:number }
export type Claim = { id:number; text:string; confidence:number; notes:string; links:ClaimLink[] }
export type Experiment = { id?:number; name:string; research_question:string; hypothesis:string; description:string; status:string; input:string; dataset:string; metrics:string[]; result:string; notes:string }
export type Manuscript = { id:number; section:string; content:string; updated_at:string }
export type Analysis = { id:number; filename:string; summary:{ overview:Record<string,unknown>; tests:Record<string,unknown>[]; charts:string[]; recommendations:string[] }; charts:string[]; created_at:string }
