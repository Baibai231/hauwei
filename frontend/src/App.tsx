import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, Beaker, BookMarked, BookOpen, Bot, BrainCircuit, Check,
  CheckCircle2, ChevronRight, Circle, CircleAlert, ClipboardCheck, Cloud, Database, Download,
  ExternalLink, FileSearch, FileText, FlaskConical, FolderKanban, GitBranch, GraduationCap,
  Lightbulb, ListChecks, LoaderCircle, Menu, Network, PenLine, Plus, Quote, RefreshCw, Search,
  Settings, ShieldCheck, Sparkles, Target, Upload, X, Zap,
} from 'lucide-react'
import { json, request } from './api'
import { useI18n } from './i18n'
import type { Analysis, Claim, Evidence, Experiment, Manuscript, Paper, Project } from './types'

const workflow = [
  ['Idea', Lightbulb], ['Literature', BookOpen], ['Evidence', Quote], ['Research Gap', FileSearch],
  ['Experiment', FlaskConical], ['Analysis', BarChart3], ['Writing', PenLine],
] as const

const experimentStatuses = ['Planned', 'Ready', 'Running', 'Completed', 'Failed'] as const

type Toast = { id:number; message:string; kind:'success'|'error' }

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message:string, kind:Toast['kind']='success') => {
    const id = Date.now() + Math.random()
    setToasts(items => [...items, { id, message, kind }])
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 3600)
  }, [])
  return <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/projects" element={<ProjectsPage notify={notify} />} />
      <Route path="/projects/:id" element={<Workspace notify={notify}><Dashboard /></Workspace>} />
      <Route path="/projects/:id/research" element={<Workspace notify={notify}><ResearchPlanner /></Workspace>} />
      <Route path="/projects/:id/literature" element={<Workspace notify={notify}><Literature /></Workspace>} />
      <Route path="/projects/:id/papers/:paperId" element={<Workspace notify={notify}><PaperReader /></Workspace>} />
      <Route path="/projects/:id/evidence" element={<Workspace notify={notify}><EvidenceWorkspace /></Workspace>} />
      <Route path="/projects/:id/research-design" element={<Workspace notify={notify}><ResearchDesign /></Workspace>} />
      <Route path="/projects/:id/experiments" element={<Workspace notify={notify}><Experiments /></Workspace>} />
      <Route path="/projects/:id/analysis" element={<Workspace notify={notify}><AnalysisWorkspace /></Workspace>} />
      <Route path="/projects/:id/writing" element={<Workspace notify={notify}><Writing /></Workspace>} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <div className="toast-stack">{toasts.map(toast => <div key={toast.id} className={`toast ${toast.kind}`}>
      {toast.kind === 'success' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span>{toast.message}</span>
    </div>)}</div>
  </>
}

function Landing() {
  const {t}=useI18n()
  return <main className="landing">
    <nav className="landing-nav container">
      <Brand />
      <div className="nav-links"><a href="#workflow">{t('Workflow')}</a><a href="#capabilities">{t('Capabilities')}</a><Link to="/settings">GeniOS</Link></div>
      <Link className="button small" to="/projects">{t('Open Workspace')} <ArrowRight size={15}/></Link>
    </nav>
    <section className="hero container">
      <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
      <div className="eyebrow"><Sparkles size={14}/> {t('GeniOS-powered Research Agent')}</div>
      <h1>{t('From Idea')}<br/>{t('to')} <span>{t('Evidence.')}</span></h1>
      <p className="hero-cn">{t('Let AI take part in the whole research process.')}</p>
      <p className="hero-copy">{t('ScholarFlow is not another chat box. It understands your research state, organises every piece of evidence, and keeps deciding the next research action.')}</p>
      <div className="hero-actions">
        <Link to="/projects" className="button primary large">{t('Start Research')} <ArrowRight size={18}/></Link>
        <Link to="/projects/1" className="button ghost large">{t('View Demo Project')}</Link>
      </div>
      <div className="hero-proof"><span><Check size={15}/> {t('Evidence traceable')}</span><span><Check size={15}/> {t('Project-aware')}</span><span><Check size={15}/> {t('Works without API key')}</span></div>
    </section>
    <section id="workflow" className="workflow-band">
      <div className="container"><div className="section-kicker">{t('ONE CONTINUOUS RESEARCH FLOW')}</div>
        <div className="workflow-row">{workflow.map(([name, Icon], index) => <div className="workflow-item" key={name}>
          <div className="workflow-icon"><Icon size={20}/></div><span>{t(name)}</span>{index < workflow.length - 1 && <ChevronRight className="workflow-arrow" size={18}/>}</div>)}</div>
      </div>
    </section>
    <section id="capabilities" className="features container">
      <div className="feature-heading"><div><div className="section-kicker">{t('RESEARCH, WITH MEMORY')}</div><h2>{t('Research no longer scatters.')}</h2></div><p>{t('From a fuzzy idea to citable manuscript paragraphs, every object lives in one traceable project state.')}</p></div>
      <div className="feature-grid">
        <Feature icon={<BrainCircuit/>} title={t('Agent State Machine')} text={t('A deterministic state machine decides the stage; the GeniOS Agent orchestrates the research tools.')} tone="blue"/>
        <Feature icon={<Network/>} title={t('Evidence Graph')} text={t('Claims, papers and evidence snippets form a graph so every conclusion traces back to its source.')} tone="cyan"/>
        <Feature icon={<Database/>} title={t('Research Memory')} text={t('Literature, experiments, analysis and drafts become project-level long-term memory.')} tone="violet"/>
      </div>
    </section>
    <footer className="landing-footer container"><Brand/><span>{t('Built for responsible, evidence-first research.')}</span><span>{t('GeniOS Agent orchestration ready')}</span></footer>
  </main>
}

function Feature({icon,title,text,tone}:{icon:ReactNode;title:string;text:string;tone:string}) {
  const {t}=useI18n()
  return <Link to="/projects" className={`feature-card ${tone}`}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><span>{t('Explore capability')} <ArrowRight size={14}/></span></Link>
}

function Brand() { return <Link to="/" className="brand"><span className="brand-mark"><GraduationCap size={22}/></span><span>ScholarFlow</span></Link> }

function ProjectsPage({notify}:{notify:(m:string,k?:Toast['kind'])=>void}) {
  const {t,lang}=useI18n()
  const [projects,setProjects] = useState<Project[]>([])
  const [loading,setLoading] = useState(true)
  const [open,setOpen] = useState(false)
  const navigate = useNavigate()
  const load = useCallback(() => request<Project[]>(`/api/projects?lang=${lang}`).then(setProjects).catch(e=>notify(e.message,'error')).finally(()=>setLoading(false)),[notify,lang])
  useEffect(()=>{ void load() },[load])
  async function create(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    try {
      const project = await request<Project>('/api/projects', json('POST', Object.fromEntries(data)))
      notify(t('Research project created')); navigate(`/projects/${project.id}/research`)
    } catch(error) { notify((error as Error).message,'error') }
  }
  return <div className="projects-page">
    <header className="projects-header container"><Brand/><div><Link className="button ghost small" to="/settings"><Settings size={16}/> {t('Settings')}</Link><button className="button primary small" onClick={()=>setOpen(true)}><Plus size={16}/> {t('New Project')}</button></div></header>
    <section className="projects-hero container"><div><div className="eyebrow"><FolderKanban size={14}/> {t('Research Projects')}</div><h1>{t('Your research workbench')}</h1><p>{t('Every project keeps its own research state, literature evidence and next action.')}</p></div><div className="mini-agent"><span><Bot size={18}/> {t('GeniOS Agent')}</span><b>{t('{n} projects in memory',{n:projects.length})}</b></div></section>
    <section className="container project-grid">{loading ? <Loader /> : projects.map(p=><Link to={`/projects/${p.id}`} className="project-card" key={p.id}>
      <div className="project-top"><span className="project-direction">{p.direction || t('Research')}</span><ArrowRight size={18}/></div>
      <h2>{p.name}</h2><p>{p.description || p.idea}</p>
      <div className="project-metrics"><span><BookOpen size={15}/>{t('{n} papers',{n:p.paper_count})}</span><span><Quote size={15}/>{t('{n} evidence',{n:p.evidence_count})}</span><span><Beaker size={15}/>{t('{n} experiments',{n:p.experiment_count})}</span></div>
      <div className="progress-label"><span>{p.next_action.title}</span><b>{p.progress}%</b></div><div className="progress"><i style={{width:`${p.progress}%`}}/></div>
    </Link>)}</section>
    {open && <Modal title={t('Create research project')} onClose={()=>setOpen(false)}><form onSubmit={create} className="form-stack">
      <label>{t('Project name')}<input name="name" required placeholder={t('e.g. LLM + Vulnerability Detection')}/></label>
      <label>{t('Rough research idea')}<textarea name="idea" required rows={4} placeholder={t('What do you want to study? No need to turn it into formal questions yet.')}/></label>
      <div className="two-col"><label>{t('Research direction')}<input name="direction" placeholder="AI Security"/></label><label>{t('Project description')}<input name="description" placeholder={t('Optional scope note')}/></label></div>
      <button className="button primary" type="submit">{t('Create and open Research Planner')} <ArrowRight size={16}/></button>
    </form></Modal>}
  </div>
}

type WorkspaceContextValue = { project:Project|null; reload:()=>Promise<void>; notify:(m:string,k?:Toast['kind'])=>void }
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace context unavailable')
  return context
}

function Workspace({children,notify}:{children:ReactNode;notify:(m:string,k?:Toast['kind'])=>void}) {
  const {t,lang}=useI18n()
  const {id=''}=useParams(); const [project,setProject]=useState<Project|null>(null); const [menu,setMenu]=useState(false)
  const reload=useCallback(async()=>{ try{setProject(await request<Project>(`/api/projects/${id}?lang=${lang}`))}catch(e){notify((e as Error).message,'error')} },[id,notify,lang])
  useEffect(()=>{ setProject(null); void reload() },[reload])
  const context=useMemo<WorkspaceContextValue>(()=>({project,reload,notify}),[project,reload,notify])
  const items=[
    ['',Activity,'Overview'],['research',Lightbulb,'Research'],['literature',BookOpen,'Literature'],['evidence',Network,'Evidence'],
    ['research-design',Target,'Design'],['experiments',FlaskConical,'Experiments'],['analysis',BarChart3,'Analysis'],['writing',PenLine,'Writing'],
  ] as const
  if(!project || String(project.id)!==id) return <div className="fullscreen-loader"><Loader/></div>
  return <WorkspaceContext.Provider value={context}><div className="app-shell">
    <aside className={`sidebar ${menu?'open':''}`}>
      <div className="sidebar-head"><Brand/><button className="icon-button mobile-only" onClick={()=>setMenu(false)}><X/></button></div>
      <Link to={`/projects/${id}`} className="project-switch"><div className="project-avatar">{project.name.slice(0,2).toUpperCase()}</div><div><small>{t('ACTIVE PROJECT')}</small><b>{project.name}</b></div><ChevronRight size={16}/></Link>
      <nav className="sidebar-nav">{items.map(([path,Icon,label])=><NavLink end={path===''} key={label} onClick={()=>setMenu(false)} to={`/projects/${id}${path?`/${path}`:''}`}><Icon size={18}/><span>{t(label)}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/settings"><Settings size={18}/>{t('Settings')}</Link><Link to="/projects"><FolderKanban size={18}/>{t('All Projects')}</Link>
        <div className="genios-chip"><span><Zap size={14}/> {t('GENIOS AGENT')}</span><b>{t('Demo adapter ready')}</b></div>
      </div>
    </aside>
    {menu&&<div className="sidebar-backdrop" onClick={()=>setMenu(false)}/>}
    <div className="shell-main"><header className="topbar"><button className="icon-button mobile-only" onClick={()=>setMenu(true)}><Menu/></button><div><small>{project.direction || t('Research project')}</small><b>{project.name}</b></div><div className="topbar-actions"><span className="sync"><Cloud size={15}/> {t('Local research memory')}</span><div className="agent-avatar"><Bot size={18}/></div></div></header><div className="page-content" key={id}>{children}</div></div>
  </div></WorkspaceContext.Provider>
}

function PageHeader({kicker,title,description,actions}:{kicker:string;title:string;description?:string;actions?:ReactNode}) {
  return <header className="page-header"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</header>
}

function Dashboard() {
  const {t}=useI18n()
  const {project}=useWorkspace(); if(!project)return null
  const stages=[
    ['Research Question',!!project.research_questions.length],['Literature Search',project.paper_count>=5],['Literature Screening',project.core_paper_count>=3],
    ['Evidence Matrix',project.evidence_count>=project.core_paper_count],['Research Gap',!!project.research_gap],['Research Design',project.experiment_count>0],
    ['Experiments',project.completed_experiment_count===project.experiment_count],['Analysis',project.analysis_count>0],['Manuscript',project.manuscript_filled>=8],
  ] as const
  const firstTodo=stages.findIndex(s=>!s[1])
  return <>
    <PageHeader kicker={t('PROJECT OVERVIEW')} title={t('Research cockpit')} description={t('Your research state, evidence coverage and next action in one place.')} actions={<span className="status-pill"><span/> {t('Active research')}</span>}/>
    <section className="dashboard-grid">
      <article className="card progress-card"><div className="card-title"><div><small>{t('RESEARCH PROGRESS')}</small><h2>{project.progress}%</h2></div><CircularProgress value={project.progress}/></div><div className="stage-list">{stages.map(([label,done],i)=><div className={`stage ${done?'done':i===firstTodo?'active':''}`} key={label}>{done?<CheckCircle2/>:i===firstTodo?<Activity/>:<Circle/>}<span>{t(label)}</span>{i===firstTodo&&<em>{t('IN PROGRESS')}</em>}</div>)}</div></article>
      <div className="dashboard-side">
        <article className="card next-action-card"><div className="agent-label"><span><Bot size={16}/> {t('AI NEXT ACTION')}</span><small>{t('Deterministic + reasoning')}</small></div><h2>{project.next_action.title}</h2><p>{project.next_action.reason}</p><div className="next-step"><Sparkles size={17}/><div><small>{t('Suggested next step')}</small><b>{project.next_action.instruction}</b></div></div><Link className="button white" to={stageLink(project.id,project.next_action.stage)}>{t('Start')} <ArrowRight size={16}/></Link></article>
        <div className="metric-grid"><Metric icon={<BookOpen/>} value={project.paper_count} label={t('Papers')} tone="blue"/><Metric icon={<BookMarked/>} value={project.core_paper_count} label={t('Core read')} tone="cyan"/><Metric icon={<Quote/>} value={project.evidence_count} label={t('Evidence')} tone="violet"/><Metric icon={<FlaskConical/>} value={`${project.completed_experiment_count}/${project.experiment_count}`} label={t('Experiments')} tone="orange"/></div>
      </div>
    </section>
    <section className="lower-grid"><article className="card"><div className="card-heading"><div><small>{t('RESEARCH QUESTIONS')}</small><h3>{t('What this project must answer')}</h3></div><Link to={`/projects/${project.id}/research`}>{t('Edit')} <ArrowRight size={14}/></Link></div><div className="rq-list">{project.research_questions.map((q,i)=><div key={q}><span>RQ{i+1}</span><p>{q.replace(/^RQ\d+:\s*/, '')}</p></div>)}</div></article>
      <article className="card"><div className="card-heading"><div><small>{t('PROJECT MEMORY')}</small><h3>{t('Evidence snapshot')}</h3></div><Link to={`/projects/${project.id}/evidence`}>{t('Open graph')} <ArrowRight size={14}/></Link></div><div className="memory-stats"><div><b>{project.claim_count}</b><span>{t('Claims tracked')}</span></div><div><b>{project.evidence_count}</b><span>{t('Source snippets')}</span></div><div><b>{project.gap_citations.length}</b><span>{t('Gap citations')}</span></div></div>{project.research_gap?<blockquote>{project.research_gap}</blockquote>:<Empty compact text={t('Research Gap not analyzed yet')}/>}</article>
    </section>
  </>
}

function CircularProgress({value}:{value:number}) { return <div className="circle-progress" style={{'--value':`${value*3.6}deg`} as React.CSSProperties}><span>{value}</span></div> }
function Metric({icon,value,label,tone}:{icon:ReactNode;value:number|string;label:string;tone:string}) {return <div className={`metric ${tone}`}><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>}
function stageLink(id:number,stage:string){const map:Record<string,string>={research_question:'research',literature:'literature',screening:'literature',evidence:'evidence',gap:'evidence',design:'research-design',experiments:'experiments',analysis:'analysis',writing:'writing',complete:'evidence'};return `/projects/${id}/${map[stage]||''}`}

function ResearchPlanner() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace(); const [busy,setBusy]=useState(false); const [questions,setQuestions]=useState(project?.research_questions||[]); const [keywords,setKeywords]=useState(project?.keywords||[])
  useEffect(()=>{setQuestions(project?.research_questions||[]);setKeywords(project?.keywords||[])},[project])
  if(!project)return null
  async function generate(){setBusy(true);try{const result=await request<{research_questions:string[];keywords:string[];tasks:string[]}>(`/api/projects/${project!.id}/plan`,json('POST',{idea:project!.idea}));setQuestions(result.research_questions);setKeywords(result.keywords);await reload();notify(t('Research plan generated and written to project state'))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function save(){try{await request(`/api/projects/${project!.id}`,json('PATCH',{research_questions:questions,keywords}));await reload();notify(t('Research questions saved'))}catch(e){notify((e as Error).message,'error')}}
  return <><PageHeader kicker={t('RESEARCH PLANNER')} title={t('Turn an idea into testable questions')} description={t('The GeniOS Agent turns a fuzzy idea into goals, questions, keywords and executable tasks.')} actions={<button className="button primary" onClick={generate} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>} {t('Regenerate')}</button>}/>
    <div className="planner-grid"><article className="card idea-card"><small>{t('ORIGINAL IDEA')}</small><Lightbulb/><h3>{project.idea}</h3><p>{project.description}</p><div className="tag-row">{keywords.map(k=><span className="tag" key={k}>{k}</span>)}</div></article>
      <article className="card"><div className="card-heading"><div><small>{t('RESEARCH QUESTIONS')}</small><h3>{t('Editable question set')}</h3></div><button className="button ghost small" onClick={()=>setQuestions([...questions,''])}><Plus size={15}/> {t('Add')}</button></div><div className="question-editor">{questions.map((q,i)=><div key={i}><span>RQ{i+1}</span><textarea value={q.replace(/^RQ\d+:\s*/, '')} onChange={e=>setQuestions(questions.map((v,n)=>n===i?`RQ${i+1}: ${e.target.value}`:v))}/><button className="icon-button" onClick={()=>setQuestions(questions.filter((_,n)=>n!==i))}><X size={16}/></button></div>)}</div><button className="button primary" onClick={save}><Check size={16}/> {t('Save to Project Memory')}</button></article>
    </div><article className="card task-plan"><div className="card-heading"><div><small>{t('AGENT TASK PLAN')}</small><h3>{t('Keep pushing forward from the current state')}</h3></div><span className="status-pill"><span/> {t('{n} tasks',{n:project.tasks.length})}</span></div><div className="task-row">{project.tasks.map((task,i)=><div key={task.id}><span>{String(i+1).padStart(2,'0')}</span><div><b>{task.title}</b><small>{task.phase}</small></div>{task.done?<CheckCircle2 className="success"/>:<Circle/>}</div>)}</div></article>
  </>
}

function Literature() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace(); const [papers,setPapers]=useState<Paper[]>([]); const [results,setResults]=useState<Paper[]>([]); const [query,setQuery]=useState(project?.keywords.slice(0,3).join(' ')||''); const [searching,setSearching]=useState(false); const [doiOpen,setDoiOpen]=useState(false); const fileRef=useRef<HTMLInputElement>(null)
  const load=useCallback(()=>project?request<Paper[]>(`/api/projects/${project.id}/papers`).then(setPapers).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]); useEffect(()=>{void load()},[load])
  if(!project)return null
  async function search(e?:FormEvent){e?.preventDefault();setSearching(true);try{const data=await request<{items:Paper[];error?:string}>(`/api/literature/search?q=${encodeURIComponent(query)}&limit=12`);setResults(data.items);if(data.error)notify(data.error,'error');else notify(t('OpenAlex returned {n} real papers',{n:data.items.length}))}catch(error){notify((error as Error).message,'error')}finally{setSearching(false)}}
  async function add(p:Paper){try{await request(`/api/projects/${project!.id}/papers`,json('POST',p));await load();await reload();notify(t('Paper added to project'))}catch(e){notify((e as Error).message,'error')}}
  async function patchPaper(p:Paper,patch:Partial<Paper>){try{await request(`/api/papers/${p.id}`,json('PATCH',patch));await load();await reload()}catch(e){notify((e as Error).message,'error')}}
  async function removePaper(p:Paper){if(!window.confirm(t('Delete "{title}" from this project?',{title:p.title})))return;try{await request(`/api/papers/${p.id}`,json('DELETE'));await load();await reload();notify(t('Paper removed from project'))}catch(e){notify((e as Error).message,'error')}}
  async function addDoi(e:FormEvent<HTMLFormElement>){e.preventDefault();const doi=String(new FormData(e.currentTarget).get('doi')||'').replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').trim();setSearching(true);try{const data=await request<{items:Paper[]}>(`/api/literature/search?q=${encodeURIComponent(doi)}&limit=10`);const match=data.items.find(item=>(item.doi||'').toLowerCase()===doi.toLowerCase())||data.items[0];if(!match)throw new Error(t('OpenAlex could not find this DOI'));await add(match);setDoiOpen(false)}catch(error){notify((error as Error).message,'error')}finally{setSearching(false)}}
  async function upload(file?:File){if(!file)return;const body=new FormData();body.append('file',file);try{notify(t('Parsing PDF…'));await request(`/api/projects/${project!.id}/papers/upload`,{method:'POST',body});await load();await reload();notify(t('PDF parsed and added to the library'))}catch(e){notify((e as Error).message,'error')}finally{if(fileRef.current)fileRef.current.value=''}}
  return <><PageHeader kicker={t('LITERATURE LIBRARY')} title={t('Search, screen, and read')} description={t('Pull real metadata from OpenAlex, or upload PDFs to build a project library.')} actions={<><input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e=>void upload(e.target.files?.[0])}/><button className="button ghost" onClick={()=>setDoiOpen(true)}><Plus size={16}/> {t('Add DOI')}</button><button className="button ghost" onClick={()=>fileRef.current?.click()}><Upload size={16}/> {t('Upload PDF')}</button></>}/>
    <form className="search-bar card" onSubmit={search}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search papers, methods, authors…')}/><select aria-label="year"><option>{t('All years')}</option><option>2022–2026</option><option>2018–2021</option></select><button className="button primary" disabled={searching}>{searching?<LoaderCircle className="spin"/>:t('Search OpenAlex')}</button></form>
    {results.length>0&&<section className="search-results"><div className="section-row"><h2>{t('OpenAlex results')} <span>{results.length}</span></h2><button className="text-button" onClick={()=>setResults([])}>{t('Close results')}</button></div>{results.map(p=><PaperRow key={p.source_id||p.title} paper={p} action={<button className="button small primary" onClick={()=>void add(p)}><Plus size={14}/> {t('Add')}</button>}/>)}</section>}
    <section><div className="section-row"><h2>{t('Project library')} <span>{papers.length}</span></h2><div className="legend"><span><i className="dot core"/> {t('Core')}</span><span><i className="dot sample"/> {t('Demo/sample')}</span></div></div><div className="paper-list">{papers.map(p=><PaperRow key={p.id} paper={p} linked action={<div className="paper-actions"><button title={t('Core paper')} className={`icon-button ${p.is_core?'active':''}`} onClick={()=>void patchPaper(p,{is_core:!p.is_core})}><BookMarked size={17}/></button><select value={p.status} onChange={e=>void patchPaper(p,{status:e.target.value})}><option value="unread">{t('Unread')}</option><option value="to_read">{t('To read')}</option><option value="read">{t('Read')}</option></select><button title={t('Delete paper')} className="icon-button danger" onClick={()=>void removePaper(p)}><X size={16}/></button></div>}/>)}</div></section>
    {doiOpen&&<Modal title={t('Add paper by DOI')} onClose={()=>setDoiOpen(false)}><form className="form-stack" onSubmit={addDoi}><label>DOI<input name="doi" required placeholder="10.1145/… or https://doi.org/…"/></label><p className="form-help">{t('ScholarFlow verifies the DOI through OpenAlex and stores real metadata; it never fabricates a citation.')}</p><button className="button primary" disabled={searching}>{searching?<LoaderCircle className="spin"/>:<Search size={16}/>} {t('Verify & Add')}</button></form></Modal>}
  </>
}

function PaperRow({paper,action,linked=false}:{paper:Paper;action:ReactNode;linked?:boolean}) {
  const {t}=useI18n()
  const {project}=useWorkspace(); const content=<><div className="paper-rank">{Math.round((paper.relevance||0)*100)}<small>{t('match')}</small></div><div className="paper-info"><div className="paper-meta"><span>{paper.year||'—'}</span><span>{paper.venue||t('Unknown venue')}</span>{paper.source==='demo/sample'&&<span className="sample-badge">{t('DEMO / SAMPLE')}</span>}</div><h3>{paper.title}</h3><p className="authors">{paper.authors.join(', ')||t('Authors unavailable')}</p><p className="abstract">{paper.abstract||t('No abstract available from the source.')}</p><div className="paper-foot">{paper.doi&&<span>DOI {paper.doi}</span>}<span>{t('{n} citations',{n:paper.cited_by_count||0})}</span>{paper.is_core&&<span className="core-label"><BookMarked size={13}/> {t('Core paper')}</span>}</div></div></>
  return <article className="paper-row"><div className="paper-link">{linked?<Link to={`/projects/${project?.id}/papers/${paper.id}`}>{content}</Link>:content}</div><div>{action}</div></article>
}

function PaperReader() {
  const {t}=useI18n()
  const {paperId}=useParams(); const {project,notify,reload}=useWorkspace(); const [paper,setPaper]=useState<Paper|null>(null); const [notes,setNotes]=useState(''); const [question,setQuestion]=useState(()=>t('Summarize the main contributions and limitations.')); const [answer,setAnswer]=useState<{answer:string;citations:{snippet:string;chunk:number}[]} | null>(null); const [busy,setBusy]=useState(false)
  const load=useCallback(()=>request<Paper>(`/api/papers/${paperId}`).then(value=>{setPaper(value);setNotes(value.notes||'')}).catch(e=>notify(e.message,'error')),[paperId,notify]);useEffect(()=>{void load()},[load]); if(!project||!paper)return <Loader/>
  async function ask(){setBusy(true);try{setAnswer(await request(`/api/papers/${paper!.id}/ask`,json('POST',{question})))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function extract(){setBusy(true);try{await request(`/api/projects/${project!.id}/evidence/extract`,json('POST',{paper_id:paper!.id}));await load();await reload();notify(t('Structured evidence saved to the Evidence Matrix'))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function saveNotes(){try{await request(`/api/papers/${paper!.id}`,json('PATCH',{notes}));notify(t('Reading notes saved'))}catch(e){notify((e as Error).message,'error')}}
  const sections=paper.sections.length?paper.sections:[{title:'Abstract',content:paper.abstract}]
  return <><Link className="button ghost small" style={{marginBottom:16}} to={`/projects/${project.id}/literature`}><ArrowLeft size={15}/> {t('Back to Literature')}</Link><PageHeader kicker={t('PAPER READER')} title={paper.title} description={`${paper.authors.join(', ')} · ${paper.year||t('Year unknown')} · ${paper.venue}`} actions={<button className="button primary" onClick={extract} disabled={busy}><Sparkles size={16}/> {t('Extract Evidence')}</button>}/>
    <div className="reader-grid"><aside className="reader-outline card"><small>{t('DOCUMENT OUTLINE')}</small>{sections.map((s,i)=><a href={`#section-${i}`} key={i}>{s.title}<ChevronRight size={14}/></a>)}</aside><article className="reader-document card">{paper.source==='demo/sample'&&<div className="warning"><CircleAlert size={17}/><span>{t('This is a demo/sample record and must not be cited as a real reference. Import real sources via OpenAlex or PDF.')}</span></div>}{sections.map((s,i)=><section id={`section-${i}`} key={i}><span>{String(i+1).padStart(2,'0')}</span><h2>{s.title}</h2>{s.content.split('\n').filter(Boolean).map((p,n)=><p key={n}>{p}</p>)}</section>)}</article><aside className="reading-assistant card"><div className="assistant-head"><span><Bot size={17}/> {t('AI READING ASSISTANT')}</span><i/></div><div className="quick-prompts">{['Extract Research Question','Extract Method','Extract Dataset','Extract Results','Extract Limitations'].map(q=><button key={q} onClick={()=>setQuestion(t(q))}>{t(q)}</button>)}</div><textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4}/><button className="button primary full" onClick={ask} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>} {t('Ask this paper')}</button>{answer&&<div className="assistant-answer"><b>{t('Evidence-grounded answer')}</b><p>{answer.answer}</p>{answer.citations.map((c,i)=><blockquote key={i}>{t('Chunk {n}',{n:c.chunk})}: {c.snippet}</blockquote>)}</div>}<div className="paper-notes"><small>{t('READING NOTES')}</small><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录判断、疑问和复现线索…"/><button className="button ghost small full" onClick={saveNotes}>{t('Save notes')}</button></div><div className="saved-evidence"><small>{t('SAVED EVIDENCE')}</small><b>{t('{n} extracted records',{n:paper.evidence?.length||0})}</b></div></aside></div>
  </>
}

function EvidenceWorkspace() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace();const [evidence,setEvidence]=useState<Evidence[]>([]);const [claims,setClaims]=useState<Claim[]>([]);const [tab,setTab]=useState<'matrix'|'graph'>('matrix');const [busy,setBusy]=useState(false);const [editing,setEditing]=useState<Evidence|null>(null);const [claimOpen,setClaimOpen]=useState(false)
  const load=useCallback(async()=>{if(!project)return;try{const [e,c]=await Promise.all([request<Evidence[]>(`/api/projects/${project.id}/evidence`),request<Claim[]>(`/api/projects/${project.id}/claims`)]);setEvidence(e);setClaims(c)}catch(e){notify((e as Error).message,'error')}},[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function gap(){setBusy(true);try{await request(`/api/projects/${project!.id}/gap`,json('POST'));await reload();notify(t('Research Gap updated from current evidence'))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function saveEvidence(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!editing)return;const values=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/evidence/${editing.id}`,json('PATCH',{...values,confidence:Number(values.confidence)}));setEditing(null);await load();notify(t('Evidence record manually revised'))}catch(error){notify((error as Error).message,'error')}}
  async function addClaim(e:FormEvent<HTMLFormElement>){e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/projects/${project!.id}/claims`,json('POST',{...values,evidence_id:Number(values.evidence_id),confidence:Number(values.confidence)}));setClaimOpen(false);await load();await reload();notify(t('Claim linked to source evidence'))}catch(error){notify((error as Error).message,'error')}}
  return <><PageHeader kicker={t('EVIDENCE SYSTEM')} title={t('Claims must lead back to sources')} description={t('Traceable links between structured evidence and research claims across papers.')} actions={<><button className="button ghost" onClick={()=>setClaimOpen(true)}><Plus size={16}/> {t('New Claim')}</button><a className="button ghost" href={`/api/projects/${project.id}/evidence.csv`}><Download size={16}/> {t('Export CSV')}</a><button className="button primary" onClick={gap} disabled={busy}><Sparkles size={16}/> {t('Analyze Gap')}</button></>}/>
    <div className="tab-bar"><button className={tab==='matrix'?'active':''} onClick={()=>setTab('matrix')}><ClipboardCheck size={16}/> {t('Evidence Matrix')}</button><button className={tab==='graph'?'active':''} onClick={()=>setTab('graph')}><Network size={16}/> {t('Evidence Graph')}</button></div>
    {tab==='matrix'?<article className="card table-card"><div className="table-scroll"><table><thead><tr><th>{t('Paper')}</th><th>{t('Problem')}</th><th>{t('Method')}</th><th>{t('Dataset')}</th><th>{t('Baseline')}</th><th>{t('Metric')}</th><th>{t('Result')}</th><th>{t('Limitation')}</th><th>{t('Confidence')}</th><th/></tr></thead><tbody>{evidence.map(e=><tr key={e.id}><td><Link to={`/projects/${project.id}/papers/${e.paper_id}`}>{e.paper_title}</Link><small>{e.source_section}</small></td><td>{e.problem||'—'}</td><td>{e.method||'—'}</td><td>{e.dataset||'—'}</td><td>{e.baseline||'—'}</td><td>{e.metric||'—'}</td><td className="result-cell">{e.result||'—'}{e.source_snippet&&<span title={e.source_snippet}><Quote size={13}/> {t('source')}</span>}</td><td>{e.limitation||'—'}</td><td><Confidence value={e.confidence}/></td><td><button className="icon-button" title={t('Edit evidence')} onClick={()=>setEditing(e)}><PenLine size={15}/></button></td></tr>)}</tbody></table></div></article>:<EvidenceGraph claims={claims}/>}
    <article className="card gap-card"><div><div className="section-kicker">{t('EVIDENCE-BASED RESEARCH GAP')}</div><h2>{project.research_gap?t('A traceable gap is active'):t('Gap analysis needed')}</h2><p>{project.research_gap||t('Add paper evidence first, then let the Agent find coverage gaps, contradictions and unstudied questions.')}</p></div><div className="citation-stack">{project.gap_citations.map(id=><Link key={id} to={`/projects/${project.id}/papers/${id}`}><FileText size={15}/> {t('Paper {id}',{id})}<ExternalLink size={13}/></Link>)}</div></article>
    {editing&&<Modal title={t('Edit evidence record')} onClose={()=>setEditing(null)}><form className="form-stack" onSubmit={saveEvidence}><div className="two-col"><label>{t('Problem')}<textarea name="problem" defaultValue={editing.problem}/></label><label>{t('Method')}<textarea name="method" defaultValue={editing.method}/></label></div><div className="two-col"><label>{t('Dataset')}<input name="dataset" defaultValue={editing.dataset}/></label><label>{t('Baseline')}<input name="baseline" defaultValue={editing.baseline}/></label></div><div className="two-col"><label>{t('Metric')}<input name="metric" defaultValue={editing.metric}/></label><label>{t('Source section')}<input name="source_section" defaultValue={editing.source_section}/></label></div><label>{t('Result')}<textarea name="result" defaultValue={editing.result}/></label><label>{t('Limitation')}<textarea name="limitation" defaultValue={editing.limitation}/></label><label>{t('Source snippet')}<textarea name="source_snippet" defaultValue={editing.source_snippet}/></label><label>{t('Confidence (0–1)')}<input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue={editing.confidence}/></label><button className="button primary">{t('Save verified evidence')}</button></form></Modal>}
    {claimOpen&&<Modal title={t('Create traceable Claim')} onClose={()=>setClaimOpen(false)}><form className="form-stack" onSubmit={addClaim}><label>{t('Claim')}<textarea name="text" required rows={3} placeholder={t('Enter a research conclusion that needs to be supported or contradicted by evidence')}/></label><div className="two-col"><label>{t('Linked evidence')}<select name="evidence_id" required>{evidence.map(item=><option key={item.id} value={item.id}>#{item.id} · {item.paper_title}</option>)}</select></label><label>{t('Stance')}<select name="stance"><option value="supporting">{t('Supporting')}</option><option value="contradicting">{t('Contradicting')}</option></select></label></div><label>{t('Confidence (0–1)')}<input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue="0.6"/></label><label>{t('Notes')}<textarea name="notes" placeholder={t('Explain the rationale or what still needs verification')}/></label><button className="button primary" disabled={!evidence.length}>{t('Link Claim to Evidence')}</button></form></Modal>}
  </>
}

function Confidence({value}:{value:number}) {return <span className={`confidence ${value>=.8?'high':value>=.55?'mid':'low'}`}>{Math.round(value*100)}%</span>}
function EvidenceGraph({claims}:{claims:Claim[]}) {const {t}=useI18n();return <div className="graph-canvas card"><div className="graph-label">{t('CLAIM → EVIDENCE → PAPER')}</div>{claims.map((claim,i)=><div className="graph-row" key={claim.id}><div className="claim-node"><small>{t('CLAIM {id}',{id:String.fromCharCode(65+i)})}</small><b>{claim.text}</b><Confidence value={claim.confidence}/></div><div className="graph-lines"><i/><i/><i/></div><div className="paper-nodes">{claim.links.map(link=><div key={link.paper_id}><FileText size={18}/><span><b>{link.paper_title}</b><small>{t(link.stance)} · {t('Evidence #{id}',{id:link.evidence_id})}</small></span></div>)}</div></div>)}</div>}

type DesignResult = {
  topic?: string; hypothesis?: string
  variables?: { independent?: string; dependent?: string[]; controls?: string[] }
  metrics?: string[]; risks?: string[]; baselines?: string[]; dataset?: string
  design_flow?: { control?: string; treatment?: string; evaluation?: string }
  created_experiment_ids?: number[]
}

function ResearchDesign() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace()
  const [result,setResult]=useState<DesignResult|null>(null)
  const [experiments,setExperiments]=useState<Experiment[]>([])
  const [busy,setBusy]=useState(false)
  const loadExperiments=useCallback(()=>project?request<Experiment[]>(`/api/projects/${project.id}/experiments`).then(setExperiments).catch(()=>{}):Promise.resolve(),[project])
  useEffect(()=>{void loadExperiments()},[loadExperiments])
  if(!project)return null
  async function design(){setBusy(true);try{const r=await request<DesignResult>(`/api/projects/${project!.id}/research-design`,json('POST'));setResult(r);await loadExperiments();await reload();notify(t('Research design generated; experiments written to Experiment Manager'))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  const topic=project.idea||project.name
  const flow=result?.design_flow
  const control=flow?.control||experiments.find(e=>/基线|baseline/i.test(`${e.name} ${e.hypothesis}`))?.name||experiments[0]?.name||t('Baseline method (TBD)')
  const treatment=flow?.treatment||experiments.find(e=>!/基线|baseline/i.test(`${e.name} ${e.hypothesis}`))?.name||experiments[1]?.name||t('Proposed method: {topic}',{topic})
  const evaluation=flow?.evaluation||t('Paired comparison + subgroup analysis')
  const variableItems=result?.variables?[t('Independent: {value}',{value:result.variables.independent||t('Method / treatment configuration')}),t('Dependent: {value}',{value:(result.variables.dependent||[]).join(', ')||t('Primary effect metric')}),t('Controls: {value}',{value:(result.variables.controls||[]).join(', ')||t('Dataset, parameters, random seed')})]:[t('Generate a design to see variable setup')]
  return <><PageHeader kicker={t('RESEARCH DESIGN AGENT')} title={t('From gap to executable experiments')} description={t('Turn a traceable Research Gap into hypotheses, variables, baselines, metrics and risks.')} actions={<button className="button primary" onClick={design} disabled={busy}><Sparkles size={16}/> {t('Generate Design')}</button>}/>
    <article className="card design-brief"><div className="design-icon"><Target/></div><div><small>{t('ACTIVE RESEARCH GAP')}</small><h2>{project.research_gap||t('Research gap not defined yet')}</h2><div className="citation-row">{project.gap_citations.map(id=><span key={id}>{t('Paper {id}',{id})}</span>)}</div></div></article>
    <div className="design-grid"><DesignCard title={t('Hypotheses')} icon={<Lightbulb/>} items={project.hypotheses.length?project.hypotheses:[t('Generate a design to derive testable hypotheses')]}/><DesignCard title={t('Variables')} icon={<GitBranch/>} items={variableItems}/><DesignCard title={t('Metrics')} icon={<BarChart3/>} items={result?.metrics||[t('Generate a design to see metrics')]}/><DesignCard title={t('Risks')} icon={<ShieldCheck/>} items={result?.risks||[t('Generate a design to see risks')]}/></div>
    <article className="card design-flow"><div className="flow-node"><small>{t('CONTROL')}</small><b>{control}</b><span>{t('Same dataset + configuration')}</span></div><ArrowRight/><div className="flow-node accent"><small>{t('TREATMENT')}</small><b>{treatment}</b><span>{t('Only the core independent variable changes')}</span></div><ArrowRight/><div className="flow-node"><small>{t('EVALUATION')}</small><b>{evaluation}</b><span>{t('Primary metric + runtime cost')}</span></div></article>
  </>
}
function DesignCard({title,icon,items}:{title:string;icon:ReactNode;items:string[]}){return <article className="card design-card"><div>{icon}<h3>{title}</h3></div>{items.map((item,i)=><p key={i}><CheckCircle2 size={15}/>{item}</p>)}</article>}

function Experiments() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace();const [items,setItems]=useState<Experiment[]>([]);const [editing,setEditing]=useState<Experiment|null>(null)
  const load=useCallback(()=>project?request<Experiment[]>(`/api/projects/${project.id}/experiments`).then(setItems).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/projects/${project!.id}/experiments`,json('POST',{...editing,...data,metrics:String(data.metrics).split(',').map(v=>v.trim()).filter(Boolean)}));setEditing(null);await load();await reload();notify(t('Experiment status saved'))}catch(err){notify((err as Error).message,'error')}}
  const blank:Experiment={name:'',research_question:'',hypothesis:'',description:'',status:'Planned',input:'',dataset:'',metrics:[],result:'',notes:''}
  const nextStage=(status:string)=>{const i=(experimentStatuses as readonly string[]).indexOf(status);return i>=0&&i<experimentStatuses.length-1?experimentStatuses[i+1]:null}
  async function moveNext(item:Experiment){const next=nextStage(item.status);if(!next)return;try{await request(`/api/projects/${project!.id}/experiments`,json('POST',{id:item.id,status:next}));await load();await reload();notify(t('Experiment moved to {status}',{status:t(next)}))}catch(err){notify((err as Error).message,'error')}}
  return <><PageHeader kicker={t('EXPERIMENT MANAGER')} title={t('Plan, run, and preserve results')} description={t('Every experiment links a research question, hypothesis, input, metrics and result.')} actions={<button className="button primary" onClick={()=>setEditing(blank)}><Plus size={16}/> {t('New Experiment')}</button>}/>
    <div className="experiment-board">{experimentStatuses.map(status=><section key={status} className="experiment-column"><header><span className={`status-dot ${status.toLowerCase()}`}/><b>{t(status)}</b><em>{items.filter(x=>x.status===status).length}</em></header>{items.filter(x=>x.status===status).map(item=><article className="experiment-card" key={item.id} onClick={()=>setEditing(item)}><small>{item.research_question}</small><h3>{item.name}</h3><p>{item.description}</p><div className="tag-row">{item.metrics.map(m=><span className="tag" key={m}>{m}</span>)}</div>{item.result&&<blockquote>{item.result}</blockquote>}<footer><span><Database size={14}/>{item.dataset||t('Dataset TBD')}</span>{nextStage(item.status)&&<button className="icon-button" style={{width:26,height:26,flex:'none'}} title={t('Move to next stage')} aria-label={t('Move to next stage')} onClick={e=>{e.stopPropagation();void moveNext(item)}}><ArrowRight size={15}/></button>}</footer></article>)}</section>)}</div>
    {editing&&<Modal title={editing.id?t('Update experiment'):t('Create experiment')} onClose={()=>setEditing(null)}><form className="form-stack" onSubmit={save}><div className="two-col"><label>{t('Name')}<input name="name" required defaultValue={editing.name}/></label><label>{t('Status')}<select name="status" defaultValue={editing.status}>{experimentStatuses.map(status=><option key={status} value={status}>{t(status)}</option>)}</select></label></div><label>{t('Research Question')}<input name="research_question" defaultValue={editing.research_question}/></label><label>{t('Hypothesis')}<textarea name="hypothesis" defaultValue={editing.hypothesis}/></label><label>{t('Description')}<textarea name="description" defaultValue={editing.description}/></label><div className="two-col"><label>{t('Dataset')}<input name="dataset" defaultValue={editing.dataset}/></label><label>{t('Metrics (comma separated)')}<input name="metrics" defaultValue={editing.metrics.join(', ')}/></label></div><label>{t('Result')}<textarea name="result" defaultValue={editing.result}/></label><button className="button primary">{t('Save experiment')}</button></form></Modal>}
  </>
}

function AnalysisWorkspace() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace();const [items,setItems]=useState<Analysis[]>([]);const [busy,setBusy]=useState(false);const input=useRef<HTMLInputElement>(null)
  const load=useCallback(()=>project?request<Analysis[]>(`/api/projects/${project.id}/analyses`).then(setItems).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function analyze(file?:File){if(!file)return;setBusy(true);const form=new FormData();form.append('file',file);try{await request(`/api/projects/${project!.id}/analysis`,{method:'POST',body:form});await load();await reload();notify(t('Python data analysis completed'))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false);if(input.current)input.current.value=''}}
  const latest=items[0]?.summary
  return <><PageHeader kicker={t('DATA ANALYSIS SKILL')} title={t('Let Python do the math')} description={t('CSV, XLSX and JSON are actually computed with pandas / NumPy / SciPy; the LLM does not guess numbers.')} actions={<><input ref={input} hidden type="file" accept=".csv,.xlsx,.xls,.json" onChange={e=>void analyze(e.target.files?.[0])}/><button className="button primary" onClick={()=>input.current?.click()} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Upload size={16}/>} {t('Upload Results')}</button></>}/>
    {!latest?<div className="upload-zone card" onClick={()=>input.current?.click()}><div><BarChart3/></div><h2>{t('Drop experiment results into the workflow')}</h2><p>{t('Automatically generates an overview, missing values, descriptive statistics, correlation tests and charts.')}</p><span>{t('CSV · XLSX · JSON, up to 30 MB')}</span></div>:<><div className="analysis-metrics"><Metric icon={<ListChecks/>} value={String(latest.overview.rows)} label={t('Rows')} tone="blue"/><Metric icon={<Database/>} value={String(latest.overview.columns)} label={t('Columns')} tone="cyan"/><Metric icon={<Activity/>} value={latest.tests.length} label={t('Statistical tests')} tone="violet"/><Metric icon={<BarChart3/>} value={latest.charts.length} label={t('Charts')} tone="orange"/></div><div className="analysis-grid"><article className="card"><div className="card-heading"><div><small>{t('AUTOMATIC VISUALIZATION')}</small><h3>{t('Numeric distributions')}</h3></div></div>{latest.charts.map(c=><img className="chart" src={c} key={c} alt={t('Data analysis chart')}/>)}</article><article className="card"><small>{t('DATA QUALITY')}</small><h3>{t('Missing values')}</h3><div className="data-list">{Object.entries((latest.overview.missing_values||{}) as Record<string,number>).map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div><small>{t('STATISTICAL TESTS')}</small>{latest.tests.length?latest.tests.map((test,i)=><blockquote key={i}>{String(test.test)}: p = {String(test.p_value)} · {String(test.interpretation)}</blockquote>):<p className="muted">{t('At least two numeric columns are required for a correlation test.')}</p>}</article></div><article className="card recommendations"><div><Sparkles/><span><small>{t('ANALYSIS RECOMMENDATIONS')}</small><h3>{t('What to inspect next')}</h3></span></div>{latest.recommendations.map(r=><p key={r}><CheckCircle2/>{r}</p>)}</article></>}
  </>
}

function Writing() {
  const {t}=useI18n()
  const {project,reload,notify}=useWorkspace();const [sections,setSections]=useState<Manuscript[]>([]);const [active,setActive]=useState('Abstract');const [content,setContent]=useState('');const [busy,setBusy]=useState(false)
  const load=useCallback(async()=>{if(!project)return;try{const data=await request<Manuscript[]>(`/api/projects/${project.id}/manuscript`);setSections(data);const item=data.find(s=>s.section===active);if(item)setContent(item.content)}catch(e){notify((e as Error).message,'error')}},[project,active,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  function switchSection(name:string){setActive(name);setContent(sections.find(s=>s.section===name)?.content||'')}
  async function save(){try{await request(`/api/projects/${project!.id}/manuscript/${encodeURIComponent(active)}`,json('PUT',{content}));await load();await reload();notify(t('{section} saved',{section:active}))}catch(e){notify((e as Error).message,'error')}}
  async function draft(){setBusy(true);try{const result=await request<{section:Manuscript;citations:unknown[]}>(`/api/projects/${project!.id}/writing/draft`,json('POST',{section:active}));setContent(result.section.content);await load();notify(t('Draft generated from {n} project evidence records',{n:result.citations.length}))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  const citeCount=(content.match(/\[Paper \d+/g)||[]).length
  return <><PageHeader kicker={t('WRITING WORKSPACE')} title={t('Write with evidence in view')} description={t('Section-by-section drafting; statements without project evidence are explicitly flagged, never fabricated.')} actions={<><button className="button ghost" onClick={save}><Check size={16}/> {t('Save')}</button><button className="button primary" onClick={draft} disabled={busy}><Sparkles size={16}/> {t('Evidence Draft')}</button></>}/>
    <div className="writing-grid"><aside className="section-nav card"><small>{t('MANUSCRIPT')}</small>{sections.map(section=><button key={section.section} className={active===section.section?'active':''} onClick={()=>switchSection(section.section)}><span>{section.content.length>80?<CheckCircle2/>:<Circle/>}{section.section}</span><small>{t('{n} chars',{n:section.content.length})}</small></button>)}</aside><article className="editor-card card"><header><div><small>{t('SECTION')}</small><h2>{active}</h2></div><div><span>{t('{n} words',{n:content.split(/\s+/).filter(Boolean).length})}</span><span>{t('{n} citations',{n:citeCount})}</span></div></header><textarea className="manuscript-editor" value={content} onChange={e=>setContent(e.target.value)} placeholder={t('Start writing here…')}/><footer><span><ShieldCheck size={15}/> {t('Citation-aware safeguards active')}</span><button className="text-button" onClick={save}>{t('Save changes')}</button></footer></article><aside className="evidence-sidebar card"><div className="assistant-head"><span><Quote size={17}/> {t('AVAILABLE EVIDENCE')}</span><i/></div><p>{t('Drafts only cite evidence already in the project Evidence Matrix.')}</p><div className="evidence-count"><b>{project.evidence_count}</b><span>{t('{n} evidence records',{n:project.evidence_count})}</span></div><div className="evidence-count"><b>{project.core_paper_count}</b><span>{t('{n} core papers',{n:project.core_paper_count})}</span></div><div className="warning soft"><CircleAlert/><span>{t('"This statement currently lacks project literature evidence" means you must add a source or delete the claim.')}</span></div><Link to={`/projects/${project.id}/evidence`} className="button ghost full">{t('Open Evidence Matrix')}</Link></aside></div>
  </>
}

function SettingsPage() {
  const {lang,setLang,t}=useI18n()
  const [health,setHealth]=useState<{llm_configured:boolean;orchestrator:string;demo_mode:boolean}|null>(null);useEffect(()=>{request<{llm_configured:boolean;orchestrator:string;demo_mode:boolean}>('/api/health').then(setHealth).catch(()=>{})},[])
  return <div className="settings-page"><header className="projects-header container"><Brand/><Link className="button ghost small" to="/projects"><ArrowRight className="flip" size={16}/> {t('Back to projects')}</Link></header><main className="settings-main container"><PageHeader kicker={t('SYSTEM SETTINGS')} title={t('GeniOS-ready, provider-neutral')} description={t('Local ScholarFlow provides tools and research state; Nankai GeniOS keeps the top-level Agent / Workflow role.')} actions={<div className="tab-bar" role="group" aria-label={t('Interface language')}><button className={lang==='zh'?'active':''} onClick={()=>setLang('zh')}>中文</button><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>English</button></div>}/>
    <article className="architecture card"><div className="architecture-node genios"><Zap/><span><small>{t('TOP-LEVEL ORCHESTRATOR')}</small><b>{t('Nankai GeniOS Agent')}</b><em>{health?.demo_mode?t('Credentials not configured · Demo mode'):t('Configured')}</em></span></div><div className="connector"><i/><span>{t('13 HTTP Tools · JSON Schema')}</span><i/></div><div className="architecture-tools"><div><FolderKanban/><b>{t('Project State')}</b></div><div><BookOpen/><b>{t('Literature')}</b></div><div><FileSearch/><b>{t('PDF & QA')}</b></div><div><Network/><b>{t('Evidence')}</b></div><div><BarChart3/><b>{t('Analysis')}</b></div><div><PenLine/><b>{t('Writing')}</b></div></div></article>
    <div className="settings-grid"><article className="card"><div className="card-heading"><div><small>{t('LLM PROVIDER')}</small><h3>{t('OpenAI-compatible interface')}</h3></div><span className={`config-status ${health?.llm_configured?'ready':''}`}>{health?.llm_configured?t('Configured'):t('Optional')}</span></div><p>{t('Supports OpenAI, DeepSeek and local OpenAI-compatible endpoints. Without a key, the deterministic state machine and local tools still run fully.')}</p><code>LLM_BASE_URL<br/>LLM_API_KEY<br/>LLM_MODEL</code></article><article className="card"><div className="card-heading"><div><small>{t('GENIOS ADAPTER')}</small><h3>{t('Tool schemas ready')}</h3></div><span className="config-status ready">{t('Ready')}</span></div><p>{t('Tool definitions live in genios/tools.json; you can also inspect every endpoint in the FastAPI OpenAPI page.')}</p><a className="button ghost" href="http://127.0.0.1:8000/docs" target="_blank">{t('Open API Docs')} <ExternalLink size={15}/></a></article></div>
  </main></div>
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X/></button></header>{children}</div></div>}
function Empty({text,compact=false}:{text:string;compact?:boolean}){return <div className={`empty ${compact?'compact':''}`}><FileSearch/><p>{text}</p></div>}
function Loader(){const {t}=useI18n();return <div className="loader"><LoaderCircle className="spin"/><span>{t('Loading research state…')}</span></div>}
