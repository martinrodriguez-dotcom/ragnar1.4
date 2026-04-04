import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Trash2, AlertTriangle, User } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Escuchar la colección global de notificaciones
    const q = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const markAsRead = async (id) => {
    try { 
      await updateDoc(doc(db, 'trainerNotifications', id), { read: true }); 
    } catch (e) { 
      console.error(e); 
    }
  };

  const deleteNotification = async (id) => {
    if(window.confirm('¿Borrar notificación?')) {
        try { 
          await deleteDoc(doc(db, 'trainerNotifications', id)); 
        } catch (e) { 
          console.error(e); 
        }
    }
  };

  const markAllRead = async () => {
    notifications.forEach(async (notif) => {
      if (!notif.read) {
        await updateDoc(doc(db, 'trainerNotifications', notif.id), { read: true });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase">Centro de Alertas</h2>
          <p className="text-zinc-500 text-sm">Actividad reciente de tus alumnos.</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllRead} 
            className="text-xs text-yellow-400 hover:text-white underline"
          >
            Marcar todo leído
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 && (
          <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
            <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2"/>
            <p className="text-zinc-500 text-sm">Todo tranquilo por aquí.</p>
          </div>
        )}

        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className={`p-4 rounded-xl border flex gap-4 transition-colors ${
              notif.read ? 'bg-zinc-950 border-zinc-800 opacity-60' : 'bg-zinc-900 border-yellow-400/30 shadow-lg'
            }`}
            onClick={() => markAsRead(notif.id)}
          >
            <div className={`p-3 rounded-full h-fit ${notif.read ? 'bg-zinc-800 text-zinc-500' : 'bg-red-500/10 text-red-400'}`}>
               {notif.type === 'missed_workout' ? <AlertTriangle size={20}/> : <User size={20}/>}
            </div>
            
            <div className="flex-1 cursor-pointer">
               <div className="flex justify-between items-start">
                  <h4 className="font-bold text-white text-sm uppercase">{notif.clientName}</h4>
                  <span className="text-[10px] text-zinc-500">
                    {notif.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                  </span>
               </div>
               <p className="text-zinc-300 text-sm mt-1 font-medium">Faltó el {notif.date}</p>
               <div className="mt-2 bg-black/40 p-2 rounded text-xs text-zinc-400 italic border-l-2 border-zinc-700">
                 "{notif.reason}"
               </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }} 
              className="text-zinc-600 hover:text-red-500 h-fit"
            >
              <Trash2 size={16}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
