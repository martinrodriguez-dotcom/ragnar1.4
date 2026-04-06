import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Dumbbell, CheckCircle, User, Menu, X, LogOut, MessageSquare, Send, 
  AlertTriangle, Trophy, CreditCard, ExternalLink, ChevronRight, Video, Bell
} from 'lucide-react';
import { doc, getDoc, collection, onSnapshot, setDoc, addDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase';

export default function StudentView({ clientId }) {
  const [client, setClient] = useState(null);
  const [trainerSettings, setTrainerSettings] = useState({ alias: '', plans: [] });
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [hasPaidMonth, setHasPaidMonth] = useState(true); 
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState('workout'); 

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // Array de colores RIR
  const rirColors = ['bg-[#ffe4c4]', 'bg-[#fcd34d]', 'bg-[#fbbf24]', 'bg-[#f97316]', 'bg-[#ef4444]', 'bg-[#b91c1c]'];

  const auth = getAuth();
  
  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentDateId = formatDateId(date);
  const currentMonthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setClient({ id: docSnap.id, ...docSnap.data() });

        const settingsRef = doc(db, 'settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) setTrainerSettings(settingsSnap.data());

        const paymentRef = doc(db, 'clients', clientId, 'payments', currentMonthId);
        const paymentSnap = await getDoc(paymentRef);
        setHasPaidMonth(paymentSnap.exists() && paymentSnap.data().status === 'paid');

      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    if (clientId) fetchData();
  }, [clientId, currentMonthId]);

  useEffect(() => {
    if (!client) return;
    const unsubSessions = onSnapshot(collection(db, 'clients', client.id, 'sessions'), (snapshot) => {
      setAllSessionsIds(snapshot.docs.map(doc => doc.id));
    });
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubDaily = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailySession(data.exercises || []);
        setIsSessionFinalized(data.isFinalized || false);
      } else {
        setDailySession([]);
        setIsSessionFinalized(false);
      }
    });
    return () => { unsubSessions(); unsubDaily(); };
  }, [date, client, currentDateId]);

  useEffect(() => {
    if (!client) return;
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      const unread = msgs.filter(m => m.sender === 'trainer' && !m.read).length;
      setUnreadCount(unread);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [client]);

  useEffect(() => {
    if (currentView === 'chat' && unreadCount > 0 && client) {
      messages.forEach(async (msg) => {
        if (msg.sender === 'trainer' && !msg.read) {
          await updateDoc(doc(db, 'clients', client.id, 'messages', msg.id), { read: true });
        }
      });
    }
  }, [currentView, messages, unreadCount, client]);

  const handleDateChange = (newDate) => {
    if (!hasPaidMonth) setShowPaymentModal(true);
    else setDate(newDate);
  };

  const handleGoToPay = () => { window.open(`https://www.mercadopago.com.ar/`, '_blank'); };

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    const updatedSession = [...dailySession];
    const exercise = updatedSession[exerciseIndex];
    if (!exercise.actualSets) exercise.actualSets = [];
    if (!exercise.actualSets[setIndex]) exercise.actualSets[setIndex] = { reps: '', weight: '', completed: false };
    exercise.actualSets[setIndex][field] = value;
    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), { date: currentDateId, exercises: updatedSession }, { merge: true });
    } catch (error) { console.error(error); }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    const currentStatus = dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
  };

  const handleFinishWorkout = async () => {
    if (!window.confirm('¿Confirmas que has terminado el entrenamiento de hoy?')) return;
    try {
      await updateDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), { isFinalized: true, completedAt: new Date() });
      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'workout_completed', clientId, clientName: client.name, date: currentDateId, read: false, createdAt: new Date(), performance: "Entrenamiento completado por el alumno"
      });
      setIsSessionFinalized(true);
    } catch (error) { console.error(error); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'clients', client.id, 'messages'), { text: newMessage, sender: 'student', createdAt: new Date(), read: false });
      setNewMessage('');
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => { await signOut(auth); window.location.reload(); };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-x-hidden">
      
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="mx-auto bg-red-500/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mb-6"><AlertTriangle className="w-10 h-10 text-red-500" /></div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Deuda del Mes</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Tu acceso está limitado. Para ver rutinas y navegar el calendario, regulariza el pago de <span className="text-white font-bold"> {date.toLocaleString('es-ES', { month: 'long' })}</span>.</p>
            <div className="bg-black/50 rounded-2xl p-5 mb-8 border border-zinc-800 text-left">
              <p className="text-[10px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Alias Mercado Pago:</p>
              <p className="text-lg font-mono font-bold text-yellow-400 break-all select-all">{trainerSettings.alias || 'COACH_SIN_ALIAS'}</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleGoToPay} className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest flex items-center justify-center gap-2">Ir a Pagar <ExternalLink size={18}/></button>
              <button onClick={() => setShowPaymentModal(false)} className="w-full text-zinc-500 font-bold text-xs uppercase tracking-widest py-2">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-6 animate-in slide-in-from-right">
          <div className="flex justify-end mb-10"><button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-full"><X size={32}/></button></div>
          <div className="flex flex-col gap-6 text-2xl font-black uppercase italic">
            <button onClick={() => { setCurrentView('workout'); setIsMenuOpen(false); }} className={`text-left ${currentView === 'workout' ? 'text-yellow-400' : 'text-zinc-600'}`}>Mi Entrenamiento</button>
            <button onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }} className={`text-left flex items-center gap-4 ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-600'}`}>Chat Directo {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full not-italic font-sans">{unreadCount}</span>}</button>
            <button onClick={() => { setCurrentView('profile'); setIsMenuOpen(false); }} className={`text-left ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-600'}`}>Mi Perfil & Pago</button>
            <div className="h-px bg-zinc-800 my-4"></div>
            <button onClick={handleLogout} className="text-left text-red-500 flex items-center gap-3"><LogOut/> Salir</button>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="bg-yellow-400 text-black p-4 pb-10 rounded-b-[3rem] shadow-xl relative z-10">
         <div className="flex justify-between items-center max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-yellow-400 shadow-lg"><User size={24}/></div>
               <div><h1 className="text-xl font-black uppercase leading-none tracking-tighter">{client?.name}</h1><p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">Atleta Ragnar</p></div>
            </div>
            
            <div className="flex items-center gap-2">
               <button onClick={() => setCurrentView('chat')} className="relative p-2 bg-black/5 rounded-lg text-black">
                 <Bell size={24}/>
                 {unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-yellow-400"></span>}
               </button>
               <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-black/5 rounded-lg"><Menu size={28}/></button>
            </div>
         </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 -mt-6 pb-28 relative z-20">
        
        {currentView === 'workout' && (
          <div className="space-y-6">
            {!hasPaidMonth && (
              <div onClick={() => setShowPaymentModal(true)} className="bg-red-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-red-600/20 animate-pulse cursor-pointer">
                <div className="flex items-center gap-3"><AlertTriangle size={20}/><span className="font-black uppercase text-xs">Pago pendiente: {date.toLocaleString('es-ES', { month: 'long' })}</span></div><ChevronRight size={20}/>
              </div>
            )}
            <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">{isSessionFinalized ? 'Resumen' : 'Entrenamiento'}</h2>
                <div className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800"><span className="text-[10px] text-yellow-400 font-black uppercase">{date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</span></div>
            </div>
            <div className={`space-y-4 ${!hasPaidMonth ? 'opacity-20 pointer-events-none' : ''}`}>
                {dailySession.length > 0 ? (
                  dailySession.map((ex, exIdx) => (
                    <div key={exIdx} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-black">{exIdx + 1}</div><h3 className="font-bold text-lg uppercase tracking-tight leading-none">{ex.name}</h3></div>
                        {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><Video size={20}/></a>}
                      </div>

                      {/* --- NUEVO: BARRA RIR PARA EL ALUMNO --- */}
                      {ex.rir && (
                        <div className="mb-4 bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                          <div className="flex justify-between items-center mb-1.5">
                             <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Intensidad Percibida</span>
                             <span className="text-[10px] text-black font-black bg-yellow-400 px-2 py-0.5 rounded">RIR {ex.rir}</span>
                          </div>
                          <div className="flex gap-1 h-2.5">
                             {[5, 4, 3, 2, 1, 0].map((val, i) => (
                                <div key={val} className={`flex-1 rounded-full transition-colors ${val >= parseInt(ex.rir) ? rirColors[i] : 'bg-zinc-800'}`}></div>
                             ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2 mb-2 px-2"><span className="text-[9px] uppercase font-black text-zinc-500">Serie</span><span className="text-[9px] uppercase font-black text-zinc-500 text-center">Objetivo</span><span className="text-[9px] uppercase font-black text-zinc-500 text-center">Reps</span><span className="text-[9px] uppercase font-black text-zinc-500 text-center">Peso</span></div>
                      <div className="space-y-2">
                        {[...Array(parseInt(ex.sets || 0))].map((_, sIdx) => {
                          const isDone = dailySession[exIdx].actualSets?.[sIdx]?.completed;
                          return (
                            <div key={sIdx} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-2xl transition-colors ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/30 border border-zinc-800/50'}`}>
                              <span className="font-bold text-sm ml-2"># {sIdx + 1}</span><span className="text-center text-xs text-zinc-400">{ex.reps}</span>
                              <input type="number" placeholder="0" disabled={isSessionFinalized} className="bg-zinc-800 border-none rounded-lg py-1 text-center text-sm font-bold focus:ring-1 focus:ring-yellow-400" value={dailySession[exIdx].actualSets?.[sIdx]?.reps || ''} onChange={(e) => handleUpdateSet(exIdx, sIdx, 'reps', e.target.value)} />
                              <input type="number" placeholder="kg" disabled={isSessionFinalized} className="bg-zinc-800 border-none rounded-lg py-1 text-center text-sm font-bold focus:ring-1 focus:ring-yellow-400" value={dailySession[exIdx].actualSets?.[sIdx]?.weight || ''} onChange={(e) => handleUpdateSet(exIdx, sIdx, 'weight', e.target.value)} />
                              <button onClick={() => toggleSetComplete(exIdx, sIdx)} className={`col-span-4 mt-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDone ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{isDone ? <><CheckCircle size={12}/> Completada</> : 'Marcar Completada'}</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800"><Dumbbell className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20"/><p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Descanso o sin rutina</p></div>
                )}
            </div>
            {dailySession.length > 0 && !isSessionFinalized && hasPaidMonth && (
              <button onClick={handleFinishWorkout} className="w-full bg-green-500 text-black font-black py-5 rounded-[2rem] uppercase tracking-widest shadow-xl shadow-green-500/10 active:scale-95 transition-transform">Finalizar Entrenamiento</button>
            )}
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6">
               <div className="flex items-center gap-2 mb-4"><Calendar size={18} className="text-yellow-400"/><h3 className="text-sm font-black uppercase tracking-widest">Historial</h3></div>
               <Calendar onChange={handleDateChange} value={date} className="react-calendar-custom-mini" tileClassName={({ date }) => allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null} />
            </div>
          </div>
        )}

        {currentView === 'chat' && (
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 flex flex-col h-[65vh] shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <MessageSquare className="text-yellow-400" size={24}/>
                <h3 className="text-white font-bold uppercase tracking-widest text-sm">Chat con Coach</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50"><MessageSquare size={48} className="mb-4" /><p>Mándale un mensaje a tu entrenador.</p></div>
              ) : (
                messages.map(msg => {
                  const isStudent = msg.sender === 'student';
                  return (
                    <div key={msg.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${isStudent ? 'bg-yellow-400 text-black rounded-tr-none' : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'}`}>
                        {msg.text}
                        <span className="block text-[10px] opacity-60 mt-2 text-right">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2 shrink-0">
              <input type="text" placeholder="Escribe aquí..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 outline-none text-sm" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
              <button type="submit" disabled={!newMessage.trim()} className="bg-yellow-400 disabled:opacity-50 text-black p-3 rounded-xl"><Send size={20}/></button>
            </form>
          </div>
        )}

        {currentView === 'profile' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-zinc-900 rounded-[2rem] p-8 border border-zinc-800 text-center"><div className="w-24 h-24 bg-yellow-400 rounded-3xl mx-auto mb-4 flex items-center justify-center text-black shadow-2xl rotate-3"><User size={48}/></div><h2 className="text-2xl font-black uppercase">{client.name}</h2><p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{client.email}</p></div>
             <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800">
               <h3 className="text-white font-bold uppercase mb-6 flex items-center gap-2 tracking-tighter"><CreditCard size={20} className="text-yellow-400"/> Mi Suscripción</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-black/40 p-5 rounded-2xl border border-zinc-800">
                    <div><p className="text-[10px] text-zinc-500 uppercase font-black">Mes Actual</p><p className="font-bold text-lg uppercase">{date.toLocaleString('es-ES', { month: 'long' })}</p></div>
                    <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest ${hasPaidMonth ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>{hasPaidMonth ? 'Al Día' : 'Pendiente'}</span>
                  </div>
                  {!hasPaidMonth && <div className="bg-yellow-400/5 border border-yellow-400/20 p-5 rounded-2xl"><p className="text-xs text-yellow-400/80 font-medium leading-relaxed">Para informar tu pago, realiza la transferencia al alias indicado abajo y envía el comprobante a tu entrenador por el Chat.</p></div>}
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800"><p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Datos de Transferencia:</p><p className="font-mono font-bold text-yellow-400 text-lg select-all cursor-pointer">{trainerSettings.alias || 'SIN_ALIAS'}</p></div>
                  <button onClick={handleGoToPay} className="w-full bg-yellow-400 text-black font-black py-5 rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">Ir a Mercado Pago <ExternalLink size={20}/></button>
               </div>
             </div>
             <button onClick={handleLogout} className="w-full py-4 text-zinc-600 font-bold uppercase text-xs tracking-[0.3em]">Cerrar Sesión</button>
          </div>
        )}
      </main>

      {/* NAV BAR INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 p-4 pb-8 flex justify-around items-center z-[40]">
        <button onClick={() => setCurrentView('workout')} className={`flex flex-col items-center gap-1 w-1/3 ${currentView === 'workout' ? 'text-yellow-400' : 'text-zinc-600'}`}>
          <Dumbbell size={24}/>
          <span className="text-[9px] font-black uppercase tracking-widest">Rutina</span>
        </button>
        <button onClick={() => setCurrentView('chat')} className={`flex flex-col items-center gap-1 w-1/3 relative ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-600'}`}>
          <div className="relative">
            <MessageSquare size={24}/>
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-black"></span>}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
        </button>
        <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 w-1/3 ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-600'}`}>
          <User size={24}/>
          <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
        </button>
      </nav>

    </div>
  );
}
