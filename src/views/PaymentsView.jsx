import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CreditCard, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar as CalendarIcon, 
  User, 
  RefreshCcw, 
  History, 
  X, 
  CalendarDays 
} from 'lucide-react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function PaymentsView({ clients, settings }) {
  // --- ESTADOS PRINCIPALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [allDebts, setAllDebts] = useState({});

  // --- ESTADOS DEL HISTORIAL ---
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- LÓGICA DE CÁLCULO DE CICLOS Y DEUDA ---
  const calculateClientDebt = async (client) => {
    if (!client.startDate) {
      return null;
    }

    const today = new Date();
    const startParts = client.startDate.split('-'); // YYYY-MM-DD
    const startYear = parseInt(startParts[0]);
    const startMonth = parseInt(startParts[1]);
    const startDay = parseInt(startParts[2]);

    // Generar lista de todos los periodos desde el alta hasta el mes actual
    const cycles = [];
    
    // Determinamos cuál es el mes límite a evaluar
    const limitDate = new Date();
    if (today.getDate() < startDay) {
        // Si hoy es antes del día de cobro, el ciclo actual es el del mes anterior
        limitDate.setMonth(limitDate.getMonth() - 1);
    }

    let tempDate = new Date(startYear, startMonth - 1, 1);
    let todayComparison = new Date(limitDate.getFullYear(), limitDate.getMonth(), 1);

    // Iteramos mes a mes para armar los periodos (Ej: "2026-03", "2026-04")
    while (tempDate <= todayComparison) {
      const yearStr = tempDate.getFullYear();
      const monthStr = String(tempDate.getMonth() + 1).padStart(2, '0');
      cycles.push(`${yearStr}-${monthStr}`);
      
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // Buscamos los pagos realizados en Firebase para este cliente
    const paymentsRef = collection(db, 'clients', client.id, 'payments');
    const paymentsSnap = await getDocs(paymentsRef);
    
    // Filtramos solo los que están marcados como 'paid'
    const paidPeriods = paymentsSnap.docs
      .filter((d) => d.data().status === 'paid')
      .map((d) => d.id);

    // Identificamos periodos pendientes comparando todos los ciclos vs los pagados
    const pendingCycles = cycles.filter((c) => !paidPeriods.includes(c));

    // Obtenemos el costo del plan asignado buscando en settings
    let planCost = 0;
    if (settings && settings.plans) {
      const assignedPlan = settings.plans.find((p) => p.name === client.plan);
      if (assignedPlan) {
        planCost = parseFloat(assignedPlan.price);
      }
    }

    return {
      pendingCycles: pendingCycles,
      planCost: planCost,
      startDay: startDay,
      totalDebt: pendingCycles.length * planCost,
      isUpToDate: pendingCycles.length === 0
    };
  };

  // --- EFECTO PARA CARGAR TODAS LAS DEUDAS ---
  useEffect(() => {
    const fetchAllDebts = async () => {
      setLoading(true);
      const debts = {};
      
      for (const client of clients) {
        if (client.active === false) {
          continue;
        }
        
        const res = await calculateClientDebt(client);
        if (res) {
          debts[client.id] = res;
        }
      }
      
      setAllDebts(debts);
      setLoading(false);
    };

    if (clients && clients.length > 0) {
      fetchAllDebts();
    } else {
      setLoading(false);
    }
  }, [clients, settings]);

  // --- FUNCIÓN PARA MARCAR UN MES COMO PAGADO ---
  const handleMarkAsPaid = async (client, periodId) => {
    const debtInfo = allDebts[client.id];
    
    if (!debtInfo) {
      return;
    }

    const confirmMessage = `¿Registrar pago de ${periodId} por $${debtInfo.planCost}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await setDoc(doc(db, 'clients', client.id, 'payments', periodId), {
        status: 'paid',
        amount: debtInfo.planCost,
        planName: client.plan || 'Sin Plan',
        paidAt: new Date(),
        clientName: client.name // Guardamos el nombre para facilitar lectura después
      });
      
      // Actualizar estado local para que desaparezca el botón
      setAllDebts((prev) => {
        const currentClientInfo = prev[client.id];
        return {
          ...prev,
          [client.id]: {
            ...currentClientInfo,
            pendingCycles: currentClientInfo.pendingCycles.filter((c) => c !== periodId),
            isUpToDate: (currentClientInfo.pendingCycles.length - 1) === 0
          }
        };
      });

    } catch (error) { 
      console.error("Error al marcar pago:", error); 
    }
  };

  // --- FUNCIÓN PARA ABRIR HISTORIAL ---
  const handleOpenHistory = async (client) => {
    setHistoryClient(client);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    
    try {
      const snap = await getDocs(collection(db, 'clients', client.id, 'payments'));
      const docs = snap.docs.map((d) => {
        return { 
          id: d.id, 
          ...d.data() 
        };
      });
      
      // Ordenar por ID del periodo (que es YYYY-MM) de forma descendente
      docs.sort((a, b) => b.id.localeCompare(a.id));
      
      setHistoryData(docs);
    } catch (error) { 
      console.error("Error cargando historial:", error); 
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredClients = clients.filter((c) => {
    if (c.active === false) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    return c.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
           <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
             <CreditCard className="text-yellow-400" size={28}/> Gestión de Cobros
           </h2>
           <p className="text-zinc-500 text-sm font-medium mt-1">
             Sincronizado con fecha de alta y planes asignados.
           </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-3.5 text-zinc-500" size={18}/>
          <input 
            type="text" 
            placeholder="Buscar atleta..." 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm font-bold transition-colors" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {filteredClients.map((client) => {
            const info = allDebts[client.id];
            
            if (!info) {
              return null; // Si no tiene info, probablemente no tiene startDate
            }

            return (
              <div 
                key={client.id} 
                className={`bg-zinc-900 border rounded-[2rem] p-6 transition-all shadow-xl flex flex-col h-full ${!info.isUpToDate ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-zinc-800'}`}
              >
                
                {/* Cabecera de la Tarjeta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${!info.isUpToDate ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      <User size={24}/>
                    </div>
                    <div className="truncate pr-2">
                      <h3 className="font-black text-lg text-white uppercase leading-tight truncate max-w-[120px]">
                        {client.name}
                      </h3>
                      <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest truncate">
                        Plan: {client.plan || 'No asignado'}
                      </p>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0 ${info.isUpToDate ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {info.isUpToDate ? 'Al Día' : 'Con Deuda'}
                  </span>
                </div>

                {/* Lista de Meses Pendientes */}
                <div className="bg-black/40 rounded-2xl p-4 mb-4 border border-zinc-800/50 flex-1">
                   <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3">
                     Meses Pendientes:
                   </p>
                   
                   {info.pendingCycles.length > 0 ? (
                     <div className="space-y-2">
                       {info.pendingCycles.map((cycle) => (
                         <div key={cycle} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-xl border border-zinc-800">
                            <span className="text-white font-bold text-xs uppercase">
                              {cycle}
                            </span>
                            <button 
                              onClick={() => handleMarkAsPaid(client, cycle)} 
                              className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-colors"
                            >
                              Cobrar ${info.planCost}
                            </button>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-green-500 text-xs font-bold uppercase text-center mt-4">
                       Sin deudas pendientes
                     </p>
                   )}
                </div>

                {/* Botón de Historial */}
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleOpenHistory(client)} 
                    className="flex-1 py-3 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <History size={14}/> Historial
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL DE HISTORIAL DE PAGOS --- */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2.5rem] border border-zinc-800 shadow-2xl flex flex-col max-h-[80vh]">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                  Historial de Pagos
                </h2>
                <p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  {historyClient?.name}
                </p>
              </div>
              <button 
                onClick={() => setHistoryModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <RefreshCcw className="animate-spin text-yellow-400" size={32}/>
                </div>
              ) : historyData.length > 0 ? (
                historyData.map((record) => {
                  
                  // Formateador seguro de fecha
                  let dateString = "Sin fecha";
                  if (record.paidAt?.toDate) {
                    dateString = record.paidAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                  } else if (record.paidAt) {
                    dateString = new Date(record.paidAt).toLocaleDateString('es-ES');
                  }

                  return (
                    <div 
                      key={record.id} 
                      className="p-4 rounded-2xl border bg-black/40 border-zinc-800 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-white font-black text-sm uppercase">
                          {record.id}
                        </p>
                        <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-1">
                          Pagado el: {dateString}
                        </p>
                      </div>
                      <span className="text-green-500 font-black text-sm">
                        ${record.amount}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <History size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                    Sin registros previos
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
               <button 
                  onClick={() => setHistoryModalOpen(false)} 
                  className="w-full py-4 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-xs bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
