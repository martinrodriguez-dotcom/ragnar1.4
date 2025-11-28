import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Dumbbell, CheckCircle, User, PlayCircle, Menu, X, 
  LogOut, MessageSquare, Send, Settings 
} from 'lucide-react';
import { doc, getDoc, collection, onSnapshot, setDoc, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase';

export default function StudentView({ clientId }) {
  // --- ESTADOS DE DATOS ---
  const [client, setClient] = useState(null);
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE NAVEGACIÓN ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState('workout'); // 'workout', 'profile', 'chat'

  // --- ESTADOS DE CHAT ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

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

  // Cargar Calendario (Puntos)
  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      setAllSessionsIds(snapshot.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [client]);

  // Cargar Rutina del Día
  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailySession(docSnap.data().exercises || []);
      } else {
        setDailySession([]);
      }
    });
    return () => unsubscribe();
  }, [date, client]);

  // Cargar Chat (Solo si está en la vista)
  useEffect(() => {
    if (!client || currentView !== 'chat') return;
    
    const q = query(
      collection(db, 'clients', client.id, 'messages'), 
      orderBy('createdAt', 'asc'), 
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [client, currentView]);

  // --- FUNCIONES DE ENTRENAMIENTO ---

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    const updatedSession = [...dailySession];
    
    // Inicializar estructuras si no existen
    if (!updatedSession[exerciseIndex].actualSets) updatedSession[exerciseIndex].actualSets = [];
    if (!updatedSession[exerciseIndex].actualSets[setIndex]) updatedSession[exerciseIndex].actualSets[setIndex] = { reps: '', weight: '', completed: false };

    // Actualizar valor
    updatedSession[exerciseIndex].actualSets[setIndex] = {
      ...updatedSession[exerciseIndex].actualSets[setIndex],
      [field]: value
    };

    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession
      }, { merge: true });
    } catch (error) { console.error("Error guardando:", error); }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    const currentStatus = dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
  };

  // --- FUNCIONES DE CHAT ---

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    await addDoc(collection(db, 'clients', client.id, 'messages'), {
      text: newMessage,
      sender: 'student', // Marca que lo envió el alumno
      createdAt: new Date()
    });
    setNewMessage('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload(); // Recargar para limpiar estados
  };

  // --- RENDERIZADO ---

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div></div>;
  if (!client) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Atleta no encontrado</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* --- MENÚ HAMBURGUESA (Overlay) --- */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm animate-in fade-in flex flex-col">
          <div className="p-6 flex justify-end">
            <button onClick={() => setIsMenuOpen(false)} className="text-white p-2 bg-zinc-900 rounded-full"><X size={24}/></button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-black text-3xl font-bold mb-4 border-4 border-zinc-800">
              {client.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">{client.name}</h2>
            
            <nav className="w-full max-w-xs space-y-3">
              <button onClick={() => { setCurrentView('workout'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold transition-all ${currentView === 'workout' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                <Dumbbell /> Mi Entrenamiento
              </button>
              <button onClick={() => { setCurrentView('profile'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold transition-all ${currentView === 'profile' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                <User /> Mi Perfil
              </button>
              <button onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold transition-all ${currentView === 'chat' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                <MessageSquare /> Chat con Coach
              </button>
            </nav>

            <button onClick={handleLogout} className="mt-12 flex items-center gap-2 text-red-500 font-bold border border-red-500/30 px-6 py-3 rounded-full hover:bg-red-500/10 transition-colors">
              <LogOut size={18}/> Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* --- HEADER PRINCIPAL --- */}
      <div className="bg-yellow-400 text-black p-4 pb-6 rounded-b-[2rem] shadow-lg z-10 relative">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="bg-black/10 p-2 rounded-full"><User size={20}/></div>
               <div>
                 <h1 className="text-xl font-black uppercase leading-none">{client.name}</h1>
                 <p className="text-xs font-bold opacity-70 uppercase tracking-wide">
                   {currentView === 'workout' && 'Tu Rutina'}
                   {currentView === 'profile' && 'Tu Perfil'}
                   {currentView === 'chat' && 'Mensajes'}
                 </p>
               </div>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
              <Menu size={28} className="text-black"/>
            </button>
         </div>
      </div>

      {/* --- CONTENIDO DINÁMICO --- */}
      <div className="flex-1 overflow-y-auto px-4 -mt-4 pt-8 pb-4 space-y-6 relative z-0">
        
        {/* VISTA 1: ENTRENAMIENTO */}
        {currentView === 'workout' && (
          <>
            <div className="flex justify-between items-end mb-1 px-1">
                <h2 className="text-xl font-bold text-white uppercase">Hoy</h2>
                <span className="text-xs text-yellow-400 font-bold uppercase">{date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</span>
            </div>

            <div className="space-y-4">
                {dailySession.length > 0 ? dailySession.map((ex, idx) => {
                  const planSets = parseInt(ex.sets) || 1;
                  const setsData = ex.actualSets || [];
                  const completedCount = setsData.filter(s => s && s.completed).length;
                  const isExerciseComplete = completedCount >= planSets;

                  return (
                    <div key={idx} className={`bg-zinc-900 border ${isExerciseComplete ? 'border-green-500/50' : 'border-zinc-800'} rounded-xl overflow-hidden transition-all`}>
                      {/* Header Ejercicio */}
                      <div className="p-4 bg-zinc-800/30 flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${isExerciseComplete ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                              {isExerciseComplete ? <CheckCircle size={16}/> : idx + 1}
                            </span>
                            <div>
                               <h3 className="font-bold text-white text-lg leading-tight">{ex.name}</h3>
                               <p className="text-zinc-500 text-xs mt-1">Meta: <span className="text-zinc-300">{ex.sets}x{ex.reps}</span> @ {ex.weight}</p>
                               {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 text-[10px] font-bold mt-1 hover:text-blue-300"><PlayCircle size={10}/> Ver técnica</a>}
                            </div>
                         </div>
                      </div>

                      {/* Tabla Series */}
                      <div className="p-3 space-y-2">
                        {Array.from({ length: planSets }).map((_, setIdx) => {
                          const currentSet = setsData[setIdx] || { reps: '', weight: '', completed: false };
                          return (
                            <div key={setIdx} className={`grid grid-cols-10 gap-2 items-center p-2 rounded-lg transition-colors ${currentSet.completed ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/20 border border-zinc-800'}`}>
                               <div className="col-span-1 text-center text-zinc-400 font-bold text-xs">{setIdx + 1}</div>
                               <div className="col-span-3"><input type="number" className={`w-full bg-zinc-950 border ${currentSet.completed ? 'border-green-500/30 text-green-400' : 'border-zinc-700 text-white'} rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400 transition-colors`} placeholder={ex.reps} value={currentSet.reps} onChange={(e) => handleUpdateSet(idx, setIdx, 'reps', e.target.value)} /></div>
                               <div className="col-span-3"><input type="text" className={`w-full bg-zinc-950 border ${currentSet.completed ? 'border-green-500/30 text-green-400' : 'border-zinc-700 text-white'} rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400 transition-colors`} placeholder={ex.weight} value={currentSet.weight} onChange={(e) => handleUpdateSet(idx, setIdx, 'weight', e.target.value)} /></div>
                               <div className="col-span-3 flex justify-center"><button onClick={() => toggleSetComplete(idx, setIdx)} className={`w-full py-1.5 rounded flex items-center justify-center gap-1 text-[10px] font-bold transition-all ${currentSet.completed ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>{currentSet.completed ? 'LISTO' : 'HECHO'}</button></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-12 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800"><Dumbbell className="w-8 h-8 text-zinc-700 mx-auto mb-2"/><p className="text-zinc-500 text-sm">Descanso.</p></div>
                )}
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mt-6">
               <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2 text-center">Navegar Agenda</p>
               <Calendar onChange={setDate} value={date} className="react-calendar-custom-mini" tileClassName={({ date }) => allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null} />
            </div>
          </>
        )}

        {/* VISTA 2: PERFIL */}
        {currentView === 'profile' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6 animate-in fade-in">
             <div className="text-center border-b border-zinc-800 pb-6">
                <div className="w-24 h-24 bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center text-zinc-500 border-2 border-zinc-700">
                  <User size={40}/>
                </div>
                <h2 className="text-xl font-bold text-white">{client.name}</h2>
                <p className="text-yellow-400 text-sm font-medium">{client.email || 'Sin email registrado'}</p>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-lg border border-zinc-800">
                   <span className="text-zinc-500 text-sm font-medium uppercase">Plan Actual</span>
                   <span className="text-white font-bold">{client.plan}</span>
                </div>
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-lg border border-zinc-800">
                   <span className="text-zinc-500 text-sm font-medium uppercase">Inicio</span>
                   <span className="text-white font-bold">{client.startDate || '-'}</span>
                </div>
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-lg border border-zinc-800">
                   <span className="text-zinc-500 text-sm font-medium uppercase">Estado</span>
                   <span className="text-green-500 font-bold uppercase text-xs border border-green-500/20 px-2 py-1 rounded bg-green-500/10">Activo</span>
                </div>
             </div>
          </div>
        )}

        {/* VISTA 3: CHAT */}
        {currentView === 'chat' && (
          <div className="flex flex-col h-[70vh] bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden animate-in fade-in">
             <div className="p-3 bg-zinc-950 border-b border-zinc-800 text-center">
                <p className="text-xs text-zinc-500 uppercase font-bold">Chat Directo</p>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">
               {messages.length === 0 && (
                 <div className="text-center mt-10 opacity-50">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 text-zinc-600"/>
                    <p className="text-zinc-500 text-xs">Escribe a tu entrenador.</p>
                 </div>
               )}
               {messages.map(msg => (
                 <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'student' 
                        ? 'bg-yellow-400 text-black rounded-tr-sm' 
                        : 'bg-zinc-800 text-white rounded-tl-sm'
                    }`}>
                       {msg.text}
                    </div>
                 </div>
               ))}
               <div ref={messagesEndRef} />
             </div>
             <form onSubmit={sendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2">
                <input 
                  type="text" 
                  placeholder="Escribe un mensaje..." 
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none transition-colors"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="bg-yellow-400 text-black p-3 rounded-full hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20">
                  <Send size={18}/>
                </button>
             </form>
          </div>
        )}

      </div>
    </div>
  );
}
