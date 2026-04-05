import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCircle, Trash2, AlertTriangle, User, 
  Filter, Check, Calendar, Users, TrendingUp, TrendingDown 
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('unread'); // 'all', 'unread', 'read'
  const [stats, setStats] = useState({ assigned: 0, completed: 0 });

  const todayId = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // 1. ESCUCHAR NOTIFICACIONES
    const q = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. CALCULAR RESUMEN DEL DÍA (Asignados vs Completados)
    const fetchDailyStats = async () => {
      try {
        const clientsSnap = await getDocs(collection(db, 'clients'));
        let assignedCount = 0;
        let completedCount = 0;

        for (const clientDoc of clientsSnap.docs) {
          const sessionRef = doc(db, 'clients', clientDoc.id, 'sessions', todayId);
          const sessionSnap = await getDocs(query(collection(db, 'clients', clientDoc.id, 'sessions'), where('date', '==', todayId)));
          
          if (!sessionSnap.empty) {
            const sessionData = sessionSnap.docs[0].data();
            if (sessionData.exercises && sessionData.exercises.length > 0) {
              assignedCount++;
              if (sessionData.isFinalized) completedCount++;
            }
          }
        }
        setStats({ assigned: assignedCount, completed: completedCount });
      } catch (e) { console.error(e); }
    };

    fetchDailyStats();
    return () => unsubscribe();
  }, [todayId]);

  // --- ACCIONES ---

  const markAsRead = async (id) => {
    try { await updateDoc(doc(db, 'trainerNotifications', id), { read: true }); } catch (e) {}
  };

  const deleteNotification = async (id) => {
    if(window.confirm('¿Eliminar esta alerta?')) {
      try { await deleteDoc(doc(db, 'trainerNotifications', id)); } catch (e) {}
    }
  };

  // --- FILTRADO ---
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'read') return n.read;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER Y TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Notificaciones</h2>
          <p className="text-zinc-500 text-sm">Seguimiento en tiempo real de tus atletas.</p>
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

      {/* PANEL DE RESUMEN DIARIO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-xl text-blue-500"><Users size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Asignados Hoy</p>
            <p className="text-2xl font-black text-white">{stats.assigned} Alumnos</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="bg-green-500/10 p-3 rounded-xl text-green-500"><CheckCircle size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Completados</p>
            <p className="text-2xl font-black text-white">{stats.completed} / {stats.assigned}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400"><TrendingUp size={24}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Efectividad</p>
            <p className="text-2xl font-black text-white">
              {stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* LISTADO DE NOTIFICACIONES */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
            <Bell className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20"/>
            <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm">Sin notificaciones en esta sección</p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const isMissed = notif.type === 'missed_workout';
            const isCompleted = notif.type === 'workout_completed';
            
            return (
              <div 
                key={notif.id} 
                className={`group relative overflow-hidden bg-zinc-900 border transition-all p-5 rounded-2xl flex gap-5 ${
                  notif.read ? 'border-zinc-800 opacity-60' : 'border-zinc-700 shadow-xl'
                }`}
              >
                {/* Indicador lateral de estado */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isMissed ? 'bg-red-500' : 'bg-green-500'}`}></div>

                {/* Icono Principal */}
                <div className={`p-4 rounded-2xl h-fit ${
                  isMissed ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                }`}>
                   {isMissed ? <AlertTriangle size={24}/> : <CheckCircle size={24}/>}
                </div>
                
                {/* Contenido */}
                <div className="flex-1">
                   <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-black text-white text-lg uppercase leading-none">{notif.clientName}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-tighter">
                          {notif.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', hour: '2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!notif.read && (
                          <button onClick={() => markAsRead(notif.id)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-green-500 rounded-lg transition-colors" title="Marcar como leído">
                            <Check size={18}/>
                          </button>
                        )}
                        <button onClick={() => deleteNotification(notif.id)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-lg transition-colors">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                   </div>

                   <div className="mt-3">
                      {isCompleted ? (
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                             <TrendingUp size={16}/> Entrenamiento del {notif.date} FINALIZADO
                           </div>
                           <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                              <p className="text-zinc-300 text-sm italic font-medium">"{notif.performance}"</p>
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                             <TrendingDown size={16}/> NO ENTRENÓ el {notif.date}
                           </div>
                           <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                              <p className="text-zinc-300 text-sm italic font-medium">Motivo: "{notif.reason}"</p>
                           </div>
                        </div>
                      )}
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
