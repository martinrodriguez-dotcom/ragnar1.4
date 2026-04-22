import React, { useState, useEffect } from 'react';
import { 
  Bell, MessageSquare, Trophy, Trash2, Dumbbell, Clock, 
  CreditCard, CheckCircle2, ChevronRight, Search, Activity, User
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, collectionGroup, where, addDoc, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsView({ navigateTo, clients = [] }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unread'); // unread, history, messages, workouts, payments

  // --- ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    // 1. Escuchamos notificaciones del sistema (Entrenamientos, Pagos, etc.)
    const qSys = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    
    const unsubSys = onSnapshot(qSys, (sysSnap) => {
      const sysData = sysSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, 
          _source: 'system', 
          ref: d.ref, 
          clientName: data.clientName || data.studentName || null,
          clientId: data.clientId || null,
          ...data 
        };
      });
      
      // 2. Escuchamos mensajes directos NO LEÍDOS por el coach
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
            title: 'Nuevo Mensaje',
            body: data.text || 'Te ha enviado un mensaje.',
            clientName: data.senderName || data.studentName || 'Atleta',
            // Intentamos extraer el ID del cliente de la ruta de la base de datos (clients/{clientId}/messages/{msgId})
            clientId: d.ref.parent.parent?.id || null, 
            createdAt: data.createdAt,
            read: false
          };
        });

        // 3. Combinamos y ordenamos por fecha
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

  // --- LÓGICA DE NAVEGACIÓN Y LECTURA ---
  const handleNotificationClick = async (notif) => {
    // 1. Marcar como leída automáticamente al hacer clic
    if (!notif.read && notif.ref) {
      try {
        await updateDoc(notif.ref, { read: true });
      } catch (e) { console.error(e); }
    }

    // 2. Teletransporte según el tipo
    if (typeof navigateTo !== 'function') return;

    if (notif.type === 'message') {
      const foundClient = clients.find(c => c.id === notif.clientId || (c.name && c.name.toLowerCase() === (notif.clientName || '').toLowerCase()));
      if (foundClient) navigateTo('client-detail', foundClient);
      else navigateTo('clients');
    } 
    else if (notif.type === 'workout_completed' || notif.type === 'milestone') {
      navigateTo('community');
    } 
    else if (notif.type === 'payment' || notif.type === 'debt') {
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
    e.stopPropagation(); // Evita navegar al borrar
    if (!window.confirm('¿Eliminar esta notificación del historial?')) return;
    try {
      if (notif._source === 'system' && notif.ref) {
        await deleteDoc(notif.ref);
      } else if (notif._source === 'message') {
        await updateDoc(notif.ref, { read: true }); // Los mensajes solo se marcan leídos para no borrarlos del chat
      }
    } catch (error) { console.error(error); }
  };

  // --- ESCÁNER INTELIGENTE DE PAGOS (LA MAGIA AUTOMÁTICA) ---
  const scanPayments = async () => {
    if (!clients || clients.length === 0) {
      alert("No tienes clientes registrados para escanear.");
      return;
    }

    setLoading(true);
    let alertsGenerated = 0;
    const today = new Date();
    const currentMonthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    for (const client of clients) {
      if (!client.startDate) continue;

      try {
        // Verificamos si ya pagó este mes
        const paymentRef = doc(db, 'clients', client.id, 'payments', currentMonthId);
        const paymentSnap = await getDoc(paymentRef);
        const isPaid = paymentSnap.exists() && paymentSnap.data().status === 'paid';

        if (!isPaid) {
          const startDay = new Date(client.startDate + 'T12:00:00Z').getUTCDate();
          const grace = parseInt(client.graceDays || 0);
          const deadline = new Date(today.getFullYear(), today.getMonth(), startDay);
          deadline.setDate(deadline.getDate() + grace);

          // Calculamos la diferencia en días
          const diffTime = deadline - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let alertType = null;
          let alertTitle = '';
          let alertBody = '';

          if (diffDays < 0) {
            alertType = 'debt';
            alertTitle = 'Cuota Vencida';
            alertBody = `La suscripción está vencida hace ${Math.abs(diffDays)} días. El atleta tiene el acceso bloqueado.`;
          } else if (diffDays <= 3 && diffDays >= 0) {
            alertType = 'payment';
            alertTitle = 'Vencimiento Próximo';
            alertBody = `La cuota vencerá en ${diffDays} días. (Incluye días de gracia).`;
          }

          if (alertType) {
            // Revisar si ya le generamos una alerta idéntica en los últimos 5 días para no spamear
            const existingAlerts = notifications.filter(n => 
              n.clientId === client.id && 
              (n.type === 'debt' || n.type === 'payment') &&
              n.createdAt && 
              (today.getTime() - (n.createdAt.toDate ? n.createdAt.toDate().getTime() : new Date(n.createdAt).getTime())) < (5 * 24 * 60 * 60 * 1000)
            );

            if (existingAlerts.length === 0) {
              await addDoc(collection(db, 'trainerNotifications'), {
                type: alertType,
                title: alertTitle,
                body: alertBody,
                clientName: client.name,
                clientId: client.id,
                read: false,
                createdAt: new Date()
              });
              alertsGenerated++;
            }
          }
        }
      } catch (error) {
        console.error(`Error escaneando al cliente ${client.name}:`, error);
      }
    }

    setLoading(false);
    if (alertsGenerated > 0) {
      alert(`¡Escaneo completo! Se generaron ${alertsGenerated} nuevas alertas de cobro.`);
    } else {
      alert("Escaneo completo. Todos tus atletas están al día o ya fueron notificados.");
    }
  };

  // --- FILTROS VISUALES ---
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'history') return n.read;
    if (filter === 'messages') return n.type === 'message';
    if (filter === 'workouts') return n.type === 'workout_completed' || n.type === 'missed_workout';
    if (filter === 'payments') return n.type === 'payment' || n.type === 'debt';
    return true; 
  });

  const unreadTotal = notifications.filter(n => !n.read).length;

  // --- ESTILOS DE LA TARJETA (DISEÑO ATLETA PRIMERO) ---
  const getTypeStyles = (type) => {
    switch (type) {
      case 'message': return { icon: <MessageSquare size={16}/>, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'workout_completed': return { icon: <Trophy size={16}/>, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
      case 'missed_workout': return { icon: <Activity size={16}/>, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
      case 'payment': return { icon: <Clock size={16}/>, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
      case 'debt': return { icon: <CreditCard size={16}/>, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      default: return { icon: <Bell size={16}/>, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            Centro de Mando
            {unreadTotal > 0 && (
              <span className="bg-red-500 text-white text-base px-3 py-1 rounded-full not-italic">
                {unreadTotal}
              </span>
            )}
          </h2>
          <p className="text-zinc-500 text-sm font-bold mt-1">Supervisa y gestiona toda la actividad de tus atletas.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={scanPayments}
            className="flex-1 md:flex-none bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-blue-500/30 flex items-center justify-center gap-2"
            title="Analiza las fechas de pago y genera alertas automáticas"
          >
            <Search size={16}/> Escanear Deudas
          </button>
          
          {unreadTotal > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex-1 md:flex-none bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle2 size={16}/> Limpiar Nuevas
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑAS DE FILTRADO (TIPO HISTORIAL) */}
      <div className="flex overflow-x-auto gap-3 mb-8 pb-2 no-scrollbar border-b border-zinc-800/80">
        {[
          { id: 'unread', label: 'Nuevas' },
          { id: 'history', label: 'Historial' },
          { id: 'messages', label: 'Mensajes' },
          { id: 'workouts', label: 'Entrenamientos' },
          { id: 'payments', label: 'Cobros' },
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setFilter(btn.id)} 
            className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              filter === btn.id 
                ? 'border-yellow-400 text-yellow-400' 
                : 'border-transparent text-zinc-600 hover:text-zinc-300'
            }`}
          >
            {btn.label} {btn.id === 'unread' && unreadTotal > 0 && `(${unreadTotal})`}
          </button>
        ))}
      </div>

      {/* LISTA DE NOTIFICACIONES (DISEÑO ATLETA PRIMERO) */}
      <div className="space-y-4">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => {
            const styles = getTypeStyles(notif.type);
            const isRead = notif.read;
            const timeString = notif.createdAt?.toDate 
              ? notif.createdAt.toDate().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' }) 
              : 'Justo ahora';
            
            return (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`relative group cursor-pointer transition-all duration-300 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 shadow-lg overflow-hidden border ${isRead ? 'bg-zinc-950/40 border-zinc-900 opacity-70 hover:opacity-100' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 hover:border-yellow-400/50'}`}
              >
                
                {/* Indicador de no leído */}
                {!isRead && <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>}

                <div className="flex items-start gap-5 w-full z-10 pl-2">
                  
                  {/* AVATAR DEL ATLETA */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${isRead ? 'bg-zinc-900 text-zinc-600' : 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]'}`}>
                    {notif.clientName ? notif.clientName.charAt(0).toUpperCase() : <User size={24}/>}
                  </div>

                  {/* CONTENIDO: NOMBRE PRIMERO, DETALLE DESPUÉS */}
                  <div className="flex-1 mt-0.5">
                    
                    {/* El Atleta es el protagonista */}
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 mb-2">
                      <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none ${isRead ? 'text-zinc-500' : 'text-white group-hover:text-yellow-400 transition-colors'}`}>
                        {notif.clientName || 'SISTEMA RAGNAR'}
                      </h2>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <Clock size={12} /> {timeString}
                      </div>
                    </div>

                    {/* El tipo de alerta y su detalle */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border shrink-0 ${styles.bg} ${styles.color} ${styles.border}`}>
                        {styles.icon} {notif.title}
                      </span>
                      <p className={`text-sm leading-snug ${isRead ? 'text-zinc-600' : 'text-zinc-300 font-medium'}`}>
                        {notif.body}
                      </p>
                    </div>

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
                   
                   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800">
                      <span className="hidden md:inline">Accionar</span>
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform text-yellow-400"/>
                   </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <h3 className="text-zinc-400 font-black text-2xl uppercase tracking-widest mb-2">Bandeja Vacía</h3>
            <p className="text-zinc-600 text-sm font-medium">No hay notificaciones en esta categoría. Todo bajo control.</p>
          </div>
        )}
      </div>

    </div>
  );
}
