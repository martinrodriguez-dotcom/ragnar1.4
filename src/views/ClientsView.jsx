import React, { useState } from 'react';
import { Search, Plus, User, Trash2, Edit, Dumbbell, Calendar, Check, ChevronRight, Link, X } from 'lucide-react';

export default function ClientsView({ 
  clients = [], 
  settings = null, 
  routines = [], 
  navigateTo = () => {}, 
  onAddClient = async () => { console.error("Error: onAddClient no está conectado"); }, 
  onUpdateClient = async () => { console.error("Error: onUpdateClient no está conectado"); }, 
  onDeleteClient = async () => { console.error("Error: onDeleteClient no está conectado"); } 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    plan: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const safeClients = Array.isArray(clients) ? clients : [];
  
  // SOLUCIÓN AL ERROR #31: Extraemos SOLO el string del nombre del plan.
  const safePlans = settings?.plans && Array.isArray(settings.plans) && settings.plans.length > 0 
    ? settings.plans.map(p => typeof p === 'object' ? p.name : p) 
    : ['Plan Base'];

  const filteredClients = safeClients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      plan: safePlans[0] || 'Plan Base',
      startDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    
    // Blindaje extra por si el plan del cliente se guardó como objeto por error
    const clientPlanName = typeof client.plan === 'object' ? client.plan.name : client.plan;

    setFormData({
      name: client.name || '',
      email: client.email || '',
      plan: clientPlanName || safePlans[0] || 'Plan Base',
      startDate: client.startDate || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const safeName = formData.name || "";
    if (!safeName.trim()) return;

    try {
      if (editingClient) {
        await onUpdateClient({ ...editingClient, ...formData });
      } else {
        await onAddClient(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al procesar el formulario de atleta:", error);
    }
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
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Mis Atletas</h2>
          <p className="text-zinc-500 text-sm font-medium">Gestiona tu equipo y sus planes de suscripción.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-zinc-500" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
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

      {/* LISTADO DE ATLETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div 
              key={client.id} 
              onClick={() => navigateTo('client-detail', client)}
              className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col justify-between group hover:border-yellow-400/50 transition-all shadow-md cursor-pointer relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-bl-xl ${client.studentUserId ? 'bg-green-500/20 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                {client.studentUserId ? 'App Vinculada' : 'Pendiente'}
              </div>

              <div className="flex items-start gap-4 mb-4 mt-2">
                <div className="w-14 h-14 bg-black text-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl border border-zinc-800 group-hover:bg-yellow-400 group-hover:text-black transition-colors shrink-0">
                  {client.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white uppercase tracking-tight leading-tight">{client.name}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 truncate max-w-[150px]">
                    {client.email || 'Sin email asignado'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium bg-black/30 p-2 rounded-xl border border-zinc-800/50">
                  <Dumbbell size={14} className="text-yellow-400"/> {typeof client.plan === 'object' ? client.plan.name : (client.plan || 'Plan Base')}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium bg-black/30 p-2 rounded-xl border border-zinc-800/50">
                  <Calendar size={14} className="text-yellow-400"/> Inicio: {client.startDate ? new Date(client.startDate).toLocaleDateString('es-ES', {timeZone: 'UTC'}) : 'No definido'}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-zinc-800/50" onClick={e => e.stopPropagation()}>
                {!client.studentUserId && (
                  <button 
                    onClick={(e) => handleCopyLink(e, client.id)}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all flex items-center justify-center gap-2 ${copiedId === client.id ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20'}`}
                  >
                    {copiedId === client.id ? <><Check size={14}/> Copiado</> : <><Link size={14}/> Invitar</>}
                  </button>
                )}

                <button 
                  onClick={() => openEditModal(client)}
                  className="p-2 bg-zinc-950 text-zinc-400 hover:text-blue-400 rounded-xl border border-zinc-800 transition-colors"
                  title="Editar"
                >
                  <Edit size={16}/>
                </button>
                <button 
                  onClick={() => onDeleteClient(client.id)}
                  className="p-2 bg-zinc-950 text-zinc-400 hover:text-red-500 rounded-xl border border-zinc-800 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16}/>
                </button>
                
                <div className="ml-auto text-zinc-600 group-hover:text-yellow-400 transition-colors">
                  <ChevronRight size={20}/>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <User size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
              {searchTerm ? 'No se encontraron atletas' : 'No tienes atletas registrados'}
            </p>
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
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre del Atleta</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Correo Electrónico (Para vincular app)</label>
                <input 
                  type="email" 
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Plan de Suscripción</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm" 
                  value={formData.plan} 
                  onChange={e => setFormData({...formData, plan: e.target.value})}
                >
                  {safePlans.map((planName, index) => (
                    <option key={index} value={planName}>{planName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Fecha Base de Cobro</label>
                <input 
                  type="date" 
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors [color-scheme:dark]" 
                  value={formData.startDate} 
                  onChange={e => setFormData({...formData, startDate: e.target.value})} 
                />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20"
                >
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
