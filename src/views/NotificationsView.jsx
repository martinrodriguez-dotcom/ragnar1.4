import React, { useState, useEffect } from 'react';
import { 
  Bell, MessageSquare, Trophy, AlertCircle, Check, 
  Trash2, Dumbbell, Clock, Zap, CreditCard, CheckCircle2, User 
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, collectionGroup, where, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); 

  // --- ESCUCHA DE NOTIFICACIONES EN TIEMPO REAL ---
  useEffect(() => {
    const qSys = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    
    const unsubSys = onSnapshot(qSys, (sysSnap) => {
      const sysData = sysSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, 
          _source: 'system', 
          ref: d.ref, 
          clientName: data.clientName || data.studentName || data.playerName || data.userName || null,
          ...data 
        };
      });
      
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
            title: 'Nuevo Mensaje Directo',
            body: data.text || 'Te ha enviado un mensaje.',
            clientName: data.senderName || data.studentName || 'Un Alumno',
            createdAt: data.createdAt,
            read: false
          };
        });

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
      if (notif.ref) await updateDoc(notif.ref, { read: true });
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
    if (!window.confirm('¿Eliminar esta notificación del historial?')) return;
    try {
      if (notif._source === 'system' && notif.ref) {
        await deleteDoc(notif.ref);
      } else if (notif._source === 'message') {
        await updateDoc(notif.ref, { read: true });
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  // --- GENERADOR DE PRUEBAS ---
  const generateTestNotification = async () => {
    const types = ['milestone', 'payment', 'workout', 'system', 'message_mock'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const mockNames = ['Juan Pérez', 'María Gómez', 'Carlos López', 'Ana Silva', 'Marcos Ruiz'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    
    let title = ''; let body = ''; let assignName = randomName;
    
    switch(randomType) {
      case 'milestone': 
        title = '¡Nuevo Récord Personal!'; 
        body = 'Acaba de levantar 120kg en Sentadilla Libre. ¡Tremendo progreso!'; 
        break;
      case 'payment': 
        title = 'Aviso de Cobro'; 
        body = 'La suscripción del Plan Premium vence en exactamente 2 días.'; 
        break;
      case 'workout': 
        title = 'Entrenamiento Finalizado'; 
        body = 'Completó la rutina "Día 1: Hipertrofia" con un 100% de cumplimiento. Está on fire.'; 
        break;
      case 'message_mock': 
        title = 'Consulta del Atleta'; 
        body = 'Hola coach, me duele un poco el hombro en el press militar, ¿puedo cambiarlo por mancuernas?'; 
        break;
      default: 
        title = 'Sincronización Exitosa'; 
        body = 'La plataforma Ragnar Training está funcionando a máxima capacidad.';
        assignName = null; 
    }

    const dbType = randomType === 'message_mock' ? 'message' : randomType;

    await addDoc(collection(db, 'trainerNotifications'), {
      type: dbType,
      title,
      body,
      clientName: assignName,
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
    return true; 
  });

  const unreadTotal = notifications.filter(n => !n.read).length;

  // --- ESTILOS PREMIUM POR TIPO ---
  const getTypeStyles = (type, isRead) => {
    if (isRead) {
      return {
        cardBg: 'bg-zinc-950/50 border-zinc-900 opacity-60 hover:opacity-100',
        accentLine: 'bg-zinc-800',
        iconWrap: 'bg-zinc-900 border-zinc-800 text-zinc-600',
        icon: <CheckCircle2 size={18} />
      };
    }

    switch (type) {
      case 'message': 
        return {
          cardBg: 'bg-zinc-900 border-zinc-800 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]',
          accentLine: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
          iconWrap: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          icon: <MessageSquare size={18} />
        };
      case 'milestone': 
        return {
          cardBg: 'bg-zinc-900 border-zinc-800 hover:border-yellow-400/30 hover:shadow-[0_0_30px_rgba(250,204,21,0.05)]',
          accentLine: 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]',
          iconWrap: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400',
          icon: <Trophy size={18} />
        };
      case 'payment': 
        return {
          cardBg: 'bg-zinc-900 border-zinc-800 hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]',
          accentLine: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
          iconWrap: 'bg-red-500/10 border-red-500/20 text-red-500',
          icon: <CreditCard size={18} />
        };
      case 'workout': 
        return {
          cardBg: 'bg-zinc-900 border-zinc-800 hover:border-green-500/30 hover:shadow-[0_0_30px_rgba(34,197,94,0.1)]',
          accentLine: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
          iconWrap: 'bg-green-500/10 border-green-500/20 text-green-500',
          icon: <Dumbbell size={18} />
        };
      default: 
        return {
          cardBg: 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
          accentLine: 'bg-zinc-500',
          iconWrap: 'bg-zinc-800 border-zinc-700 text-zinc-400',
          icon: <Zap size={18} />
        };
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
    <div className="max-w-5xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-yellow-400/10 rounded-2xl border border-yellow-400/20">
              <Bell size={24} className="text-yellow-400" />
            </div>
            <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
              Radar de Mando
            </h2>
          </div>
          <p className="text-zinc-500 text-sm font-medium pl-1">
            Supervisa la actividad de tus atletas en tiempo real.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={generateTestNotification}
            className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-zinc-800 shadow-lg"
          >
            + Forzar Alerta
          </button>
          
          {unreadTotal > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex-1 md:flex-none bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <CheckCircle2 size={16}/> Limpiar Nuevas
            </button>
          )}
        </div>
      </div>

      {/* FILTROS TIPO PÍLDORA */}
      <div className="flex overflow-x-auto gap-3 mb-8 pb-2 no-scrollbar">
        {[
          { id: 'all', label: 'Todas', icon: null },
          { id: 'unread', label: `No leídas (${unreadTotal})`, icon: null },
          { id: 'messages', label: 'Mensajes', icon: <MessageSquare size={14}/> },
          { id: 'milestones', label: 'Hitos', icon: <Trophy size={14}/> },
          { id: 'payments', label: 'Cobros', icon: <CreditCard size={14}/> },
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setFilter(btn.id)} 
            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${
              filter === btn.id 
                ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>

      {/* LISTA DE NOTIFICACIONES */}
      <div className="space-y-4">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => {
            const styles = getTypeStyles(notif.type, notif.read);
            
            return (
              <div 
                key={notif.id} 
                className={`relative p-5 md:p-6 rounded-2xl border transition-all duration-300 group flex flex-col md:flex-row md:items-center justify-between gap-5 overflow-hidden ${styles.cardBg}`}
              >
                {/* LÍNEA DE ACENTO LATERAL */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accentLine}`}></div>

                <div className="flex items-start gap-5 w-full">
                  {/* ICONO */}
                  <div className={`p-4 rounded-2xl border shrink-0 transition-colors ${styles.iconWrap}`}>
                    {styles.icon}
                  </div>

                  {/* CONTENIDO */}
                  <div className="flex-1 mt-1">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h3 className={`font-black uppercase tracking-tight text-sm md:text-base ${notif.read ? 'text-zinc-500' : 'text-white'}`}>
                        {notif.title}
                      </h3>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                      )}
                    </div>
                    
                    {/* BADGE DEL ATLETA */}
                    {notif.clientName && (
                      <div className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg mb-3">
                        <User size={12} className={notif.read ? 'text-zinc-600' : 'text-yellow-400'} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${notif.read ? 'text-zinc-500' : 'text-zinc-300'}`}>
                          {notif.clientName}
                        </span>
                      </div>
                    )}

                    <p className={`text-sm leading-relaxed max-w-3xl ${notif.read ? 'text-zinc-600' : 'text-zinc-400 font-medium'}`}>
                      {notif.body}
                    </p>
                    
                    <div className="flex items-center gap-1.5 mt-4 text-[10px] uppercase font-black tracking-widest text-zinc-600">
                      <Clock size={12} /> {formatTime(notif.createdAt)}
                    </div>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN (Aparecen en desktop al hacer hover) */}
                <div className="flex md:flex-col gap-2 pl-16 md:pl-0 shrink-0">
                  {!notif.read && (
                    <button 
                      onClick={() => markAsRead(notif)}
                      className="flex-1 md:flex-none p-3 bg-zinc-950 hover:bg-green-500/10 text-zinc-500 hover:text-green-400 border border-zinc-800 hover:border-green-500/30 rounded-xl transition-all flex items-center justify-center"
                      title="Marcar como resuelto"
                    >
                      <Check size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notif)}
                    className="flex-1 md:flex-none p-3 bg-zinc-950 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 border border-zinc-800 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100"
                    title="Eliminar registro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-400/5 blur-[100px] rounded-full pointer-events-none"></div>
            <Bell size={64} className="mb-6 text-zinc-800" strokeWidth={1} />
            <h3 className="text-zinc-300 font-black text-xl uppercase tracking-widest mb-2">Radar Despejado</h3>
            <p className="text-zinc-600 font-medium text-sm text-center max-w-sm">
              No hay {filter !== 'all' ? 'este tipo de' : ''} alertas en el sistema. Todo marcha sobre ruedas.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
