import React, { useState, useEffect } from 'react';
import { 
  Bell, MessageSquare, Trophy, AlertCircle, Check, 
  Trash2, Dumbbell, Clock, Zap, CreditCard, CheckCircle2 
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, collectionGroup, where, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, messages, milestones, payments

  // --- ESCUCHA DE NOTIFICACIONES EN TIEMPO REAL ---
  useEffect(() => {
    // 1. Escuchamos las notificaciones del sistema (Hitos, Pagos, Entrenamientos)
    const qSys = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    
    const unsubSys = onSnapshot(qSys, (sysSnap) => {
      const sysData = sysSnap.docs.map(d => ({ 
        id: d.id, 
        _source: 'system', 
        ref: d.ref, // Guardamos la referencia para poder actualizarla
        ...d.data() 
      }));
      
      // 2. Escuchamos los mensajes no leídos de los alumnos en toda la base de datos
      const qMsg = query(
        collectionGroup(db, 'messages'), 
        where('sender', '==', 'student'), 
        where('read', '==', false)
      );
      
      const unsubMsg = onSnapshot(qMsg, (msgSnap) => {
        const msgData = msgSnap.docs.map(d => ({
          id: d.id,
          _source: 'message',
          ref: d.ref,
          type: 'message',
          title: 'Nuevo Mensaje de Alumno',
          body: d.data().text || 'Te ha enviado un mensaje.',
          createdAt: d.data().createdAt,
          read: false
        }));

        // Combinamos ambas fuentes y ordenamos por fecha (más reciente primero)
        const combined = [...sysData, ...msgData].sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setNotifications(combined);
        setLoading(false);
      });
      
      return () => unsubMsg();
    });

    return () => unsubSys();
  }, []);

  // --- FUNCIONES DE ACCIÓN ---
  const markAsRead = async (notif) => {
    try {
      if (notif.ref) {
        await updateDoc(notif.ref, { read: true });
      }
    } catch (error) {
      console.error("Error al marcar como leído:", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read && n.ref);
    unreadNotifs.forEach(async (notif) => {
      try {
        await updateDoc(notif.ref, { read: true });
      } catch (error) {
        console.error(error);
      }
    });
  };

  const deleteNotification = async (notif) => {
    if (!window.confirm('¿Eliminar esta notificación?')) return;
    try {
      if (notif._source === 'system' && notif.ref) {
        await deleteDoc(notif.ref);
      } else if (notif._source === 'message') {
        // En los mensajes, solo lo marcamos como leído para no borrarle el chat al alumno
        await updateDoc(notif.ref, { read: true });
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  // --- GENERADOR DE PRUEBAS (SOLO PARA QUE VEAS CÓMO QUEDA) ---
  const generateTestNotification = async () => {
    const types = ['milestone', 'payment', 'workout', 'system', 'message_mock'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    let title = ''; let body = '';
    
    switch(randomType) {
      case 'milestone': 
        title = '¡Nuevo Récord Personal!'; 
        body = 'Un alumno acaba de levantar 120kg en Sentadilla Libre. ¡Felicítalo!'; 
        break;
      case 'payment': 
        title = 'Aviso de Cobro Próximo'; 
        body = 'La suscripción del Plan Premium de un atleta vence en 2 días.'; 
        break;
      case 'workout': 
        title = 'Entrenamiento Finalizado'; 
        body = 'Se ha completado la rutina "Fuerza Día 1" con un 90% de cumplimiento.'; 
        break;
      case 'message_mock': 
        title = 'Nuevo Mensaje'; 
        body = 'Hola coach, me duele un poco el hombro en el press, ¿qué hago?'; 
        break;
      default: 
        title = 'Actualización del Sistema'; 
        body = 'Tu base de datos Firebase está sincronizada y funcionando al 100%.';
    }

    // Usamos el tipo real en DB
    const dbType = randomType === 'message_mock' ? 'message' : randomType;

    await addDoc(collection(db, 'trainerNotifications'), {
      type: dbType,
      title,
      body,
      read: false,
      createdAt: new Date()
    });
  };

  // --- FILTRADO VISUAL ---
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'messages') return n.type === 'message';
    if (filter === 'milestones') return n.type === 'milestone';
    if (filter === 'payments') return n.type === 'payment';
    return true; // 'all'
  });

  const unreadTotal = notifications.filter(n => !n.read).length;

  // --- RENDERIZADO DE ICONOS SEGÚN EL TIPO ---
  const getIcon = (type) => {
    switch (type) {
      case 'message': return <MessageSquare size={20} className="text-blue-400" />;
      case 'milestone': return <Trophy size={20} className="text-yellow-400" />;
      case 'payment': return <CreditCard size={20} className="text-red-400" />;
      case 'workout': return <Dumbbell size={20} className="text-green-400" />;
      default: return <Zap size={20} className="text-zinc-400" />;
    }
  };

  const getBgColor = (type, isRead) => {
    if (isRead) return 'bg-zinc-900 border-zinc-800 opacity-70'; // Leído
    switch (type) {
      case 'message': return 'bg-blue-500/10 border-blue-500/30';
      case 'milestone': return 'bg-yellow-400/10 border-yellow-400/30';
      case 'payment': return 'bg-red-500/10 border-red-500/30';
      case 'workout': return 'bg-green-500/10 border-green-500/30';
      default: return 'bg-zinc-800 border-zinc-700';
    }
  };

  const formatTime = (dateObj) => {
    if (!dateObj) return 'Justo ahora';
    const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            Centro de Mando
            {unreadTotal > 0 && (
              <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full not-italic">
                {unreadTotal} nuevas
              </span>
            )}
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Revisa la actividad de tus atletas y alertas del sistema.</p>
        </div>
        
        <div className="flex gap-2">
          {/* Botón de Prueba (Lo puedes quitar cuando tu app esté en producción) */}
          <button 
            onClick={generateTestNotification}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-zinc-700"
            title="Genera una alerta aleatoria para probar el diseño"
          >
            + Crear Prueba
          </button>
          
          {unreadTotal > 0 && (
            <button 
              onClick={markAllAsRead}
              className="bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 size={16} className="text-green-400"/> Marcar todas leídas
            </button>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}>Todas</button>
        <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === 'unread' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}>No leídas</button>
        <button onClick={() => setFilter('messages')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${filter === 'messages' ? 'bg-blue-500 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}><MessageSquare size={14}/> Mensajes</button>
        <button onClick={() => setFilter('milestones')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${filter === 'milestones' ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}><Trophy size={14}/> Hitos</button>
        <button onClick={() => setFilter('payments')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${filter === 'payments' ? 'bg-red-500 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}><CreditCard size={14}/> Pagos</button>
      </div>

      {/* LISTA DE NOTIFICACIONES */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all group ${getBgColor(notif.type, notif.read)}`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner mt-1 md:mt-0 shrink-0">
                  {getIcon(notif.type)}
                </div>
                <div>
                  <h3 className={`font-bold text-sm md:text-base mb-1 ${notif.read ? 'text-zinc-400' : 'text-white'}`}>
                    {notif.title}
                  </h3>
                  <p className={`text-xs md:text-sm leading-relaxed max-w-2xl ${notif.read ? 'text-zinc-600' : 'text-zinc-300'}`}>
                    {notif.body}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                    <Clock size={12} /> {formatTime(notif.createdAt)}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex md:flex-col gap-2 ml-14 md:ml-0 shrink-0">
                {!notif.read && (
                  <button 
                    onClick={() => markAsRead(notif)}
                    className="p-2 bg-zinc-950 hover:bg-green-500/20 text-zinc-400 hover:text-green-400 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center"
                    title="Marcar como leído"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button 
                  onClick={() => deleteNotification(notif)}
                  className="p-2 bg-zinc-950 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100"
                  title="Eliminar notificación"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <Bell size={48} className="mb-4 opacity-20 text-zinc-500" />
            <h3 className="text-zinc-400 font-bold text-lg mb-1">Todo al día, Capitán</h3>
            <p className="text-zinc-600 font-medium text-sm text-center max-w-xs">
              No tienes {filter !== 'all' ? 'este tipo de' : ''} notificaciones nuevas por el momento.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
