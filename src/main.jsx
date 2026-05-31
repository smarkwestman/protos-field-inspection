import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Download, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './style.css';

const ORANGE = '#FF6600';
const ratingOptions = ['N/A', '1', '2', '3', '4', '5'];

const sections = [
  { key: 'appearance', title: 'Appearance', items: ['Uniform Compliance & Cleanliness', 'Personal Grooming & Hygiene', 'Professional Presence', 'Valid Guard Card', 'Equipment and Readiness'] },
  { key: 'postOrders', title: 'Post Order Compliance / Comprehension', items: ['Post Orders on Site', 'Knows Post Responsibilities', 'Emergency Procedures', 'Post Order Execution'] },
  { key: 'jobPerformance', title: 'Job Performance', items: ['Situational Awareness', 'Proactive', 'Customer Service', 'Client Staff Engagement'], notes: true },
  { key: 'technology', title: 'Protos Technology', items: ['App Downloaded', 'Compliance with App Usage', 'Incident Reporting', 'DAR', 'Guard Tour Completion'] },
  { key: 'clientVoice', title: 'Voice of the Client', items: ['Punctuality & Check In', 'Professionalism and Demeanor', 'Customer Service / Engagement', 'Response to Incidents', 'Communication Skills', 'Overall Client Satisfaction'] },
];

function average(values) {
  const nums = Object.values(values || {}).map(Number).filter(v => Number.isFinite(v) && v > 0);
  return nums.length ? nums.reduce((a,b) => a + b, 0) / nums.length : null;
}

function Field({ label, value, onChange, required }) {
  return <label className="field"><span>{label}{required ? ' *' : ''}</span><input value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function ScoreBadge({ label, value }) {
  return <div className="score-badge"><small>{label}</small><strong>{value == null ? '—' : value.toFixed(2)}</strong></div>;
}

function RatingRow({ label, value, onChange }) {
  return <div className="rating-row"><span>{label}</span><select value={value || ''} onChange={e => onChange(e.target.value)}><option value="">Select</option>{ratingOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>;
}

function PhotoInput({ label, files, setFiles, multiple }) {
  const ref = useRef(null);
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  return <div className="photo-box"><div className="photo-top"><div><b>{label}</b><p>Camera/photo upload</p></div><button type="button" onClick={() => ref.current?.click()}><Camera size={18}/> Add</button></div><input ref={ref} type="file" accept="image/*" capture="environment" multiple={multiple} hidden onChange={e => { const selected = Array.from(e.target.files || []); setFiles(multiple ? [...files, ...selected] : selected.slice(0,1)); }} />{previews.length > 0 && <div className="photo-grid">{previews.map((p,i) => <div className="photo-preview" key={i}><img src={p.url}/><button type="button" onClick={() => setFiles(files.filter((_,idx) => idx !== i))}><Trash2 size={14}/></button></div>)}</div>}</div>;
}

function SignaturePad({ value, onChange }) {
  return <div className="signature-box"><p>The information contained in this report is accurate and true to the best of my knowledge.</p><label className="field"><span>Signature / Signer Name *</span><input value={value} onChange={e => onChange(e.target.value)} placeholder="Prototype: type signer name. Later: touchscreen signature pad." /></label></div>;
}

function App() {
  const reportRef = useRef(null);
  const [visit, setVisit] = useState({ client:'', vendor:'', siteName:'', address:'', visitDateTime:new Date().toLocaleString(), fom:'', ssa:'', status:'Complete' });
  const [ratings, setRatings] = useState({});
  const [jobNotes, setJobNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [ssaNotified, setSsaNotified] = useState(false);
  const [caseFiled, setCaseFiled] = useState(false);
  const [signature, setSignature] = useState('');
  const [officerPhoto, setOfficerPhoto] = useState([]);
  const [fieldPhotos, setFieldPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  const scores = useMemo(() => Object.fromEntries(sections.map(s => [s.key, average(ratings[s.key])])), [ratings]);
  const overall = useMemo(() => { const vals = Object.values(scores).filter(v => v != null); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null; }, [scores]);
  const valid = visit.client.trim() && visit.vendor.trim() && visit.siteName.trim() && signature.trim();

  const updateVisit = (key, val) => setVisit(v => ({...v, [key]: val}));
  const updateRating = (section, item, val) => setRatings(r => ({...r, [section]: {...(r[section] || {}), [item]: val}}));

  async function generatePdf(email=false) {
    if (!valid || busy) return;
    setBusy(true);
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#121212' });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'in', 'letter');
    const pageWidth = 8.5, pageHeight = 11, margin = 0.5;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    let y = margin;
    let remaining = imgHeight;
    let position = margin;
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    while (remaining > pageHeight - margin * 2) {
      remaining -= pageHeight - margin * 2;
      position = margin - (imgHeight - remaining);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    }
    const pages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFontSize(9); pdf.text(`Page ${i} of ${pages}`, pageWidth / 2, 10.7, { align: 'center' }); }
    const filename = `Inspection_${visit.siteName || 'Site'}_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(filename);
    if (email) alert('PDF downloaded. Next version will email it automatically to your work email.');
    setBusy(false);
  }

  return <div className="app"><main ref={reportRef} className="report"><header className="header"><div className="logo"><ShieldCheck size={32}/></div><div><h1>Field Operations Inspection Report</h1><p>Protos Security: Operations</p></div><ScoreBadge label="Overall" value={overall}/></header>

  <section className="card"><h2>Visit Information & Officer Profile</h2><div className="two-col"><div className="grid"><Field label="Client" required value={visit.client} onChange={v => updateVisit('client', v)} /><Field label="Vendor" required value={visit.vendor} onChange={v => updateVisit('vendor', v)} /><Field label="Site Name" required value={visit.siteName} onChange={v => updateVisit('siteName', v)} /><Field label="Address" value={visit.address} onChange={v => updateVisit('address', v)} /><Field label="Visit Date & Time" value={visit.visitDateTime} onChange={v => updateVisit('visitDateTime', v)} /><Field label="FOM" value={visit.fom} onChange={v => updateVisit('fom', v)} /><Field label="SSA" value={visit.ssa} onChange={v => updateVisit('ssa', v)} /><label className="field"><span>Status</span><select value={visit.status} onChange={e => updateVisit('status', e.target.value)}><option>Complete</option><option>Case Filed</option></select></label></div><PhotoInput label="Officer Photo" files={officerPhoto} setFiles={setOfficerPhoto}/></div></section>

  {sections.map(section => <section className="card" key={section.key}><div className="section-head"><h2>{section.title}</h2><ScoreBadge label="Score" value={scores[section.key]}/></div>{section.items.map(item => <RatingRow key={item} label={item} value={ratings[section.key]?.[item]} onChange={v => updateRating(section.key, item, v)}/>) }{section.notes && <textarea value={jobNotes} onChange={e => setJobNotes(e.target.value)} placeholder="Job Performance Notes"/>}</section>)}

  <section className="card highlight"><div className="section-head"><h2>Performance Summary & Post-Inspection Actions</h2><ScoreBadge label="Overall Visit" value={overall}/></div><textarea className="summary" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Enter final comprehensive narrative report..."/><div className="two-col"><PhotoInput label="Supporting Field Photos" files={fieldPhotos} setFiles={setFieldPhotos} multiple/><div className="toggles"><label><span>SSA Notified</span><input type="checkbox" checked={ssaNotified} onChange={e => setSsaNotified(e.target.checked)}/></label><label><span>Case Filed in Salesforce</span><input type="checkbox" checked={caseFiled} onChange={e => setCaseFiled(e.target.checked)}/></label></div></div></section>

  <section className="card"><h2>Legal Attestation & Sign-Off</h2><SignaturePad value={signature} onChange={setSignature}/></section></main>

  <footer className="actions"><span>Required: Client, Vendor, Site Name, Signature.</span><button disabled={!valid || busy} onClick={() => generatePdf(true)}><Mail size={18}/> Email PDF</button><button disabled={!valid || busy} onClick={() => generatePdf(false)}><Download size={18}/> Save Completed Inspection to PDF</button></footer></div>;
}

createRoot(document.getElementById('root')).render(<App />);
