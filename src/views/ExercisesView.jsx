import React, { useState } from 'react';
import { Plus, Trash2, Dumbbell, Video, Link as LinkIcon } from 'lucide-react';

export default function ExercisesView({
  exercises,
  onAddExercise,
  onDeleteExercise,
}) {
  const [newExercise, setNewExercise] = useState({ name: '', videoUrl: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newExercise.name.trim()) return;
    onAddExercise(newExercise); // Pasamos el objeto completo
    setNewExercise({ name: '', videoUrl: '' });
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white uppercase">
          Biblioteca de Ejercicios
        </h2>
        <p className="text-zinc-500 text-sm">
          Crea tu base de datos de movimientos y videos.
        </p>
      </div>

      {/* Formulario de Agregar */}
      <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 mb-6">
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Plus size={16} className="text-yellow-400" /> Nuevo Ejercicio
        </h3>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Dumbbell
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Nombre (ej. Press Plano)"
              className="w-full bg-black border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-white focus:border-yellow-400 outline-none"
              value={newExercise.name}
              onChange={(e) =>
                setNewExercise({ ...newExercise, name: e.target.value })
              }
            />
          </div>
          <div className="relative flex-1">
            <LinkIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              size={18}
            />
            <input
              type="url"
              placeholder="Link de Video (YouTube/Instagram)"
              className="w-full bg-black border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-white focus:border-yellow-400 outline-none"
              value={newExercise.videoUrl}
              onChange={(e) =>
                setNewExercise({ ...newExercise, videoUrl: e.target.value })
              }
            />
          </div>
          <button
            type="submit"
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-2 rounded-lg transition-colors"
          >
            Guardar
          </button>
        </form>
      </div>

      {/* Lista de Ejercicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 flex justify-between items-center group hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  ex.videoUrl
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                <Video size={18} />
              </div>
              <div>
                <span className="text-white font-medium block">{ex.name}</span>
                {ex.videoUrl && (
                  <a
                    href={ex.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-400 hover:underline"
                  >
                    Ver link guardado
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => onDeleteExercise(ex.id)}
              className="text-zinc-600 hover:text-red-500 transition-colors p-2"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
