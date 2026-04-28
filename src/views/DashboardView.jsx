import React, { useState, useEffect } from 'react';
import { 
  Users, CreditCard, Layout, TrendingUp, 
  ChevronRight, DollarSign, X, CheckCircle, Clock, Plus
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function DashboardView({ clients, navigateTo }) {
  // --- ESTADOS ---
  const [loadingIncome, setLoadingIncome] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [paidClientsDetail, setPaidClientsDetail] = useState([]);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // Estadísticas básicas
  const activeClients = clients.filter(c => c.active !== false).length;
  
  // --- CÁLCULO INTELIGENTE DE INGRESOS ---
  useEffect(() => {
    const fetchIncomeDetails = async () => {
      setLoadingIncome(true);
      let total = 0;
      let details = [];
      const today = new Date();

      for (const client of clients) {
        // Ignoramos atletas inactivos o sin fecha de alta
        if (client.active === false || !client.startDate) continue;

        // 1. Calculamos cuál es su Ciclo Relativo Actual (Igual que en Pagos)
        const startDay = new Date(client.startDate + 'T12:00:00Z').getUTCDate();
        let cycleYear = today.getFullYear();
        let cycleMonth = today.getMonth() + 1;

        if (today.getDate() < startDay) {
          cycleMonth -= 1;
          if (cycleMonth === 0) {
            cycleMonth = 12;
            cycleYear -= 1;
          }
        }

        const periodId = `${cycleYear}-${String(cycleMonth).padStart(2, '0')}`;

        // 2. Buscamos en Firebase si este ciclo exacto está pagado
        try {
          const payRef = doc(db, 'clients', client.id, 'payments', periodId);
          const paySnap = await getDoc(payRef);

          if (paySnap.exists() && paySnap.data().status === 'paid') {
            const amount = parseFloat(client.price || 0); // Si no le pusiste precio, suma 0 pero lo lista
            total += amount;
            
            details.push({
              id: client.id,
              name: client.name,
              amount: amount,
              paidAt: paySnap.data().paidAt?.toDate() || new Date(),
              periodId: periodId
            });
          }
        } catch (error) {
          console.error(`Error obteniendo pago de ${client.name}:`, error);
        }
      }

      // Ordenamos el detalle para que los pagos más recientes salgan arriba
      details.sort((a, b) => b.paidAt - a.paidAt);

      setMonthlyIncome(total);
      setPaidClientsDetail(details);
      setLoadingIncome(false);
    };

    if (clients && clients.length > 0) {
      fetchIncomeDetails();
    } else {
      setLoadingIncome(false);
    }
  }, [clients]);

  // Formateador de moneda
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER PRINCIPAL */}
      <div className="mb-10">
        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
          <TrendingUp className="text-yellow-400" size={32}/> Dashboard
        </h2>
        <p className="text-zinc-500 text-sm font-bold mt-1">Resumen general de tu negocio y tus atletas.</p>
      </div>

      {/* GRID DE MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* TARJETA 1: ATLETAS ACTIVOS */}
        <div 
          onClick={() => navigateTo('clients')}
          className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl cursor-pointer group hover:border-yellow-400/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
              <Users size={24}/>
            </div>
            <ChevronRight size={20} className="text-zinc-600 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all"/>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-black text-white leading-none tracking-tighter mb-1">{activeClients}</h3>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Atletas Activos</p>
          </div>
        </div>

        {/* TARJETA 2: INGRESOS DEL MES (CLICKABLE) */}
        <div 
          onClick={() => setIsIncomeModalOpen(true)}
          className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl cursor-pointer group hover:border-yellow-400/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-2xl">
              <DollarSign size={24}/>
            </div>
            <ChevronRight size={20} className="text-zinc-600 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all"/>
          </div>
          <div className="relative z-10">
            {loadingIncome ? (
              <div className="h-10 flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-yellow-400"></div>
              </div>
            ) : (
              <h3 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tighter mb-1 truncate">
                {formatMoney(monthlyIncome)}
              </h3>
            )}
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Ingresos del Mes</p>
          </div>
        </div>

        {/* TARJETA 3: ESTADO DE COBROS */}
        <div 
          onClick={() => navigateTo('payments')}
          className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl cursor-pointer group hover:border-yellow-400/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <CreditCard size={24}/>
            </div>
            <ChevronRight size={20} className="text-zinc-600 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all"/>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-white leading-none tracking-tighter mb-2 mt-2">Gestionar Pagos</h3>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Ver deudas y vencimientos</p>
          </div>
        </div>

      </div>

      {/* ACCIONES RÁPIDAS */}
      <div>
        <h3 className="text-white font-bold uppercase text-sm tracking-widest mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <button 
            onClick={() => navigateTo('routines')}
            className="flex items-center gap-4 p-5 bg-black/40 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors text-left group"
          >
            <div className="p-3 bg-zinc-900 group-hover:bg-yellow-400/10 group-hover:text-yellow-400 text-zinc-500 rounded-xl transition-colors">
              <Layout size={20}/>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-0.5">Crear Plantilla</h4>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Arma nuevas rutinas base</p>
            </div>
          </button>

          <button 
            onClick={() => navigateTo('calendar')}
            className="flex items-center gap-4 p-5 bg-black/40 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors text-left group"
          >
            <div className="p-3 bg-zinc-900 group-hover:bg-yellow-400/10 group-hover:text-yellow-400 text-zinc-500 rounded-xl transition-colors">
              <CalendarIcon size={20}/>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-0.5">Ver Agenda Global</h4>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Planificación de todos</p>
            </div>
          </button>

        </div>
      </div>

      {/* --- MODAL DE DETALLE DE INGRESOS --- */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-green-500/20 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>

            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                  <DollarSign className="text-green-500" size={20}/> Ingresos del Mes
                </h2>
                <p className="text-green-500 font-black text-2xl tracking-tighter mt-1">
                  {formatMoney(monthlyIncome)}
                </p>
              </div>
              <button 
                onClick={() => setIsIncomeModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {paidClientsDetail.length > 0 ? (
                paidClientsDetail.map((payment, index) => (
                  <div 
                    key={`${payment.id}-${index}`} 
                    className="p-4 rounded-2xl border bg-black/40 border-zinc-800 flex items-center justify-between transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-green-500/10 text-green-500 shrink-0">
                        <CheckCircle size={18}/>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm uppercase tracking-tight truncate max-w-[140px]">
                          {payment.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 text-zinc-500">
                          <Clock size={10}/>
                          <p className="text-[9px] font-black uppercase tracking-widest">
                            {payment.paidAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <p className="text-green-400 font-black text-sm">
                        {payment.amount > 0 ? formatMoney(payment.amount) : 'Sin Precio'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-black/30 rounded-2xl border border-dashed border-zinc-800">
                  <DollarSign size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Aún no hay pagos registrados en este ciclo</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
              <button 
                onClick={() => {
                  setIsIncomeModalOpen(false);
                  navigateTo('payments');
                }} 
                className="w-full py-4 text-black font-black uppercase tracking-widest text-xs bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors shadow-lg shadow-yellow-400/20"
              >
                Ir al Panel de Cobros
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
