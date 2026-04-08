import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, Video, X, Dumbbell } from 'lucide-react';

// Restaurado el prop original: exercisesLibrary
export default function ExercisesView({ exercisesLibrary = [], onAddExercise, onUpdateExercise, onDeleteExercise }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [formData, setFormData] = useState({ name: '', videoUrl: '', category: 'Fuerza' });

  // Nos aseguramos de que no de error "filter of undefined"
  const safeExercises = Array.isArray(exercisesLibrary) ? exercisesLibrary : [];

  const filteredExercises = safeExercises.filter(ex => 
    ex.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingExercise(null);
    setFormData({ name: '', videoUrl: '', category: 'Fuerza' });
    setIsModalOpen(true);
  };

  const openEditModal = (ex) => {
    setEditingExercise(ex);
    setFormData({ name: ex.name, videoUrl: ex.videoUrl || '', category: ex.category || 'Fuerza' });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingExercise) {
      onUpdateExercise({ ...editingExercise, ...formData });
    } else {
      onAddExercise(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Librería de Ejercicios</h2>
          <p className="text-zinc-500 text-sm font-medium">Gestiona tu base de datos de movimientos y videos.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-zinc-500" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar ejercicio..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shrink-0"
          >
            <Plus size={18}/> <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExercises.length > 0 ? (
          filteredExercises.map(ex => (
            <div key={ex.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col justify-between group hover:border-yellow-400/50 transition-all shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                  <div className="bg-black text-yellow-400 p-3 rounded-2xl border border-zinc-800 group-hover:bg-yellow-400 group-hover:text-black transition-colors shrink-0">
                    <Dumbbell size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-tight leading-tight">{ex.name}</h3>
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{ex.category || 'General'}</span>
                  </div>
                </div>
                {ex.videoUrl && (
                  <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-blue-500 bg-blue-500/10 p-2 rounded-xl hover:bg-blue-500 hover:text-white transition-colors" title="Ver Video">
                    <Video size={16} />
                  </a>
                )}
              </div>
              
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-800/50">
                <button 
                  onClick={() => openEditModal(ex)}
                  className="flex-1 py-2 bg-zinc-950 text-zinc-400 hover:text-blue-400 text-xs font-bold uppercase rounded-xl border border-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={14}/> Editar
                </button>
                <button 
                  onClick={() => onDeleteExercise(ex.id)}
                  className="flex-1 py-2 bg-zinc-950 text-zinc-400 hover:text-red-500 text-xs font-bold uppercase rounded-xl border border-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14}/> Borrar
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <Dumbbell size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
              {searchTerm ? 'No se encontraron ejercicios' : 'Tu librería está vacía'}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                {editingExercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre del Ejercicio</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Sentadilla Libre"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Categoría / Grupo Muscular</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm" 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="Fuerza">Fuerza / General</option>
                  <option value="Pecho">Pecho</option>
                  <option value="Espalda">Espalda</option>
                  <option value="Piernas">Piernas</option>
                  <option value="Hombros">Hombros</option>
                  <option value="Brazos">Brazos</option>
                  <option value="Cardio">Cardio / HIIT</option>
                  <option value="Core">Core / Abs</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Link de Video (YouTube/Instagram)</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.videoUrl} 
                  onChange={e => setFormData({...formData, videoUrl: e.target.value})} 
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
                  {editingExercise ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
