import React, { useState } from 'react';
import { Search, ChevronRight, Plus, X, Dumbbell, Calendar, Check, Link, Edit, Trash2, User } from 'lucide-react';

export default function ClientsView({ 
  clients = [], 
  settings = null, 
  navigateTo, 
  onAddClient, 
  onUpdateClient, 
  onDeleteClient 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    plan: '',
    startDate: ''
  });

  const safeClients = Array.isArray(clients) ? clients : [];
  const safePlans = settings?.plans && Array.isArray(settings.plans) && settings.plans.length > 0 
    ? settings.plans.map(p => typeof p === 'object' ? String(p.name) : String(p)) 
    : ['Plan Base'];

  const filteredClients = safeClients.filter(client => {
    if (!client || !client.name) return false;
    return client.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const openAddModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      plan: safePlans[0],
      startDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client, e) => {
    e.stopPropagation();
    setEditingClient(client);
    let planStr = client.plan || safePlans[0];
    if (typeof client.plan === 'object' && client.plan !== null) {
      planStr = client.plan.name || safePlans[0];
    }
    setFormData({
      name: String(client.name || ''),
      email: String(client.email || ''),
      plan: String(planStr),
      startDate: client.startDate ? String(client.startDate) : new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDelete = (clientId, e) => {
    e.stopPropagation();
    if(typeof onDeleteClient === 'function') {
      onDeleteClient(clientId);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || String(formData.name).trim() === '') return;

    const dataToSave = {
      name: String(formData.name),
      email: String(formData.email),
      plan: String(formData.plan || safePlans[0]),
      startDate: String(formData.startDate),
      status: 'active'
    };

    if (editingClient) {
      if(typeof onUpdateClient === 'function') onUpdateClient({ ...editingClient, ...dataToSave });
    } else {
      if(typeof onAddClient === 'function') onAddClient(dataToSave);
    }
    
    setIsModalOpen(false);
  };

  const handleCopyLink = (e, clientId) => {
    e.stopPropagation(); 
    const inviteLink = `${window.location.origin}?invite=${clientId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* Header con Buscador y Botón */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase">Mis Clientes</h2>
          <p className="text-zinc-500 text-sm">Gestión de atletas y suscripciones.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar atleta..." 
              className="pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl w-full text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shrink-0"
          >
            <Plus size={18}/> <span className="hidden sm:inline">Nuevo Atleta</span>
          </button>
        </div>
      </div>

      {/* Grilla de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div 
              key={client.id} 
              onClick={() => { if(typeof navigateTo === 'function') navigateTo('client-detail', client) }}
              className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-400/50 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400 transform -translate-x-1 group-hover:translate-x-0 transition-transform duration-200"></div>

              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-zinc-800 text-yellow-400 rounded-full flex items-center justify-center font-bold text-lg border border-zinc-700">
                  {client.name ? String(client.name).charAt(0).toUpperCase() : '?'}
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${client.studentUserId ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-amber-900/30 text-amber-500 border border-amber-900'}`}>
                  {client.studentUserId ? 'App Vinculada' : 'Pendiente'}
                </span>
              </div>

              <h3 className="font-bold text-lg text-white group-hover:text-yellow-400 transition-colors mb-1">{client.name}</h3>
              
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Dumbbell size={12} className="text-yellow-400"/> 
                  {typeof client.plan === 'object' && client.plan !== null ? client.plan.name : (client.plan || 'Plan Base')}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Calendar size={12} className="text-yellow-400"/> 
                  Inicio: {client.startDate ? new Date(client.startDate).toLocaleDateString('es-ES', {timeZone: 'UTC'}) : 'No definido'}
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-800" onClick={e => e.stopPropagation()}>
                {!client.studentUserId && (
                  <button 
                    onClick={(e) => handleCopyLink(e, client.id)}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg border transition-all flex items-center justify-center gap-2 ${copiedId === client.id ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20'}`}
                  >
                    {copiedId === client.id ? <><Check size={14}/> Copiado</> : <><Link size={14}/> Invitar</>}
                  </button>
                )}

                <button onClick={(e) => openEditModal(client, e)} className="p-2 text-zinc-400 hover:text-blue-400 rounded-lg hover:bg-zinc-800 transition-colors">
                  <Edit size={16}/>
                </button>
                <button onClick={(e) => handleDelete(client.id, e)} className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-800 transition-colors">
                  <Trash2 size={16}/>
                </button>
                
                <div className="ml-auto text-zinc-600 group-hover:text-yellow-400 transition-colors">
                  <ChevronRight size={18}/>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <User size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No se encontraron atletas</p>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                {editingClient ? 'Editar Atleta' : 'Nuevo Atleta'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre del Atleta</label>
                <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Correo Electrónico (Opcional)</label>
                <input type="email" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Plan de Suscripción</label>
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm" value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value})}>
                  {safePlans.map((planName, index) => <option key={index} value={planName}>{planName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Fecha Base de Cobro</label>
                <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors [color-scheme:dark]" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20">
                  {editingClient ? 'Guardar Cambios' : 'Crear Atleta'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
