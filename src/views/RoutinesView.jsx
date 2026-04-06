import React, { useState, useEffect } from 'react';
import { 
  Layout, Plus, Trash2, Dumbbell, Save, ChevronRight, X, Video 
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function RoutinesView({ exercisesLibrary }) {
  const [routines, setRoutines] = useState([]);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  
  // Modal agregar ejercicio a plantilla
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [newExData, setNewExData] = useState({ name: '', sets: 4, reps: '10', weight: '', rir: '2', videoUrl: '' });

  // Colores para la escala RIR (de 5 a 0)
  const rirColors = ['bg-[#ffe4c4]', 'bg-[#fcd34d]', 'bg-[#fbbf24]', 'bg-[#f97316]', 'bg-[#ef4444]', 'bg-[#b91c1c]'];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreateRoutine = async (e) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    try {
      await addDoc(collection(db, 'routines'), { name: newRoutineName, exercises: [], createdAt: new Date() });
      setNewRoutineName('');
      setIsCreating(false);
    } catch (error) { console.error(error); }
  };

  const handleDeleteRoutine = async (id) => {
    if (window.confirm('¿Eliminar esta plantilla?')) {
      await deleteDoc(doc(db, 'routines', id));
      if (selectedRoutine?.id === id) setSelectedRoutine(null);
    }
  };

  const handleSelectExercise = (e) => {
    const name = e.target.value;
    const found = exercisesLibrary.find(ex => ex.name === name);
    setNewExData({ ...newExData, name, videoUrl: found?.videoUrl || '' });
  };

  const handleSaveExerciseToRoutine = async (e) => {
    e.preventDefault();
    if (!newExData.name || !selectedRoutine) return;
    
    const updatedExercises = [...(selectedRoutine.exercises || []), { ...newExData, id: Date.now() }];
    
    try {
      await setDoc(doc(db, 'routines', selectedRoutine.id), { exercises: updatedExercises }, { merge: true });
      setSelectedRoutine({ ...selectedRoutine, exercises: updatedExercises });
      setIsAddingEx(false);
      setNewExData({ name: '', sets: 4, reps: '10', weight: '', rir: '2', videoUrl: '' });
    } catch (error) { console.error(error); }
  };

  const handleRemoveExerciseFromRoutine = async (index) => {
    const updatedExercises = selectedRoutine.exercises.filter((_, i) => i !== index);
    try {
      await setDoc(doc(db, 'routines', selectedRoutine.id), { exercises: updatedExercises }, { merge: true });
      setSelectedRoutine({ ...selectedRoutine, exercises: updatedExercises });
    } catch (error) { console.error(error); }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Plantillas</h2>
          <p className="text-zinc-500 text-sm">Crea rutinas prearmadas para asignar rápido a tus alumnos.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)] flex items-center gap-2">
          <Plus size={18}/> Nueva Plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTA DE PLANTILLAS */}
        <div className="lg:col-span-1 space-y-3">
          {routines.map(routine => (
            <div 
              key={routine.id} 
              onClick={() => setSelectedRoutine(routine)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center group ${selectedRoutine?.id === routine.id ? 'bg-zinc-800 border-yellow-400' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-black p-2 rounded-lg text-yellow-400"><Layout size={20}/></div>
                <div>
                  <h3 className="font-bold text-white uppercase text-sm">{routine.name}</h3>
                  <p className="text-zinc-500 text-[10px] uppercase">{routine.exercises?.length || 0} ejercicios</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleDeleteRoutine(routine.id); }} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                <ChevronRight size={18} className="text-zinc-600 group-hover:text-yellow-400"/>
              </div>
            </div>
          ))}
          {routines.length === 0 && (
            <div className="text-center py-10 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm font-bold uppercase">No hay plantillas creadas</p></div>
          )}
        </div>

        {/* DETALLE DE PLANTILLA SELECCIONADA */}
        <div className="lg:col-span-2">
          {selectedRoutine ? (
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-xl flex flex-col h-[65vh]">
              <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{selectedRoutine.name}</h3>
                </div>
                <button onClick={() => setIsAddingEx(true)} className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"><Plus size={18}/> Agregar Ejercicio</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {selectedRoutine.exercises && selectedRoutine.exercises.length > 0 ? (
                  selectedRoutine.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-black p-5 rounded-2xl border border-zinc-800 flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <span className="bg-zinc-900 text-zinc-500 font-bold w-10 h-10 rounded-full flex items-center justify-center border border-zinc-800">{idx + 1}</span>
                          <div>
                            <div className="flex items-center gap-2"><h4 className="font-black text-white text-lg leading-none uppercase">{ex.name}</h4>{ex.videoUrl && <Video size={16} className="text-blue-500"/>}</div>
                            <p className="text-zinc-400 text-sm mt-1 font-medium"><span className="text-white">{ex.sets}</span> sets x <span className="text-white">{ex.reps}</span> reps {ex.weight && `| ${ex.weight}`}</p>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveExerciseFromRoutine(idx)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                      </div>

                      {/* BARRA RIR */}
                      {ex.rir && (
                        <div className="mt-2 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                          <div className="flex justify-between items-center mb-1.5">
                             <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Intensidad RIR</span>
                             <span className="text-[10px] text-white font-black bg-zinc-800 px-2 py-0.5 rounded">RIR {ex.rir}</span>
                          </div>
                          <div className="flex gap-1 h-2">
                             {[5, 4, 3, 2, 1, 0].map((val, i) => (
                                <div key={val} className={`flex-1 rounded-full transition-colors ${val >= parseInt(ex.rir) ? rirColors[i] : 'bg-zinc-800'}`}></div>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-700"><Dumbbell size={64} className="mb-4 opacity-20"/><p className="text-lg font-bold uppercase tracking-widest opacity-30">Plantilla Vacía</p></div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800 h-[65vh] flex flex-col items-center justify-center text-zinc-600">
              <Layout size={64} className="mb-4 opacity-20"/>
              <p className="font-bold uppercase tracking-widest text-sm">Selecciona una plantilla para editarla</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR RUTINA */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between"><h2 className="font-black text-white uppercase italic">Nombre de Plantilla</h2><button onClick={() => setIsCreating(false)}><X size={20}/></button></div>
            <form onSubmit={handleCreateRoutine} className="p-6 space-y-4">
              <input type="text" autoFocus required placeholder="Ej. Pecho - Hipertrofia" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} />
              <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase">Crear Plantilla</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR EJERCICIO A RUTINA */}
      {isAddingEx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between"><h2 className="font-black text-white uppercase italic">Agregar a {selectedRoutine?.name}</h2><button onClick={() => setIsAddingEx(false)}><X size={20}/></button></div>
            <form onSubmit={handleSaveExerciseToRoutine} className="p-6 space-y-4">
              <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" value={newExData.name} onChange={handleSelectExercise}>
                <option value="">Elegir ejercicio de biblioteca...</option>
                {exercisesLibrary.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" placeholder="Sets" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.sets} onChange={e => setNewExData({...newExData, sets: e.target.value})} />
                <input type="text" placeholder="Reps" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.reps} onChange={e => setNewExData({...newExData, reps: e.target.value})} />
                <input type="text" placeholder="Peso" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm text-center" value={newExData.weight} onChange={e => setNewExData({...newExData, weight: e.target.value})} />
              </div>
              
              <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none font-medium" value={newExData.rir} onChange={e => setNewExData({...newExData, rir: e.target.value})}>
                <option value="5">RIR 5 (Muy fácil / Calentamiento)</option>
                <option value="4">RIR 4 (Fácil)</option>
                <option value="3">RIR 3 (Moderado)</option>
                <option value="2">RIR 2 (Intenso)</option>
                <option value="1">RIR 1 (Muy intenso)</option>
                <option value="0">RIR 0 (Fallo muscular absoluto)</option>
              </select>
              
              <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase mt-2">Guardar Ejercicio</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
