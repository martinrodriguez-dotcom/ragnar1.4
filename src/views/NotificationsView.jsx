import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Bell, Dumbbell, AlertTriangle, MessageSquare, CheckCircle } from 'lucide-react';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Escuchador en Tiempo Real para la vista de Notificaciones
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

  // Marcar una notificación individual como leída
  const markAsRead = async (id, currentStatus) => {
    if (currentStatus) return; // Si ya está leída, no hace nada
    try {
      await updateDoc(doc(db, 'trainerNotifications', id), {
        read: true
      });
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  // Marcar TODAS como leídas en un solo clic (Usando Batch para no saturar Firebase)
  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    if (unreadNotifs.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(notif => {
        const notifRef = doc(db, 'trainerNotifications', notif.id);
        batch.update(notifRef, { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error al marcar todas como leídas:", error);
    }
  };

  // Íconos dinámicos según el tipo de notificación
  const getIconForType = (type) => {
    switch (type) {
      case 'workout_completed': 
        return <Dumbbell className="text-green-500" size={24} />;
      case 'missed_workout': 
        return <AlertTriangle className="text-red-500" size={24} />;
      case 'new_message': 
        return <MessageSquare className="text-yellow-400" size={24} />;
      default: 
        return <Bell className="text-blue-500" size={24} />;
    }
  };

  // Títulos dinámicos según el tipo de notificación
  const getTitleForType = (notif) => {
    switch (notif.type) {
      case 'workout_completed': 
        return `${notif.clientName} ha completado su rutina`;
      case 'missed_workout': 
        return `${notif.clientName} no entrenó ayer`;
      case 'new_message': 
        return `Nuevo mensaje de ${notif.clientName}`;
      default: 
        return 'Nueva Notificación';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Centro de Control</h2>
          <p className="text-zinc-500 text-sm font-medium">
            Monitorea la actividad de tus atletas en tiempo real.
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm shadow-lg active:scale-95"
          >
            <CheckCircle size={18} className="text-yellow-400"/>
            Marcar todo como leído
          </button>
        )}
      </div>

      {/* LISTA DE NOTIFICACIONES */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-xl">
        {notifications.length > 0 ? (
          <div className="divide-y divide-zinc-800/50">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => markAsRead(notif.id, notif.read)}
                className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all cursor-pointer hover:bg-zinc-800/50 ${!notif.read ? 'bg-black/40' : 'opacity-60 grayscale-[50%]'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-2xl shrink-0 ${!notif.read ? 'bg-zinc-800 shadow-lg border border-zinc-700' : 'bg-transparent border border-transparent'}`}>
                    {getIconForType(notif.type)}
                  </div>
                  <div>
                    <h3 className={`text-lg font-black uppercase tracking-tight ${!notif.read ? 'text-white' : 'text-zinc-400'}`}>
                      {getTitleForType(notif)}
                    </h3>
                    
                    {/* Renderizado condicional del contenido de la notificación */}
                    {notif.type === 'missed_workout' && notif.reason && (
                      <div className="mt-3 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                        <p className="text-red-200 text-sm italic font-medium">"{notif.reason}"</p>
                      </div>
                    )}
                    
                    {notif.type === 'workout_completed' && (
                      <p className="text-zinc-400 text-sm mt-1 font-medium">
                        Fecha de la sesión: <span className="font-bold text-white">{notif.date}</span>
                      </p>
                    )}

                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mt-3">
                      {notif.createdAt?.toDate().toLocaleString('es-ES', { 
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' 
                      })}
                    </p>
                  </div>
                </div>

                {/* ETIQUETA DE "NUEVO" */}
                {!notif.read && (
                  <div className="shrink-0 flex items-center self-start md:self-auto mt-2 md:mt-0 ml-16 md:ml-0">
                    <span className="bg-yellow-400 text-black text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                      Nuevo
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-600">
            <Bell size={64} className="mb-6 opacity-20" />
            <p className="text-xl font-black uppercase tracking-widest opacity-40">Todo tranquilo</p>
            <p className="text-sm mt-2 opacity-50 font-medium">No tienes notificaciones pendientes.</p>
          </div>
        )}
      </div>

    </div>
  );
}
