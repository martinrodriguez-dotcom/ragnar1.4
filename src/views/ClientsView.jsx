import React, { useState, useEffect } from 'react';
import { 
  Search, Edit, Trash2, User, ChevronRight, 
  Dumbbell, Calendar as CalendarIcon, X, Mail, Link, Check
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ClientsView({ clients, navigateTo, onUpdateClient, onDeleteClient }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [trainerPlans, setTrainerPlans] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists() && snap.data().plans) {
          setTrainerPlans(snap.data().plans);
        }
      } catch (error) { 
        console.error(error); 
      }
    };
    fetchSettings();
  }, []);

  const handleCopyLink = (clientId, e) => {
    e.stopPropagation();
    const inviteLink = `${window.location.origin}/?invite=${clientId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Mis Atletas</h2>
          <p className="text-zinc-500 text-sm font-medium">Gestiona tu base de clientes.</p>
        </div>
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-500" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar alumno..." 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* LISTADO DE CLIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div 
              key={client.id} 
              onClick={() => navigateTo('client-detail', client)} 
              className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex items-center justify-between group cursor-pointer hover:border-yellow-400/50 transition-all shadow-md"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 bg-black text-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shrink-0 group-hover:bg-yellow-400 group-hover:text-black transition-colors border border-zinc-800">
                  {client.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white uppercase truncate">{client.name}</h3>
                    {/* BOTÓN DE LINK RÁPIDO */}
                    <button 
                      onClick={(e) => handleCopyLink(client.id, e)}
                      className={`p-1.5 rounded-lg transition-all ${copiedId === client.id ? 'bg-green-500/20 text-green-500' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                      title="Copiar Link de Invitación"
                    >
                      {copiedId === client.id ? <Check size={14}/> : <Link size={14}/>}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 uppercase font-black mt-1">
                    <span className="text-yellow-400 flex items-center gap-1"><Dumbbell size={10}/> {client.plan || 'Sin plan'}</span>
                    <span>{client.studentUserId ? '✅ Vinculado' : '⏳ Pendiente'}</span>
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingClient({...client}); setIsEditModalOpen(true); }} 
                  className="p-2 bg-zinc-950 text-zinc-400 hover:text-blue-400 rounded-xl border border-zinc-800 transition-colors"
                  title="Editar Alumno"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }} 
                  className="p-2 bg-zinc-950 text-zinc-400 hover:text-red-500 rounded-xl border border-zinc-800 ml-1 transition-colors"
                  title="Eliminar Alumno"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={20} className="text-zinc-700 group-hover:text-yellow-400 ml-2 transition-colors" />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <User size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
              {searchTerm ? 'No se encontraron resultados' : 'Aún no tienes alumnos registrados'}
            </p>
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN */}
      {isEditModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Editar Atleta</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); onUpdateClient(editingClient); setIsEditModalOpen(false); }} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <User size={12}/> Nombre Completo
                </label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={editingClient.name} 
                  onChange={e => setEditingClient({...editingClient, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Mail size={12}/> Email (Opcional)
                </label>
                <input 
                  type="email" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={editingClient.email || ''} 
                  onChange={e => setEditingClient({...editingClient, email: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Dumbbell size={12}/> Plan Asignado
                  </label>
                  <select 
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm outline-none focus:border-yellow-400 transition-colors" 
                    value={editingClient.plan} 
                    onChange={e => setEditingClient({...editingClient, plan: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {trainerPlans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    <option value="Personalizado">Personalizado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <CalendarIcon size={12}/> Fecha de Cobro
                  </label>
                  <input 
                    type="date" 
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm outline-none focus:border-yellow-400 transition-colors" 
                    value={editingClient.startDate || ''} 
                    onChange={e => setEditingClient({...editingClient, startDate: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
