import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  ChevronLeft, Plus, Trash2, Dumbbell, User, Calendar as CalendarIcon, 
  Video, Copy, X, Save, MessageSquare, Send, BarChart3 
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ProgressChart from '../components/ProgressChart';

export default function ClientDetailView({ client, goBack, exercisesLibrary }) {
  const [activeTab, setActiveTab] = useState('routine'); // 'routine', 'stats', 'chat'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [routines, setRoutines] = useState([]);
  
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [addMode, setAddMode] = useState('single');
  const [newExData, setNewExData] = useState({ name: '', sets: 4, reps: '10', weight: '', rir: '2', videoUrl: '' });
  const [selectedRoutineId, setSelectedRoutineId] = useState('');

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneDates, setCloneDates] = useState([]);

  const rirColors = ['bg-[#ffe4c4]', 'bg-[#fcd34d]', 'bg-[#fbbf24]', 'bg-[#f97316]', 'bg-[#ef4444]', 'bg-[#b91c1c]'];

  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentDateId = formatDateId(date);

  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const activeSessions = snapshot.docs
        .filter(doc => doc.data().exercises && doc.data().exercises.length > 0)
        .map(doc => doc.id);
      setAllSessionsIds(activeSessions);
    });
    return () => unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const exercises = data.exercises || [];
        setDailySession(exercises);
        if (exercises.length === 0 && !data.missedReason) deleteDoc(sessionDocRef);
      } else {
        setDailySession([]);
      }
    });
    return () => unsubscribe();
  }, [date, client, currentDateId]);

  useEffect(() => {
    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubRoutines();
  }, []);

  useEffect(() => {
    if (!client || activeTab !== 'chat') return;
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      
      msgs.forEach(async (m) => {
        if (m.sender === 'student' && !m.read) {
          await updateDoc(doc(db, 'clients', client.id, 'messages', m.id), { read: true });
        }
      });

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [client, activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'clients', client.id, 'messages'), {
        text: newMessage, sender: 'trainer', createdAt: new Date(), read: false 
      });
      setNewMessage('');
    } catch (error) { console.error(error); }
  };

  const handleSelectExerciseName = (e) => {
    const name = e.target.value;
    const found = exercisesLibrary.find(ex => ex.name === name);
    setNewExData({ ...newExData, name, videoUrl: found?.videoUrl || '' });
  };

  const handleSaveNewItem = async (e) => {
    e.preventDefault();
    let newExercises = [];

    if (addMode === 'single') {
      if (!newExData.name) return;
      newExercises = [{ ...newExData, id: Date.now() }];
    } else {
      if (!selectedRoutineId) return;
      const routine = routines.find(r => r.id === selectedRoutineId);
      if (routine && routine.exercises) {
        newExercises = routine.exercises.map(ex => ({
           name: ex.name, sets: ex.sets || 4, reps: ex.reps || '10', weight: ex.weight || '', rir: ex.rir || '2', videoUrl: ex.videoUrl || '', id: Math.random().toString(36).substr(2, 9)
        }));
      }
    }

    const updatedSession = [...dailySession, ...newExercises];
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId, exercises: updatedSession, updatedAt: new Date()
      }, { merge: true });
      setIsAddingEx(false);
      setNewExData({ name: '', sets: 4, reps: '10', weight: '', rir: '2', videoUrl: '' });
      setSelectedRoutineId('');
    } catch (error) { console.error(error); }
  };

  const handleRemoveExercise = async (index) => {
    const updatedSession = dailySession.filter((_, i) => i !== index);
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    try {
      if (updatedSession.length === 0) await deleteDoc(sessionDocRef);
      else await updateDoc(sessionDocRef, { exercises: updatedSession });
    } catch (error) { console.error(error); }
  };

  const handleToggleCloneDate = (val) => {
    const dateId = formatDateId(val);
    if (dateId === currentDateId) return;
    if (cloneDates.includes(dateId)) setCloneDates(cloneDates.filter(d => d !== dateId));
    else setCloneDates([...cloneDates, dateId]);
  };

  const handleSaveClone = async () => {
    if (cloneDates.length === 0 || dailySession.length === 0) return;
    const cleanSession = dailySession.map(ex => { const { actualSets, ...rest } = ex; return { ...rest }; });
    try {
      const promises = cloneDates.map(dateId => 
        setDoc(doc(db, 'clients', client.id, 'sessions', dateId), { date: dateId, exercises: cleanSession, updatedAt: new Date() }, { merge: true })
      );
      await Promise.all(promises);
      setIsCloneModalOpen(false);
      setCloneDates([]);
      alert("¡Rutina replicada con éxito!");
    } catch (error) { console.error(error); alert("Error al replicar."); }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10 flex flex-col h-[calc(100vh-80px)]">
      
      {/* HEADER CLIENTE */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="p-2 bg-zinc-800 hover:bg-yellow-400 hover:text-black text-white rounded-full transition-colors"><ChevronLeft size={24} /></button>
            <div className="w-14 h-14 bg-zinc-800 text-yellow-400 rounded-full flex items-center justify-center font-bold text-xl border-2 border-zinc-700">{client.name.charAt(0)}</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{client.name}</h2>
              <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
                <span className="flex items-center gap-1 font-bold"><Dumbbell size={14} className="text-yellow-400"/> {client.plan}</span>
                <span className="flex items-center gap-1"><CalendarIcon size={14}/> {client.startDate || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS CON 3 PESTAÑAS */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('routine')} className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${activeTab === 'routine' ? 'bg-yellow-400 text-black shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-800'}`}>
            <CalendarIcon size={16}/> Rutina
          </button>
          <button onClick={() => setActiveTab('stats')} className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${activeTab === 'stats' ? 'bg-yellow-400 text-black shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-800'}`}>
            <BarChart3 size={16}/> Progreso
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${activeTab === 'chat' ? 'bg-yellow-400 text-black shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-800'}`}>
            <MessageSquare size={16}/> Chat
          </button>
        </div>
      </div>

      {/* --- VISTA 1: RUTINA --- */}
      {activeTab === 'routine' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
          <div className="lg:col-span-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
              <h3 className="text-white font-bold uppercase mb-4 text-xs tracking-widest flex items-center gap-2"><CalendarIcon size={18} className="text-yellow-400"/> Agenda del Atleta</h3>
              <Calendar onChange={setDate} value={date} className="react-calendar-custom" tileClassName={({ date }) => allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col h-full shadow-xl">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                  <p className="text-zinc-500 text-sm font-medium mt-1">{dailySession.length} movimientos asignados</p>
                </div>
                <div className="flex gap-2">
                  {dailySession.length > 0 && <button onClick={() => setIsCloneModalOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-zinc-700"><Copy size={18}/> <span className="hidden sm:inline">Replicar</span></button>}
                  <button onClick={() => setIsAddingEx(true)} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"><Plus size={18}/> Agregar</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/20 custom-scrollbar">
                {dailySession.length > 0 ? (
                  dailySession.map((ex, idx) => (
                    <div key={idx} className="bg-black p-5 rounded-2xl border border-zinc-800 flex flex-col group hover:border-yellow-400/50 transition-all shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <span className="bg-zinc-900 text-zinc-500 font-bold w-10 h-10 rounded-full flex items-center justify-center border border-zinc-800 group-hover:text-yellow-400 group-hover:border-yellow-400/30 transition-colors">{idx + 1}</span>
                          <div>
                            <div className="flex items-center gap-2"><h4 className="font-black text-white text-lg leading-none uppercase">{ex.name}</h4>{ex.videoUrl && <Video size={16} className="text-blue-500 cursor-help" />}</div>
                            <p className="text-zinc-400 text-sm mt-1 font-medium"><span className="text-white">{ex.sets}</span> series x <span className="text-white">{ex.reps}</span> reps {ex.weight && ` | ${ex.weight}`}</p>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveExercise(idx)} className="text-zinc-600 hover:text-red-500 p-2 transition-colors"><Trash2 size={20}/></button>
                      </div>

                      {/* BARRA ESCALA RIR */}
                      {ex.rir && (
                        <div className="mt-2 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                          <div className="flex justify-between items-center mb-1.5">
                             <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1">Intensidad RIR</span>
                             <span className="text-[10px] text-white font-black bg-zinc-800 px-2 py-0.5 rounded">RIR {ex.rir}</span>
                          </div>
                          <div className="flex gap-1 h-2">
                             {[5, 4, 3, 2, 1, 0].map((val, i) => (
                                <div key={val} className={`flex-1 rounded-full transition-colors ${val >= parseInt(ex.rir) ? rirColors[i] : 'bg-zinc-800'}`}></div>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-700"><Dumbbell size={64} className="mb-4 opacity-20"/><p className="text-lg font-bold uppercase tracking-widest opacity-30">Día de Descanso</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VISTA 2: ESTADÍSTICAS --- */}
      {activeTab === 'stats' && (
        <div className="flex-1 overflow-y-auto">
          <ProgressChart clientId={client.id} />
        </div>
      )}

      {/* --- VISTA 3: CHAT --- */}
      {activeTab === 'chat' && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col h-full overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-3 shrink-0">
            <MessageSquare className="text-yellow-400" size={24}/>
            <div>
              <h3 className="text-white font-bold uppercase tracking-widest">Conversación con {client.name}</h3>
              <p className="text-zinc-500 text-xs">Los mensajes de sistema y excusas también aparecerán aquí.</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/20 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50"><MessageSquare size={48} className="mb-4" /><p>No hay mensajes todavía.</p></div>
            ) : (
              messages.map(msg => {
                const isTrainer = msg.sender === 'trainer';
                const isSystem = msg.sender === 'system';
                return (
                  <div key={msg.id} className={`flex ${isTrainer ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${isTrainer ? 'bg-yellow-400 text-black rounded-tr-none' : isSystem ? 'bg-red-500/20 border border-red-500/30 text-red-100 rounded-tl-none font-bold' : 'bg-zinc-800 text-white rounded-tl-none'}`}>
                      {msg.text}
                      <span className="block text-[10px] opacity-60 mt-2 text-right">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950 border-t border-zinc-800 flex gap-3 shrink-0">
            <input type="text" placeholder="Escribe un mensaje a tu alumno..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 outline-none transition-colors" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <button type="submit" disabled={!newMessage.trim()} className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:hover:bg-yellow-400 text-black p-3 rounded-xl transition-colors flex items-center justify-center"><Send size={20}/></button>
          </form>
        </div>
      )}

      {/* --- MODAL: AGREGAR EJERCICIO --- */}
      {isAddingEx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Asignar Entrenamiento</h2>
              <button onClick={() => setIsAddingEx(false)} className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6">
              <div className="flex gap-2 mb-6 border-b border-zinc-800 p-1 bg-black rounded-xl">
                <button onClick={() => setAddMode('single')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${addMode === 'single' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Individual</button>
                <button onClick={() => setAddMode('routine')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${addMode === 'routine' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Plantilla</button>
              </div>

              {addMode === 'single' ? (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" value={newExData.name} onChange={handleSelectExerciseName}>
                    <option value="">Elegir ejercicio...</option>
                    {exercisesLibrary.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" placeholder="Sets" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.sets} onChange={e => setNewExData({...newExData, sets: e.target.value})} />
                    <input type="text" placeholder="Reps" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.reps} onChange={e => setNewExData({...newExData, reps: e.target.value})} />
                    <input type="text" placeholder="Peso" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.weight} onChange={e => setNewExData({...newExData, weight: e.target.value})} />
                  </div>
                  
                  {/* SELECTOR RIR */}
                  <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none font-medium" value={newExData.rir} onChange={e => setNewExData({...newExData, rir: e.target.value})}>
                    <option value="5">RIR 5 (Muy fácil / Calentamiento)</option>
                    <option value="4">RIR 4 (Fácil)</option>
                    <option value="3">RIR 3 (Moderado)</option>
                    <option value="2">RIR 2 (Intenso)</option>
                    <option value="1">RIR 1 (Muy intenso)</option>
                    <option value="0">RIR 0 (Fallo muscular absoluto)</option>
                  </select>

                  <button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase tracking-widest mt-2 transition-colors shadow-lg shadow-yellow-400/20">Guardar Ejercicio</button>
                </form>
              ) : (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)}>
                    <option value="">Elegir plantilla...</option>
                    {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button type="submit" disabled={!selectedRoutineId} className="w-full bg-yellow-400 disabled:opacity-50 disabled:bg-zinc-800 text-black font-black py-4 rounded-xl uppercase tracking-widest mt-2 transition-colors">Volcar Plantilla</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: REPLICAR DÍA (CLONAR) --- */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 text-center">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Replicar en Calendario</h2>
              <p className="text-zinc-400 text-xs mt-1">Selecciona los días para pegar la rutina</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
              <Calendar 
                onClickDay={handleToggleCloneDate}
                className="react-calendar-custom clone-mode"
                tileClassName={({ date }) => {
                  const dId = formatDateId(date);
                  if (dId === currentDateId) return 'bg-yellow-400 !text-black font-bold';
                  if (cloneDates.includes(dId)) return 'bg-green-500 !text-black font-bold shadow-[0_0_10px_rgba(34,197,94,0.5)]';
                  return null;
                }}
              />
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button onClick={() => { setIsCloneModalOpen(false); setCloneDates([]); }} className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black">Cancelar</button>
              <button onClick={handleSaveClone} disabled={cloneDates.length === 0} className="flex-1 py-4 bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl uppercase text-xs">Pegar en {cloneDates.length} días</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
