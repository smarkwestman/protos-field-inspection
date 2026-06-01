import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Download, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './style.css';

const ORANGE = '#00A651';
const ratingOptions = ['N/A', '1', '2', '3', '4', '5'];

const sections = [
  { key: 'appearance', title: 'Appearance', items: ['Uniform Compliance & Cleanliness', 'Personal Grooming & Hygiene', 'Professional Presence', 'Valid Guard Card', 'Equipment and Readiness'] },
  { key: 'postOrders', title: 'Post Order Compliance / Comprehension', items: ['Post Orders on Site', 'Knows Post Responsibilities', 'Emergency Procedures', 'Post Order Execution'] },
  { key: 'jobPerformance', title: 'Job Performance', items: ['Situational Awareness', 'Proactive', 'Customer Service', 'Client / Staff Engagement'] },
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
  return <div className="photo-box"><div className="photo-top"><div><b>{label}</b></div><button type="button" onClick={() => ref.current?.click()}><Camera size={18}/> Add</button></div><input ref={ref} type="file" accept="image/*" capture="environment" multiple={multiple} hidden onChange={e => { const selected = Array.from(e.target.files || []); setFiles(multiple ? [...files, ...selected] : selected.slice(0,1)); }} />{previews.length > 0 && <div className="photo-grid">{previews.map((p,i) => <div className="photo-preview" key={i}><img src={p.url}/><button type="button" onClick={() => setFiles(files.filter((_,idx) => idx !== i))}><Trash2 size={14}/></button></div>)}</div>}</div>;
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPoint(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const stop = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return <div className="signature-box"><p>The information contained in this report is accurate and true to the best of my knowledge.</p><div className="signature-pad-wrap"><canvas ref={canvasRef} width="700" height="220" className="signature-pad" onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop}></canvas><button type="button" onClick={clear}>Clear Signature</button></div></div>;
}

function App() {
  const reportRef = useRef(null);
  const [visit, setVisit] = useState({ client:'', vendor:'', siteName:'', address:'', visitDateTime:new Date().toLocaleString(), fom:'', ssa:'', officerName:'', status:'Complete' });
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

  const pdf = new jsPDF('p', 'in', 'letter');
  const pageW = 8.5;
  const pageH = 11;
  const margin = 0.45;
  let y = margin;

  const green = '#00A651';
  const blue = '#1F3A68';
  const gray = '#444444';

  const fileToDataUrl = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

  const addPageIfNeeded = (needed = 0.5) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const sectionBox = (title, height) => {
    addPageIfNeeded(height);
    pdf.setDrawColor(0, 166, 81);
    pdf.setLineWidth(0.01);
    pdf.roundedRect(margin, y, pageW - margin * 2, height, 0.08, 0.08);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(blue);
    pdf.text(title, margin + 0.15, y + 0.25);
  };

  const textLine = (label, value, x, lineY) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(gray);
    pdf.text(label, x, lineY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text(String(value || ''), x + 1.15, lineY);
  };

  const scoreText = (v) => v == null ? 'N/A' : Number(v).toFixed(2);

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, pageH, 'F');

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(blue);
  pdf.addImage('/Protos-logo.png', 'PNG', margin, y - 0.05, 2.0, 0.45);
  pdf.setFontSize(11);
  pdf.text('Field Operations Inspection Report', margin, y + 0.55);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(gray);

  pdf.setFillColor(0, 166, 81);
  pdf.roundedRect(6.55, y + 0.08, 1.45, 0.55, 0.08, 0.08, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('OVERALL SCORE', 6.72, y + 0.3);
  pdf.setFontSize(11);
  pdf.text(scoreText(overall), 7.25, y + 0.52);
  y += 1.05;

  // Visit Info
  sectionBox('Visit Information', 1.35);
  textLine('Client:', visit.client, margin + 0.15, y + 0.55);
  textLine('Vendor:', visit.vendor, margin + 3.9, y + 0.55);
  textLine('Site:', visit.siteName, margin + 0.15, y + 0.85);
 textLine('Address:', String(visit.address || '').slice(0, 40), margin + 3.9, y + 0.85);
  textLine('Visit Date:', visit.visitDateTime, margin + 0.15, y + 1.15);
  textLine('FOM:', visit.fom, margin + 3.9, y + 1.15);
  y += 1.45;

  // Officer + score summary
  sectionBox('Officer Information & Score Summary', 1.90);
  const officerName = visit.officerName || '';
  textLine('Officer:', officerName, margin + 0.15, y + 0.55);
  textLine('SSA:', visit.ssa, margin + 0.15, y + 0.85);
  ('Status:', visit.status, margin + 0.15, y + 1.15);

  let sy = y + 0.55;
  Object.keys(scores).forEach((key) => {
    const section = sections.find(s => s.key === key);
    const shortTitle = section?.title === 'Post Order Compliance / Comprehension' ? 'Post Orders' : section?.title; textLine(shortTitle + ':', scoreText(scores[key]), margin + 3.15, sy);
    sy += 0.25;
  });

  if (officerPhoto[0]) {
    const img = await fileToDataUrl(officerPhoto[0]);
    pdf.addImage(img, 'JPEG', 5.95, y + 0.18, 1.55, 1.55);
  }

  y += 2.10;

  // Detailed scoring
  sections.forEach((section) => {
    const h = 0.32 + section.items.length * 0.16 + 0.18;
    sectionBox(section.title, h);
    let rowY = y + 0.55;
    section.items.forEach((item) => {
      const val = ratings[section.key]?.[item] || 'N/A';
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(gray); pdf.text(item + ':', margin + 0.15, rowY); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(0,0,0); pdf.text(String(val), margin + 3.15, rowY);
      rowY += 0.14;
    });
    textLine('Section Score:', scoreText(scores[section.key]), margin + 5.65, y + 0.55);
    y += h + 0.15;
  });

  // Summary
  const summaryLines = pdf.splitTextToSize(summary || 'No summary entered.', pageW - margin * 2 - 0.3);
  const summaryH = Math.max(1.4, 0.45 + summaryLines.length * 0.18);
  sectionBox('Visit Summary', summaryH);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(0, 0, 0);
  pdf.text(summaryLines, margin + 0.15, y + 0.55);
  y += summaryH + 0.15;

  // Actions + Signature
  sectionBox('Post-Inspection Actions & Signature', 1.45);
  textLine('SSA Notified:', ssaNotified ? 'Yes' : 'No', margin + 0.15, y + 0.55);
  textLine('Salesforce Case:', caseFiled ? 'Yes' : 'No', margin + 3.2, y + 0.55);

  if (signature) {
    pdf.addImage(signature, 'PNG', margin + 0.15, y + 0.75, 2.7, 0.45);
  }
  y += 1.65;

  // Supporting photos
  if (fieldPhotos.length > 0) {
    sectionBox('Supporting Field Photos', 0.55);
    y += 0.7;
    for (let i = 0; i < fieldPhotos.length; i++) {
      addPageIfNeeded(2.2);
      const img = await fileToDataUrl(fieldPhotos[i]);
      const x = i % 2 === 0 ? margin : 4.4;
      if (i % 2 === 0 && i !== 0) y += 2.25;
      pdf.addImage(img, 'JPEG', x, y, 3.35, 2.0);
      if (i % 2 === 1) y += 2.25;
    }
  }

  const pages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(gray);
    pdf.text(`Page ${i} of ${pages}`, pageW / 2, 10.75, { align: 'center' });
  }

  const filename = `Inspection_${visit.siteName || 'Site'}_${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(filename);

  if (email) alert('PDF downloaded. Next version will email it automatically to your work email.');
  setBusy(false);
}

  return <div className="app"><main ref={reportRef} className="report"><header className="header"><div className="logo"><img src="/protos-shield-1.png" alt="Protos Shield" style={{width:'48px',height:'48px'}} /></div><div><h1>Field Operations Inspection Report</h1><p>Protos Security: Operations</p></div><ScoreBadge label="Overall Score" value={overall}/></header>

  <section className="card"><h2>Visit Information & Officer Profile</h2><div className="two-col"><div className="grid"><Field label="Client" required value={visit.client} onChange={v => updateVisit('client', v)} /><Field label="Vendor" required value={visit.vendor} onChange={v => updateVisit('vendor', v)} /><Field label="Site Name" required value={visit.siteName} onChange={v => updateVisit('siteName', v)} /><Field label="Address" value={visit.address} onChange={v => updateVisit('address', v)} /><Field label="Visit Date & Time" value={visit.visitDateTime} onChange={v => updateVisit('visitDateTime', v)} /><Field label="FOM" value={visit.fom} onChange={v => updateVisit('fom', v)} />
<Field label="Officer Name" value={visit.officerName} onChange={v => updateVisit('officerName', v)} />
<Field label="SSA" value={visit.ssa} onChange={v => updateVisit('ssa', v)} /><label className="field"><span>Status</span><select value={visit.status} onChange={e => updateVisit('status', e.target.value)}><option>Complete</option><option>Case Filed</option></select></label></div><PhotoInput label="Uniform Photo" files={officerPhoto} setFiles={setOfficerPhoto}/></div></section>

  {sections.map(section => <section className="card" key={section.key}><div className="section-head"><h2>{section.title}</h2><ScoreBadge label="Score" value={scores[section.key]}/></div>{section.items.map(item => <RatingRow key={item} label={item} value={ratings[section.key]?.[item]} onChange={v => updateRating(section.key, item, v)}/>) }{section.notes && <textarea value={jobNotes} onChange={e => setJobNotes(e.target.value)} placeholder="Job Performance Notes"/>}</section>)}

  <section className="card highlight"><div className="section-head"><h2>Performance Summary & Post-Inspection Actions</h2><ScoreBadge label="Overall Visit" value={overall}/></div><textarea className="summary" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Enter final comprehensive narrative report..."/><div className="two-col"><PhotoInput label="Supporting Field Photos" files={fieldPhotos} setFiles={setFieldPhotos} multiple/><div className="toggles"><label><span>SSA Notified</span><input type="checkbox" checked={ssaNotified} onChange={e => setSsaNotified(e.target.checked)}/></label><label><span>Case Filed in Salesforce</span><input type="checkbox" checked={caseFiled} onChange={e => setCaseFiled(e.target.checked)}/></label></div></div></section>

  <section className="card"><h2>Legal Attestation & Sign-Off</h2><SignaturePad value={signature} onChange={setSignature}/></section></main>

  <footer className="actions"><span>Required: Client, Vendor, Site Name, Signature.</span><button disabled={!valid || busy} onClick={() => generatePdf(true)}><Mail size={18}/> Email PDF</button><button disabled={!valid || busy} onClick={() => generatePdf(false)}><Download size={18}/> Save Completed Inspection to PDF</button></footer></div>;
}

createRoot(document.getElementById('root')).render(<App />);
