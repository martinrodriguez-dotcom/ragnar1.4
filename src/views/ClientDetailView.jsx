import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ChevronLeft, Plus, Trash2, Dumbbell, User, Calendar as CalendarIcon, Video, Copy, X, Save, Layout } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ClientDetailView({ client, goBack, exercisesLibrary }) {
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [routines, setRoutines] = useState([]);
  
  // Modal de Agregar Ejercicio/Rutina
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [addMode, setAddMode] = useState('single'); // 'single' o 'routine'
  const [newExData, setNewExData] = useState({ name: '', sets: 4, reps: '10', weight: '', videoUrl: '' });
  const [selectedRoutineId, setSelectedRoutineId] = useState('');

  // Modal de Replicar Día (Clonar)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneDates, setCloneDates] = useState([]);

  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentDateId = formatDateId(date);

  // 1. Cargar Fechas con Ejercicios (Para los puntitos del calendario)
  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      // Solo incluimos en la lista de "puntos amarillos" los días que realmente tienen ejercicios
      const activeSessions = snapshot.docs
        .filter(doc => doc.data().exercises && doc.data().exercises.length > 0)
        .map(doc => doc.id);
      setAllSessionsIds(activeSessions);
    });
    return () => unsubscribe();
  }, [client]);

  // 2. Cargar Sesión del Día Seleccionado + LIMPIEZA AUTOMÁTICA
  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const exercises = data.exercises || [];
        setDailySession(exercises);

        // Lógica de limpieza: Si el documento existe pero no tiene ejercicios ni otros datos importantes, borrarlo.
        if (exercises.length === 0 && !data.missedReason) {
          deleteDoc(sessionDocRef);
        }
      } else {
        setDailySession([]);
      }
    });
    return () => unsubscribe();
  }, [date, client, currentDateId]);

  // 3. Cargar las Rutinas prearmadas
  useEffect(() => {
    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubRoutines();
  }, []);

  // --- FUNCIONES DE AGREGAR ---

  const handleSelectExerciseName = (e) => {
    const name = e.target.value;
    const found = exercisesLibrary.find(ex => ex.name === name);
    setNewExData({ ...newExData, name, videoUrl: found?.videoUrl || '' });
  };

  const handleSaveNewItem = async (e) => {
    e.preventDefault();
    let newExercises = [];

    if (addMode === 'single') {
      if (!newExData.name) return;
      newExercises = [{ ...newExData, id: Date.now() }];
    } else {
      if (!selectedRoutineId) return;
      const routine = routines.find(r => r.id === selectedRoutineId);
      if (routine && routine.exercises) {
        newExercises = routine.exercises.map(ex => ({
           name: ex.name,
           sets: ex.sets || 4,
           reps: ex.reps || '10',
           weight: ex.weight || '',
           videoUrl: ex.videoUrl || '',
           id: Math.random().toString(36).substr(2, 9)
        }));
      }
    }

    const updatedSession = [...dailySession, ...newExercises];
    
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession,
        updatedAt: new Date()
      }, { merge: true });
      
      setIsAddingEx(false);
      setNewExData({ name: '', sets: 4, reps: '10', weight: '', videoUrl: '' });
      setSelectedRoutineId('');
    } catch (error) { console.error(error); }
  };

  const handleRemoveExercise = async (index) => {
    const updatedSession = dailySession.filter((_, i) => i !== index);
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    
    try {
      if (updatedSession.length === 0) {
        // Si borramos el último, eliminamos el documento físico de la base de datos
        await deleteDoc(sessionDocRef);
      } else {
        await updateDoc(sessionDocRef, {
          exercises: updatedSession
        });
      }
    } catch (error) { console.error(error); }
  };

  // --- FUNCIONES DE CLONAR DÍA ---

  const handleToggleCloneDate = (val) => {
    const dateId = formatDateId(val);
    if (dateId === currentDateId) return;
    if (cloneDates.includes(dateId)) {
      setCloneDates(cloneDates.filter(d => d !== dateId));
    } else {
      setCloneDates([...cloneDates, dateId]);
    }
  };

  const handleSaveClone = async () => {
    if (cloneDates.length === 0 || dailySession.length === 0) return;
    
    const cleanSession = dailySession.map(ex => {
      const { actualSets, ...rest } = ex;
      return { ...rest };
    });

    try {
      const promises = cloneDates.map(dateId => 
        setDoc(doc(db, 'clients', client.id, 'sessions', dateId), {
          date: dateId,
          exercises: cleanSession,
          updatedAt: new Date()
        }, { merge: true })
      );
      await Promise.all(promises);
      
      setIsCloneModalOpen(false);
      setCloneDates([]);
      alert("¡Rutina replicada con éxito!");
    } catch (error) {
       console.error(error);
       alert("Error al replicar.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER CLIENTE */}
      <div className="flex items-center justify-between mb-6 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2 bg-zinc-800 hover:bg-yellow-400 hover:text-black text-white rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="w-14 h-14 bg-zinc-800 text-yellow-400 rounded-full flex items-center justify-center font-bold text-xl border-2 border-zinc-700">
            {client.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{client.name}</h2>
            <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
              <span className="flex items-center gap-1 font-bold"><Dumbbell size={14} className="text-yellow-400"/> {client.plan}</span>
              <span className="flex items-center gap-1"><CalendarIcon size={14}/> {client.startDate || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CALENDARIO */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl sticky top-6">
            <h3 className="text-white font-bold uppercase mb-4 text-xs tracking-widest flex items-center gap-2">
              <CalendarIcon size={18} className="text-yellow-400"/> Agenda del Atleta
            </h3>
            <Calendar 
              onChange={setDate} 
              value={date} 
              className="react-calendar-custom"
              tileClassName={({ date }) => allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null} 
            />
          </div>
        </div>

        {/* LISTA DE EJERCICIOS */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col min-h-[500px] shadow-xl">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                  {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-zinc-500 text-sm font-medium mt-1">
                  {dailySession.length} movimientos asignados
                </p>
              </div>
              
              <div className="flex gap-2">
                {dailySession.length > 0 && (
                  <button 
                    onClick={() => setIsCloneModalOpen(true)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-zinc-700"
                  >
                    <Copy size={18}/> <span className="hidden sm:inline">Replicar</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsAddingEx(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                  <Plus size={18}/> Agregar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-zinc-950/20">
              {dailySession.length > 0 ? (
                dailySession.map((ex, idx) => (
                  <div key={idx} className="bg-black p-4 rounded-xl border border-zinc-800 flex justify-between items-center group hover:border-yellow-400/50 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="bg-zinc-900 text-zinc-500 font-bold w-10 h-10 rounded-full flex items-center justify-center border border-zinc-800 group-hover:text-yellow-400 group-hover:border-yellow-400/30 transition-colors">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-lg leading-none">{ex.name}</h4>
                          {ex.videoUrl && <Video size={16} className="text-blue-500 cursor-help" />}
                        </div>
                        <p className="text-zinc-500 text-sm mt-1">
                          <span className="text-zinc-300">{ex.sets}</span> series x <span className="text-zinc-300">{ex.reps}</span> reps 
                          {ex.weight && ` | ${ex.weight}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveExercise(idx)} className="text-zinc-600 hover:text-red-500 p-2 transition-colors">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-zinc-700">
                  <Dumbbell size={64} className="mb-4 opacity-20"/>
                  <p className="text-lg font-bold uppercase tracking-widest opacity-30">Día de Descanso</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL AGREGAR */}
      {isAddingEx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white uppercase">Asignar Entrenamiento</h2>
              <button onClick={() => setIsAddingEx(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6">
              <div className="flex gap-4 mb-6 border-b border-zinc-800">
                <button onClick={() => setAddMode('single')} className={`pb-2 text-sm font-bold uppercase tracking-wider ${addMode === 'single' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-600'}`}>Individual</button>
                <button onClick={() => setAddMode('routine')} className={`pb-2 text-sm font-bold uppercase tracking-wider ${addMode === 'routine' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-600'}`}>Plantilla</button>
              </div>

              {addMode === 'single' ? (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none" value={newExData.name} onChange={handleSelectExerciseName}>
                    <option value="">Elegir ejercicio...</option>
                    {exercisesLibrary.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" placeholder="Sets" className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm" value={newExData.sets} onChange={e => setNewExData({...newExData, sets: e.target.value})} />
                    <input type="text" placeholder="Reps" className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm" value={newExData.reps} onChange={e => setNewExData({...newExData, reps: e.target.value})} />
                    <input type="text" placeholder="Peso" className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm" value={newExData.weight} onChange={e => setNewExData({...newExData, weight: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg uppercase">Guardar</button>
                </form>
              ) : (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none" value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)}>
                    <option value="">Elegir plantilla...</option>
                    {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button type="submit" className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg uppercase">Volcar Plantilla</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLONAR */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900 text-center">
              <h2 className="text-xl font-bold text-white uppercase">Replicar en Calendario</h2>
              <p className="text-zinc-400 text-xs mt-1 italic">Selecciona los días para pegar la rutina</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
              <Calendar 
                onClickDay={handleToggleCloneDate}
                className="react-calendar-custom clone-mode"
                tileClassName={({ date }) => {
                  const dId = formatDateId(date);
                  if (dId === currentDateId) return 'bg-yellow-400 !text-black font-bold';
                  if (cloneDates.includes(dId)) return 'bg-green-600 !text-white font-bold';
                  return null;
                }}
              />
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button onClick={() => { setIsCloneModalOpen(false); setCloneDates([]); }} className="flex-1 py-3 text-zinc-400 font-bold uppercase text-xs">Cancelar</button>
              <button onClick={handleSaveClone} disabled={cloneDates.length === 0} className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-lg uppercase text-xs">Pegar en {cloneDates.length} días</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
