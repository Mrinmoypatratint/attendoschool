import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Navigate,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import {api, API_BASE_URL} from './api';
import {useAuth,Guard,RoleGuard} from './hooks/useAuth';
import AttendanceReports from './AttendanceReports';
import AttendanceCorrections from './AttendanceCorrections';
import PeopleManagement from './PeopleManagement';
import AcademicYears from './AcademicYears';
import StudentPromotion from './StudentPromotion';
import ParentPortal from './ParentPortal';
import Permissions from './Permissions';
import SubscriptionEnforcement from './SubscriptionEnforcement';
import Security from './Security';
import Backup from './Backup';
import Timetable from './Timetable';
import OfflineAttendance from './OfflineAttendance';
import Analytics from './Analytics';
import Communication from './Communication';
import ParentCommunication from './ParentCommunication';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,Users,GraduationCap,BookOpen,Layers,LogOut,Plus,
  CalendarDays,ClipboardCheck,School,CheckCircle2,MessageSquare,BarChart3,
  FileText,Shield,Database,Clock,Wifi,UserPlus,Settings,Moon,Sun,
  ArrowUpDown,Bell,CreditCard,Eye,FileSpreadsheet,Download,Trash2,
  UploadCloud,CheckSquare,Square,RefreshCw,Send,Lock,ShieldCheck,Mail,Server,
  Search,Sparkles,ArrowRight,Activity,Zap,EyeOff,ArrowLeft
} from 'lucide-react';

const fmt=(t:string)=>t?.slice(0,5)||'';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ────── Dark Mode ────── */
function useTheme(){
  const [dark,setDark]=useState(()=>{
    const saved=localStorage.getItem('theme');
    if(saved) return saved==='dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    localStorage.setItem('theme',dark?'dark':'light');
  },[dark]);
  return {dark,toggle:()=>setDark(d=>!d)};
}

/* ────── Login ────── */
function Login(){
  const nav=useNavigate();
  const {login}=useAuth();
  const [email,setEmail]=useState('admin@demo-school.local');
  const [password,setPassword]=useState('ChangeMe123!');
  const [showPassword,setShowPassword]=useState(false);
  const [agree,setAgree]=useState(true);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setLoading(true);
    try{
      const{data}=await api.post('/auth/login',{email,password});
      login(data.token,data.user);
      nav('/dashboard');
    }catch(e:any){setError(e?.response?.data?.message||'Login failed')}
    finally{setLoading(false)}
  }

  return (
    <div className="edu-auth-wrapper">
      <div className="edu-auth-card">
        {/* Left Side: Educational Hero Showcase */}
        <div className="edu-auth-hero">
          <img
            src="/educational_student_campus.jpg"
            alt="AttendoSchool Campus & Academic Excellence"
            className="edu-auth-hero-img"
          />
          <div className="edu-auth-hero-scrim" />

          {/* Official Full Uncropped Brand Logo (Emblem with Name Underneath as in Logo) */}
          <div className="edu-auth-emblem">
            <img src="/attendo-school-logo.png" alt="AttendoSchool" />
          </div>

          {/* Bottom Telemetry Scrim */}
          <div className="edu-auth-hero-bottom">
            <div className="edu-live-pill">
              <span className="edu-live-dot"></span>
              <span>98.6% Daily Attendance Verified</span>
            </div>
            <p className="edu-hero-tagline">
              "Attendance Today — Brighter Tomorrow"
            </p>
            <div className="edu-hero-badge-row">
              <GraduationCap size={13} />
              <span>CBSE · ICSE · ISO 9001:2015 Accredited</span>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Professional Form (Matches Mockup) */}
        <div className="edu-auth-form-side">
          <button type="button" className="edu-back-link" onClick={() => { setEmail('admin@demo-school.local'); setPassword('ChangeMe123!'); }}>
            <ArrowLeft size={14} /> <span>Back</span>
          </button>

          <h1 className="edu-form-title">Log in</h1>
          <p className="edu-form-sub">
            Institutional Academic & Attendance Management Portal
          </p>

          {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={submit}>
            <div className="edu-form-group">
              <label>Email Address</label>
              <div className="edu-input-wrap">
                <input
                  required
                  type="email"
                  className="edu-input"
                  placeholder="john52martinez@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="edu-form-group">
              <label>Password</label>
              <div className="edu-input-wrap">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  className="edu-input"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="edu-eye-btn"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(s => !s)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact your institutional school administrator to reset your credentials.'); }} className="edu-forgot-link">
                Forgot Password?
              </a>
            </div>

            <label className="edu-terms-row">
              <input
                type="checkbox"
                checked={agree}
                onChange={e => setAgree(e.target.checked)}
              />
              <span>I agree to the <b>Terms & Conditions</b></span>
            </label>

            <button type="submit" className="edu-btn-login" disabled={loading || !agree}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="edu-divider">
            <span>or</span>
          </div>

          <div className="edu-demo-pills">
            <button
              type="button"
              className="edu-demo-btn"
              onClick={() => { setEmail('superadmin@attendance.local'); setPassword('ChangeMe123!'); }}
              title="Quick Super Admin Demo Login"
            >
              <ShieldCheck size={14} className="edu-role-icon" style={{ color: '#7c3aed' }} />
              <span>Super Admin</span>
            </button>
            <button
              type="button"
              className="edu-demo-btn"
              onClick={() => { setEmail('admin@demo-school.local'); setPassword('ChangeMe123!'); }}
              title="Quick School Admin Demo Login"
            >
              <School size={14} className="edu-role-icon" style={{ color: '#059669' }} />
              <span>School Admin</span>
            </button>
            <button
              type="button"
              className="edu-demo-btn"
              onClick={() => { setEmail('rahul@demo-school.local'); setPassword('ChangeMe123!'); }}
              title="Quick Teacher Demo Login"
            >
              <GraduationCap size={14} className="edu-role-icon" style={{ color: '#d97706' }} />
              <span>Teacher</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────── Layout ────── */
function Layout({children}:{children:React.ReactNode}){
  const {user,logout}=useAuth();
  const nav=useNavigate();
  const loc=useLocation();
  const {dark,toggle}=useTheme();

  if(!user) return null;

  const adminLinks:any[]=[
    ['—','MAIN'],
    ['/dashboard','Dashboard',LayoutDashboard],
    ['/students','Students',Users],
    ['/teachers','Teachers',GraduationCap],
    ['/classes','Classes & Sections',Layers],
    ['/subjects','Subjects',BookOpen],
    ['/routine','Class Routine',CalendarDays],
    ['—','ATTENDANCE'],
    ['/attendance-reports','Reports',FileText],
    ['/attendance-corrections','Corrections',ArrowUpDown],
    ['—','MANAGEMENT'],
    ['/people','People',UserPlus],
    ['/academic-years','Academic Years',Clock],
    ['/promotion','Promotions',GraduationCap],
    ['/timetable','Timetable',CalendarDays],
    ['—','COMMUNICATION'],
    ['/notifications','Notifications',Bell],
    ['/communication','Announcements',MessageSquare],
    ['—','SETTINGS'],
    ['/subscription','Subscription',CreditCard],
    ['/analytics','Analytics',BarChart3],
    ['/backups','Backups',Database],
  ];

  const teacherLinks:any[]=[
    ['—','MAIN'],
    ['/dashboard','Dashboard',LayoutDashboard],
    ['/take-attendance','Take Attendance',ClipboardCheck],
    ['/teacher-history','History',CalendarDays],
    ['—','ATTENDANCE'],
    ['/attendance-reports','Reports',FileText],
    ['/attendance-corrections','Corrections',ArrowUpDown],
    ['/timetable','Timetable',CalendarDays],
    ['/offline-attendance','Offline Mode',Wifi],
  ];

  const superAdminLinks:any[]=[
    ['—','MAIN'],
    ['/dashboard','Overview',LayoutDashboard],
    ['/super-admin','Schools',School],
    ['/payments','Payments',CreditCard],
    ['/invoices','Invoices',BookOpen],
    ['/monitor','Monitoring',Eye],
    ['—','PLATFORM'],
    ['/analytics','Analytics',BarChart3],
    ['/people','People',UserPlus],
    ['/permissions','Permissions',Shield],
    ['/security','Security',Shield],
  ];

  const parentLinks:any[]=[
    ['—','MAIN'],
    ['/parent-portal','My Children',Users],
    ['/parent-communication','Messages',MessageSquare],
  ];

  const links=user.role==='SUPER_ADMIN'?superAdminLinks:
    user.role==='TEACHER'?teacherLinks:
    user.role==='PARENT'?parentLinks:
    adminLinks;

  return <div className="app-shell">
    <aside>
      <div className="sidebar-header">
        <div className="school-crest" style={{ background: '#ffffff', border: '1px solid var(--border)', padding: 3, overflow: 'hidden' }}>
          <img src="/attendo-school-logo.png" alt="AttendoSchool" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
        </div>
        <div className="school-info">
          <span className="school-name">{user.role==='SUPER_ADMIN'?'AttendoSchool Platform':'AttendoSchool · Demo High'}</span>
          <span className="school-meta">Attendance Today · Brighter Tomorrow</span>
        </div>
      </div>
      <div className="sidebar-nav-container">
        <nav>
          {links.map(([p,l,I]:any,i:number)=>{
            if(p==='—') return <div className="sidebar-section-label" key={`s-${i}`}>{l}</div>;
            return <button key={p} className={loc.pathname===p?'nav-active':''} onClick={()=>nav(p)}>
              <I size={16}/> <span>{l}</span>
            </button>;
          })}
        </nav>
      </div>
      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={toggle} title={dark?'Light mode':'Dark mode'}>
          {dark?<Sun size={15}/>:<Moon size={15}/>} <span>{dark?'Light Mode':'Dark Mode'}</span>
        </button>
        <button className="logout" onClick={()=>{logout();nav('/login')}}>
          <LogOut size={15}/> <span>Sign out</span>
        </button>
      </div>
    </aside>
    <main>
      <header>
        <div className="header-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/attendo-school-logo.png" alt="AttendoSchool" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain' }} />
            <p className="eyebrow" style={{ margin: 0 }}>ATTENDOSCHOOL · {user.role.replace(/_/g,' ')}</p>
          </div>
          <h2>{user.name}</h2>
        </div>
        <div className="header-search">
          <Search size={15}/>
          <input placeholder="Search records, students, classes..." />
          <span className="header-kbd">⌘K</span>
        </div>
        <div className="header-right">
          <div className="session-pill">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
            2025–26 ACADEMIC SESSION
          </div>
          <button className="header-icon-btn" title="Notifications" onClick={()=>nav(user.role==='TEACHER'?'/teacher-history':'/notifications')}>
            <Bell size={16}/>
            <span className="header-badge-dot"></span>
          </button>
          <button className="header-icon-btn" onClick={toggle} title={dark?'Light mode':'Dark mode'}>
            {dark?<Sun size={16}/>:<Moon size={16}/>}
          </button>
          <div className="profile-pill">
            <div className="user-avatar">
              {user.name ? user.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() : 'SA'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{user.name}</span>
              <span className="profile-role">{user.email}</span>
            </div>
          </div>
        </div>
      </header>
      {children}
    </main>
  </div>
}

/* ────── Shared Components ────── */
function Stat({label,value,trend,sub}:{label:string;value:any;trend?:string;sub?:string}){
  return <div className="stat">
    <span>{label}</span>
    <strong>{value}</strong>
    {(trend || sub) && (
      <div className="stat-sub">
        {trend && (
          <span className={`stat-trend ${trend.startsWith('-') || trend.toLowerCase().includes('expired') || trend.toLowerCase().includes('failed') ? 'negative' : 'positive'}`}>
            {trend.startsWith('+') ? '↑ ' : trend.startsWith('-') ? '↓ ' : ''}{trend}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    )}
  </div>
}
function PageHead({title,sub,button,onClick}:{title:string;sub:string;button?:string;onClick?:()=>void}){return <div className="page-head"><div><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><img src="/attendo-school-logo.png" alt="AttendoSchool" style={{width:18,height:18,borderRadius:4,objectFit:'contain'}}/><p className="eyebrow" style={{margin:0}}>{title.includes('Admin')?'ATTENDOSCHOOL SUPER ADMIN':'ATTENDOSCHOOL ADMIN'}</p></div><h1>{title}</h1><p className="muted">{sub}</p></div>{button&&<button onClick={onClick}><Plus size={16}/>{button}</button>}</div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="overlay"><div className="modal"><div className="modal-head"><h3>{title}</h3><button className="close" onClick={close}>×</button></div>{children}</div></div>}

/* ────── Dashboard ────── */
function Dashboard(){const {user}=useAuth();if(!user)return null;return user.role==='SUPER_ADMIN'?<SuperAdminHome/>:user.role==='TEACHER'?<TeacherHome/>:<AdminHome/>}

function AdminHome(){
  const {user}=useAuth();
  const [s,setS]=useState<any>();
  const [period,setPeriod]=useState('Today');
  useEffect(()=>{api.get('/dashboard/school').then(x=>setS(x.data)).catch(()=>{})},[]);
  return <Layout>
    <div className="hero">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><img src="/attendo-school-logo.png" alt="AttendoSchool" style={{width:26,height:26,borderRadius:6,objectFit:'contain'}}/><p className="eyebrow" style={{margin:0}}>ATTENDOSCHOOL · INSTITUTIONAL CONSOLE</p></div>
      <h1>Demo Higher Secondary School</h1>
      <p>Official student and faculty directories, academic year lifecycle, section routine scheduling, and verified attendance audits.</p>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
      <div className="date-filter-group">
        {['Today', 'Weekly', 'Monthly', 'Academic Year'].map(tab => (
          <button key={tab} className={`date-filter-btn ${period === tab ? 'active' : ''}`} onClick={()=>setPeriod(tab)}>{tab}</button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Academic Session: 2025–26 (Active)
      </div>
    </div>
    <div className="stats">
      <Stat label="Enrolled Students" value={s?.totalStudents??'—'} trend="+5%" sub="active enrollment"/>
      <Stat label="Appointed Faculty" value={s?.totalTeachers??'—'} trend="100%" sub="verified teachers"/>
      <Stat label="Academic Classes" value={s?.totalClasses??'—'} trend="Active" sub="curriculum setup"/>
      <Stat label="System Status" value={s?.school?.status??'ACTIVE'} trend="Verified" sub="license active"/>
    </div>
  </Layout>
}

function TeacherHome(){const {user}=useAuth();const [r,setR]=useState<any[]>([]);useEffect(()=>{api.get('/teacher/routine/today').then(x=>setR(x.data)).catch(()=>{})},[]);
  return <Layout><div className="hero"><p className="eyebrow">TODAY'S ROUTINE</p><h1>Ready to take attendance.</h1><p>Checked students are marked present. Unchecked students are automatically marked absent when submitted.</p></div><div className="panel"><h3>Today's classes</h3>{r.length===0?<p className="muted">No routine assigned for today.</p>:r.map(x=><div className="routine-card" key={x.id}><div><b>Class {x.class_number}-{x.section_name}</b><span>{x.subject_name} · {fmt(x.start_time)}–{fmt(x.end_time)} {x.room?'· '+x.room:''}</span></div><button onClick={()=>location.href=`/take-attendance?routine=${x.id}`}>Take attendance →</button></div>)}</div></Layout>}

/* ────── Students ────── */
function Students(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [classes,setClasses]=useState<any[]>([]);
  const [sections,setSections]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [f,setF]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [previewRows,setPreviewRows]=useState<any[]>([]);
  const [importing,setImporting]=useState(false);

  async function load(){
    try {
      const [a,b,c]=await Promise.all([api.get('/students'),api.get('/classes'),api.get('/sections')]);
      setRows(a.data || []);
      setClasses(b.data || []);
      setSections(c.data || []);
    } catch(err) {
      console.error('Failed to load students:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function save(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/students', f);
      const created = res.data;
      const cls = classes.find(c => c.id === f.classId);
      const sec = sections.find(s => s.id === f.sectionId);
      const rowItem = {
        ...created,
        class_number: created.class_number || cls?.class_number || 8,
        section_name: created.section_name || sec?.name || 'A'
      };
      setRows(prev => [rowItem, ...prev.filter(r => r.id !== rowItem.id)]);
      setOpen(false);
      setF({});
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not save student');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('Are you sure you want to delete this student record?')) return;
    try {
      await api.delete(`/students/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete student');
    }
  }

  async function deleteBulk() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected students?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await api.post('/students/bulk-delete', { ids });
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to bulk delete students');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = rows.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    String(r.roll_number).includes(search) ||
    String(r.class_number).includes(search)
  );

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  function downloadTemplate() {
    const sample = [
      { "Student Name": "Aarav Sharma", "Roll Number": "101", "Class Number": 8, "Section Name": "A", "Parent Name": "Rajesh Sharma", "Parent Mobile": "9876543210", "Parent Email": "rajesh.sharma@example.com" },
      { "Student Name": "Diya Patel", "Roll Number": "102", "Class Number": 8, "Section Name": "A", "Parent Name": "Kirit Patel", "Parent Mobile": "9876543211", "Parent Email": "kirit.patel@example.com" },
      { "Student Name": "Rohan Gupta", "Roll Number": "103", "Class Number": 9, "Section Name": "B", "Parent Name": "Manoj Gupta", "Parent Mobile": "9876543212", "Parent Email": "manoj.gupta@example.com" },
      { "Student Name": "Ananya Sen", "Roll Number": "104", "Class Number": 10, "Section Name": "A", "Parent Name": "Subhash Sen", "Parent Mobile": "9876543213", "Parent Email": "subhash.sen@example.com" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_import_template.xlsx");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const mapped = json.map((r, idx) => ({
          name: r["Student Name"] || r["Name"] || r["name"] || `Student ${idx + 1}`,
          rollNumber: String(r["Roll Number"] || r["Roll"] || r["roll_number"] || r["Roll No"] || idx + 101),
          classNumber: Number(r["Class Number"] || r["Class"] || r["class_number"] || 8),
          sectionName: String(r["Section Name"] || r["Section"] || r["section_name"] || 'A').toUpperCase(),
          parentName: r["Parent Name"] || r["Guardian Name"] || r["parent_name"] || '—',
          parentSmsNumber: String(r["Parent Mobile"] || r["Parent SMS"] || r["Mobile"] || r["parent_sms_number"] || '9876543210'),
          parentEmail: r["Parent Email"] || r["Email"] || r["parent_email"] || ''
        })).filter(x => x.name && x.rollNumber);
        setPreviewRows(mapped);
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post('/students/bulk-import', { students: previewRows });
      alert(`Successfully imported ${res.data.count} students!`);
      setImportOpen(false);
      setPreviewRows([]);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import students');
    } finally {
      setImporting(false);
    }
  }

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">STUDENT DIRECTORY</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Students Directory</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Manage enrolled students, section assignments, parent contacts, and batch Excel imports.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setImportOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
        >
          <FileSpreadsheet size={16} /> Import Excel / CSV
        </button>
        <button 
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add Student
        </button>
      </div>
    </div>

    {/* Search & Filter Bar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
      <input 
        placeholder="🔍 Search student name, roll number, or class..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 380, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
      />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Showing <b>{filtered.length}</b> of <b>{rows.length}</b> students
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                title="Select all"
              />
            </th>
            <th>Roll</th>
            <th>Student Name</th>
            <th>Class</th>
            <th>Section</th>
            <th>Parent / Guardian</th>
            <th>Mobile</th>
            <th>Email</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24 }} className="muted">No students found. Click "Add Student" or "Import Excel / CSV" to enroll students.</td></tr>
          ) : filtered.map(x => (
            <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
              <td style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(x.id)}
                  onChange={() => toggleSelect(x.id)}
                />
              </td>
              <td><span className="roll">{x.roll_number}</span></td>
              <td><b>{x.name}</b></td>
              <td>Class {x.class_number}</td>
              <td>Section {x.section_name}</td>
              <td>{x.parent_name || '—'}</td>
              <td><code>{x.parent_sms_number}</code></td>
              <td><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{x.parent_email || '—'}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button 
                  className="table-action-btn danger" 
                  onClick={() => deleteStudent(x.id)}
                  title="Delete student"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} students selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={deleteBulk}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE STUDENT ADD MODAL */}
    {open && <Modal title="Add Student" close={()=>setOpen(false)}>
      <form className="modal-form" onSubmit={save}>
        <label>Student Name
          <input required placeholder="Full Name (e.g. Aarav Sharma)" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/>
        </label>
        <label>Roll Number
          <input required placeholder="Roll Number (e.g. 101)" value={f.rollNumber||''} onChange={e=>setF({...f,rollNumber:e.target.value})}/>
        </label>
        <label>Parent / Guardian Name
          <input placeholder="Guardian Name" value={f.parentName||''} onChange={e=>setF({...f,parentName:e.target.value})}/>
        </label>
        <label>Parent SMS Mobile Number
          <input required placeholder="Mobile (e.g. 9876543210)" value={f.parentSmsNumber||''} onChange={e=>setF({...f,parentSmsNumber:e.target.value})}/>
        </label>
        <label>Parent Email (for Absent Alerts)
          <input type="email" placeholder="parent@example.com" value={f.parentEmail||''} onChange={e=>setF({...f,parentEmail:e.target.value})}/>
        </label>
        <label>Class
          <select required value={f.classId||''} onChange={e=>setF({...f,classId:e.target.value,sectionId:''})}>
            <option value="">Select Class</option>
            {classes.map(c=><option key={c.id} value={c.id}>Class {c.class_number}</option>)}
          </select>
        </label>
        <label>Section
          <select required value={f.sectionId||''} onChange={e=>setF({...f,sectionId:e.target.value})}>
            <option value="">Select Section</option>
            {sections.filter(s=>!f.classId || s.class_id===f.classId).map(s=><option key={s.id} value={s.id}>Section {s.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving}>{saving ? 'Saving student...' : 'Save student'}</button>
      </form>
    </Modal>}

    {/* EXCEL / CSV BULK IMPORT MODAL */}
    {importOpen && <Modal title="Bulk Import Students (Excel / CSV)" close={()=>{setImportOpen(false); setPreviewRows([]);}}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Upload an Excel (.xlsx, .xls) or CSV file with student rosters.
          </p>
          <button 
            type="button" 
            className="template-download-btn"
            onClick={downloadTemplate}
          >
            <Download size={13} /> Download Sample Template (.xlsx)
          </button>
        </div>

        <label className="dropzone">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <UploadCloud size={24} />
          </div>
          <strong style={{ fontSize: 14 }}>Click to browse or drop Excel file here</strong>
          <span className="muted" style={{ fontSize: 12 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
        </label>

        {previewRows.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Preview Data ({previewRows.length} students ready to import)</strong>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setPreviewRows([])}
              >
                Clear
              </button>
            </div>
            <div className="preview-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Parent Name</th>
                    <th>Mobile</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td><span className="roll">{r.rollNumber}</span></td>
                      <td><b>{r.name}</b></td>
                      <td>Class {r.classNumber}</td>
                      <td>{r.sectionName}</td>
                      <td>{r.parentName}</td>
                      <td>{r.parentSmsNumber}</td>
                      <td>{r.parentEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setImportOpen(false); setPreviewRows([]); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={submitBulkImport}
                disabled={importing}
                style={{ background: '#10b981', color: '#ffffff' }}
              >
                {importing ? 'Importing Students...' : `Confirm & Import ${previewRows.length} Students`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>}
  </Layout>
}

/* ────── Teachers ────── */
function Teachers(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [f,setF]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [previewRows,setPreviewRows]=useState<any[]>([]);
  const [importing,setImporting]=useState(false);

  async function load(){
    try {
      const res = await api.get('/teachers');
      setRows(res.data || []);
    } catch(err) {
      console.error('Failed to load teachers:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function save(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/teachers', f);
      const created = res.data;
      setRows(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      setOpen(false);
      setF({});
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not save teacher');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeacher(id: string) {
    if (!confirm('Are you sure you want to deactivate and remove this teacher?')) return;
    try {
      await api.delete(`/teachers/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete teacher');
    }
  }

  async function deleteBulk() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected faculty accounts?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await api.post('/teachers/bulk-delete', { ids });
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to bulk delete teachers');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = rows.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    String(r.employee_id).toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  function downloadTemplate() {
    const sample = [
      { "Teacher Name": "Sunita Verma", "Email": "sunita.v@school.local", "Employee ID": "EMP010", "Mobile": "9876500001", "Default Password": "ChangeMe123!" },
      { "Teacher Name": "Alok Mishra", "Email": "alok.m@school.local", "Employee ID": "EMP011", "Mobile": "9876500002", "Default Password": "ChangeMe123!" },
      { "Teacher Name": "Rekha Sengupta", "Email": "rekha.s@school.local", "Employee ID": "EMP012", "Mobile": "9876500003", "Default Password": "ChangeMe123!" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    XLSX.writeFile(wb, "teachers_import_template.xlsx");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const mapped = json.map((r, idx) => ({
          name: r["Teacher Name"] || r["Name"] || r["name"] || `Teacher ${idx + 1}`,
          email: String(r["Email"] || r["Email Address"] || r["email"] || `teacher${idx+1}@school.local`).toLowerCase().trim(),
          employeeId: String(r["Employee ID"] || r["Emp ID"] || r["employee_id"] || `EMP0${idx+10}`),
          mobile: String(r["Mobile"] || r["Phone"] || r["mobile"] || '9876500000'),
          password: r["Default Password"] || r["Password"] || r["password"] || 'ChangeMe123!'
        })).filter(x => x.name && x.email);
        setPreviewRows(mapped);
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post('/teachers/bulk-import', { teachers: previewRows });
      alert(`Successfully registered ${res.data.count} teachers!`);
      setImportOpen(false);
      setPreviewRows([]);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import teachers');
    } finally {
      setImporting(false);
    }
  }

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">FACULTY & STAFF</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Teachers & Faculty</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Appointed faculty accounts, classroom attendance permissions, and bulk onboarding.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setImportOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
        >
          <FileSpreadsheet size={16} /> Import Excel / CSV
        </button>
        <button 
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add Teacher
        </button>
      </div>
    </div>

    {/* Search & Filter Bar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
      <input 
        placeholder="🔍 Search teacher name, email, or employee ID..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 380, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
      />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Showing <b>{filtered.length}</b> of <b>{rows.length}</b> faculty members
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                title="Select all"
              />
            </th>
            <th>Employee ID</th>
            <th>Teacher Name</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="muted">No faculty members found. Click "Add Teacher" or "Import Excel / CSV" to onboard staff.</td></tr>
          ) : filtered.map(x => (
            <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
              <td style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(x.id)}
                  onChange={() => toggleSelect(x.id)}
                />
              </td>
              <td><code>{x.employee_id}</code></td>
              <td><b>{x.name}</b></td>
              <td>{x.email}</td>
              <td>{x.mobile || '—'}</td>
              <td><span className="badge active">{x.is_active !== false ? 'ACTIVE' : 'INACTIVE'}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button 
                  className="table-action-btn danger" 
                  onClick={() => deleteTeacher(x.id)}
                  title="Delete teacher"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} faculty selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={deleteBulk}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE TEACHER ADD MODAL */}
    {open && <Modal title="Add Teacher" close={()=>setOpen(false)}>
      <form className="modal-form" onSubmit={save}>
        <label>Teacher Full Name
          <input required placeholder="Full Name (e.g. Rahul Sharma)" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/>
        </label>
        <label>Email Address
          <input required type="email" placeholder="teacher@school.local" value={f.email||''} onChange={e=>setF({...f,email:e.target.value})}/>
        </label>
        <label>Employee ID
          <input required placeholder="EMP001" value={f.employeeId||''} onChange={e=>setF({...f,employeeId:e.target.value})}/>
        </label>
        <label>Mobile Number
          <input placeholder="Mobile Number" value={f.mobile||''} onChange={e=>setF({...f,mobile:e.target.value})}/>
        </label>
        <label>Temporary Password
          <input required type="password" placeholder="Password (e.g. ChangeMe123!)" value={f.password||''} onChange={e=>setF({...f,password:e.target.value})}/>
        </label>
        <button type="submit" disabled={saving}>{saving ? 'Creating teacher...' : 'Create teacher'}</button>
      </form>
    </Modal>}

    {/* EXCEL / CSV BULK IMPORT MODAL */}
    {importOpen && <Modal title="Bulk Import Teachers (Excel / CSV)" close={()=>{setImportOpen(false); setPreviewRows([]);}}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Upload an Excel (.xlsx, .xls) or CSV file with teacher rosters.
          </p>
          <button 
            type="button" 
            className="template-download-btn"
            onClick={downloadTemplate}
          >
            <Download size={13} /> Download Sample Template (.xlsx)
          </button>
        </div>

        <label className="dropzone">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <UploadCloud size={24} />
          </div>
          <strong style={{ fontSize: 14 }}>Click to browse or drop Excel file here</strong>
          <span className="muted" style={{ fontSize: 12 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
        </label>

        {previewRows.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Preview Data ({previewRows.length} faculty ready to import)</strong>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setPreviewRows([])}
              >
                Clear
              </button>
            </div>
            <div className="preview-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Default Password</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td><code>{r.employeeId}</code></td>
                      <td><b>{r.name}</b></td>
                      <td>{r.email}</td>
                      <td>{r.mobile}</td>
                      <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>••••••••</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setImportOpen(false); setPreviewRows([]); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={submitBulkImport}
                disabled={importing}
                style={{ background: '#10b981', color: '#ffffff' }}
              >
                {importing ? 'Importing Teachers...' : `Confirm & Import ${previewRows.length} Teachers`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>}
  </Layout>
}

/* ────── Classes ────── */
function Classes(){
  const {user}=useAuth();
  const [c,setC]=useState<any[]>([]);
  const [s,setS]=useState<any[]>([]);
  const [n,setN]=useState('');
  const [cid,setCid]=useState('');
  const [sn,setSn]=useState('');
  const [addingClass,setAddingClass]=useState(false);
  const [addingSection,setAddingSection]=useState(false);

  async function load(){
    try {
      const [cr, sr]=await Promise.all([api.get('/classes'), api.get('/sections')]);
      const classesData = cr.data || [];
      const sectionsData = sr.data || [];
      setC(classesData);
      setS(sectionsData);
      if (classesData.length > 0 && !cid) {
        setCid(classesData[0].id);
      }
    } catch(err) {
      console.error('Failed to load classes and sections:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function addClass(e?: React.FormEvent){
    if (e) e.preventDefault();
    if (!n) {
      alert('Please select a class number to add.');
      return;
    }
    setAddingClass(true);
    try {
      const res = await api.post('/classes', { classNumber: Number(n) });
      const created = res.data;
      setC(prev => {
        const filtered = prev.filter(x => x.class_number !== created.class_number);
        return [...filtered, created].sort((a,b) => a.class_number - b.class_number);
      });
      setN('');
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not add class');
    } finally {
      setAddingClass(false);
    }
  }

  async function addSection(e?: React.FormEvent){
    if (e) e.preventDefault();
    const targetCid = cid || c[0]?.id;
    if (!targetCid) {
      alert('Please select a class first.');
      return;
    }
    if (!sn.trim()) {
      alert('Please enter a section name (e.g. C).');
      return;
    }
    setAddingSection(true);
    try {
      const res = await api.post('/sections', { classId: targetCid, name: sn.trim() });
      const created = res.data;
      setS(prev => [...prev, created].sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name)));
      setSn('');
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not add section');
    } finally {
      setAddingSection(false);
    }
  }

  return <Layout>
    <PageHead title="Classes & Sections" sub="Build Classes 1–12 and their sections."/>
    <div className="two-col">
      <div className="panel">
        <h3>Add class</h3>
        <form className="inline" onSubmit={addClass}>
          <select value={n} onChange={e=>setN(e.target.value)}>
            <option value="">Select Class</option>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(x=><option key={x} value={x}>Class {x}</option>)}
          </select>
          <button type="submit" disabled={addingClass}>{addingClass ? 'Adding...' : 'Add Class'}</button>
        </form>
        <div className="list">
          {c.map(x=><div className="list-row" key={x.id}>
            <b>Class {x.class_number}</b>
            <span>{x.section_count || 0} sections</span>
          </div>)}
        </div>
      </div>

      <div className="panel">
        <h3>Add section</h3>
        <form className="inline" onSubmit={addSection}>
          <select value={cid || (c[0]?.id || '')} onChange={e=>setCid(e.target.value)}>
            {c.map(x=><option key={x.id} value={x.id}>Class {x.class_number}</option>)}
          </select>
          <input placeholder="Section (e.g. C)" value={sn} onChange={e=>setSn(e.target.value)}/>
          <button type="submit" disabled={addingSection}>{addingSection ? 'Adding...' : 'Add Section'}</button>
        </form>
        <div className="list">
          {s.map(x=><div className="list-row" key={x.id}>
            <b>Class {x.class_number} — Section {x.name}</b>
          </div>)}
        </div>
      </div>
    </div>
  </Layout>
}

/* ────── Subjects ────── */
function Subjects(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [n,setN]=useState('');
  const [adding,setAdding]=useState(false);

  async function load(){
    try {
      const res = await api.get('/subjects');
      setRows(res.data || []);
    } catch(err) {
      console.error('Failed to load subjects:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function addSubject(e?: React.FormEvent){
    if (e) e.preventDefault();
    if (!n.trim()) {
      alert('Please enter a subject name (e.g. Economics).');
      return;
    }
    setAdding(true);
    try {
      const res = await api.post('/subjects', { name: n.trim() });
      const created = res.data;
      setRows(prev => [...prev, created]);
      setN('');
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not add subject');
    } finally {
      setAdding(false);
    }
  }

  return <Layout>
    <PageHead title="Subjects" sub="Subjects used by class routines."/>
    <div className="panel narrow">
      <form className="inline" onSubmit={addSubject}>
        <input placeholder="Subject name (e.g. Mathematics)" value={n} onChange={e=>setN(e.target.value)}/>
        <button type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add subject'}</button>
      </form>
      <div className="list">
        {rows.map(x=><div className="list-row" key={x.id}>
          <b>{x.name}</b>
        </div>)}
      </div>
    </div>
  </Layout>
}

/* ────── Routine ────── */
function Routine(){const {user}=useAuth();const [rows,setRows]=useState<any[]>([]);const [c,setC]=useState<any[]>([]);const [s,setS]=useState<any[]>([]);const [sub,setSub]=useState<any[]>([]);const [t,setT]=useState<any[]>([]);const [f,setF]=useState<any>({dayOfWeek:1});
  async function load(){const[a,b,d,e,g]=await Promise.all([api.get('/routines'),api.get('/classes'),api.get('/sections'),api.get('/subjects'),api.get('/teachers')]);setRows(a.data);setC(b.data);setS(d.data);setSub(e.data);setT(g.data)}useEffect(()=>{load()},[]);
  async function add(e:React.FormEvent){e.preventDefault();try{await api.post('/routines',f);setF({dayOfWeek:1});load()}catch(e:any){alert(e?.response?.data?.message||'Could not create routine')}}
  async function del(id:string){if(confirm('Delete this routine?')){await api.delete('/routines/'+id);load()}}
  return <Layout><PageHead title="Class Routine" sub="Create section-wise teacher and time-slot schedules."/><div className="panel"><form className="routine-form" onSubmit={add}><label>Day<select value={f.dayOfWeek} onChange={e=>setF({...f,dayOfWeek:Number(e.target.value)})}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label>Class<select required value={f.classId||''} onChange={e=>setF({...f,classId:e.target.value,sectionId:''})}><option value="">Select</option>{c.map(x=><option key={x.id} value={x.id}>Class {x.class_number}</option>)}</select></label><label>Section<select required value={f.sectionId||''} onChange={e=>setF({...f,sectionId:e.target.value})}><option value="">Select</option>{s.filter(x=>x.class_id===f.classId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Subject<select required value={f.subjectId||''} onChange={e=>setF({...f,subjectId:e.target.value})}><option value="">Select</option>{sub.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Teacher<select required value={f.teacherId||''} onChange={e=>setF({...f,teacherId:e.target.value})}><option value="">Select</option>{t.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Start<input required type="time" value={f.startTime||''} onChange={e=>setF({...f,startTime:e.target.value})}/></label><label>End<input required type="time" value={f.endTime||''} onChange={e=>setF({...f,endTime:e.target.value})}/></label><label>Room<input value={f.room||''} onChange={e=>setF({...f,room:e.target.value})}/></label><button>Create routine</button></form></div>
  <div className="table-wrap"><table><thead><tr><th>Day</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Time</th><th>Room</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{days[x.day_of_week]}</td><td>{x.class_number}-{x.section_name}</td><td>{x.subject_name}</td><td>{x.teacher_name}</td><td>{fmt(x.start_time)}–{fmt(x.end_time)}</td><td>{x.room||'—'}</td><td><button className="danger" onClick={()=>del(x.id)}>Delete</button></td></tr>)}</tbody></table></div></Layout>}

/* ────── Attendance ────── */
function Attendance(){const {user}=useAuth();const params=new URLSearchParams(useLocation().search);const [routine,setRoutine]=useState<any>();const [students,setStudents]=useState<any[]>([]);const [checked,setChecked]=useState<Record<string,boolean>>({});const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{api.get('/teacher/routine/today').then(x=>{const id=params.get('routine');const rr=id?x.data.find((a:any)=>a.id===id):x.data[0];if(rr){setRoutine(rr);api.get(`/teacher/students/${rr.class_id}/${rr.section_id}`).then(s=>setStudents(s.data))}}).catch(()=>{})},[]);
  const selectAll=(v:boolean)=>{const z:any={};students.forEach(s=>z[s.id]=v);setChecked(z)};const present=students.filter(s=>checked[s.id]).length;
  async function submit(){if(!routine)return;setBusy(true);try{const today=new Date().toISOString().slice(0,10);await api.post('/teacher/attendance',{classId:routine.class_id,sectionId:routine.section_id,subjectId:routine.subject_id,startTime:fmt(routine.start_time),endTime:fmt(routine.end_time),attendanceDate:today,presentStudentIds:students.filter(s=>checked[s.id]).map(s=>s.id)});setDone(true)}catch(e:any){alert(e?.response?.data?.message||'Attendance submission failed')}finally{setBusy(false)}}
  if(!routine)return <Layout><div className="panel"><h3>No class available</h3><p className="muted">No routine is assigned to you for today.</p></div></Layout>;
  return <Layout><PageHead title={`Class ${routine.class_number}-${routine.section_name}`} sub={`${routine.subject_name} · ${fmt(routine.start_time)}–${fmt(routine.end_time)} · Teacher: ${user?.name||''}`}/><div className="attendance-top"><div><b>Present:</b> {present} / {students.length}</div><button onClick={()=>selectAll(true)}>Select All</button><button className="secondary" onClick={()=>selectAll(false)}>Clear All</button></div><div className="instruction"><CheckCircle2 size={17}/> Instruction: select only students who are physically present. Unchecked students will be marked absent automatically.</div><div className="attendance-list">{students.map(s=><label className="student-row" key={s.id}><div><span className="roll">{s.roll_number}</span><b>{s.name}</b><small>{s.parent_name||'Parent details'}</small></div><input type="checkbox" checked={!!checked[s.id]} onChange={e=>setChecked({...checked,[s.id]:e.target.checked})}/></label>)}</div><div className="submit-bar"><span>{students.length-present} students will be marked absent.</span><button disabled={busy||done} onClick={submit}>{done?'✓ Attendance Submitted':busy?'Submitting…':'Submit Attendance'}</button></div></Layout>}

/* ────── History ────── */
function History(){const {user}=useAuth();const [rows,setRows]=useState<any[]>([]);useEffect(()=>{api.get('/teacher/attendance/history').then(x=>setRows(x.data)).catch(()=>{})},[]);
  return <Layout><PageHead title="Attendance History" sub="Previously submitted attendance sessions."/><div className="table-wrap"><table><thead><tr><th>Date</th><th>Class</th><th>Subject</th><th>Time</th><th>Present</th><th>Absent</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{new Date(x.attendance_date).toLocaleDateString()}</td><td>{x.class_number}-{x.section_name}</td><td>{x.subject_name||'—'}</td><td>{fmt(x.start_time)}–{fmt(x.end_time)}</td><td>{x.present}</td><td>{x.total-x.present}</td></tr>)}</tbody></table></div></Layout>}

/* ────── Notifications V11 & SMTP ────── */
function NotificationCenter(){
  const {user}=useAuth();
  const [channels,setChannels]=useState<any>(null);
  const [smtp,setSmtp]=useState<any>({
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
    username: '',
    password: '',
    senderEmail: 'attendance@school.local',
    senderName: 'School Attendance Office',
    isEnabled: true
  });
  const [showPass,setShowPass]=useState(false);
  const [logs,setLogs]=useState<any[]>([]);
  const [analytics,setAnalytics]=useState<any>(null);
  const [tab,setTab]=useState<'settings' | 'smtp' | 'templates' | 'analytics' | 'logs'>('settings');
  const [msg,setMsg]=useState('');
  const [templates,setTemplates]=useState<any[]>([]);
  const [testModal,setTestModal]=useState(false);
  const [testEmail,setTestEmail]=useState(user?.email || 'admin@demo-school.local');
  const [testing,setTesting]=useState(false);
  const [testResult,setTestResult]=useState<any>(null);

  async function load(){
    try {
      const [a,b,c,d,e]=await Promise.all([
        api.get('/notifications-v11/channels'),
        api.get('/notifications-v11/logs'),
        api.get('/notifications-v11/analytics'),
        api.get('/notifications-v11/templates'),
        api.get('/notifications-v11/smtp')
      ]);
      setChannels(a.data);
      setLogs(b.data);
      setAnalytics(c.data);
      setTemplates(d.data);
      if (e.data) setSmtp(e.data);
    } catch {}
  }

  useEffect(()=>{load()},[]);

  async function saveChannels(){
    await api.put('/notifications-v11/channels',{
      smsEnabled:channels.sms_enabled,
      whatsappEnabled:channels.whatsapp_enabled,
      emailEnabled:channels.email_enabled,
      whatsappProvider:channels.whatsapp_provider,
      whatsappApiUrl:channels.whatsapp_api_url||'',
      whatsappApiKey:channels.whatsapp_api_key||''
    });
    setMsg('Channel delivery settings saved.');
  }

  async function saveSmtp(){
    try {
      await api.put('/notifications-v11/smtp', smtp);
      setMsg('SMTP Email server configuration saved successfully!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save SMTP settings');
    }
  }

  async function runTestEmail(e: React.FormEvent){
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/notifications-v11/smtp/test', {
        recipientEmail: testEmail,
        ...smtp
      });
      setTestResult({ success: true, message: res.data.message || 'Test email successfully dispatched!' });
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.message || 'SMTP Connection Test Failed' });
    } finally {
      setTesting(false);
    }
  }

  async function process(){
    const x=await api.post('/notifications-v11/process');
    setMsg(`Queue processed: ${x.data.sent} sent, ${x.data.failed} failed.`);
    load();
  }

  const set=(k:string,v:any)=>setChannels({...channels,[k]:v});

  return <Layout>
    <PageHead title="Notification Center" sub="Manage SMS, WhatsApp, and SMTP Email alerts for student absences."/>
    
    <div className="tabs">
      <button className={tab==='settings'?'tab-active':''} onClick={()=>setTab('settings')}>Channels</button>
      <button className={tab==='smtp'?'tab-active':''} onClick={()=>setTab('smtp')}>📧 SMTP Email Settings</button>
      <button className={tab==='templates'?'tab-active':''} onClick={()=>setTab('templates')}>Templates</button>
      <button className={tab==='analytics'?'tab-active':''} onClick={()=>setTab('analytics')}>Analytics</button>
      <button className={tab==='logs'?'tab-active':''} onClick={()=>setTab('logs')}>Delivery logs</button>
    </div>

    {msg && <div className="success" style={{ marginBottom: 16 }}>{msg}</div>}

    {/* TAB 1: GENERAL CHANNELS */}
    {tab==='settings'&&channels&&(
      <div className="panel">
        <h3>Notification Channels</h3>
        <p className="muted">Configure active dispatch channels for absent notifications.</p>
        <label className="checkline">
          <input type="checkbox" checked={channels.sms_enabled} onChange={e=>set('sms_enabled',e.target.checked)}/> SMS Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.whatsapp_enabled} onChange={e=>set('whatsapp_enabled',e.target.checked)}/> WhatsApp Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.email_enabled} onChange={e=>set('email_enabled',e.target.checked)}/> Email Alerts Enabled (Automatic Absent Notifications)
        </label>

        {channels.whatsapp_enabled&&(
          <div style={{ marginTop: 14, padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
            <label>WhatsApp Provider
              <select value={channels.whatsapp_provider||'MOCK'} onChange={e=>set('whatsapp_provider',e.target.value)}>
                <option value="MOCK">MOCK (Local Sandbox)</option>
                <option value="HTTP">HTTP API Gateway</option>
              </select>
            </label>
            <label>WhatsApp API URL
              <input value={channels.whatsapp_api_url||''} onChange={e=>set('whatsapp_api_url',e.target.value)}/>
            </label>
            <label>WhatsApp API Key
              <input type="password" value={channels.whatsapp_api_key||''} onChange={e=>set('whatsapp_api_key',e.target.value)}/>
            </label>
          </div>
        )}

        <div className="action-row" style={{ marginTop: 18 }}>
          <button onClick={saveChannels}>Save Channel Settings</button>
          <button className="small-btn" onClick={process}>Process Queue Now</button>
        </div>
      </div>
    )}

    {/* TAB 2: SMTP EMAIL SERVER CONFIGURATION */}
    {tab==='smtp'&&(
      <div className="smtp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={22} style={{ color: 'var(--primary-600)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>SMTP Email Server Configuration</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                Configure your custom outgoing SMTP mail server for automatic student absence email notifications.
              </p>
            </div>
          </div>
          <span className={`smtp-header-badge ${smtp.isEnabled ? 'active' : ''}`}>
            <Mail size={13} /> {smtp.isEnabled ? 'Automated Absence Alerts Active' : 'SMTP Disabled'}
          </span>
        </div>

        <form onSubmit={e => { e.preventDefault(); saveSmtp(); }}>
          <div className="smtp-grid">
            <div>
              <label>SMTP Host Server
                <input 
                  required 
                  placeholder="e.g. smtp.gmail.com, smtp.office365.com"
                  value={smtp.host || ''} 
                  onChange={e => setSmtp({ ...smtp, host: e.target.value })}
                />
              </label>
            </div>
            <div>
              <label>SMTP Port
                <input 
                  required 
                  type="number" 
                  placeholder="587 or 465"
                  value={smtp.port || 587} 
                  onChange={e => setSmtp({ ...smtp, port: Number(e.target.value) })}
                />
              </label>
            </div>
            <div>
              <label>Encryption Protocol
                <select 
                  value={smtp.encryption || 'STARTTLS'} 
                  onChange={e => setSmtp({ ...smtp, encryption: e.target.value })}
                >
                  <option value="STARTTLS">STARTTLS (Port 587 / 25)</option>
                  <option value="SSL/TLS">SSL / TLS (Port 465)</option>
                  <option value="NONE">None / Plaintext</option>
                </select>
              </label>
            </div>
            <div>
              <label>SMTP Username / Login Email
                <input 
                  placeholder="e.g. your-email@gmail.com"
                  value={smtp.username || ''} 
                  onChange={e => setSmtp({ ...smtp, username: e.target.value })}
                />
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <label>SMTP Password / App Password
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input 
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={smtp.password || ''} 
                    onChange={e => setSmtp({ ...smtp, password: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary"
                    style={{ padding: '7px 10px' }}
                    onClick={() => setShowPass(!showPass)}
                    title={showPass ? 'Hide Password' : 'Show Password'}
                  >
                    <Eye size={15} />
                  </button>
                </div>
              </label>
            </div>
            <div>
              <label>Sender Email Address
                <input 
                  required 
                  type="email" 
                  placeholder="attendance@demo-school.local"
                  value={smtp.senderEmail || ''} 
                  onChange={e => setSmtp({ ...smtp, senderEmail: e.target.value })}
                />
              </label>
            </div>
            <div className="full-width">
              <label>Sender Display Name
                <input 
                  placeholder="e.g. Demo Higher Secondary School Attendance Office"
                  value={smtp.senderName || ''} 
                  onChange={e => setSmtp({ ...smtp, senderName: e.target.value })}
                />
              </label>
            </div>
            <div className="full-width">
              <label className="checkline" style={{ marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  checked={smtp.isEnabled !== false} 
                  onChange={e => setSmtp({ ...smtp, isEnabled: e.target.checked })}
                />
                <b>Enable Automatic Absence Notification Emails via SMTP</b>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button type="submit">
              Save SMTP Configuration
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => { setTestResult(null); setTestModal(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={15} /> Test SMTP Connection & Send Email
            </button>
          </div>
        </form>
      </div>
    )}

    {/* TAB 3: TEMPLATES */}
    {tab==='templates'&&(
      <div className="panel">
        <h3>Absent Alert Templates</h3>
        {['SMS','WHATSAPP','EMAIL'].map(ch=>{
          const t=templates.find(x=>x.channel===ch);
          return (
            <div className="template-box" key={ch}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b>{ch} Template</b>
                <span className="badge active">ACTIVE</span>
              </div>
              <textarea 
                defaultValue={t?.body||`Attendance Alert: {student_name} was absent from Class {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.`} 
                onBlur={async e=>{await api.put('/notifications-v11/templates/'+ch,{body:e.target.value}); load();}}
              />
              <small className="muted">Variables: {'{student_name}'} {'{class_name}'} {'{section}'} {'{time}'} {'{teacher_name}'} {'{enquiry_number}'}</small>
            </div>
          );
        })}
      </div>
    )}

    {/* TAB 4: ANALYTICS */}
    {tab==='analytics'&&<>
      <div className="stats">
        <Stat label="Total Alerts" value={analytics?.totals?.total??0}/>
        <Stat label="Delivered" value={analytics?.totals?.sent??0}/>
        <Stat label="Queued" value={analytics?.totals?.queued??0}/>
        <Stat label="Failed" value={analytics?.totals?.failed??0}/>
      </div>
      <div className="panel">
        <h3>Dispatch Metrics by Channel</h3>
        <div className="list">
          {analytics?.byChannel?.map((x:any,i:number)=>(
            <div className="list-row" key={i}>
              <b>{x.channel}</b>
              <span>{x.status} · {x.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>}

    {/* TAB 5: LOGS */}
    {tab==='logs'&&(
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Channel</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(x=>(
              <tr key={x.id}>
                <td>{x.student_name||'—'}</td>
                <td><span className="badge">{x.channel}</span></td>
                <td><code>{x.recipient}</code></td>
                <td><span className={`badge ${x.status==='SENT'?'active':'processing'}`}>{x.status}</span></td>
                <td>{x.attempts}</td>
                <td>{x.created_at?.slice(0,19).replace('T',' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* SMTP TEST EMAIL MODAL */}
    {testModal && (
      <Modal title="Test SMTP Connection" close={() => setTestModal(false)}>
        <form className="modal-form" onSubmit={runTestEmail}>
          <p className="muted" style={{ margin: '0 0 14px 0', fontSize: 13 }}>
            Send a live verification test email to confirm that your SMTP server host (<code>{smtp.host}:{smtp.port}</code>) and authentication credentials are correct.
          </p>
          <label>Recipient Test Email Address
            <input 
              required 
              type="email" 
              placeholder="e.g. admin@school.com or your personal email"
              value={testEmail} 
              onChange={e => setTestEmail(e.target.value)}
            />
          </label>

          {testResult && (
            <div className={testResult.success ? 'success' : 'error'} style={{ marginTop: 12 }}>
              {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn-secondary" onClick={() => setTestModal(false)}>
              Close
            </button>
            <button type="submit" disabled={testing}>
              {testing ? 'Connecting & Sending...' : 'Send Test Verification Email'}
            </button>
          </div>
        </form>
      </Modal>
    )}
  </Layout>
}

/* ────── Notifications (Legacy SMS) ────── */
function Notifications(){const {user}=useAuth();const [settings,setSettings]=useState<any>({sms_enabled:true,provider:'mock',sender_id:'',template:'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.'});const [logs,setLogs]=useState<any[]>([]);const [busy,setBusy]=useState(false);
  async function load(){const[a,b]=await Promise.all([api.get('/notifications/settings'),api.get('/notifications/logs')]);setSettings(a.data);setLogs(b.data)}useEffect(()=>{load()},[]);
  async function save(){setBusy(true);try{await api.put('/notifications/settings',{smsEnabled:settings.sms_enabled,provider:settings.provider,senderId:settings.sender_id,template:settings.template});alert('Notification settings saved')}catch(e:any){alert(e?.response?.data?.message||'Save failed')}finally{setBusy(false)}}
  async function process(){setBusy(true);try{const r=await api.post('/notifications/process');alert(`Processed ${r.data.processed}: ${r.data.sent} sent, ${r.data.failed} failed`);load()}catch(e:any){alert('Queue processing failed')}finally{setBusy(false)}}
  return <Layout><PageHead title="Parent SMS" sub="Automatic absent notifications, templates and delivery logs."/><div className="two-col"><div className="panel"><h3>SMS settings</h3><label className="toggle"><input type="checkbox" checked={settings.sms_enabled!==false} onChange={e=>setSettings({...settings,sms_enabled:e.target.checked})}/> Enable parent SMS</label><label>Provider<select value={settings.provider||'mock'} onChange={e=>setSettings({...settings,provider:e.target.value})}><option value="mock">Mock / Local testing</option><option value="http">HTTP SMS provider</option></select></label><label>Sender ID<input value={settings.sender_id||''} onChange={e=>setSettings({...settings,sender_id:e.target.value})}/></label><label>Message template<textarea value={settings.template||''} onChange={e=>setSettings({...settings,template:e.target.value})}/></label><p className="muted small">Variables: {'{student_name}'}, {'{class_name}'}, {'{section}'}, {'{time}'}, {'{teacher_name}'}, {'{enquiry_number}'}</p><div className="inline"><button disabled={busy} onClick={save}>Save settings</button><button className="secondary" disabled={busy} onClick={process}>Process queue</button></div></div><div className="panel"><h3>How it works</h3><div className="flow"><b>1. Teacher submits</b><span>Unchecked students become ABSENT.</span><b>2. System queues SMS</b><span>Parent number and class details are inserted into the template.</span><b>3. Provider sends</b><span>Mock mode works locally; HTTP mode connects to your SMS gateway.</span><b>4. Delivery is logged</b><span>Queued, processing, sent or failed status is stored.</span></div></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Parent SMS</th><th>Status</th><th>Attempts</th><th>Message</th><th>Created</th></tr></thead><tbody>{logs.map(x=><tr key={x.id}><td>{x.student_name||'—'}</td><td>{x.parent_number}</td><td><span className={'badge '+String(x.status).toLowerCase()}>{x.status}</span></td><td>{x.attempts}</td><td>{x.message}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></Layout>}

/* ────── Subscription (School) ────── */
function SubscriptionPage(){
 const {user}=useAuth();const [s,setS]=useState<any>(null);const [payments,setPayments]=useState<any[]>([]);const [busy,setBusy]=useState(false);const [subDays,setSubDays]=useState(30);const [msg,setMsg]=useState('');
 async function load(){const[a,b]=await Promise.all([api.get('/school-payment/subscription'),api.get('/school-payment/payments')]);setS(a.data);setPayments(b.data)}
 useEffect(()=>{load()},[]);
 async function renew(){
   setBusy(true);setMsg('');
   try{
     const order=(await api.post('/school-payment/renew/order',{days:subDays,gateway:'MOCK'})).data;
     await api.post('/school-payment/renew/mock-complete',{orderId:order.orderId,days:subDays});
     setMsg('Payment successful. Subscription renewed.');
     await load();
   }catch(e:any){setMsg(e?.response?.data?.message||'Payment failed')}
   finally{setBusy(false)}
 }
 return <Layout><PageHead title="Subscription & Billing" sub="View your plan, validity, payments and renew your school subscription."/>
 <div className="stats"><Stat label="Plan" value={s?.plan_name||'—'}/><Stat label="Students" value={s?.student_count??'—'}/><Stat label="Days remaining" value={s?.days_remaining??'—'}/><Stat label="Status" value={s?.computed_status||'—'}/></div>
 <div className="two-col"><div className="panel"><h3>Current subscription</h3>
   <div className="list"><div className="list-row"><b>Start</b><span>{s?.start_date?.slice(0,10)||'—'}</span></div><div className="list-row"><b>End</b><span>{s?.end_date?.slice(0,10)||'—'}</span></div><div className="list-row"><b>Student limit</b><span>{s?.max_students??'—'}</span></div><div className="list-row"><b>Monthly plan</b><span>₹{Number(s?.price_monthly||0).toLocaleString('en-IN')}</span></div></div>
 </div><div className="panel"><h3>Renew online</h3><label>Renewal period<select value={subDays} onChange={e=>setSubDays(Number(e.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select></label><p className="muted">Use mock mode for local testing. If Razorpay is configured on the server, the production checkout endpoint is available.</p><button disabled={busy} onClick={renew}>{busy?'Processing…':`Pay & renew ${subDays} days (Test)`}</button>{msg&&<div className="success">{msg}</div>}</div></div>
 <div className="panel"><h3>Payment history</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Provider</th><th>Amount</th><th>Status</th><th>Invoice</th><th>Receipt</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.created_at?.slice(0,19).replace('T',' ')}</td><td>{p.provider}</td><td>₹{Number(p.amount||0).toLocaleString('en-IN')}</td><td><span className="badge">{p.status}</span></td><td>{p.invoice_number||'—'}</td><td>{p.receipt_number||'—'} {p.invoice_id&&<button className="small-btn" onClick={()=>window.open(`${API_BASE_URL}/super-admin/invoices/${p.invoice_id}/receipt`,'_blank')}>Receipt</button>}</td></tr>)}</tbody></table></div></div>
 </Layout>
}

/* ────── Invoices (Super Admin) ────── */
function Invoices(){
 const {user}=useAuth();const [rows,setRows]=useState<any[]>([]);
 useEffect(()=>{api.get('/super-admin/invoices').then(x=>setRows(x.data)).catch(()=>{})},[]);
 return <Layout><PageHead title="Invoices & Receipts" sub="Generated subscription invoices and payment receipts."/>
 <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>School</th><th>Receipt</th><th>Amount</th><th>Status</th><th>Paid</th><th>Receipt</th></tr></thead>
 <tbody>{rows.map(x=><tr key={x.id}><td><b>{x.invoice_number}</b></td><td>{x.school_name}</td><td>{x.receipt_number||'—'}</td><td>₹{Number(x.amount||0).toLocaleString('en-IN')}</td><td><span className="badge">{x.status}</span></td><td>{x.paid_at?.slice(0,19).replace('T',' ')||'—'}</td><td><button className="small-btn" onClick={()=>window.open(`${API_BASE_URL}/super-admin/invoices/${x.id}/receipt`,'_blank')}>Open</button></td></tr>)}</tbody></table></div>
 </Layout>
}

/* ────── Super Admin Monitor ────── */
function SuperMonitor(){
 const {user}=useAuth();const [d,setD]=useState<any>(null);const [busy,setBusy]=useState(false);
 async function load(){setD((await api.get('/super-admin/monitor')).data)}
 useEffect(()=>{load()},[]);
 const m=d?.metrics||{};
 const attendance=(Number(m.today_present||0)+Number(m.today_absent||0));
 return <Layout><PageHead title="SaaS Monitoring" sub="Live operational view of schools, subscriptions and today's attendance."/>
 <div className="stats">
   <Stat label="Schools" value={m.total_schools??'—'}/><Stat label="Active" value={m.active_schools??'—'}/>
   <Stat label="Expired" value={m.expired_schools??'—'}/><Stat label="Students" value={m.total_students??'—'}/>
   <Stat label="Today's sessions" value={m.today_sessions??'—'}/><Stat label="Revenue" value={`₹${Number(m.total_revenue||0).toLocaleString('en-IN')}`}/>
 </div>
 <div className="two-col">
  <div className="panel"><h3>Today's attendance</h3>
   <div className="list"><div className="list-row"><b>Present</b><span>{m.today_present??0}</span></div><div className="list-row"><b>Absent</b><span>{m.today_absent??0}</span></div><div className="list-row"><b>Recorded</b><span>{attendance}</span></div></div>
  </div>
  <div className="panel"><h3>Expiring within 7 days</h3>
   {d?.expiringSoon?.length?<div className="list">{d.expiringSoon.map((x:any)=><div className="list-row" key={x.id}><b>{x.name}</b><span>{x.plan_name} · {x.end_date?.slice(0,10)}</span></div>)}</div>:<p className="muted">No schools expiring in the next 7 days.</p>}
  </div>
 </div>
 <div className="panel"><div className="panel-head"><h3>Subscription operations</h3><button className="small-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await api.post('/super-admin/subscriptions/expire-now');await load()}finally{setBusy(false)}}}>{busy?'Refreshing…':'Refresh expiry status'}</button></div>
 <p className="muted">Run this after a deployment or schedule the backend subscription worker to keep expired schools synchronized automatically.</p></div>
 </Layout>
}

/* ────── Payments (Super Admin) ────── */
function Payments(){
 const {user}=useAuth();const [rows,setRows]=useState<any[]>([]);
 useEffect(()=>{api.get('/super-admin/payments').then(x=>setRows(x.data)).catch(()=>{})},[]);
 return <Layout><PageHead title="Payments" sub="Subscription payment records across all schools."/>
 <div className="table-wrap"><table><thead><tr><th>School</th><th>Plan</th><th>Amount</th><th>Provider</th><th>Status</th><th>Created</th></tr></thead>
 <tbody>{rows.map(x=><tr key={x.id}><td><b>{x.school_name}</b></td><td>{x.plan_name||'—'}</td><td>₹{Number(x.amount||0).toLocaleString('en-IN')}</td><td>{x.provider}</td><td><span className="badge">{x.status}</span></td><td>{x.created_at?.slice(0,19).replace('T',' ')}</td></tr>)}</tbody></table></div>
 </Layout>
}

/* ────── Super Admin Home ────── */
const DEFAULT_PLANS = [
  { id: 'e7377e37-9267-487b-817e-606370af60d9', name: 'Basic', max_students: 300, price_monthly: 499 },
  { id: '59b51bb8-25c3-4417-8663-13836440f77d', name: 'Standard', max_students: 1000, price_monthly: 999 },
  { id: '97279b50-bc33-4e64-a69a-9bc837ce9361', name: 'Enterprise', max_students: 5000, price_monthly: 1999 }
];

function SuperAdminHome(){
 const {user}=useAuth();
 const [data,setData]=useState<any>(null);
 const [schools,setSchools]=useState<any[]>([]);
 const [plans,setPlans]=useState<any[]>(DEFAULT_PLANS);
 const [timeframe,setTimeframe]=useState('All Time');
 const [open,setOpen]=useState(false);
 const [renew,setRenew]=useState<any>(null);
 const [msg,setMsg]=useState('');
 const [f,setF]=useState<any>({startDate:new Date().toISOString().slice(0,10), planId: DEFAULT_PLANS[0].id});

 async function load(){
   try {
     const [a,b,c] = await Promise.all([
       api.get('/super-admin/overview').catch(() => ({ data: null })),
       api.get('/super-admin/schools').catch(() => ({ data: [] })),
       api.get('/super-admin/plans').catch(() => ({ data: [] }))
     ]);
     if (a?.data) setData(a.data);
     if (Array.isArray(b?.data)) setSchools(b.data);
     const loadedPlans = Array.isArray(c?.data) && c.data.length > 0 ? c.data : DEFAULT_PLANS;
     setPlans(loadedPlans);
     setF((prev: any) => ({ ...prev, planId: prev.planId || loadedPlans[0]?.id }));
   } catch (err) {
     console.error('SuperAdmin load error:', err);
   }
 }
 useEffect(()=>{load()},[]);

 async function createSchool(e:React.FormEvent){
   e.preventDefault();setMsg('');
   try{
     await api.post('/super-admin/schools',f);
     setOpen(false);
     setF({startDate:new Date().toISOString().slice(0,10), planId: plans[0]?.id || DEFAULT_PLANS[0].id});
     load();
   } catch(e:any){
     setMsg(e?.response?.data?.message||'Could not create school');
   }
 }

 async function toggle(id:string,status:string){
   try{await api.put('/super-admin/schools/'+id+'/status',{status});load()}
   catch(e:any){alert(e?.response?.data?.message||'Could not update status')}
 }

 async function doRenew(e:React.FormEvent){
   e.preventDefault();
   try{await api.post('/super-admin/schools/'+renew.id+'/renew',renew.form);setRenew(null);load()}
   catch(e:any){alert(e?.response?.data?.message||'Could not renew')}
 }

 const money=(n:any)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

 return <Layout>
   <PageHead title="Company Super Admin" sub="Manage schools, subscriptions, payments and SaaS usage." button="Create school" onClick={()=>{
     setF((prev: any) => ({ ...prev, planId: prev.planId || plans[0]?.id || DEFAULT_PLANS[0].id }));
     setOpen(true);
   }}/>
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
     <div className="date-filter-group">
       {['Today', 'Weekly', 'Monthly', 'All Time'].map(tab => (
         <button key={tab} className={`date-filter-btn ${timeframe === tab ? 'active' : ''}`} onClick={()=>setTimeframe(tab)}>{tab}</button>
       ))}
     </div>
     <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
       Multi-Tenant Cloud SIS · Auto-sync active
     </div>
   </div>
   <div className="stats">
     <Stat label="Total schools" value={data?.totalSchools ?? data?.total_schools ?? '—'} trend="+100%" sub="platform growth"/>
     <Stat label="Active" value={data?.activeSchools ?? data?.active_schools ?? '—'} trend="Healthy" sub="100% operational"/>
     <Stat label="Expired" value={data?.expiredSchools ?? data?.expired_schools ?? '—'} trend="0% expired" sub="grace period"/>
     <Stat label="Students" value={data?.totalStudents ?? data?.total_students ?? '—'} trend="+14" sub="active enrolled"/>
     <Stat label="Revenue" value={money(data?.totalRevenue ?? data?.total_revenue)} trend="+24%" sub="gross run-rate"/>
     <Stat label="Pending payments" value={data?.pendingPayments ?? data?.pending_payments ?? '—'} trend="0 due" sub="all cleared"/>
   </div>
   <div className="two-col">
     <div className="panel"><h3>Subscription health</h3>
       <div className="list">
         <div className="list-row"><b>Active ratio</b><span>{data?.activeRatio??0}%</span></div>
         <div className="list-row"><b>Expired ratio</b><span>{data?.expiredRatio??0}%</span></div>
         <div className="list-row"><b>Suspended</b><span>{data?.suspendedSchools ?? data?.suspended_schools ?? 0}</span></div>
       </div>
     </div>
     <div className="panel"><h3>Plans</h3>
       <div className="list">{plans.map(p=><div className="list-row" key={p.id}><b>{p.name}</b><span>{money(p.price_monthly)}/month · {p.max_students} students</span></div>)}</div>
     </div>
   </div>
   <div className="panel"><div className="panel-head"><h3>Schools</h3><span className="muted">{schools.length} records</span></div>
    <div className="table-wrap"><table><thead><tr><th>School</th><th>Admin</th><th>Students</th><th>Plan</th><th>Validity</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{schools.map(s=><tr key={s.id}><td><b>{s.name}</b><small className="table-sub">{s.code}</small></td><td>{s.admin_email||'—'}</td><td>{s.student_count}</td><td>{s.plan_name||'—'}</td><td>{s.start_date?.slice(0,10)||'—'} → {s.end_date?.slice(0,10)||'—'}</td><td><span className="badge">{s.computed_status}</span></td>
    <td><div className="action-row"><button className="small-btn" onClick={()=>setRenew({id:s.id,form:{days:30,amount:s.plan_price_monthly||0}})}>Renew</button>{s.status==='SUSPENDED'?<button className="small-btn" onClick={()=>toggle(s.id,'ACTIVE')}>Activate</button>:<button className="small-btn danger-btn" onClick={()=>toggle(s.id,'SUSPENDED')}>Suspend</button>}</div></td></tr>)}</tbody></table></div>
   </div>
   {open&&<Modal title="Create school" close={()=>setOpen(false)}><form className="modal-form" onSubmit={createSchool}>
     <label>School name<input required value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label>
     <label>School code<input required value={f.code||''} onChange={e=>setF({...f,code:e.target.value.toUpperCase()})}/></label>
     <label>Enquiry number<input required value={f.enquiryNumber||''} onChange={e=>setF({...f,enquiryNumber:e.target.value})}/></label>
     <label>Admin name<input required value={f.adminName||''} onChange={e=>setF({...f,adminName:e.target.value})}/></label>
     <label>Admin email<input required type="email" value={f.adminEmail||''} onChange={e=>setF({...f,adminEmail:e.target.value})}/></label>
     <label>Admin password<input required type="password" value={f.adminPassword||''} onChange={e=>setF({...f,adminPassword:e.target.value})}/></label>
     <label>Subscription plan
       <select required value={f.planId||plans[0]?.id||''} onChange={e=>setF({...f,planId:e.target.value})}>
         <option value="">Select plan</option>
         {plans.map(p=><option key={p.id} value={p.id}>{p.name} · ₹{Number(p.price_monthly).toLocaleString('en-IN')}/month</option>)}
       </select>
     </label>
     <label>Start date<input required type="date" value={f.startDate||''} onChange={e=>setF({...f,startDate:e.target.value})}/></label>
     <label>Validity (days)<input required type="number" min="1" value={f.days||30} onChange={e=>setF({...f,days:Number(e.target.value)})}/></label>
     {msg&&<div className="error">{msg}</div>}<button>Create school</button>
   </form></Modal>}
   {renew&&<Modal title="Renew subscription" close={()=>setRenew(null)}><form className="modal-form" onSubmit={doRenew}>
     <label>Renewal days<input type="number" min="1" value={renew.form.days} onChange={e=>setRenew({...renew,form:{...renew.form,days:Number(e.target.value)}})}/></label>
     <label>Payment amount<input type="number" min="0" step="0.01" value={renew.form.amount} onChange={e=>setRenew({...renew,form:{...renew.form,amount:Number(e.target.value)}})}/></label>
     <p className="muted">V05 uses a mock payment flow for testing. A real gateway can be connected in the next version.</p>
     <button>Renew & record payment</button>
   </form></Modal>}
 </Layout>
}

/* ────── Routes ────── */
function App(){return <Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/dashboard" element={<Guard><Dashboard/></Guard>}/>
  <Route path="/students" element={<Guard><Students/></Guard>}/>
  <Route path="/teachers" element={<Guard><Teachers/></Guard>}/>
  <Route path="/classes" element={<Guard><Classes/></Guard>}/>
  <Route path="/subjects" element={<Guard><Subjects/></Guard>}/>
  <Route path="/routine" element={<Guard><Routine/></Guard>}/>
  <Route path="/notifications" element={<RoleGuard roles={['SCHOOL_ADMIN']}><NotificationCenter/></RoleGuard>}/>
  <Route path="/take-attendance" element={<Guard><Attendance/></Guard>}/>
  <Route path="/teacher-history" element={<Guard><History/></Guard>}/>
  <Route path="/attendance-reports" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN','TEACHER']}><Layout><AttendanceReports/></Layout></RoleGuard>}/>
  <Route path="/attendance-corrections" element={<RoleGuard roles={['SCHOOL_ADMIN','TEACHER']}><Layout><AttendanceCorrections/></Layout></RoleGuard>}/>
  <Route path="/people" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><PeopleManagement/></Layout></RoleGuard>}/>
  <Route path="/academic-years" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><AcademicYears/></Layout></RoleGuard>}/>
  <Route path="/promotion" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><StudentPromotion/></Layout></RoleGuard>}/>
  <Route path="/parent-portal" element={<RoleGuard roles={['PARENT']}><Layout><ParentPortal/></Layout></RoleGuard>}/>
  <Route path="/permissions" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Permissions/></Layout></RoleGuard>}/>
  <Route path="/subscription-enforcement" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><SubscriptionEnforcement/></Layout></RoleGuard>}/>
  <Route path="/security" element={<RoleGuard roles={['SUPER_ADMIN']}><Layout><Security/></Layout></RoleGuard>}/>
  <Route path="/backups" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Backup/></Layout></RoleGuard>}/>
  <Route path="/timetable" element={<RoleGuard roles={['SCHOOL_ADMIN','TEACHER']}><Layout><Timetable/></Layout></RoleGuard>}/>
  <Route path="/offline-attendance" element={<RoleGuard roles={['TEACHER']}><Layout><OfflineAttendance/></Layout></RoleGuard>}/>
  <Route path="/analytics" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Analytics/></Layout></RoleGuard>}/>
  <Route path="/communication" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><Communication/></Layout></RoleGuard>}/>
  <Route path="/parent-communication" element={<RoleGuard roles={['PARENT']}><Layout><ParentCommunication/></Layout></RoleGuard>}/>
  <Route path="/super-admin" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminHome/></RoleGuard>}/>
  <Route path="/payments" element={<RoleGuard roles={['SUPER_ADMIN']}><Payments/></RoleGuard>}/>
  <Route path="/invoices" element={<RoleGuard roles={['SUPER_ADMIN']}><Invoices/></RoleGuard>}/>
  <Route path="/monitor" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperMonitor/></RoleGuard>}/>
  <Route path="/subscription" element={<RoleGuard roles={['SCHOOL_ADMIN']}><SubscriptionPage/></RoleGuard>}/>
  <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
</Routes>}

export default App;
