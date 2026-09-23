import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ASSETS, THEME } from './config';
import './styles.css';
import { sendRsvp } from './utils/rsvp';

function Icon({ name }) { return <img className="icon" src={ASSETS.icons[name]} alt="" />; }
function Crest() { return <div className="crest-row" aria-hidden="true"><span/><div className="crest"><Icon name="queue"/></div><span/></div>; }
function Divider() { return <div className="divider" aria-hidden="true"><span/>◆<span/></div>; }
function GoldPanel({ children, className = '' }) { return <div className={`gold-panel ${className}`}>{children}</div>; }
function GameButton({ primary, children, ...props }) { return <button className={`game-button ${primary ? 'primary' : ''}`} {...props}><span>{children}</span></button>; }
function Artwork({ accepted = false }) {
  const [failed, setFailed] = useState(false);
  return <div className={`artwork ${accepted ? 'autumn-art' : ''}`}>
    {!failed ? <img src={accepted ? ASSETS.characters.accepted : ASSETS.characters.hero} onError={() => setFailed(true)} alt={accepted ? 'Choncc and Doughcat with backpacks, looking toward an autumn Rhode Island lighthouse, with a tiny duck beside them.' : 'Joyful pink Choncc and orange Doughcat dressed for a wedding, surrounded by cream flowers.'}/> : <div className="art-fallback"><img src={ASSETS.characters.choncc} alt="Choncc"/><img src={ASSETS.characters.doughcat} alt="Doughcat"/></div>}
  </div>;
}
function ParticleLayer({ autumn }) { return <div className={`particles ${autumn ? 'leaves' : ''}`} aria-hidden="true">{Array.from({length: 14}, (_, i) => <i key={i} style={{'--x': `${(i * 29 + 7) % 100}%`, '--delay': `${-i * 1.7}s`, '--duration': `${9 + i % 5}s`}}/>)}</div>; }
function InfoPanel() { return <GoldPanel className="info-panel"><dl>{[['location','MODE','Rhode Island Wedding'],['calendar','DATE','November 2026'],['party','PARTY SIZE','2'],['party','ROLE','Kenny’s +1']].map(([icon,label,value]) => <div className="info-row" key={label}><Icon name={icon}/><dt>{label}</dt><dd>{value}</dd></div>)}</dl></GoldPanel>; }
function NotesPanel() { return <GoldPanel className="notes-panel"><ul>{['Travel Arrangements : TBD','Dress Code : Fly','Good Vibes : Required','Dance Floor : Optional Objective'].map(note => <li key={note}><span aria-hidden="true">✦</span>{note}</li>)}</ul><span className="duck" aria-hidden="true">🦆</span></GoldPanel>; }
function DeclineButton({ attempts, onAttempt, onDecline }) {

  const [dismissed, setDismissed] = useState(false);
  return <div className={`decline-arena position-${attempts}`}>
    <div className="decline-moving">
      {attempts > 0 && !dismissed && <div className="game-tooltip" role="status">{THEME.declineMessages[attempts-1]}</div>}
      <GameButton onClick={() => {if(attempts < 3) onAttempt(); else { setDismissed(true); onDecline(); }}}>DECLINE</GameButton>
    </div>
    {dismissed && <GoldPanel className="decline-message"><span role="status">fair enough 😭</span><button aria-label="Close decline message" onClick={() => setDismissed(false)}>×</button></GoldPanel>}
  </div>;
}
function InviteScreen({ onAccept, attempts, onAttempt, onDecline }) { return <section className="screen invite-screen" aria-labelledby="invite-title"><Artwork/><Crest/><div className="invite-content"><div className="heading-ornament" aria-hidden="true">◆</div><h1 id="invite-title">QUEUE POPPED</h1><p className="subtitle">May has been invited to join<br/><strong>Kenny’s Wedding Lobby</strong></p><Divider/><InfoPanel/><NotesPanel/><div className="actions"><GameButton primary onClick={onAccept}><Icon name="queue"/>ACCEPT MATCH</GameButton><DeclineButton attempts={attempts} onAttempt={onAttempt} onDecline={onDecline}/></div><footer><span/>Same duo. New adventure.<span/></footer></div></section>; }
function LoadingBar({ onReady }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => { const start = performance.now(); let id; function frame(now) { const p = Math.min(100, (now-start)/THEME.loadingMs*100); setProgress(p); if(p<100) id=requestAnimationFrame(frame); else onReady(); } id=requestAnimationFrame(frame); return () => cancelAnimationFrame(id); }, []);
  return <div className="loading-block"><div className="loading-label" aria-live="polite">{progress < 100 ? 'Rhode Island loading...' : 'RHODE ISLAND READY'}</div><div className="loading-track" role="progressbar" aria-label="Rhode Island loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress)}><div style={{width:`${progress}%`}}/></div><div className="loading-meta"><span>{progress === 100 ? 'November adventure locked in.' : 'November 2026'}</span><span>{Math.floor(progress)}%</span></div></div>;
}
function AcceptedScreen() { const [ready, setReady] = useState(false); const title = useRef(null); useEffect(() => { title.current?.focus(); }, []); return <section className="screen accepted-screen" aria-labelledby="accepted-title"><Artwork accepted/><Crest/><div className="accepted-heading"><h1 id="accepted-title" tabIndex={-1} ref={title}>MATCH ACCEPTED</h1><p className="subtitle">Duo locked in.{!ready && <><br/>Rhode Island loading...</>}</p><Divider/></div><div className="accepted-bottom"><div className="destination" aria-hidden="true">◆</div><LoadingBar onReady={() => setReady(true)}/><footer><span/>Same duo. New adventure.<span/></footer></div></section>; }
function App() { const [accepted, setAccepted] = useState(false); const [attempts, setAttempts] = useState(0); return <main className={`lobby ${accepted ? 'accepted' : ''}`}><div className="outer-corner top-left"/><div className="outer-corner top-right"/>{accepted ? <AcceptedScreen/> : <InviteScreen attempts={attempts} onAttempt={() => setAttempts(n => Math.min(3, n + 1))} onDecline={() => sendRsvp("declined", attempts)} onAccept={() => { setAccepted(true); sendRsvp("accepted", attempts); }}/>}<ParticleLayer autumn={accepted}/><div className="outer-corner bottom-left"/><div className="outer-corner bottom-right"/></main>; }
createRoot(document.getElementById('root')).render(<App/>);


