import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2, Video, Dumbbell, X, Save } from 'lucide-react';

export default function ExercisesView({ exercises, onAddExercise, onUpdateExercise, onDeleteExercise }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // NUEVO: Estado para saber si estamos editando un ejercicio existente
  const [editingExercise, setEditingExercise] = useState(null);
  const [formData, setFormData] = useState({ name: '', videoUrl: '' });

  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para abrir modal en modo "Crear"
  const openAddModal = () => {
    setEditingExercise(null);
    setFormData({ name: '', videoUrl: '' });
    setIsModalOpen(true);
  };

  // NUEVO: Función para abrir modal en modo "Editar"
  const openEditModal = (exercise) => {
    setEditingExercise(exercise);
    setFormData({ name: exercise.name, videoUrl: exercise.videoUrl || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingExercise) {
      // Si estamos editando, enviamos los datos combinados con el ID original
      onUpdateExercise({ ...editingExercise, ...formData });
    } else {
      // Si es nuevo, simplemente lo agregamos
      onAddExercise(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col animate-in fade-in">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase">Biblioteca de Ejercicios</h2>
          <p className="text-zinc-500 text-sm">Gestiona tu base de datos de movimientos.</p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar ejercicio..." 
              className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg w-full text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus size={18}/> <span className="hidden md:inline">Nuevo Ejercicio</span>
          </button>
        </div>
      </div>

      {/* Exercise List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20">
        {filteredExercises.map(ex => (
          <div key={ex.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col justify-between group hover:border-zinc-700 transition-colors">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="bg-zinc-800 p-2 rounded-lg text-zinc-400">
                  <Dumbbell size={20} />
                </div>
                <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* BOTÓN DE EDITAR */}
                  <button 
                    onClick={() => openEditModal(ex)}
                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-yellow-400 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  {/* BOTÓN DE ELIMINAR */}
                  <button 
                    onClick={() => onDeleteExercise(ex.id)}
                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-white mb-1">{ex.name}</h3>
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center">
              {ex.videoUrl ? (
                <a 
                  href={ex.videoUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Video size={14}/> Ver Tutorial
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600">
                  <Video size={14}/> Sin video
                </span>
              )}
            </div>
          </div>
        ))}
        
        {filteredExercises.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
            <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No se encontraron ejercicios.</p>
          </div>
        )}
      </div>

      {/* Modal Agregar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 w-full max-w-md rounded-xl border border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Dumbbell className="text-yellow-400" size={20} /> 
                {editingExercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nombre del Ejercicio</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ej. Press de Banca"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-zinc-700"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">URL del Video Tutorial (Opcional)</label>
                <div className="relative">
                  <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input 
                    type="url" 
                    placeholder="https://youtube.com/..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-zinc-700"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({...formData, videoUrl: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-lg border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-900 hover:text-white transition-colors uppercase text-xs tracking-wide"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors shadow-[0_0_20px_rgba(250,204,21,0.2)] uppercase text-xs tracking-wide flex justify-center items-center gap-2"
                >
                  <Save size={16} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
