import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, writeBatch, deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Bell, Dumbbell, AlertTriangle, MessageSquare, CheckCircle, 
  Trash2, Archive, RotateCcw, Check, Inbox
} from 'lucide-react';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' o 'history'

  // 1. Escuchador en Tiempo Real
  useEffect(() => {
    const q = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- FUNCIONES DE GESTIÓN ---

  const markAsRead = async (id, currentStatus) => {
    if (currentStatus) return;
    try {
      await updateDoc(doc(db, 'trainerNotifications', id), { read: true });
    } catch (error) { console.error(error); }
  };

  const moveToHistory = async (id) => {
    try {
      await updateDoc(doc(db, 'trainerNotifications', id), { 
        deleted: true,
        read: true // Al archivarla, la marcamos como leída automáticamente
      });
    } catch (error) { console.error(error); }
  };

  const restoreFromHistory = async (id) => {
    try {
      await updateDoc(doc(db, 'trainerNotifications', id), { deleted: false });
    } catch (error) { console.error(error); }
  };

  const permanentDelete = async (id) => {
    if (!window.confirm("¿Eliminar definitivamente del registro?")) return;
    try {
      await deleteDoc(doc(db, 'trainerNotifications', id));
    } catch (error) { console.error(error); }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read && !n.deleted);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'trainerNotifications', n.id), { read: true }));
    await batch.commit();
  };

  const moveAllToHistory = async () => {
    const active = notifications.filter(n => !n.deleted);
    if (active.length === 0 || !window.confirm("¿Mandar todas las notificaciones al historial?")) return;
    const batch = writeBatch(db);
    active.forEach(n => batch.update(doc(db, 'trainerNotifications', n.id), { deleted: true, read: true }));
    await batch.commit();
  };

  // --- HELPERS VISUALES Y TRADUCCIONES ---

  const getIcon = (type) => {
    switch (type) {
      case 'workout_completed': return <Dumbbell className="text-green-500" size={20} />;
      case 'missed_workout': return <AlertTriangle className="text-red-500" size={20} />;
      case 'new_message': return <MessageSquare className="text-yellow-400" size={20} />;
      default: return <Bell className="text-blue-500" size={20} />;
    }
  };

  // Función para traducir las claves de Firebase al español
  const getNotifLabel = (type) => {
    switch (type) {
      case 'workout_completed': return 'Rutina Completada';
      case 'missed_workout': return 'Ausencia Justificada';
      case 'new_message': return 'Nuevo Mensaje';
      default: return 'Notificación';
    }
  };

  // Filtrado de listas
  const activeNotifs = notifications.filter(n => !n.deleted);
  const historyNotifs = notifications.filter(n => n.deleted);
  const unreadCount = activeNotifs.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20">
      
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            Notificaciones {unreadCount > 0 && <span className="bg-red-600 text-white text-xs not-italic px-2 py-1 rounded-lg">{unreadCount}</span>}
          </h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">Sincronización en tiempo real con tus atletas.</p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-yellow-400 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Activas ({activeNotifs.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-yellow-400 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Historial ({historyNotifs.length})
          </button>
        </div>
      </div>

      {/* ACCIONES GLOBALES */}
      {activeTab === 'active' && activeNotifs.length > 0 && (
        <div className="flex gap-3 mb-6">
          <button onClick={markAllAsRead} className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 text-zinc-400 hover:text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
            <Check size={16}/> Marcar Leídas
          </button>
          <button onClick={moveAllToHistory} className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-400 hover:text-red-400 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
            <Archive size={16}/> Limpiar Vista
          </button>
        </div>
      )}

      {/* LISTADO PRINCIPAL */}
      <div className="space-y-3">
        {(activeTab === 'active' ? activeNotifs : historyNotifs).length > 0 ? (
          (activeTab === 'active' ? activeNotifs : historyNotifs).map((n) => (
            <div 
              key={n.id}
              className={`group relative overflow-hidden bg-zinc-900 border transition-all rounded-[1.5rem] ${!n.read && activeTab === 'active' ? 'border-yellow-400/30 shadow-[0_0_20px_rgba(250,204,21,0.05)]' : 'border-zinc-800/50 opacity-80'}`}
            >
              {/* Indicador lateral de "Nueva" */}
              {!n.read && activeTab === 'active' && (
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-yellow-400"></div>
              )}

              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-5">
                  <div className={`p-4 rounded-2xl shrink-0 ${!n.read ? 'bg-yellow-400/10 shadow-inner' : 'bg-black/20'}`}>
                    {getIcon(n.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                       <h3 className={`font-black uppercase tracking-tight text-lg ${!n.read ? 'text-white' : 'text-zinc-500'}`}>
                         {n.clientName}
                       </h3>
                       {/* ETIQUETA TRADUCIDA AL ESPAÑOL */}
                       <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${n.type === 'workout_completed' ? 'bg-green-500/10 text-green-500' : n.type === 'missed_workout' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                         {getNotifLabel(n.type)}
                       </span>
                    </div>

                    {n.reason && (
                      <div className="mt-2 bg-black/40 border border-zinc-800 p-3 rounded-xl">
                        <p className="text-zinc-400 text-sm italic font-medium">"{n.reason}"</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3">
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                         <Clock size={12}/> {n.createdAt?.toDate().toLocaleString('es-ES', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                       </p>
                       {n.date && (
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                           Sesión: {n.date}
                         </p>
                       )}
                    </div>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN POR ITEM */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  {activeTab === 'active' ? (
                    <>
                      {!n.read && (
                        <button 
                          onClick={() => markAsRead(n.id, n.read)}
                          className="p-3 bg-zinc-800 hover:bg-yellow-400 text-zinc-400 hover:text-black rounded-xl transition-all"
                          title="Marcar como leída"
                        >
                          <Check size={18}/>
                        </button>
                      )}
                      <button 
                        onClick={() => moveToHistory(n.id)}
                        className="p-3 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
                        title="Mover al historial"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => restoreFromHistory(n.id)}
                        className="p-3 bg-zinc-800 hover:bg-green-500/20 text-zinc-400 hover:text-green-500 rounded-xl transition-all"
                        title="Restaurar a activas"
                      >
                        <RotateCcw size={18}/>
                      </button>
                      <button 
                        onClick={() => permanentDelete(n.id)}
                        className="p-3 bg-zinc-800 hover:bg-red-500 text-zinc-400 hover:text-white rounded-xl transition-all"
                        title="Eliminar permanentemente"
                      >
                        <X size={18}/>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800">
            <div className="bg-zinc-900 p-6 rounded-full mb-4 text-zinc-700">
               {activeTab === 'active' ? <Inbox size={48}/> : <Archive size={48}/>}
            </div>
            <p className="text-zinc-600 font-black uppercase tracking-[0.2em] text-sm">
              {activeTab === 'active' ? 'No hay notificaciones activas' : 'El historial está vacío'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

// Sub-componente simple para el icono de reloj que falta
function Clock({ size }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
