import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Dumbbell, CheckCircle, User, PlayCircle, Menu, X, 
  LogOut, MessageSquare, Send, AlertTriangle, Trophy
} from 'lucide-react';
import { doc, getDoc, collection, onSnapshot, setDoc, addDoc, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase';

export default function StudentView({ clientId }) {
  // --- ESTADOS DE DATOS ---
  const [client, setClient] = useState(null);
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE NAVEGACIÓN ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState('workout'); // 'workout', 'profile', 'chat'

  // --- ESTADOS DE CHAT ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // --- ESTADOS DE "MISSED WORKOUT" (Falta de ayer) ---
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [missedReason, setMissedReason] = useState('');
  const [missedDateId, setMissedDateId] = useState(null);

  const auth = getAuth();
  const formatDateId = (d) => d.toISOString().split('T')[0];
  const currentDateId = formatDateId(date);

  // --- CARGA DE DATOS INICIALES ---
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setClient({ id: docSnap.id, ...docSnap.data() });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    if (clientId) fetchClient();
  }, [clientId]);

  // Cargar Calendario (Puntos de días con rutina)
  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      setAllSessionsIds(snapshot.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [client]);

  // Cargar Rutina del Día Seleccionado
  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailySession(data.exercises || []);
        setIsSessionFinalized(data.isFinalized || false);
      } else {
        setDailySession([]);
        setIsSessionFinalized(false);
      }
    });
    return () => unsubscribe();
  }, [date, client]);

  // Cargar Chat
  useEffect(() => {
    if (!client || currentView !== 'chat') return;
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [client, currentView]);

  // --- LÓGICA DE DETECCIÓN DE FALTA ---
  useEffect(() => {
    const checkYesterday = async () => {
      if (!client) return;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yId = formatDateId(yesterday);

      try {
        const docRef = doc(db, 'clients', client.id, 'sessions', yId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const exercises = data.exercises || [];

          if (exercises.length > 0) {
            const didSomething = exercises.some(ex => ex.actualSets && ex.actualSets.some(s => s.completed));
            const alreadyExcused = data.missedReason && data.missedReason.length > 0;
            const alreadyFinalized = data.isFinalized;

            if (!didSomething && !alreadyExcused && !alreadyFinalized) {
              setMissedDateId(yId);
              setShowMissedModal(true);
            }
          }
        }
      } catch (error) { console.error("Error verificando ayer:", error); }
    };
    checkYesterday();
  }, [client]);

  // --- FUNCIONES ---

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    if (isSessionFinalized) return; // Si ya terminó, no puede editar
    const updatedSession = [...dailySession];
    
    if (!updatedSession[exerciseIndex].actualSets) updatedSession[exerciseIndex].actualSets = [];
    if (!updatedSession[exerciseIndex].actualSets[setIndex]) updatedSession[exerciseIndex].actualSets[setIndex] = { reps: '', weight: '', completed: false };
    
    updatedSession[exerciseIndex].actualSets[setIndex][field] = value;

    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession
      }, { merge: true });
    } catch (error) { console.error(error); }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    if (isSessionFinalized) return;
    const currentStatus = dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
  };

  // NUEVO: FINALIZAR Y EVALUAR ENTRENAMIENTO
  const handleFinishWorkout = async () => {
    if (!window.confirm('¿Finalizar entrenamiento? Tu coach recibirá los resultados y ya no podrás editar los pesos de hoy.')) return;

    let fellShort = false;
    let wentAbove = false;
    let completedSetsCount = 0;
    let prescribedSetsCount = 0;

    // Analizamos el rendimiento del alumno vs lo que le pediste
    dailySession.forEach(ex => {
      const pSets = parseInt(ex.sets) || 0;
      const pReps = parseInt(ex.reps) || 0; 
      prescribedSetsCount += pSets;

      const setsData = ex.actualSets || [];
      const cSets = setsData.filter(s => s && s.completed).length;
      completedSetsCount += cSets;

      if (cSets < pSets) fellShort = true;
      if (cSets > pSets) wentAbove = true;

      setsData.forEach(set => {
        if (set && set.completed) {
          const cReps = parseInt(set.reps) || 0;
          if (cReps < pReps && pReps > 0) fellShort = true;
          if (cReps > pReps && pReps > 0) wentAbove = true;
        }
      });
    });

    // Definimos el veredicto
    let performanceText = "Cumplió exactamente con las series y repeticiones.";
    if (completedSetsCount === 0) {
      performanceText = "Marcó finalizado pero no registró ninguna serie completada.";
    } else if (fellShort && wentAbove) {
      performanceText = "Resultados mixtos (algunos por debajo, otros por encima de la meta).";
    } else if (fellShort) {
      performanceText = "Rindió por debajo de las series/reps asignadas.";
    } else if (wentAbove) {
      performanceText = "¡Superó el volumen! (Hizo más series o reps de las asignadas).";
    }

    try {
      // 1. Bloqueamos la edición del día
      await updateDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), {
        isFinalized: true,
        performanceSummary: performanceText,
        completedAt: new Date()
      });

      // 2. Enviamos la notificación al coach
      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'workout_completed',
        clientId: clientId,
        clientName: client.name,
        date: currentDateId,
        performance: performanceText,
        read: false,
        createdAt: new Date()
      });

      setIsSessionFinalized(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendReason = async () => {
    if (!missedReason.trim()) return;
    try {
      await updateDoc(doc(db, 'clients', clientId, 'sessions', missedDateId), { missedReason: missedReason, missedReasonDate: new Date() });
      await addDoc(collection(db, 'clients', clientId, 'messages'), { text: `⚠️ NO ENTRENÉ EL ${missedDateId}: "${missedReason}"`, sender: 'system', createdAt: new Date() });
      await addDoc(collection(db, 'trainerNotifications'), { type: 'missed_workout', clientId: clientId, clientName: client.name, date: missedDateId, reason: missedReason, read: false, createdAt: new Date() });
      setShowMissedModal(false);
    } catch (error) {}
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'clients', client.id, 'messages'), { text: newMessage, sender: 'student', createdAt: new Date() });
    setNewMessage('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div></div>;
  if (!client) return <div className="min-h-screen bg-black text-white flex justify-center items-center">Atleta no encontrado</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* MODAL DE FALTA */}
      {showMissedModal && (
        <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-yellow-400 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="mx-auto bg-yellow-400/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4"><AlertTriangle className="w-10 h-10 text-yellow-400" /></div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">¡Faltaste Ayer!</h2>
            <p className="text-zinc-400 text-sm mb-4">Tenías rutina programada y no registraste actividad.</p>
            <textarea className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none resize-none" rows={3} maxLength={100} placeholder="¿Qué pasó?" value={missedReason} onChange={(e) => setMissedReason(e.target.value)} />
            <button onClick={handleSendReason} disabled={!missedReason.trim()} className="w-full mt-4 bg-yellow-400 text-black font-bold py-3 rounded-xl uppercase disabled:opacity-50">Enviar al Coach</button>
          </div>
        </div>
      )}

      {/* MENÚ HAMBURGUESA */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col p-6">
          <div className="flex justify-end"><button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-full"><X/></button></div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-black text-3xl font-bold">{client.name.charAt(0)}</div>
            <h2 className="text-2xl font-bold uppercase">{client.name}</h2>
            <nav className="w-full max-w-xs space-y-3">
              <button onClick={() => { setCurrentView('workout'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold ${currentView === 'workout' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400'}`}><Dumbbell /> Mi Entrenamiento</button>
              <button onClick={() => { setCurrentView('profile'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold ${currentView === 'profile' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400'}`}><User /> Mi Perfil</button>
              <button onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold ${currentView === 'chat' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400'}`}><MessageSquare /> Chat con Coach</button>
            </nav>
            <button onClick={handleLogout} className="mt-12 text-red-500 font-bold flex items-center gap-2"><LogOut/> Cerrar Sesión</button>
          </div>
        </div>
      )}

      {/* HEADER SUPERIOR */}
      <div className="bg-yellow-400 text-black p-4 pb-6 rounded-b-[2rem] shadow-lg z-10 relative">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="bg-black/10 p-2 rounded-full"><User size={20}/></div>
               <div><h1 className="text-xl font-black uppercase leading-none">{client.name}</h1><p className="text-xs font-bold opacity-70 uppercase tracking-wide">Alumno</p></div>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-2"><Menu size={28}/></button>
         </div>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-4 -mt-4 pt-8 pb-10 space-y-6 relative z-0">
        
        {currentView === 'workout' && (
          <>
            <div className="flex justify-between items-end mb-1 px-1">
                <h2 className="text-xl font-bold uppercase">{isSessionFinalized ? 'Terminado' : 'Hoy'}</h2>
                <span className="text-xs text-yellow-400 font-bold uppercase">{date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</span>
            </div>

            {isSessionFinalized && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 text-green-400">
                <Trophy size={24} className="shrink-0"/>
                <div>
                  <p className="font-bold text-sm uppercase">Entrenamiento Finalizado</p>
                  <p className="text-xs opacity-80">El coach ya recibió tus resultados de este día.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
                {dailySession.length > 0 ? dailySession.map((ex, idx) => {
                  const planSets = parseInt(ex.sets) || 1;
                  const setsData = ex.actualSets || [];
                  const isExerciseComplete = setsData.filter(s => s && s.completed).length >= planSets;

                  return (
                    <div key={idx} className={`bg-zinc-900 border ${isExerciseComplete ? 'border-green-500/50' : 'border-zinc-800'} rounded-xl overflow-hidden`}>
                      <div className="p-4 bg-zinc-800/30 flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isExerciseComplete ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                              {isExerciseComplete ? <CheckCircle size={16}/> : idx + 1}
                            </span>
                            <div>
                               <h3 className="font-bold text-lg leading-tight">{ex.name}</h3>
                               <p className="text-zinc-500 text-xs mt-1">Meta: <span className="text-zinc-300">{ex.sets}x{ex.reps}</span> @ {ex.weight}</p>
                            </div>
                         </div>
                      </div>

                      <div className="p-3 space-y-2">
                        {Array.from({ length: planSets }).map((_, setIdx) => {
                          const currentSet = setsData[setIdx] || { reps: '', weight: '', completed: false };
                          return (
                            <div key={setIdx} className={`grid grid-cols-10 gap-2 items-center p-2 rounded-lg ${currentSet.completed ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/20 border border-zinc-800'}`}>
                               <div className="col-span-1 text-center text-zinc-400 font-bold text-xs">{setIdx + 1}</div>
                               <div className="col-span-3"><input type="number" disabled={isSessionFinalized} className="w-full bg-zinc-950 border border-zinc-700 disabled:opacity-50 rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400" placeholder={ex.reps} value={currentSet.reps} onChange={(e) => handleUpdateSet(idx, setIdx, 'reps', e.target.value)} /></div>
                               <div className="col-span-3"><input type="text" disabled={isSessionFinalized} className="w-full bg-zinc-950 border border-zinc-700 disabled:opacity-50 rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400" placeholder={ex.weight} value={currentSet.weight} onChange={(e) => handleUpdateSet(idx, setIdx, 'weight', e.target.value)} /></div>
                               <div className="col-span-3 flex justify-center">
                                 <button disabled={isSessionFinalized} onClick={() => toggleSetComplete(idx, setIdx)} className={`w-full py-1.5 rounded flex items-center justify-center text-[10px] font-bold disabled:opacity-80 ${currentSet.completed ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                                   {currentSet.completed ? 'LISTO' : 'HECHO'}
                                 </button>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-12 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800"><Dumbbell className="w-8 h-8 text-zinc-700 mx-auto mb-2"/><p className="text-zinc-500 text-sm">Sin rutina asignada para hoy.</p></div>
                )}
            </div>

            {/* BOTÓN FINALIZAR ENTRENAMIENTO */}
            {dailySession.length > 0 && !isSessionFinalized && (
              <button 
                onClick={handleFinishWorkout}
                className="w-full mt-6 bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all flex justify-center items-center gap-2"
              >
                <CheckCircle size={20}/> Finalizar Entrenamiento
              </button>
            )}

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mt-6">
               <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2 text-center">Navegar Agenda</p>
               <Calendar onChange={setDate} value={date} className="react-calendar-custom-mini" tileClassName={({ date }) => allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null} />
            </div>
          </>
        )}

        {/* ... Vistas Profile y Chat ... */}
        {currentView === 'profile' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6"><div className="text-center border-b border-zinc-800 pb-6"><div className="w-24 h-24 bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-zinc-700"><User size={40}/></div><h2 className="text-xl font-bold">{client.name}</h2><p className="text-yellow-400 text-sm">{client.email || 'Sin email'}</p></div></div>
        )}

        {currentView === 'chat' && (
          <div className="flex flex-col h-[70vh] bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"><div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">{messages.map(msg => (<div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.sender === 'student' ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-white'}`}>{msg.text}</div></div>))}<div ref={messagesEndRef} /></div><form onSubmit={sendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2"><input type="text" placeholder="Escribe..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none" value={newMessage} onChange={e => setNewMessage(e.target.value)}/><button type="submit" className="bg-yellow-400 text-black p-3 rounded-full"><Send size={18}/></button></form></div>
        )}
      </div>
    </div>
  );
}
