import React, { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

export default function ClientsView({ clients, navigateTo }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtramos clientes según lo que se escriba en el buscador
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      {/* Header con Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase">Mis Clientes</h2>
          <p className="text-zinc-500 text-sm">Gestión de atletas y rutinas.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar atleta..." 
            className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg w-full md:w-64 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grilla de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div 
            key={client.id} 
            onClick={() => navigateTo('client-detail', client)}
            className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-400/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            {/* Decoración hover (Barra lateral amarilla animada) */}
            <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400 transform -translate-x-1 group-hover:translate-x-0 transition-transform duration-200"></div>

            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-zinc-800 text-yellow-400 rounded-full flex items-center justify-center font-bold text-lg border border-zinc-700">
                {client.name.charAt(0)}
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${client.status === 'active' ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-amber-900/30 text-amber-500 border border-amber-900'}`}>
                {client.status === 'active' ? 'Activo' : 'Pendiente'}
              </span>
            </div>
            <h3 className="font-bold text-lg text-white group-hover:text-yellow-400 transition-colors">{client.name}</h3>
            <p className="text-sm text-zinc-500 mb-4 uppercase text-xs font-bold tracking-wide">{client.plan}</p>
            
            <div className="flex items-center justify-between text-sm text-zinc-600 pt-4 border-t border-zinc-800">
              <span className="text-xs">Último: {client.lastCheckin}</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform text-zinc-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}