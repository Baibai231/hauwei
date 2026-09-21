import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowRight, BarChart3, Beaker, BookMarked, BookOpen, Bot, BrainCircuit, Check,
  CheckCircle2, ChevronRight, Circle, CircleAlert, ClipboardCheck, Cloud, Database, Download,
  ExternalLink, FileSearch, FileText, FlaskConical, FolderKanban, GitBranch, GraduationCap,
  Lightbulb, ListChecks, LoaderCircle, Menu, Network, PenLine, Plus, Quote, RefreshCw, Search,
  Settings, ShieldCheck, Sparkles, Target, Upload, X, Zap,
} from 'lucide-react'
import { json, request } from './api'
import type { Analysis, Claim, Evidence, Experiment, Manuscript, Paper, Project } from './types'

const workflow = [
  ['Idea', Lightbulb], ['Literature', BookOpen], ['Evidence', Quote], ['Research Gap', FileSearch],
  ['Experiment', FlaskConical], ['Analysis', BarChart3], ['Writing', PenLine],
] as const

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
  return <main className="landing">
    <nav className="landing-nav container">
      <Brand />
      <div className="nav-links"><a href="#workflow">Workflow</a><a href="#capabilities">Capabilities</a><Link to="/settings">GeniOS</Link></div>
      <Link className="button small" to="/projects">进入工作台 <ArrowRight size={15}/></Link>
    </nav>
    <section className="hero container">
      <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
      <div className="eyebrow"><Sparkles size={14}/> GeniOS-powered Research Agent</div>
      <h1>From Idea<br/>to <span>Evidence.</span></h1>
      <p className="hero-cn">让 AI 真正参与科研全过程。</p>
      <p className="hero-copy">ScholarFlow 不是另一个聊天框。它理解你的研究状态，组织每一条证据，并持续决定下一步科研行动。</p>
      <div className="hero-actions">
        <Link to="/projects" className="button primary large">Start Research <ArrowRight size={18}/></Link>
        <Link to="/projects/1" className="button ghost large">查看 Demo Project</Link>
      </div>
      <div className="hero-proof"><span><Check size={15}/> Evidence traceable</span><span><Check size={15}/> Project-aware</span><span><Check size={15}/> Works without API key</span></div>
    </section>
    <section id="workflow" className="workflow-band">
      <div className="container"><div className="section-kicker">ONE CONTINUOUS RESEARCH FLOW</div>
        <div className="workflow-row">{workflow.map(([name, Icon], index) => <div className="workflow-item" key={name}>
          <div className="workflow-icon"><Icon size={20}/></div><span>{name}</span>{index < workflow.length - 1 && <ChevronRight className="workflow-arrow" size={18}/>}</div>)}</div>
      </div>
    </section>
    <section id="capabilities" className="features container">
      <div className="feature-heading"><div><div className="section-kicker">RESEARCH, WITH MEMORY</div><h2>科研过程不再散落。</h2></div><p>从模糊想法到可引用的论文段落，所有对象都保存在同一个可追溯项目状态中。</p></div>
      <div className="feature-grid">
        <Feature icon={<BrainCircuit/>} title="Agent State Machine" text="确定性状态机判断阶段，GeniOS Agent 据此编排科研工具。" tone="blue"/>
        <Feature icon={<Network/>} title="Evidence Graph" text="Claim、论文与证据片段形成关系网络，结论随时回到来源。" tone="cyan"/>
        <Feature icon={<Database/>} title="Research Memory" text="文献、实验、数据分析与写作草稿成为项目级长期记忆。" tone="violet"/>
      </div>
    </section>
    <footer className="landing-footer container"><Brand/><span>Built for responsible, evidence-first research.</span><span>GeniOS Agent orchestration ready</span></footer>
  </main>
}

function Feature({icon,title,text,tone}:{icon:ReactNode;title:string;text:string;tone:string}) {
  return <article className={`feature-card ${tone}`}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><span>Explore capability <ArrowRight size={14}/></span></article>
}

function Brand() { return <Link to="/" className="brand"><span className="brand-mark"><GraduationCap size={22}/></span><span>ScholarFlow</span></Link> }

function ProjectsPage({notify}:{notify:(m:string,k?:Toast['kind'])=>void}) {
  const [projects,setProjects] = useState<Project[]>([])
  const [loading,setLoading] = useState(true)
  const [open,setOpen] = useState(false)
  const navigate = useNavigate()
  const load = useCallback(() => request<Project[]>('/api/projects').then(setProjects).catch(e=>notify(e.message,'error')).finally(()=>setLoading(false)),[notify])
  useEffect(()=>{ void load() },[load])
  async function create(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    try {
      const project = await request<Project>('/api/projects', json('POST', Object.fromEntries(data)))
      notify('科研项目已创建'); navigate(`/projects/${project.id}/research`)
    } catch(error) { notify((error as Error).message,'error') }
  }
  return <div className="projects-page">
    <header className="projects-header container"><Brand/><div><Link className="button ghost small" to="/settings"><Settings size={16}/> 设置</Link><button className="button primary small" onClick={()=>setOpen(true)}><Plus size={16}/> 新建项目</button></div></header>
    <section className="projects-hero container"><div><div className="eyebrow"><FolderKanban size={14}/> Research Projects</div><h1>你的科研工作台</h1><p>每个项目都保存独立的研究状态、文献证据和下一步行动。</p></div><div className="mini-agent"><span><Bot size={18}/> GeniOS Agent</span><b>{projects.length} projects in memory</b></div></section>
    <section className="container project-grid">{loading ? <Loader /> : projects.map(p=><Link to={`/projects/${p.id}`} className="project-card" key={p.id}>
      <div className="project-top"><span className="project-direction">{p.direction || 'Research'}</span><ArrowRight size={18}/></div>
      <h2>{p.name}</h2><p>{p.description || p.idea}</p>
      <div className="project-metrics"><span><BookOpen size={15}/>{p.paper_count} papers</span><span><Quote size={15}/>{p.evidence_count} evidence</span><span><Beaker size={15}/>{p.experiment_count} experiments</span></div>
      <div className="progress-label"><span>{p.next_action.title}</span><b>{p.progress}%</b></div><div className="progress"><i style={{width:`${p.progress}%`}}/></div>
    </Link>)}</section>
    {open && <Modal title="创建科研项目" onClose={()=>setOpen(false)}><form onSubmit={create} className="form-stack">
      <label>项目名称<input name="name" required placeholder="例如：LLM + Vulnerability Detection"/></label>
      <label>模糊研究想法<textarea name="idea" required rows={4} placeholder="你想研究什么？无需先组织成正式研究问题。"/></label>
      <div className="two-col"><label>研究方向<input name="direction" placeholder="AI Security"/></label><label>项目描述<input name="description" placeholder="可选的范围说明"/></label></div>
      <button className="button primary" type="submit">创建并进入 Research Planner <ArrowRight size={16}/></button>
    </form></Modal>}
  </div>
}

type WorkspaceContext = { project:Project|null; reload:()=>Promise<void>; notify:(m:string,k?:Toast['kind'])=>void }
let activeContext: WorkspaceContext | null = null
function useWorkspace() { if(!activeContext) throw new Error('Workspace context unavailable'); return activeContext }

function Workspace({children,notify}:{children:ReactNode;notify:(m:string,k?:Toast['kind'])=>void}) {
  const {id=''}=useParams(); const [project,setProject]=useState<Project|null>(null); const [menu,setMenu]=useState(false)
  const reload=useCallback(async()=>{ try{setProject(await request<Project>(`/api/projects/${id}`))}catch(e){notify((e as Error).message,'error')} },[id,notify])
  useEffect(()=>{ void reload() },[reload]); activeContext={project,reload,notify}
  const items=[
    ['',Activity,'Overview'],['research',Lightbulb,'Research'],['literature',BookOpen,'Literature'],['evidence',Network,'Evidence'],
    ['research-design',Target,'Design'],['experiments',FlaskConical,'Experiments'],['analysis',BarChart3,'Analysis'],['writing',PenLine,'Writing'],
  ] as const
  if(!project) return <div className="fullscreen-loader"><Loader/></div>
  return <div className="app-shell">
    <aside className={`sidebar ${menu?'open':''}`}>
      <div className="sidebar-head"><Brand/><button className="icon-button mobile-only" onClick={()=>setMenu(false)}><X/></button></div>
      <div className="project-switch"><div className="project-avatar">{project.name.slice(0,2).toUpperCase()}</div><div><small>ACTIVE PROJECT</small><b>{project.name}</b></div><ChevronRight size={16}/></div>
      <nav className="sidebar-nav">{items.map(([path,Icon,label])=><NavLink end={path===''} key={label} onClick={()=>setMenu(false)} to={`/projects/${id}${path?`/${path}`:''}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/settings"><Settings size={18}/>Settings</Link><Link to="/projects"><FolderKanban size={18}/>All Projects</Link>
        <div className="genios-chip"><span><Zap size={14}/> GENIOS AGENT</span><b>Demo adapter ready</b></div>
      </div>
    </aside>
    {menu&&<div className="sidebar-backdrop" onClick={()=>setMenu(false)}/>}
    <div className="shell-main"><header className="topbar"><button className="icon-button mobile-only" onClick={()=>setMenu(true)}><Menu/></button><div><small>{project.direction || 'Research project'}</small><b>{project.name}</b></div><div className="topbar-actions"><span className="sync"><Cloud size={15}/> Local research memory</span><div className="agent-avatar"><Bot size={18}/></div></div></header><div className="page-content">{children}</div></div>
  </div>
}

function PageHeader({kicker,title,description,actions}:{kicker:string;title:string;description?:string;actions?:ReactNode}) {
  return <header className="page-header"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</header>
}

function Dashboard() {
  const {project}=useWorkspace(); if(!project)return null
  const stages=[
    ['Research Question',!!project.research_questions.length],['Literature Search',project.paper_count>=5],['Literature Screening',project.core_paper_count>=3],
    ['Evidence Matrix',project.evidence_count>=project.core_paper_count],['Research Gap',!!project.research_gap],['Research Design',project.experiment_count>0],
    ['Experiments',project.completed_experiment_count===project.experiment_count],['Analysis',project.analysis_count>0],['Manuscript',project.manuscript_filled>=8],
  ] as const
  const firstTodo=stages.findIndex(s=>!s[1])
  return <>
    <PageHeader kicker="PROJECT OVERVIEW" title="Research cockpit" description="你的研究状态、证据完整度与下一步行动集中在这里。" actions={<span className="status-pill"><span/> Active research</span>}/>
    <section className="dashboard-grid">
      <article className="card progress-card"><div className="card-title"><div><small>RESEARCH PROGRESS</small><h2>{project.progress}%</h2></div><CircularProgress value={project.progress}/></div><div className="stage-list">{stages.map(([label,done],i)=><div className={`stage ${done?'done':i===firstTodo?'active':''}`} key={label}>{done?<CheckCircle2/>:i===firstTodo?<Activity/>:<Circle/>}<span>{label}</span>{i===firstTodo&&<em>IN PROGRESS</em>}</div>)}</div></article>
      <div className="dashboard-side">
        <article className="card next-action-card"><div className="agent-label"><span><Bot size={16}/> AI NEXT ACTION</span><small>Deterministic + reasoning</small></div><h2>{project.next_action.title}</h2><p>{project.next_action.reason}</p><div className="next-step"><Sparkles size={17}/><div><small>建议下一步</small><b>{project.next_action.instruction}</b></div></div><Link className="button white" to={stageLink(project.id,project.next_action.stage)}>开始执行 <ArrowRight size={16}/></Link></article>
        <div className="metric-grid"><Metric icon={<BookOpen/>} value={project.paper_count} label="Papers" tone="blue"/><Metric icon={<BookMarked/>} value={project.core_paper_count} label="Core read" tone="cyan"/><Metric icon={<Quote/>} value={project.evidence_count} label="Evidence" tone="violet"/><Metric icon={<FlaskConical/>} value={`${project.completed_experiment_count}/${project.experiment_count}`} label="Experiments" tone="orange"/></div>
      </div>
    </section>
    <section className="lower-grid"><article className="card"><div className="card-heading"><div><small>RESEARCH QUESTIONS</small><h3>What this project must answer</h3></div><Link to={`/projects/${project.id}/research`}>Edit <ArrowRight size={14}/></Link></div><div className="rq-list">{project.research_questions.map((q,i)=><div key={q}><span>RQ{i+1}</span><p>{q.replace(/^RQ\d+:\s*/, '')}</p></div>)}</div></article>
      <article className="card"><div className="card-heading"><div><small>PROJECT MEMORY</small><h3>Evidence snapshot</h3></div><Link to={`/projects/${project.id}/evidence`}>Open graph <ArrowRight size={14}/></Link></div><div className="memory-stats"><div><b>{project.claim_count}</b><span>Claims tracked</span></div><div><b>{project.evidence_count}</b><span>Source snippets</span></div><div><b>{project.gap_citations.length}</b><span>Gap citations</span></div></div>{project.research_gap?<blockquote>{project.research_gap}</blockquote>:<Empty compact text="Research Gap 尚未分析"/>}</article>
    </section>
  </>
}

function CircularProgress({value}:{value:number}) { return <div className="circle-progress" style={{'--value':`${value*3.6}deg`} as React.CSSProperties}><span>{value}</span></div> }
function Metric({icon,value,label,tone}:{icon:ReactNode;value:number|string;label:string;tone:string}) {return <div className={`metric ${tone}`}><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>}
function stageLink(id:number,stage:string){const map:Record<string,string>={research_question:'research',literature:'literature',screening:'literature',evidence:'evidence',gap:'evidence',design:'research-design',experiments:'experiments',analysis:'analysis',writing:'writing',complete:'evidence'};return `/projects/${id}/${map[stage]||''}`}

function ResearchPlanner() {
  const {project,reload,notify}=useWorkspace(); const [busy,setBusy]=useState(false); const [questions,setQuestions]=useState(project?.research_questions||[]); const [keywords,setKeywords]=useState(project?.keywords||[])
  useEffect(()=>{setQuestions(project?.research_questions||[]);setKeywords(project?.keywords||[])},[project])
  if(!project)return null
  async function generate(){setBusy(true);try{const result=await request<{research_questions:string[];keywords:string[];tasks:string[]}>(`/api/projects/${project!.id}/plan`,json('POST',{idea:project!.idea}));setQuestions(result.research_questions);setKeywords(result.keywords);await reload();notify('研究计划已生成并写入项目状态')}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function save(){try{await request(`/api/projects/${project!.id}`,json('PATCH',{research_questions:questions,keywords}));await reload();notify('研究问题已保存')}catch(e){notify((e as Error).message,'error')}}
  return <><PageHeader kicker="RESEARCH PLANNER" title="Turn an idea into testable questions" description="GeniOS Agent 将模糊想法转化为研究目标、问题、关键词和可执行任务。" actions={<button className="button primary" onClick={generate} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>} 重新规划</button>}/>
    <div className="planner-grid"><article className="card idea-card"><small>ORIGINAL IDEA</small><Lightbulb/><h3>{project.idea}</h3><p>{project.description}</p><div className="tag-row">{keywords.map(k=><span className="tag" key={k}>{k}</span>)}</div></article>
      <article className="card"><div className="card-heading"><div><small>RESEARCH QUESTIONS</small><h3>可编辑的问题集</h3></div><button className="button ghost small" onClick={()=>setQuestions([...questions,''])}><Plus size={15}/> 添加</button></div><div className="question-editor">{questions.map((q,i)=><div key={i}><span>RQ{i+1}</span><textarea value={q.replace(/^RQ\d+:\s*/, '')} onChange={e=>setQuestions(questions.map((v,n)=>n===i?`RQ${i+1}: ${e.target.value}`:v))}/><button className="icon-button" onClick={()=>setQuestions(questions.filter((_,n)=>n!==i))}><X size={16}/></button></div>)}</div><button className="button primary" onClick={save}><Check size={16}/> 保存到 Project Memory</button></article>
    </div><article className="card task-plan"><div className="card-heading"><div><small>AGENT TASK PLAN</small><h3>从当前状态持续推进</h3></div><span className="status-pill"><span/> {project.tasks.length} tasks</span></div><div className="task-row">{project.tasks.map((task,i)=><div key={task.id}><span>{String(i+1).padStart(2,'0')}</span><div><b>{task.title}</b><small>{task.phase}</small></div>{task.done?<CheckCircle2 className="success"/>:<Circle/>}</div>)}</div></article>
  </>
}

function Literature() {
  const {project,reload,notify}=useWorkspace(); const [papers,setPapers]=useState<Paper[]>([]); const [results,setResults]=useState<Paper[]>([]); const [query,setQuery]=useState(project?.keywords.slice(0,3).join(' ')||''); const [searching,setSearching]=useState(false); const [doiOpen,setDoiOpen]=useState(false); const fileRef=useRef<HTMLInputElement>(null)
  const load=useCallback(()=>project?request<Paper[]>(`/api/projects/${project.id}/papers`).then(setPapers).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]); useEffect(()=>{void load()},[load])
  if(!project)return null
  async function search(e?:FormEvent){e?.preventDefault();setSearching(true);try{const data=await request<{items:Paper[];error?:string}>(`/api/literature/search?q=${encodeURIComponent(query)}&limit=12`);setResults(data.items);if(data.error)notify(data.error,'error');else notify(`OpenAlex 返回 ${data.items.length} 篇真实文献`)}catch(error){notify((error as Error).message,'error')}finally{setSearching(false)}}
  async function add(p:Paper){try{await request(`/api/projects/${project!.id}/papers`,json('POST',p));await load();await reload();notify('文献已加入项目')}catch(e){notify((e as Error).message,'error')}}
  async function patchPaper(p:Paper,patch:Partial<Paper>){try{await request(`/api/papers/${p.id}`,json('PATCH',patch));await load();await reload()}catch(e){notify((e as Error).message,'error')}}
  async function removePaper(p:Paper){if(!window.confirm(`从项目中删除“${p.title}”？`))return;try{await request(`/api/papers/${p.id}`,json('DELETE'));await load();await reload();notify('文献已从项目移除')}catch(e){notify((e as Error).message,'error')}}
  async function addDoi(e:FormEvent<HTMLFormElement>){e.preventDefault();const doi=String(new FormData(e.currentTarget).get('doi')||'').replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').trim();setSearching(true);try{const data=await request<{items:Paper[]}>(`/api/literature/search?q=${encodeURIComponent(doi)}&limit=10`);const match=data.items.find(item=>(item.doi||'').toLowerCase()===doi.toLowerCase())||data.items[0];if(!match)throw new Error('OpenAlex 未找到该 DOI');await add(match);setDoiOpen(false)}catch(error){notify((error as Error).message,'error')}finally{setSearching(false)}}
  async function upload(file?:File){if(!file)return;const body=new FormData();body.append('file',file);try{notify('正在解析 PDF…');await request(`/api/projects/${project!.id}/papers/upload`,{method:'POST',body});await load();await reload();notify('PDF 已解析并加入论文库')}catch(e){notify((e as Error).message,'error')}finally{if(fileRef.current)fileRef.current.value=''}}
  return <><PageHeader kicker="LITERATURE LIBRARY" title="Search, screen, and read" description="通过 OpenAlex 获取真实元数据，或上传 PDF 建立项目级论文库。" actions={<><input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e=>void upload(e.target.files?.[0])}/><button className="button ghost" onClick={()=>setDoiOpen(true)}><Plus size={16}/> Add DOI</button><button className="button ghost" onClick={()=>fileRef.current?.click()}><Upload size={16}/> 上传 PDF</button></>}/>
    <form className="search-bar card" onSubmit={search}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search papers, methods, authors…"/><select aria-label="year"><option>All years</option><option>2022–2026</option><option>2018–2021</option></select><button className="button primary" disabled={searching}>{searching?<LoaderCircle className="spin"/>:'Search OpenAlex'}</button></form>
    {results.length>0&&<section className="search-results"><div className="section-row"><h2>OpenAlex results <span>{results.length}</span></h2><button className="text-button" onClick={()=>setResults([])}>关闭结果</button></div>{results.map(p=><PaperRow key={p.source_id||p.title} paper={p} action={<button className="button small primary" onClick={()=>void add(p)}><Plus size={14}/> Add</button>}/>)}</section>}
    <section><div className="section-row"><h2>Project library <span>{papers.length}</span></h2><div className="legend"><span><i className="dot core"/> Core</span><span><i className="dot sample"/> Demo/sample</span></div></div><div className="paper-list">{papers.map(p=><PaperRow key={p.id} paper={p} linked action={<div className="paper-actions"><button title="核心论文" className={`icon-button ${p.is_core?'active':''}`} onClick={()=>void patchPaper(p,{is_core:!p.is_core})}><BookMarked size={17}/></button><select value={p.status} onChange={e=>void patchPaper(p,{status:e.target.value})}><option value="unread">Unread</option><option value="to_read">To read</option><option value="read">Read</option></select><button title="删除文献" className="icon-button danger" onClick={()=>void removePaper(p)}><X size={16}/></button></div>}/>)}</div></section>
    {doiOpen&&<Modal title="Add paper by DOI" onClose={()=>setDoiOpen(false)}><form className="form-stack" onSubmit={addDoi}><label>DOI<input name="doi" required placeholder="10.1145/… or https://doi.org/…"/></label><p className="form-help">ScholarFlow 将通过 OpenAlex 核验 DOI 并保存真实元数据，不会创建虚构引用。</p><button className="button primary" disabled={searching}>{searching?<LoaderCircle className="spin"/>:<Search size={16}/>} Verify & Add</button></form></Modal>}
  </>
}

function PaperRow({paper,action,linked=false}:{paper:Paper;action:ReactNode;linked?:boolean}) {
  const {project}=useWorkspace(); const content=<><div className="paper-rank">{Math.round((paper.relevance||0)*100)}<small>match</small></div><div className="paper-info"><div className="paper-meta"><span>{paper.year||'—'}</span><span>{paper.venue||'Unknown venue'}</span>{paper.source==='demo/sample'&&<span className="sample-badge">DEMO / SAMPLE</span>}</div><h3>{paper.title}</h3><p className="authors">{paper.authors.join(', ')||'Authors unavailable'}</p><p className="abstract">{paper.abstract||'No abstract available from the source.'}</p><div className="paper-foot">{paper.doi&&<span>DOI {paper.doi}</span>}<span>{paper.cited_by_count||0} citations</span>{paper.is_core&&<span className="core-label"><BookMarked size={13}/> Core paper</span>}</div></div></>
  return <article className="paper-row"><div className="paper-link">{linked?<Link to={`/projects/${project?.id}/papers/${paper.id}`}>{content}</Link>:content}</div><div>{action}</div></article>
}

function PaperReader() {
  const {paperId}=useParams(); const {project,notify,reload}=useWorkspace(); const [paper,setPaper]=useState<Paper|null>(null); const [notes,setNotes]=useState(''); const [question,setQuestion]=useState('总结论文的主要贡献与局限'); const [answer,setAnswer]=useState<{answer:string;citations:{snippet:string;chunk:number}[]} | null>(null); const [busy,setBusy]=useState(false)
  const load=useCallback(()=>request<Paper>(`/api/papers/${paperId}`).then(value=>{setPaper(value);setNotes(value.notes||'')}).catch(e=>notify(e.message,'error')),[paperId,notify]);useEffect(()=>{void load()},[load]); if(!project||!paper)return <Loader/>
  async function ask(){setBusy(true);try{setAnswer(await request(`/api/papers/${paper!.id}/ask`,json('POST',{question})))}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function extract(){setBusy(true);try{await request(`/api/projects/${project!.id}/evidence/extract`,json('POST',{paper_id:paper!.id}));await load();await reload();notify('结构化证据已保存到 Evidence Matrix')}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function saveNotes(){try{await request(`/api/papers/${paper!.id}`,json('PATCH',{notes}));notify('阅读笔记已保存')}catch(e){notify((e as Error).message,'error')}}
  const sections=paper.sections.length?paper.sections:[{title:'Abstract',content:paper.abstract}]
  return <><PageHeader kicker="PAPER READER" title={paper.title} description={`${paper.authors.join(', ')} · ${paper.year||'Year unknown'} · ${paper.venue}`} actions={<button className="button primary" onClick={extract} disabled={busy}><Sparkles size={16}/> Extract Evidence</button>}/>
    <div className="reader-grid"><aside className="reader-outline card"><small>DOCUMENT OUTLINE</small>{sections.map((s,i)=><a href={`#section-${i}`} key={i}>{s.title}<ChevronRight size={14}/></a>)}</aside><article className="reader-document card">{paper.source==='demo/sample'&&<div className="warning"><CircleAlert size={17}/><span>这是 demo/sample 记录，不应作为正式文献引用。请用 OpenAlex 或 PDF 导入真实来源。</span></div>}{sections.map((s,i)=><section id={`section-${i}`} key={i}><span>{String(i+1).padStart(2,'0')}</span><h2>{s.title}</h2>{s.content.split('\n').filter(Boolean).map((p,n)=><p key={n}>{p}</p>)}</section>)}</article><aside className="reading-assistant card"><div className="assistant-head"><span><Bot size={17}/> AI READING ASSISTANT</span><i/></div><div className="quick-prompts">{['提取 Research Question','提取 Method','提取 Dataset','提取 Results','提取 Limitations'].map(q=><button key={q} onClick={()=>setQuestion(q)}>{q}</button>)}</div><textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4}/><button className="button primary full" onClick={ask} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>} Ask this paper</button>{answer&&<div className="assistant-answer"><b>Evidence-grounded answer</b><p>{answer.answer}</p>{answer.citations.map((c,i)=><blockquote key={i}>Chunk {c.chunk}: {c.snippet}</blockquote>)}</div>}<div className="paper-notes"><small>READING NOTES</small><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录判断、疑问和复现线索…"/><button className="button ghost small full" onClick={saveNotes}>Save notes</button></div><div className="saved-evidence"><small>SAVED EVIDENCE</small><b>{paper.evidence?.length||0} extracted records</b></div></aside></div>
  </>
}

function EvidenceWorkspace() {
  const {project,reload,notify}=useWorkspace();const [evidence,setEvidence]=useState<Evidence[]>([]);const [claims,setClaims]=useState<Claim[]>([]);const [tab,setTab]=useState<'matrix'|'graph'>('matrix');const [busy,setBusy]=useState(false);const [editing,setEditing]=useState<Evidence|null>(null);const [claimOpen,setClaimOpen]=useState(false)
  const load=useCallback(async()=>{if(!project)return;try{const [e,c]=await Promise.all([request<Evidence[]>(`/api/projects/${project.id}/evidence`),request<Claim[]>(`/api/projects/${project.id}/claims`)]);setEvidence(e);setClaims(c)}catch(e){notify((e as Error).message,'error')}},[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function gap(){setBusy(true);try{await request(`/api/projects/${project!.id}/gap`,json('POST'));await reload();notify('Research Gap 已根据当前证据更新')}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  async function saveEvidence(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!editing)return;const values=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/evidence/${editing.id}`,json('PATCH',{...values,confidence:Number(values.confidence)}));setEditing(null);await load();notify('证据记录已人工修订')}catch(error){notify((error as Error).message,'error')}}
  async function addClaim(e:FormEvent<HTMLFormElement>){e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/projects/${project!.id}/claims`,json('POST',{...values,evidence_id:Number(values.evidence_id),confidence:Number(values.confidence)}));setClaimOpen(false);await load();await reload();notify('Claim 已连接到来源证据')}catch(error){notify((error as Error).message,'error')}}
  return <><PageHeader kicker="EVIDENCE SYSTEM" title="Claims must lead back to sources" description="多篇论文的结构化证据与研究 Claim 在这里建立可追溯关系。" actions={<><button className="button ghost" onClick={()=>setClaimOpen(true)}><Plus size={16}/> New Claim</button><a className="button ghost" href={`/api/projects/${project.id}/evidence.csv`}><Download size={16}/> Export CSV</a><button className="button primary" onClick={gap} disabled={busy}><Sparkles size={16}/> Analyze Gap</button></>}/>
    <div className="tab-bar"><button className={tab==='matrix'?'active':''} onClick={()=>setTab('matrix')}><ClipboardCheck size={16}/> Evidence Matrix</button><button className={tab==='graph'?'active':''} onClick={()=>setTab('graph')}><Network size={16}/> Evidence Graph</button></div>
    {tab==='matrix'?<article className="card table-card"><div className="table-scroll"><table><thead><tr><th>Paper</th><th>Problem</th><th>Method</th><th>Dataset</th><th>Baseline</th><th>Metric</th><th>Result</th><th>Limitation</th><th>Confidence</th><th/></tr></thead><tbody>{evidence.map(e=><tr key={e.id}><td><Link to={`/projects/${project.id}/papers/${e.paper_id}`}>{e.paper_title}</Link><small>{e.source_section}</small></td><td>{e.problem||'—'}</td><td>{e.method||'—'}</td><td>{e.dataset||'—'}</td><td>{e.baseline||'—'}</td><td>{e.metric||'—'}</td><td className="result-cell">{e.result||'—'}{e.source_snippet&&<span title={e.source_snippet}><Quote size={13}/> source</span>}</td><td>{e.limitation||'—'}</td><td><Confidence value={e.confidence}/></td><td><button className="icon-button" title="Edit evidence" onClick={()=>setEditing(e)}><PenLine size={15}/></button></td></tr>)}</tbody></table></div></article>:<EvidenceGraph claims={claims}/>}
    <article className="card gap-card"><div><div className="section-kicker">EVIDENCE-BASED RESEARCH GAP</div><h2>{project.research_gap?'A traceable gap is active':'Gap analysis needed'}</h2><p>{project.research_gap||'先补充论文证据，再让 Agent 识别覆盖不足、互相矛盾和未研究的问题。'}</p></div><div className="citation-stack">{project.gap_citations.map(id=><Link key={id} to={`/projects/${project.id}/papers/${id}`}><FileText size={15}/> Paper {id}<ExternalLink size={13}/></Link>)}</div></article>
    {editing&&<Modal title="Edit evidence record" onClose={()=>setEditing(null)}><form className="form-stack" onSubmit={saveEvidence}><div className="two-col"><label>Problem<textarea name="problem" defaultValue={editing.problem}/></label><label>Method<textarea name="method" defaultValue={editing.method}/></label></div><div className="two-col"><label>Dataset<input name="dataset" defaultValue={editing.dataset}/></label><label>Baseline<input name="baseline" defaultValue={editing.baseline}/></label></div><div className="two-col"><label>Metric<input name="metric" defaultValue={editing.metric}/></label><label>Source section<input name="source_section" defaultValue={editing.source_section}/></label></div><label>Result<textarea name="result" defaultValue={editing.result}/></label><label>Limitation<textarea name="limitation" defaultValue={editing.limitation}/></label><label>Source snippet<textarea name="source_snippet" defaultValue={editing.source_snippet}/></label><label>Confidence (0–1)<input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue={editing.confidence}/></label><button className="button primary">Save verified evidence</button></form></Modal>}
    {claimOpen&&<Modal title="Create traceable Claim" onClose={()=>setClaimOpen(false)}><form className="form-stack" onSubmit={addClaim}><label>Claim<textarea name="text" required rows={3} placeholder="输入需要被证据支持或反驳的研究结论"/></label><div className="two-col"><label>Linked evidence<select name="evidence_id" required>{evidence.map(item=><option key={item.id} value={item.id}>#{item.id} · {item.paper_title}</option>)}</select></label><label>Stance<select name="stance"><option value="supporting">Supporting</option><option value="contradicting">Contradicting</option></select></label></div><label>Confidence (0–1)<input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue="0.6"/></label><label>Notes<textarea name="notes" placeholder="说明判断依据或待核验事项"/></label><button className="button primary" disabled={!evidence.length}>Link Claim to Evidence</button></form></Modal>}
  </>
}

function Confidence({value}:{value:number}) {return <span className={`confidence ${value>=.8?'high':value>=.55?'mid':'low'}`}>{Math.round(value*100)}%</span>}
function EvidenceGraph({claims}:{claims:Claim[]}) {return <div className="graph-canvas card"><div className="graph-label">CLAIM → EVIDENCE → PAPER</div>{claims.map((claim,i)=><div className="graph-row" key={claim.id}><div className="claim-node"><small>CLAIM {String.fromCharCode(65+i)}</small><b>{claim.text}</b><Confidence value={claim.confidence}/></div><div className="graph-lines"><i/><i/><i/></div><div className="paper-nodes">{claim.links.map(link=><div key={link.paper_id}><FileText size={18}/><span><b>{link.paper_title}</b><small>{link.stance} · Evidence #{link.evidence_id}</small></span></div>)}</div></div>)}</div>}

function ResearchDesign() {
  const {project,reload,notify}=useWorkspace();const [result,setResult]=useState<Record<string,unknown>|null>(null);const [busy,setBusy]=useState(false);if(!project)return null
  async function design(){setBusy(true);try{const r=await request<Record<string,unknown>>(`/api/projects/${project!.id}/research-design`,json('POST'));setResult(r);await reload();notify('研究方案已生成，实验已写入 Experiment Manager')}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  return <><PageHeader kicker="RESEARCH DESIGN AGENT" title="From gap to executable experiments" description="把可追溯 Research Gap 转化为假设、变量、基线、指标与风险。" actions={<button className="button primary" onClick={design} disabled={busy}><Sparkles size={16}/> Generate Design</button>}/>
    <article className="card design-brief"><div className="design-icon"><Target/></div><div><small>ACTIVE RESEARCH GAP</small><h2>{project.research_gap||'尚未形成 Research Gap'}</h2><div className="citation-row">{project.gap_citations.map(id=><span key={id}>Paper {id}</span>)}</div></div></article>
    <div className="design-grid"><DesignCard title="Hypotheses" icon={<Lightbulb/>} items={project.hypotheses}/><DesignCard title="Variables" icon={<GitBranch/>} items={result?['Independent: Method configuration','Dependent: Precision, Recall, F1, Latency','Controls: Dataset, Model, Prompt, Random seed']:['生成方案后显示变量设计']}/><DesignCard title="Metrics" icon={<BarChart3/>} items={['Precision / Recall / F1','Paired significance test','95% confidence interval','Latency and retrieval cost']}/><DesignCard title="Risks" icon={<ShieldCheck/>} items={['Data leakage','Retrieval noise','Insufficient sample size','Unverified demo evidence']}/></div>
    <article className="card design-flow"><div className="flow-node"><small>CONTROL</small><b>Baseline LLM</b><span>Same dataset + prompt</span></div><ArrowRight/><div className="flow-node accent"><small>TREATMENT</small><b>LLM + RAG</b><span>Retrieved security evidence</span></div><ArrowRight/><div className="flow-node"><small>EVALUATION</small><b>Paired comparison</b><span>Quality + cost + subgroups</span></div></article>
  </>
}
function DesignCard({title,icon,items}:{title:string;icon:ReactNode;items:string[]}){return <article className="card design-card"><div>{icon}<h3>{title}</h3></div>{items.map((item,i)=><p key={i}><CheckCircle2 size={15}/>{item}</p>)}</article>}

function Experiments() {
  const {project,reload,notify}=useWorkspace();const [items,setItems]=useState<Experiment[]>([]);const [editing,setEditing]=useState<Experiment|null>(null)
  const load=useCallback(()=>project?request<Experiment[]>(`/api/projects/${project.id}/experiments`).then(setItems).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{await request(`/api/projects/${project!.id}/experiments`,json('POST',{...editing,...data,metrics:String(data.metrics).split(',').map(v=>v.trim()).filter(Boolean)}));setEditing(null);await load();await reload();notify('实验状态已保存')}catch(err){notify((err as Error).message,'error')}}
  const blank:Experiment={name:'',research_question:'',hypothesis:'',description:'',status:'Planned',input:'',dataset:'',metrics:[],result:'',notes:''}
  return <><PageHeader kicker="EXPERIMENT MANAGER" title="Plan, run, and preserve results" description="每个实验都连接研究问题、假设、输入、指标和分析结果。" actions={<button className="button primary" onClick={()=>setEditing(blank)}><Plus size={16}/> New Experiment</button>}/>
    <div className="experiment-board">{['Planned','Ready','Running','Completed','Failed'].map(status=><section key={status} className="experiment-column"><header><span className={`status-dot ${status.toLowerCase()}`}/><b>{status}</b><em>{items.filter(x=>x.status===status).length}</em></header>{items.filter(x=>x.status===status).map(item=><article className="experiment-card" key={item.id} onClick={()=>setEditing(item)}><small>{item.research_question}</small><h3>{item.name}</h3><p>{item.description}</p><div className="tag-row">{item.metrics.map(m=><span className="tag" key={m}>{m}</span>)}</div>{item.result&&<blockquote>{item.result}</blockquote>}<footer><span><Database size={14}/>{item.dataset||'Dataset TBD'}</span><ArrowRight size={15}/></footer></article>)}</section>)}</div>
    {editing&&<Modal title={editing.id?'Update experiment':'Create experiment'} onClose={()=>setEditing(null)}><form className="form-stack" onSubmit={save}><div className="two-col"><label>Name<input name="name" required defaultValue={editing.name}/></label><label>Status<select name="status" defaultValue={editing.status}><option>Planned</option><option>Ready</option><option>Running</option><option>Completed</option><option>Failed</option></select></label></div><label>Research Question<input name="research_question" defaultValue={editing.research_question}/></label><label>Hypothesis<textarea name="hypothesis" defaultValue={editing.hypothesis}/></label><label>Description<textarea name="description" defaultValue={editing.description}/></label><div className="two-col"><label>Dataset<input name="dataset" defaultValue={editing.dataset}/></label><label>Metrics (comma separated)<input name="metrics" defaultValue={editing.metrics.join(', ')}/></label></div><label>Result<textarea name="result" defaultValue={editing.result}/></label><button className="button primary">Save experiment</button></form></Modal>}
  </>
}

function AnalysisWorkspace() {
  const {project,reload,notify}=useWorkspace();const [items,setItems]=useState<Analysis[]>([]);const [busy,setBusy]=useState(false);const input=useRef<HTMLInputElement>(null)
  const load=useCallback(()=>project?request<Analysis[]>(`/api/projects/${project.id}/analyses`).then(setItems).catch(e=>notify(e.message,'error')):Promise.resolve(),[project,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  async function analyze(file?:File){if(!file)return;setBusy(true);const form=new FormData();form.append('file',file);try{await request(`/api/projects/${project!.id}/analysis`,{method:'POST',body:form});await load();await reload();notify('Python 数值分析已完成')}catch(e){notify((e as Error).message,'error')}finally{setBusy(false);if(input.current)input.current.value=''}}
  const latest=items[0]?.summary
  return <><PageHeader kicker="DATA ANALYSIS SKILL" title="Let Python do the math" description="CSV、XLSX 与 JSON 由 pandas / NumPy / SciPy 实际计算，LLM 不负责猜数。" actions={<><input ref={input} hidden type="file" accept=".csv,.xlsx,.xls,.json" onChange={e=>void analyze(e.target.files?.[0])}/><button className="button primary" onClick={()=>input.current?.click()} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Upload size={16}/>} Upload Results</button></>}/>
    {!latest?<div className="upload-zone card" onClick={()=>input.current?.click()}><div><BarChart3/></div><h2>Drop experiment results into the workflow</h2><p>自动生成数据概览、缺失值、描述统计、相关性检验与建议图表。</p><span>CSV · XLSX · JSON, up to 30 MB</span></div>:<><div className="analysis-metrics"><Metric icon={<ListChecks/>} value={String(latest.overview.rows)} label="Rows" tone="blue"/><Metric icon={<Database/>} value={String(latest.overview.columns)} label="Columns" tone="cyan"/><Metric icon={<Activity/>} value={latest.tests.length} label="Statistical tests" tone="violet"/><Metric icon={<BarChart3/>} value={latest.charts.length} label="Charts" tone="orange"/></div><div className="analysis-grid"><article className="card"><div className="card-heading"><div><small>AUTOMATIC VISUALIZATION</small><h3>Numeric distributions</h3></div></div>{latest.charts.map(c=><img className="chart" src={c} key={c} alt="Data analysis chart"/>)}</article><article className="card"><small>DATA QUALITY</small><h3>Missing values</h3><div className="data-list">{Object.entries((latest.overview.missing_values||{}) as Record<string,number>).map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div><small>STATISTICAL TESTS</small>{latest.tests.length?latest.tests.map((test,i)=><blockquote key={i}>{String(test.test)}: p = {String(test.p_value)} · {String(test.interpretation)}</blockquote>):<p className="muted">需要至少两个数值列才能运行相关性检验。</p>}</article></div><article className="card recommendations"><div><Sparkles/><span><small>ANALYSIS RECOMMENDATIONS</small><h3>What to inspect next</h3></span></div>{latest.recommendations.map(r=><p key={r}><CheckCircle2/>{r}</p>)}</article></>}
  </>
}

function Writing() {
  const {project,reload,notify}=useWorkspace();const [sections,setSections]=useState<Manuscript[]>([]);const [active,setActive]=useState('Abstract');const [content,setContent]=useState('');const [busy,setBusy]=useState(false)
  const load=useCallback(async()=>{if(!project)return;try{const data=await request<Manuscript[]>(`/api/projects/${project.id}/manuscript`);setSections(data);const item=data.find(s=>s.section===active);if(item)setContent(item.content)}catch(e){notify((e as Error).message,'error')}},[project,active,notify]);useEffect(()=>{void load()},[load]);if(!project)return null
  function switchSection(name:string){setActive(name);setContent(sections.find(s=>s.section===name)?.content||'')}
  async function save(){try{await request(`/api/projects/${project!.id}/manuscript/${encodeURIComponent(active)}`,json('PUT',{content}));await load();await reload();notify(`${active} 已保存`)}catch(e){notify((e as Error).message,'error')}}
  async function draft(){setBusy(true);try{const result=await request<{section:Manuscript;citations:unknown[]}>(`/api/projects/${project!.id}/writing/draft`,json('POST',{section:active}));setContent(result.section.content);await load();notify(`已基于 ${result.citations.length} 条项目证据生成草稿`)}catch(e){notify((e as Error).message,'error')}finally{setBusy(false)}}
  const citeCount=(content.match(/\[Paper \d+/g)||[]).length
  return <><PageHeader kicker="WRITING WORKSPACE" title="Write with evidence in view" description="逐章节辅助写作；没有项目证据的陈述会被明确标记，绝不伪造引用。" actions={<><button className="button ghost" onClick={save}><Check size={16}/> Save</button><button className="button primary" onClick={draft} disabled={busy}><Sparkles size={16}/> Evidence Draft</button></>}/>
    <div className="writing-grid"><aside className="section-nav card"><small>MANUSCRIPT</small>{sections.map(section=><button key={section.section} className={active===section.section?'active':''} onClick={()=>switchSection(section.section)}><span>{section.content.length>80?<CheckCircle2/>:<Circle/>}{section.section}</span><small>{section.content.length} chars</small></button>)}</aside><article className="editor-card card"><header><div><small>SECTION</small><h2>{active}</h2></div><div><span>{content.split(/\s+/).filter(Boolean).length} words</span><span>{citeCount} citations</span></div></header><textarea className="manuscript-editor" value={content} onChange={e=>setContent(e.target.value)} placeholder="Start writing here…"/><footer><span><ShieldCheck size={15}/> Citation-aware safeguards active</span><button className="text-button" onClick={save}>Save changes</button></footer></article><aside className="evidence-sidebar card"><div className="assistant-head"><span><Quote size={17}/> AVAILABLE EVIDENCE</span><i/></div><p>草稿只会引用项目 Evidence Matrix 中已有的证据。</p><div className="evidence-count"><b>{project.evidence_count}</b><span>evidence records</span></div><div className="evidence-count"><b>{project.core_paper_count}</b><span>core papers</span></div><div className="warning soft"><CircleAlert/><span>“该陈述当前缺少项目文献证据”表示必须补充来源或删除该论断。</span></div><Link to={`/projects/${project.id}/evidence`} className="button ghost full">Open Evidence Matrix</Link></aside></div>
  </>
}

function SettingsPage() {
  const [health,setHealth]=useState<{llm_configured:boolean;orchestrator:string;demo_mode:boolean}|null>(null);useEffect(()=>{request<{llm_configured:boolean;orchestrator:string;demo_mode:boolean}>('/api/health').then(setHealth).catch(()=>{})},[])
  return <div className="settings-page"><header className="projects-header container"><Brand/><Link className="button ghost small" to="/projects"><ArrowRight className="flip" size={16}/> Back to projects</Link></header><main className="settings-main container"><PageHeader kicker="SYSTEM SETTINGS" title="GeniOS-ready, provider-neutral" description="本地 ScholarFlow 提供工具与科研状态；南开 GeniOS 保持顶层 Agent / Workflow 编排角色。"/>
    <article className="architecture card"><div className="architecture-node genios"><Zap/><span><small>TOP-LEVEL ORCHESTRATOR</small><b>Nankai GeniOS Agent</b><em>{health?.demo_mode?'Credentials not configured · Demo mode':'Configured'}</em></span></div><div className="connector"><i/><span>13 HTTP Tools · JSON Schema</span><i/></div><div className="architecture-tools"><div><FolderKanban/><b>Project State</b></div><div><BookOpen/><b>Literature</b></div><div><FileSearch/><b>PDF & QA</b></div><div><Network/><b>Evidence</b></div><div><BarChart3/><b>Analysis</b></div><div><PenLine/><b>Writing</b></div></div></article>
    <div className="settings-grid"><article className="card"><div className="card-heading"><div><small>LLM PROVIDER</small><h3>OpenAI-compatible interface</h3></div><span className={`config-status ${health?.llm_configured?'ready':''}`}>{health?.llm_configured?'Configured':'Optional'}</span></div><p>支持 OpenAI、DeepSeek 和本地 OpenAI-compatible endpoint。未配置 Key 时，确定性状态机与本地工具仍然完整运行。</p><code>LLM_BASE_URL<br/>LLM_API_KEY<br/>LLM_MODEL</code></article><article className="card"><div className="card-heading"><div><small>GENIOS ADAPTER</small><h3>Tool schemas ready</h3></div><span className="config-status ready">Ready</span></div><p>工具定义位于 <code>genios/tools.json</code>，运行后也可在 FastAPI OpenAPI 页面检查全部接口。</p><a className="button ghost" href="http://127.0.0.1:8000/docs" target="_blank">Open API Docs <ExternalLink size={15}/></a></article></div>
  </main></div>
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X/></button></header>{children}</div></div>}
function Empty({text,compact=false}:{text:string;compact?:boolean}){return <div className={`empty ${compact?'compact':''}`}><FileSearch/><p>{text}</p></div>}
function Loader(){return <div className="loader"><LoaderCircle className="spin"/><span>Loading research state…</span></div>}
