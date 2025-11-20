import React, { useState } from 'react';
import { Users, CheckCircle, Activity, Plus, Zap } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import NewClientForm from '../components/NewClientForm';

export default function DashboardView({ clients, navigateTo, onAddClient }) {
  const [showModal, setShowModal] = useState(false);
  const activeClients = clients.filter(c => c.status === 'active').length;
  
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header del Dashboard */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Dashboard</h2>
          <p className="text-zinc-500 mt-1 text-sm">Resumen de rendimiento diario.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded font-bold shadow-[0_4px_0px_rgb(161,98,7)] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-sm"
        >
          <Plus size={18} /> <span className="hidden sm:inline">Nuevo Cliente</span>
        </button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Clientes Activos" value={activeClients} trend="+2 este mes" icon={<Users className="text-yellow-400" />} />
        <StatCard title="Rutinas Completadas" value="12" trend="85% cumplimiento" icon={<CheckCircle className="text-zinc-100" />} />
        <StatCard title="Ingresos (Mes)" value="$1,250" trend="+12% vs mes pasado" icon={<Activity className="text-yellow-400" />} />
      </div>

      {/* Tabla de Actividad Reciente */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 backdrop-blur-sm">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap size={18} className="text-yellow-400"/> Actividad Reciente
        </h3>
        <div className="space-y-4">
          {clients.slice(0, 3).map(client => (
            <div key={client.id} className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-700 group" onClick={() => navigateTo('client-detail', client)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 font-bold group-hover:text-yellow-400 transition-colors">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200 group-hover:text-white">{client.name}</p>
                  <p className="text-xs text-zinc-500">Plan: {client.plan}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs border border-green-900 bg-green-900/20 text-green-400 px-2 py-1 rounded-full font-medium">
                  Check-in: {client.lastCheckin}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Nuevo Cliente (Condicional) */}
      {showModal && (
        <NewClientForm 
          onClose={() => setShowModal(false)} 
          onSave={onAddClient}
        />
      )}
    </div>
  );
}