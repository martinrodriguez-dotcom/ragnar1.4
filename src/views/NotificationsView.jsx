import React, { useState, useEffect } from 'react';
import { 
  Bell, MessageSquare, Trophy, Check, 
  Trash2, Dumbbell, Clock, Zap, CreditCard, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, collectionGroup, where, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView({ navigateTo, clients = [] }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // --- ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    // 1. Escuchamos notificaciones del sistema
    const qSys = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    
    const unsubSys = onSnapshot(qSys, (sysSnap) => {
      const sysData = sysSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, 
          _source: 'system', 
          ref: d.ref, 
          clientName: data.clientName || data.studentName || null,
          ...data 
        };
      });
      
      // 2. Escuchamos mensajes no leídos
      const qMsg = query(
        collectionGroup(db, 'messages'), 
        where('sender', '==', 'student'), 
        where('read', '==', false)
      );
      
      const unsubMsg = onSnapshot(qMsg, (msgSnap) => {
        const msgData = msgSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            _source: 'message',
            ref: d.ref,
            type: 'message',
            title: 'Mensaje Directo',
            body: data.text || 'Te ha enviado un mensaje.',
            clientName: data.senderName || data.studentName || 'Un Alumno',
            createdAt: data.createdAt,
            read: false
          };
        });

        // 3. Combinamos y ordenamos cronológicamente
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

  // --- LÓGICA DE CLICS Y NAVEGACIÓN TÁCTICA ---
  const handleNotificationClick = async (notif) => {
    // 1. Marcar como leída automáticamente al hacer clic
    if (!notif.read && notif.ref) {
      try {
        await updateDoc(notif.ref, { read: true });
      } catch (e) { console.error(e); }
    }

    // 2. Teletransporte según el tipo de notificación
    if (typeof navigateTo !== 'function') return;

    if (notif.type === 'message') {
      // Buscar cliente por nombre exacto para ir a su perfil
      const foundClient = clients.find(c => c.name && c.name.toLowerCase() === (notif.clientName || '').toLowerCase());
      if (foundClient) {
        navigateTo('client-detail', foundClient);
      } else {
        navigateTo('clients'); // Si no encuentra coincidencia exacta, va a la lista
      }
    } 
    else if (notif.type === 'milestone') {
      navigateTo('community');
    } 
    else if (notif.type === 'payment') {
      navigateTo('payments');
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read && n.ref);
    unreadNotifs.forEach(async (notif) => {
      try { await updateDoc(notif.ref, { read: true }); } catch (e) { console.error(e); }
    });
  };

  const deleteNotification = async (e, notif) => {
    e.stopPropagation(); // Evita que el clic dispare también la navegación
    if (!window.confirm('¿Eliminar esta notificación del historial?')) return;
    try {
      if (notif._source === 'system' && notif.ref) {
        await deleteDoc(notif.ref);
      } else if (notif._source === 'message') {
        // A los mensajes solo los marcamos como leídos para no borrarle el chat al alumno
        await updateDoc(notif.ref, { read: true });
      }
    } catch (error) { console.error(error); }
  };

  // --- SIMULADOR DE ALERTAS ---
  const generateTestNotification = async () => {
    const types = ['milestone', 'payment', 'workout', 'message_mock'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    // Usa nombres reales de tus clientes si tienes, sino inventa
    const mockNames = clients.length > 0 ? clients.map(c => c.name) : ['Juan Pérez', 'María Gómez', 'Carlos López', 'Ana Silva'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    
    let title = ''; let body = '';
    
    switch(randomType) {
      case 'milestone': 
        title = 'Nuevo Récord'; body = 'Rompió su marca personal en Sentadilla.'; break;
      case 'payment': 
        title = 'Aviso de Vencimiento'; body = 'La cuota de este atleta vence en 2 días.'; break;
      case 'workout': 
        title = 'Rutina Finalizada'; body = 'Ha completado el "Día 1: Hipertrofia".'; break;
      case 'message_mock': 
        title = 'Mensaje Nuevo'; body = 'Hola coach, me duele un poco el hombro, ¿qué hago?'; break;
      default: break;
    }

    const dbType = randomType === 'message_mock' ? 'message' : randomType;

    try {
      await addDoc(collection(db, 'trainerNotifications'), {
        type: dbType,
        title,
        body,
        clientName: randomName,
        read: false,
        createdAt: new Date()
      });
    } catch (error) { console.error(error); }
  };

  // --- FILTROS VISUALES ---
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'messages') return n.type === 'message';
    if (filter === 'milestones') return n.type === 'milestone';
    if (filter === 'payments') return n.type === 'payment';
    return true; 
  });

  const unreadTotal = notifications.filter(n => !n.read).length;

  // --- ESTILOS DE LA TARJETA ---
  const getTypeStyles = (type) => {
    switch (type) {
      case 'message': return { border: 'border-l-blue-500', bg: 'bg-blue-500/10 text-blue-400', label: 'Mensaje' };
      case 'milestone': return { border: 'border-l-yellow-400', bg: 'bg-yellow-400/10 text-yellow-400', label: 'Hito Deportivo' };
      case 'payment': return { border: 'border-l-red-500', bg: 'bg-red-500/10 text-red-500', label: 'Alerta de Cobro' };
      case 'workout': return { border: 'border-l-green-500', bg: 'bg-green-500/10 text-green-500', label: 'Entrenamiento' };
      default: return { border: 'border-l-zinc-500', bg: 'bg-zinc-800 text-zinc-300', label: 'Sistema' };
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-1">
            Notificaciones
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Panel de alertas y actividad de atletas.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={generateTestNotification}
            className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-zinc-800 shadow-md"
          >
            + Simular Alerta
          </button>
          
          {unreadTotal > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex-1 md:flex-none bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <CheckCircle2 size={16}/> Marcar todo leído
            </button>
          )}
        </div>
      </div>

      {/* FILTROS TIPO PÍLDORA */}
      <div className="flex overflow-x-auto gap-3 mb-8 pb-2 no-scrollbar">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'unread', label: `No leídas (${unreadTotal})` },
          { id: 'messages', label: 'Mensajes' },
          { id: 'milestones', label: 'Hitos' },
          { id: 'payments', label: 'Cobros' },
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setFilter(btn.id)} 
            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all shrink-0 border ${
              filter === btn.id 
                ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' 
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* LISTA DE NOTIFICACIONES */}
      <div className="space-y-4">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => {
            const styles = getTypeStyles(notif.type);
            const isRead = notif.read;
            
            return (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`relative group cursor-pointer transition-all duration-300 border-y border-r border-l-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6 shadow-lg overflow-hidden ${styles.border} ${isRead ? 'bg-zinc-950/50 border-zinc-900 opacity-70 hover:opacity-100' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:shadow-xl'}`}
              >
                
                {/* Brillo de fondo para las no leídas */}
                {!isRead && (
                   <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 blur-3xl rounded-full pointer-events-none"></div>
                )}

                <div className="flex-1 z-10">
                  {/* BADGE DEL TIPO */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${styles.bg}`}>
                      {styles.label}
                    </span>
                    {!isRead && <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></span>}
                  </div>

                  {/* NOMBRE DEL ATLETA GIGANTE */}
                  <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none mb-2 ${isRead ? 'text-zinc-500' : 'text-white group-hover:text-yellow-400 transition-colors'}`}>
                    {notif.clientName || 'SISTEMA RAGNAR'}
                  </h2>

                  {/* TÍTULO Y CUERPO */}
                  <p className={`text-sm md:text-base leading-snug max-w-3xl mb-4 ${isRead ? 'text-zinc-600' : 'text-zinc-300'}`}>
                    <strong className="text-white mr-1">{notif.title}:</strong> {notif.body}
                  </p>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    <Clock size={12} /> 
                    {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' }) : 'Justo ahora'}
                  </div>
                </div>

                {/* ACCIONES LATERALES */}
                <div className="flex items-center gap-4 mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-zinc-800/50 pt-4 md:pt-0 md:pl-6 z-10 shrink-0">
                   <button 
                     onClick={(e) => deleteNotification(e, notif)}
                     className="p-3 bg-zinc-950 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-zinc-800 hover:border-red-500/30"
                     title="Eliminar notificación"
                   >
                     <Trash2 size={18} />
                   </button>
                   
                   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-yellow-400 transition-colors bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800">
                      <span className="hidden md:inline">Ver Detalles</span>
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                   </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <h3 className="text-zinc-400 font-black text-2xl uppercase tracking-widest mb-2">Radar Despejado</h3>
            <p className="text-zinc-600 text-sm font-medium">No hay notificaciones pendientes. Todo marcha sobre ruedas.</p>
          </div>
        )}
      </div>

    </div>
  );
}
