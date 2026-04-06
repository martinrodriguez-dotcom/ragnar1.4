import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCircle, Trash2, AlertTriangle, User, 
  Check, Calendar, Users, TrendingUp, TrendingDown, CreditCard, DollarSign
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('unread'); // 'unread' | 'read' | 'all'
  const [stats, setStats] = useState({ assigned: 0, completed: 0 });

  const todayId = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Escuchar todas las notificaciones ordenadas por fecha de creación
    const q = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Calcular estadísticas diarias (Rutinas asignadas hoy vs Rutinas finalizadas hoy)
    const fetchDailyStats = async () => {
      try {
        const clientsSnap = await getDocs(collection(db, 'clients'));
        let assignedCount = 0;
        let completedCount = 0;
        
        for (const clientDoc of clientsSnap.docs) {
          const sessionSnap = await getDocs(query(collection(db, 'clients', clientDoc.id, 'sessions'), where('date', '==', todayId)));
          if (!sessionSnap.empty) {
            const data = sessionSnap.docs[0].data();
            if (data.exercises && data.exercises.length > 0) {
              assignedCount++;
              if (data.isFinalized) completedCount++;
            }
          }
        }
        setStats({ assigned: assignedCount, completed: completedCount });
      } catch (e) { 
        console.error("Error al cargar estadísticas diarias:", e); 
      }
    };

    fetchDailyStats();
    return () => unsubscribe();
  }, [todayId]);

  // --- ACCIONES ---
  const markAsRead = async (id) => { 
    try { 
      await updateDoc(doc(db, 'trainerNotifications', id), { read: true }); 
    } catch (e) {
      console.error(e);
    } 
  };

  const deleteNotification = async (id) => { 
    if(window.confirm('¿Estás seguro de eliminar esta alerta del historial?')) {
      try {
        await deleteDoc(doc(db, 'trainerNotifications', id)); 
      } catch(e) {
        console.error(e);
      }
    } 
  };

  // --- FILTRADO ---
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'read') return n.read;
    return true; // 'all'
  });

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER Y TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Notificaciones</h2>
          <p className="text-zinc-500 text-sm">Control de actividad y vencimientos de cobros.</p>
        </div>
        
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('unread')} 
            className={`flex-1 md:px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'unread' ? 'bg-yellow-400 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Pendientes ({notifications.filter(n => !n.read).length})
          </button>
          <button 
            onClick={() => setActiveTab('read')} 
            className={`flex-1 md:px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'read' ? 'bg-yellow-400 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Historial
          </button>
          <button 
            onClick={() => setActiveTab('all')} 
            className={`flex-1 md:px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'all' ? 'bg-yellow-400 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Todas
          </button>
        </div>
      </div>

      {/* DASHBOARD RÁPIDO SUPERIOR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="bg-green-500/10 p-3 rounded-xl text-green-500"><TrendingUp size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Rutinas Hoy</p>
            <p className="text-2xl font-black text-white">{stats.completed} / {stats.assigned}</p>
          </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="bg-red-500/10 p-3 rounded-xl text-red-500"><AlertTriangle size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Cuotas Vencidas</p>
            <p className="text-2xl font-black text-white">
              {notifications.filter(n => n.type === 'payment_expired' && !n.read).length}
            </p>
          </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400"><DollarSign size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Próximos Cobros</p>
            <p className="text-2xl font-black text-white">
              {notifications.filter(n => n.type === 'payment_warning' && !n.read).length}
            </p>
          </div>
        </div>
      </div>

      {/* LISTADO DE NOTIFICACIONES */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
            <Bell className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20"/>
            <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm">Bandeja Vacía</p>
          </div>
        ) : (
          filteredNotifications.map(n => {
            // Clasificación del tipo de notificación para los colores y estilos
            const isExpired = n.type === 'payment_expired';
            const isWarning = n.type === 'payment_warning';
            const isWorkoutCompleted = n.type === 'workout_completed';
            const isMissedWorkout = n.type === 'missed_workout';

            return (
              <div 
                key={n.id} 
                className={`relative overflow-hidden bg-zinc-900 border p-5 rounded-2xl flex gap-5 transition-all ${
                  n.read ? 'border-zinc-800 opacity-60' : 'border-zinc-700 shadow-xl'
                }`}
              >
                {/* Barra lateral de color */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  isExpired || isMissedWorkout ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-green-500'
                }`}></div>
                
                {/* Ícono de la Notificación */}
                <div className={`p-4 rounded-2xl h-fit ${
                  isExpired || isMissedWorkout ? 'bg-red-500/10 text-red-500' : 
                  isWarning ? 'bg-yellow-400/10 text-yellow-400' : 
                  'bg-green-500/10 text-green-500'
                }`}>
                   {isExpired || isWarning ? <CreditCard size={24}/> : 
                    isMissedWorkout ? <TrendingDown size={24}/> : 
                    <CheckCircle size={24}/>}
                </div>
                
                {/* Cuerpo de la Notificación */}
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-white text-lg uppercase leading-none">{n.clientName}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-widest">
                          {n.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                      
                      {/* Botones de acción */}
                      <div className="flex gap-2">
                        {!n.read && (
                          <button 
                            onClick={() => markAsRead(n.id)} 
                            className="p-2 bg-zinc-800 text-zinc-400 hover:text-green-500 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Marcar como leída"
                          >
                            <Check size={18}/>
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(n.id)} 
                          className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Eliminar notificación"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                   </div>

                   {/* Mensaje o Descripción */}
                   <div className="mt-3 bg-black/40 p-4 rounded-xl border border-zinc-800/50">
                      <p className={`text-sm font-bold ${
                        isExpired ? 'text-red-400' : 
                        isWarning ? 'text-yellow-400' : 
                        isMissedWorkout ? 'text-red-400' : 
                        'text-green-400'
                      }`}>
                        {n.message || (isWorkoutCompleted ? 'ENTRENAMIENTO FINALIZADO' : 'NO ENTRENÓ')}
                      </p>
                      
                      {/* Sub-detalles como el rendimiento del alumno o la excusa por faltar */}
                      {n.performance && <p className="text-zinc-300 text-sm mt-2 italic font-medium">"{n.performance}"</p>}
                      {n.reason && <p className="text-zinc-300 text-sm mt-2 italic font-medium">Motivo: "{n.reason}"</p>}
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
