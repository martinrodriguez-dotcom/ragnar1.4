import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Dumbbell, CheckCircle, User, Menu, X, LogOut, MessageSquare, Send, 
  AlertTriangle, Trophy, CreditCard, ExternalLink, ChevronRight, Video, 
  Bell, Users, TrendingUp, Calendar as CalendarIcon, ChevronLeft, Timer, Clock
} from 'lucide-react';
import { doc, getDoc, collection, onSnapshot, setDoc, addDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase';
import CommunityView from './CommunityView';
import ProgressChart from '../components/ProgressChart';

export default function StudentView({ clientId }) {
  // --- ESTADOS GLOBALES ---
  const [client, setClient] = useState(null);
  const [trainerSettings, setTrainerSettings] = useState({ alias: '', plans: [] });
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE PAGO ---
  const [hasPaidMonth, setHasPaidMonth] = useState(true); 
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // --- ESTADOS DE INTERFAZ ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState('calendar'); 

  // --- ESTADOS DE CHAT ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // --- ESTADOS DE FALTAS ---
  const [missedWorkout, setMissedWorkout] = useState(null);
  const [missedReason, setMissedReason] = useState('');

  // --- ESTADOS DEL CRONÓMETRO ---
  const [restTime, setRestTime] = useState(90); 
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

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

  // --- EFECTO 1: CARGA DE DATOS Y LÓGICA DE DÍAS DE GRACIA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        let clientData = null;
        
        if (docSnap.exists()) {
          clientData = docSnap.data();
          setClient({ id: docSnap.id, ...clientData });
          if (clientData.preferredRestTime) {
            setRestTime(clientData.preferredRestTime);
          }
        }

        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          setTrainerSettings(settingsSnap.data());
        }

        // VERIFICACIÓN DE PAGO CON DÍAS DE GRACIA
        const paymentRef = doc(db, 'clients', clientId, 'payments', currentMonthId);
        const paymentSnap = await getDoc(paymentRef);
        let isPaid = paymentSnap.exists() && paymentSnap.data().status === 'paid';

        if (!isPaid && clientData?.startDate) {
          const today = new Date();
          // Aseguramos que la fecha se lea correctamente sin desfases de zona horaria
          const startDay = new Date(clientData.startDate + 'T12:00:00Z').getUTCDate(); 
          const grace = parseInt(clientData.graceDays || 0);
          
          // Calculamos la fecha límite (Día de cobro + Días de Gracia)
          const deadline = new Date(today.getFullYear(), today.getMonth(), startDay);
          deadline.setDate(deadline.getDate() + grace); 

          if (today <= deadline) {
            isPaid = true;
          }
        }

        setHasPaidMonth(isPaid);

        // Si la suscripción venció, lo enviamos directo al perfil para que vea los datos de pago
        if (!isPaid) {
          setCurrentView('profile');
          setShowPaymentModal(true);
        }

      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    };
    if (clientId) fetchData();
  }, [clientId, currentMonthId]);

  // --- EFECTO 2: CONTROL DE SESIONES PENDIENTES ---
  useEffect(() => {
    if (!client) return;
    const checkYesterday = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yId = formatDateId(yesterday);
      
      const docRef = doc(db, 'clients', client.id, 'sessions', yId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.isFinalized && !data.missedReason && data.exercises && data.exercises.length > 0) {
          setMissedWorkout({ 
            id: yId, 
            date: yesterday, 
            name: data.exercises[0]?.name || 'Entrenamiento' 
          });
        }
      }
    };
    checkYesterday();
  }, [client]);

  // --- EFECTO 3: SINCRONIZACIÓN DE RUTINAS ---
  useEffect(() => {
    if (!client || !hasPaidMonth) return;
    
    const unsubSessions = onSnapshot(collection(db, 'clients', client.id, 'sessions'), (snapshot) => {
      setAllSessionsIds(snapshot.docs.map(doc => doc.id));
    });
    
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubDaily = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailySession(docSnap.data().exercises || []);
        setIsSessionFinalized(docSnap.data().isFinalized || false);
      } else {
        setDailySession([]);
        setIsSessionFinalized(false);
      }
    });

    return () => { unsubSessions(); unsubDaily(); };
  }, [date, client, currentDateId, hasPaidMonth]);

  // --- EFECTO 4: CHAT EN TIEMPO REAL ---
  useEffect(() => {
    if (!client) return;
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setUnreadCount(msgs.filter(m => m.sender === 'trainer' && !m.read).length);
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

  // --- FUNCIONES DEL CRONÓMETRO ---
  const playTimerSound = () => {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
  };

  const startTimer = (seconds) => {
    const endTimestamp = Date.now() + seconds * 1000;
    setTimerEndTime(endTimestamp);
    setTimeLeft(seconds);
  };

  useEffect(() => {
    if (!timerEndTime) return;

    const interval = setInterval(() => {
      const current = Date.now();
      const remaining = Math.round((timerEndTime - current) / 1000);

      if (remaining <= 0) {
        clearInterval(interval);
        setTimerEndTime(null);
        setTimeLeft(0);
        playTimerSound();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEndTime]);

  const updatePreferredRest = async (val) => {
    const newRest = parseInt(val) || 0;
    setRestTime(newRest);
    try {
      await updateDoc(doc(db, 'clients', clientId), { preferredRestTime: newRest });
    } catch (e) { 
      console.error(e); 
    }
  };

  // --- FUNCIONES GENERALES ---
  const handleDateChange = (newDate) => {
    if (!hasPaidMonth) {
      setShowPaymentModal(true);
    } else {
      setDate(newDate);
      setCurrentView('workout'); 
    }
  };

  const submitMissedWorkout = async (e) => {
    e.preventDefault();
    if (!missedWorkout || !missedReason.trim()) return;

    try {
      await updateDoc(doc(db, 'clients', client.id, 'sessions', missedWorkout.id), { 
        missedReason: missedReason 
      });
      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'missed_workout', 
        clientId: client.id, 
        clientName: client.name, 
        date: missedWorkout.id, 
        reason: missedReason, 
        read: false, 
        createdAt: new Date()
      });
      await addDoc(collection(db, 'clients', client.id, 'messages'), {
        text: `Sistema: No pude entrenar ayer (${missedWorkout.date.toLocaleDateString()}). Motivo: ${missedReason}`, 
        sender: 'system', 
        createdAt: new Date(), 
        read: false
      });
      setMissedWorkout(null);
      setMissedReason('');
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleGoToPay = () => { 
    window.open(`https://www.mercadopago.com.ar/`, '_blank'); 
  };

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    const updatedSession = [...dailySession];
    const exercise = updatedSession[exerciseIndex];
    
    if (!exercise.actualSets) exercise.actualSets = [];
    if (!exercise.actualSets[setIndex]) exercise.actualSets[setIndex] = { reps: '', weight: '', completed: false };
    
    exercise.actualSets[setIndex][field] = value;
    
    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), { 
        date: currentDateId, exercises: updatedSession 
      }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    const currentStatus = dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
    
    if (!currentStatus && restTime > 0) {
      startTimer(restTime);
    }
  };

  const handleFinishWorkout = async () => {
    if (!window.confirm('¿Confirmas que has terminado el entrenamiento de hoy y compartir en el Salón?')) return;
    try {
      await updateDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), { 
        isFinalized: true, completedAt: new Date() 
      });
      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'workout_completed', 
        clientId: client.id, 
        clientName: client.name, 
        date: currentDateId, 
        read: false, 
        createdAt: new Date(), 
        performance: "Entrenamiento completado por el alumno"
      });
      await addDoc(collection(db, 'communityFeed'), {
        type: 'workout_completed', 
        userId: clientId, 
        userName: client.name, 
        workoutName: date.toLocaleDateString('es-ES', { weekday: 'long' }), 
        createdAt: new Date(), 
        reactions: { fire: [], power: [] }
      });
      setIsSessionFinalized(true);
      setTimerEndTime(null);
      setCurrentView('community');
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'clients', client.id, 'messages'), { 
        text: newMessage, sender: 'student', createdAt: new Date(), read: false 
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => { 
    await signOut(auth); 
    window.location.reload(); 
  };

  // --- RENDERIZADO INICIAL ---
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-x-hidden">
      
      {/* MODAL DE DEUDA DE PAGO CON DÍAS DE GRACIA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            
            <div className="mx-auto bg-red-500/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Acceso Bloqueado</h2>
            
            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
              Tu suscripción ha vencido. Por favor regulariza tu pago para desbloquear tus rutinas.
            </p>
            
            {client?.graceDays > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-6">
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                  Los {client.graceDays} días de gracia otorgados ya han expirado.
                </p>
              </div>
            )}
            
            <div className="bg-black/50 rounded-2xl p-5 mb-8 border border-zinc-800 text-left">
              <p className="text-[10px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Transferir al Alias:</p>
              <p className="text-lg font-mono font-bold text-yellow-400 break-all select-all">{trainerSettings.alias || 'COACH_SIN_ALIAS'}</p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handleGoToPay} 
                className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                Pagar Cuota <ExternalLink size={18}/>
              </button>
              <button 
                onClick={() => { 
                  setShowPaymentModal(false); 
                  setCurrentView('chat'); 
                }} 
                className="w-full text-zinc-500 font-bold text-xs uppercase tracking-widest py-2"
              >
                Informar Pago por Chat
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL FALTA INJUSTIFICADA */}
      {missedWorkout && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl">
            
            <div className="mx-auto bg-red-500/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Sesión Pendiente</h2>
            
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              No completaste tu entrenamiento del <span className="text-white font-bold">{missedWorkout.date.toLocaleDateString()}</span>. Justifica tu falta para continuar.
            </p>
            
            <form onSubmit={submitMissedWorkout} className="space-y-4">
              <textarea 
                required
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white text-sm focus:border-red-500 outline-none resize-none h-24"
                placeholder="Motivo de la falta..."
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
              />
              <button 
                type="submit" 
                className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                Enviar Justificación
              </button>
            </form>
            
          </div>
        </div>
      )}

      {/* MENÚ LATERAL MÓVIL */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-6 animate-in slide-in-from-right">
          
          <div className="flex justify-end mb-10">
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-full">
              <X size={32}/>
            </button>
          </div>
          
          <div className="flex flex-col gap-6 text-2xl font-black uppercase italic">
            
            <button 
              disabled={!hasPaidMonth}
              onClick={() => { setCurrentView('calendar'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (['calendar', 'workout'].includes(currentView) ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Mi Agenda {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            <button 
              disabled={!hasPaidMonth}
              onClick={() => { setCurrentView('stats'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'stats' ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Mi Estadística {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            <button 
              disabled={!hasPaidMonth}
              onClick={() => { setCurrentView('community'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'community' ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Salón Ragnar {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            {/* El chat y perfil siempre disponibles aunque deba */}
            <button 
              onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-4 ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-600'}`}
            >
              Chat Directo 
              {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full not-italic font-sans">{unreadCount}</span>}
            </button>
            
            <button 
              onClick={() => { setCurrentView('profile'); setIsMenuOpen(false); }} 
              className={`text-left ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-600'}`}
            >
              Mi Perfil & Pago
            </button>
            
            <div className="h-px bg-zinc-800 my-4"></div>
            
            <button onClick={handleLogout} className="text-left text-red-500 flex items-center gap-3">
              <LogOut/> Salir
            </button>
            
          </div>
        </div>
      )}

      {/* HEADER DE BIENVENIDA */}
      <div className="bg-yellow-400 text-black p-4 pb-10 rounded-b-[3rem] shadow-xl relative z-10 shrink-0">
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-yellow-400 shadow-lg">
                 <User size={24}/>
               </div>
               <div>
                 <h1 className="text-xl font-black uppercase leading-none tracking-tighter">
                   {client?.name || 'Atleta'}
                 </h1>
                 <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">
                   Socio Ragnar
                 </p>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
               <button onClick={() => setCurrentView('chat')} className="relative p-2 bg-black/5 rounded-lg">
                 <Bell size={24}/>
                 {unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
               </button>
               <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-black/5 rounded-lg">
                 <Menu size={28}/>
               </button>
            </div>
            
          </div>
      </div>

      {/* CONTENIDO PRINCIPAL DINÁMICO */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 -mt-6 pb-40 relative z-20 flex flex-col">
        
        {/* --- VISTA: CALENDARIO --- */}
        {currentView === 'calendar' && hasPaidMonth && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
               <div className="flex items-center gap-2 mb-6">
                 <CalendarIcon size={20} className="text-yellow-400"/>
                 <h3 className="text-lg font-black uppercase tracking-widest text-white italic">Planificación</h3>
               </div>
               <Calendar 
                 onChange={handleDateChange} 
                 value={date} 
                 className="react-calendar-custom" 
                 tileClassName={({ date: tDate }) => allSessionsIds.includes(formatDateId(tDate)) ? 'has-workout' : null} 
               />
            </div>
          </div>
        )}

        {/* --- VISTA: ENTRENAMIENTO --- */}
        {currentView === 'workout' && hasPaidMonth && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-10">
            
            <div className="flex items-center gap-4 px-2 mb-2">
                <button 
                  onClick={() => setCurrentView('calendar')} 
                  className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-white hover:text-yellow-400 hover:border-yellow-400 transition-colors shadow-lg"
                >
                  <ChevronLeft size={24}/>
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                    {isSessionFinalized ? 'Resumen' : 'Entrenar'}
                  </h2>
                  <p className="text-yellow-400 font-bold text-[10px] uppercase mt-1 tracking-widest">
                    {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
            </div>

            {!isSessionFinalized && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-zinc-500" />
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Timer Descanso:</span>
                </div>
                <div className="flex items-center gap-2 bg-black px-3 py-1 rounded-xl border border-zinc-800">
                   <input 
                     type="number" 
                     className="bg-transparent text-yellow-400 font-black w-10 text-center outline-none" 
                     value={restTime} 
                     onChange={(e) => updatePreferredRest(e.target.value)} 
                   />
                   <span className="text-[10px] font-black text-zinc-600">seg</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
                {dailySession.length > 0 ? (
                  dailySession.map((ex, exIdx) => (
                    <div key={exIdx} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-black">
                            {exIdx + 1}
                          </div>
                          <h3 className="font-bold text-lg uppercase tracking-tight text-white">{ex.name}</h3>
                        </div>
                        {ex.videoUrl && (
                          <a 
                            href={ex.videoUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors"
                          >
                            <Video size={20}/>
                          </a>
                        )}
                      </div>

                      {ex.rir && (
                        <div className="mb-4 bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                          <div className="flex justify-between items-center mb-1.5">
                             <span className="text-[10px] text-zinc-500 font-black uppercase">Intensidad</span>
                             <span className="text-[10px] text-black font-black bg-yellow-400 px-2 py-0.5 rounded">RIR {ex.rir}</span>
                          </div>
                          <div className="flex gap-1 h-2.5">
                             {[5, 4, 3, 2, 1, 0].map((val, i) => (
                                <div key={val} className={`flex-1 rounded-full ${val >= parseInt(ex.rir) ? rirColors[i] : 'bg-zinc-800'}`}></div>
                             ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2 mb-2 px-2 text-[9px] uppercase font-black text-zinc-500 text-center">
                        <span>Set</span>
                        <span>Meta</span>
                        <span>Reps</span>
                        <span>Kg</span>
                      </div>
                      
                      <div className="space-y-2">
                        {[...Array(parseInt(ex.sets || 0))].map((_, sIdx) => {
                          const isDone = dailySession[exIdx].actualSets?.[sIdx]?.completed;
                          return (
                            <div key={sIdx} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-2xl transition-colors ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/30 border border-zinc-800/50'}`}>
                              <span className="font-bold text-sm ml-2 text-white"># {sIdx + 1}</span>
                              <span className="text-center text-xs text-zinc-400">{ex.reps}</span>
                              <input 
                                type="number" 
                                placeholder="0" 
                                disabled={isSessionFinalized} 
                                className="bg-zinc-800 border-none rounded-lg py-1 text-center text-sm font-bold text-white focus:ring-1 focus:ring-yellow-400 disabled:opacity-50" 
                                value={dailySession[exIdx].actualSets?.[sIdx]?.reps || ''} 
                                onChange={(e) => handleUpdateSet(exIdx, sIdx, 'reps', e.target.value)} 
                              />
                              <input 
                                type="number" 
                                placeholder="kg" 
                                disabled={isSessionFinalized} 
                                className="bg-zinc-800 border-none rounded-lg py-1 text-center text-sm font-bold text-white focus:ring-1 focus:ring-yellow-400 disabled:opacity-50" 
                                value={dailySession[exIdx].actualSets?.[sIdx]?.weight || ''} 
                                onChange={(e) => handleUpdateSet(exIdx, sIdx, 'weight', e.target.value)} 
                              />
                              <button 
                                onClick={() => toggleSetComplete(exIdx, sIdx)} 
                                className={`col-span-4 mt-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDone ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                              >
                                {isDone ? <><CheckCircle size={14}/> Completada</> : 'Marcar Hecha'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800 flex flex-col items-center">
                    <Dumbbell className="w-12 h-12 text-zinc-800 mb-4 opacity-30"/>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Sin rutina para hoy</p>
                  </div>
                )}
            </div>
            
            {dailySession.length > 0 && !isSessionFinalized && (
              <button 
                onClick={handleFinishWorkout} 
                className="w-full bg-green-500 text-black font-black py-5 mt-6 rounded-[2rem] uppercase tracking-widest shadow-lg shadow-green-500/10 transition-transform active:scale-95"
              >
                <Trophy size={20} className="inline mr-2"/> Finalizar Sesión
              </button>
            )}
          </div>
        )}

        {/* --- VISTA: SALÓN RAGNAR --- */}
        {currentView === 'community' && hasPaidMonth && (
          <CommunityView currentUserId={clientId} userName={client?.name} />
        )}

        {/* --- VISTA: ESTADÍSTICAS --- */}
        {currentView === 'stats' && hasPaidMonth && (
          <div className="space-y-6 animate-in fade-in">
            <ProgressChart clientId={client?.id} />
          </div>
        )}

        {/* --- VISTA: CHAT (SIEMPRE DISPONIBLE) --- */}
        {currentView === 'chat' && (
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 flex flex-col h-[65vh] shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-3">
              <MessageSquare className="text-yellow-400" size={24}/>
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">Canal Directo</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                  <MessageSquare size={48} className="mb-4" />
                  <p>Mándale un mensaje a tu entrenador.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.sender === 'student' ? 'bg-yellow-400 text-black rounded-tr-none' : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'}`}>
                      {msg.text}
                      <span className="block text-[9px] opacity-60 mt-2 text-right">
                        {msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2">
              <input 
                type="text" 
                placeholder="Tu mensaje..." 
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 outline-none text-sm" 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()} 
                className="bg-yellow-400 disabled:opacity-50 text-black p-3 rounded-xl transition-colors"
              >
                <Send size={20}/>
              </button>
            </form>
          </div>
        )}

        {/* --- VISTA: PERFIL --- */}
        {currentView === 'profile' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-zinc-900 rounded-[2rem] p-8 border border-zinc-800 text-center">
               <div className="w-20 h-20 bg-yellow-400 rounded-2xl mx-auto mb-4 flex items-center justify-center text-black shadow-lg">
                 <User size={40}/>
               </div>
               <h2 className="text-2xl font-black uppercase text-white">{client?.name}</h2>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">{client?.email}</p>
             </div>
             
             <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 shadow-xl">
               <h3 className="text-white font-bold uppercase mb-6 flex items-center gap-2">
                 <CreditCard size={20} className="text-yellow-400"/> Suscripción
               </h3>
               
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-black/40 p-5 rounded-2xl border border-zinc-800">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-black">Estado</p>
                      <p className="font-bold text-lg uppercase text-white">{date.toLocaleString('es-ES', { month: 'long' })}</p>
                    </div>
                    <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase ${hasPaidMonth ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                      {hasPaidMonth ? 'Activo' : 'Vencido'}
                    </span>
                  </div>
                  
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Alias de Pago:</p>
                    <p className="font-mono font-bold text-yellow-400 text-lg select-all">
                      {trainerSettings.alias || 'SIN_ALIAS'}
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleGoToPay} 
                    className="w-full bg-yellow-400 text-black font-black py-5 rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    Ir a Mercado Pago <ExternalLink size={20}/>
                  </button>
               </div>
             </div>
             
             <button 
               onClick={handleLogout} 
               className="w-full py-4 text-zinc-600 hover:text-red-500 font-bold uppercase text-[10px] tracking-[0.3em] transition-colors"
             >
               Cerrar Sesión
             </button>
          </div>
        )}
      </main>

      {/* --- CRONÓMETRO FLOTANTE --- */}
      {timerEndTime && (
        <div className="fixed bottom-24 left-4 right-4 bg-zinc-900 border border-yellow-400/50 rounded-2xl p-4 shadow-2xl z-[60] flex items-center justify-between animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-4">
            <Timer size={28} className="text-yellow-400 animate-pulse" />
            <div>
              <p className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Descanso...</p>
              <p className="text-3xl font-black text-white leading-none">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setTimerEndTime(null)} 
            className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <X size={20}/>
          </button>
        </div>
      )}

      {/* --- NAV BAR INFERIOR --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 p-2 pb-6 flex justify-between items-center z-[40]">
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('calendar')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/5 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (['calendar', 'workout'].includes(currentView) ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <CalendarIcon size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Agenda</span>
        </button>
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('community')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/5 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'community' ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <Users size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Salón</span>
        </button>
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('stats')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/5 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'stats' ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <TrendingUp size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Progreso</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('chat')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/5 relative transition-colors ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-500'}`}
        >
          <MessageSquare size={20}/>
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-black"></span>}
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Chat</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('profile')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/5 transition-colors ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-500'}`}
        >
          <User size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Perfil</span>
        </button>
        
      </nav>

    </div>
  );
}
