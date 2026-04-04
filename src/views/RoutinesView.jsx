import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Dumbbell, Save, ChevronRight, Layout, Video } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function RoutinesView({ exercisesLibrary }) {
  const [routines, setRoutines] = useState([]);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [newRoutineName, setNewRoutineName] = useState('');
  
  // Estado para agregar ejercicio a la rutina seleccionada
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [newExData, setNewExData] = useState({ name: '', sets: 4, reps: '10', weight: '', videoUrl: '' });

  // Cargar Rutinas
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Crear Nueva Rutina (Carpeta)
  const handleCreateRoutine = async (e) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'routines'), {
        name: newRoutineName,
        exercises: [],
        createdAt: new Date()
      });
      setNewRoutineName('');
      setSelectedRoutine({ id: docRef.id, name: newRoutineName, exercises: [] });
    } catch (error) { console.error(error); }
  };

  const handleDeleteRoutine = async (id) => {
    if (!window.confirm('¿Borrar esta plantilla de rutina?')) return;
    await deleteDoc(doc(db, 'routines', id));
    if (selectedRoutine?.id === id) setSelectedRoutine(null);
  };

  // Agregar Ejercicio a la Rutina Seleccionada
  const handleAddExerciseToRoutine = async () => {
    if (!selectedRoutine || !newExData.name) return;
    
    const updatedExercises = [...(selectedRoutine.exercises || []), { ...newExData, id: Date.now() }];
    
    try {
      await updateDoc(doc(db, 'routines', selectedRoutine.id), {
        exercises: updatedExercises
      });
      setSelectedRoutine(prev => ({ ...prev, exercises: updatedExercises }));
      setIsAddingEx(false);
      setNewExData({ name: '', sets: 4, reps: '10', weight: '', videoUrl: '' });
    } catch (error) { console.error(error); }
  };

  const handleRemoveExerciseFromRoutine = async (exerciseId) => {
    const updatedExercises = selectedRoutine.exercises.filter(ex => ex.id !== exerciseId);
    try {
      await updateDoc(doc(db, 'routines', selectedRoutine.id), {
        exercises: updatedExercises
      });
      setSelectedRoutine(prev => ({ ...prev, exercises: updatedExercises }));
    } catch (error) { console.error(error); }
  };

  // Auto-rellenar video si existe en la librería
  const handleSelectExerciseName = (e) => {
    const name = e.target.value;
    const found = exercisesLibrary.find(ex => ex.name === name);
    setNewExData({ ...newExData, name, videoUrl: found?.videoUrl || '' });
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 animate-in fade-in">
      
      {/* COLUMNA IZQUIERDA: Lista de Rutinas */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-white uppercase">Biblioteca</h2>
          <p className="text-zinc-500 text-sm">Tus plantillas de entrenamiento.</p>
        </div>

        {/* Crear Rutina */}
        <form onSubmit={handleCreateRoutine} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nombre (ej. Pecho A)" 
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-400 outline-none"
            value={newRoutineName}
            onChange={e => setNewRoutineName(e.target.value)}
          />
          <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-black p-2 rounded-lg"><Plus size={20}/></button>
        </form>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {routines.map(routine => (
            <div 
              key={routine.id}
              onClick={() => setSelectedRoutine(routine)}
              className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                selectedRoutine?.id === routine.id 
                  ? 'bg-zinc-800 border-yellow-400' 
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layout size={18} className={selectedRoutine?.id === routine.id ? 'text-yellow-400' : 'text-zinc-500'} />
                <span className="font-bold text-white">{routine.name}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteRoutine(routine.id); }}
                className="text-zinc-600 hover:text-red-500 p-1"
              >
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMNA DERECHA: Editor de la Rutina Seleccionada */}
      <div className="w-full md:w-2/3 bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col overflow-hidden">
        {selectedRoutine ? (
          <>
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/30">
              <div>
                <h3 className="text-xl font-bold text-white uppercase">{selectedRoutine.name}</h3>
                <p className="text-zinc-500 text-xs mt-1">{selectedRoutine.exercises?.length || 0} ejercicios configurados</p>
              </div>
              <button 
                onClick={() => setIsAddingEx(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Plus size={16}/> Agregar Ejercicio
              </button>
            </div>

            {/* Formulario Agregar Ejercicio a la Plantilla */}
            {isAddingEx && (
              <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-4 gap-2 mb-2">
                   <div className="col-span-4">
                     <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Ejercicio</label>
                     <select 
                       className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" 
                       value={newExData.name} 
                       onChange={handleSelectExerciseName}
                     >
                        <option value="">Seleccionar de la biblioteca...</option>
                        {exercisesLibrary.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                     </select>
                   </div>
                   <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Series</label><input type="number" className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" value={newExData.sets} onChange={e => setNewExData({...newExData, sets: e.target.value})} /></div>
                   <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Reps</label><input type="text" className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" value={newExData.reps} onChange={e => setNewExData({...newExData, reps: e.target.value})} /></div>
                   <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Kg (Ref)</label><input type="text" className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" value={newExData.weight} onChange={e => setNewExData({...newExData, weight: e.target.value})} /></div>
                   <div className="flex items-end"><button onClick={handleAddExerciseToRoutine} className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded text-sm font-bold h-[38px]">Guardar</button></div>
                </div>
                <button onClick={() => setIsAddingEx(false)} className="text-xs text-zinc-500 hover:text-white underline ml-1">Cancelar</button>
              </div>
            )}

            {/* Lista de Ejercicios de la Plantilla */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedRoutine.exercises && selectedRoutine.exercises.length > 0 ? (
                selectedRoutine.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-800 group hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="bg-zinc-800 text-zinc-400 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">{idx + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-lg">{ex.name}</h4>
                          {ex.videoUrl && <Video size={14} className="text-blue-500"/>}
                        </div>
                        <p className="text-zinc-500 text-sm">{ex.sets} series x {ex.reps} reps</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveExerciseFromRoutine(ex.id)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                  <Dumbbell size={48} className="mb-4"/>
                  <p>Plantilla vacía.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Layout size={64} className="mb-4 opacity-20"/>
            <p className="text-lg font-medium">Selecciona una rutina para editar</p>
            <p className="text-sm">O crea una nueva en el panel izquierdo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
