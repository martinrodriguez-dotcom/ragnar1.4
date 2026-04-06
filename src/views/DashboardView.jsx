import React, { useState, useEffect } from 'react';
import { 
  Users, Activity, DollarSign, AlertTriangle, 
  TrendingUp, Plus, CheckCircle, ChevronRight, X 
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export default function DashboardView({ clients, navigateTo, onAddClient }) {
  const [stats, setStats] = useState({
    revenue: 0,
    completedToday: 0,
    debtorsCount: 0
  });
  
  const [completedList, setCompletedList] = useState([]);
  const [debtorsList, setDebtorsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Nuevo Cliente
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', plan: 'Personalizado', startDate: '' });

  const today = new Date();
  const currentMonthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayId = today.toISOString().split('T')[0];

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      let totalRevenue = 0;
      let completedCount = 0;
      let tempCompletedList = [];
      let tempDebtorsList = [];

      for (const client of clients) {
        // 1. Verificar Pagos (Ingresos del mes y Deudores)
        const payRef = doc(db, 'clients', client.id, 'payments', currentMonthId);
        const paySnap = await getDoc(payRef);
        
        let hasPaid = false;
        if (paySnap.exists() && paySnap.data().status === 'paid') {
          hasPaid = true;
          totalRevenue += Number(paySnap.data().amount || 0);
        } else if (client.startDate) {
          // Si no pagó, calculamos si está vencido
          const start = new Date(client.startDate);
          const expDate = new Date(today.getFullYear(), today.getMonth(), start.getDate());
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 0) {
            tempDebtorsList.push(client);
          }
        }

        // 2. Verificar Entrenamientos de Hoy
        const sessRef = doc(db, 'clients', client.id, 'sessions', todayId);
        const sessSnap = await getDoc(sessRef);
        
        if (sessSnap.exists()) {
          const data = sessSnap.data();
          if (data.isFinalized) {
            completedCount++;
            tempCompletedList.push({ 
              ...client, 
              performance: data.performanceSummary || 'Entrenamiento completado' 
            });
          }
        }
      }

      setStats({
        revenue: totalRevenue,
        completedToday: completedCount,
        debtorsCount: tempDebtorsList.length
      });
      setCompletedList(tempCompletedList);
      setDebtorsList(tempDebtorsList);
      setIsLoading(false);
    };

    if (clients.length > 0) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [clients, currentMonthId, todayId]);

  const handleCreateClient = (e) => {
    e.preventDefault();
    if (!newClient.name || !newClient.startDate) return;
    onAddClient(newClient);
    setIsAddModalOpen(false);
    setNewClient({ name: '', email: '', plan: 'Personalizado', startDate: '' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Panel</h2>
          <p className="text-zinc-500 text-sm font-medium">Resumen general de tu negocio.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)] flex items-center gap-2"
        >
          <Plus size={18}/> Nuevo Alumno
        </button>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Ingresos */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-yellow-400/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={64} className="text-green-500 -mr-4 -mt-4" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-500/10 p-2 rounded-lg text-green-500"><DollarSign size={20}/></div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Ingresos del Mes</p>
          </div>
          <p className="text-3xl font-black text-white">${stats.revenue.toLocaleString('es-AR')}</p>
        </div>

        {/* Alumnos Activos */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-blue-500/50 transition-colors cursor-pointer" onClick={() => navigateTo('clients')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={64} className="text-blue-500 -mr-4 -mt-4" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500"><Users size={20}/></div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Alumnos Activos</p>
          </div>
          <p className="text-3xl font-black text-white">{clients.length}</p>
        </div>

        {/* Entrenaron Hoy */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-yellow-400/50 transition-colors cursor-pointer" onClick={() => navigateTo('notifications')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={64} className="text-yellow-400 -mr-4 -mt-4" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-400/10 p-2 rounded-lg text-yellow-400"><TrendingUp size={20}/></div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Entrenaron Hoy</p>
          </div>
          <p className="text-3xl font-black text-white">{stats.completedToday}</p>
        </div>

        {/* Deudores */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-red-500/50 transition-colors cursor-pointer" onClick={() => navigateTo('payments')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={64} className="text-red-500 -mr-4 -mt-4" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-500/10 p-2 rounded-lg text-red-500"><AlertTriangle size={20}/></div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Cuotas Vencidas</p>
          </div>
          <p className="text-3xl font-black text-white">{stats.debtorsCount}</p>
        </div>

      </div>

      {/* COLUMNAS DE DETALLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Columna Izquierda: Actividad de Hoy */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <CheckCircle size={18} className="text-green-500"/> Finalizaron Hoy
            </h3>
            <button onClick={() => navigateTo('notifications')} className="text-[10px] font-bold text-yellow-400 uppercase hover:underline">Ver todas</button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {completedList.length > 0 ? (
              completedList.map(client => (
                <div key={client.id} className="bg-black/50 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group cursor-pointer hover:border-zinc-700" onClick={() => navigateTo('client-detail', client)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center font-bold">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white uppercase text-sm">{client.name}</h4>
                      <p className="text-zinc-500 text-[10px] uppercase mt-0.5 line-clamp-1">"{client.performance}"</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 group-hover:text-yellow-400 transition-colors"/>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                <Activity size={40} className="mb-3"/>
                <p className="text-xs uppercase font-bold tracking-widest">Nadie ha finalizado aún</p>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Atención Requerida (Deudores) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500"/> Atención Requerida
            </h3>
            <button onClick={() => navigateTo('payments')} className="text-[10px] font-bold text-yellow-400 uppercase hover:underline">Ir a Cobros</button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {debtorsList.length > 0 ? (
              debtorsList.map(client => (
                <div key={client.id} className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl flex justify-between items-center group cursor-pointer hover:border-red-500/50 transition-colors" onClick={() => navigateTo('payments')}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center font-bold">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white uppercase text-sm">{client.name}</h4>
                      <p className="text-red-400 text-[10px] uppercase font-bold mt-0.5">Cuota Vencida</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-red-500/50 group-hover:text-red-500 transition-colors"/>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                <CheckCircle size={40} className="mb-3 text-green-500/50"/>
                <p className="text-xs uppercase font-bold tracking-widest">Todos al día</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- MODAL: NUEVO ALUMNO --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Alta de Alumno</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre Completo</label>
                <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400" placeholder="Ej. Juan Pérez" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Email (Opcional, para invitar)</label>
                <input type="email" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400" placeholder="juan@email.com" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Plan</label>
                  <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 text-sm" value={newClient.plan} onChange={e => setNewClient({...newClient, plan: e.target.value})}>
                    <option value="Personalizado">Personalizado</option>
                    <option value="Rutina Base">Rutina Base</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Fecha de Cobro</label>
                  <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 text-sm" value={newClient.startDate} onChange={e => setNewClient({...newClient, startDate: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase tracking-widest mt-4 transition-colors">
                Crear Alumno
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
