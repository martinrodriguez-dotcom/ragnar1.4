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

  const formatDateId = (d) => d.toISOString().split('T')[0];
  const currentDateId = formatDateId(date);

  // 1. Cargar Fechas con Ejercicios (Para los puntitos del calendario)
  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      setAllSessionsIds(snapshot.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [client]);

  // 2. Cargar Sesión del Día Seleccionado
  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailySession(docSnap.data().exercises || []);
      } else {
        setDailySession([]);
      }
    });
    return () => unsubscribe();
  }, [date, client]);

  // 3. Cargar las Rutinas prearmadas del Entrenador
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
      newExercises = [{ ...newExData }];
    } else {
      if (!selectedRoutineId) return;
      const routine = routines.find(r => r.id === selectedRoutineId);
      if (routine && routine.exercises) {
        // Limpiamos los datos de la rutina para asegurarnos de que encajen bien
        newExercises = routine.exercises.map(ex => ({
           name: ex.name,
           sets: ex.sets || 4,
           reps: ex.reps || '10',
           weight: ex.weight || '',
           videoUrl: ex.videoUrl || ''
        }));
      }
    }

    if (newExercises.length === 0) return;

    const updatedSession = [...dailySession, ...newExercises];
    
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession
      }, { merge: true });
      
      setIsAddingEx(false);
      setNewExData({ name: '', sets: 4, reps: '10', weight: '', videoUrl: '' });
      setSelectedRoutineId('');
    } catch (error) { console.error(error); }
  };

  const handleRemoveExercise = async (index) => {
    const updatedSession = dailySession.filter((_, i) => i !== index);
    try {
      if (updatedSession.length === 0) {
        // SOLUCIÓN: Si ya no quedan ejercicios, eliminamos el documento para borrar el punto amarillo
        await deleteDoc(doc(db, 'clients', client.id, 'sessions', currentDateId));
      } else {
        // Si aún quedan ejercicios, solo actualizamos la lista
        await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
          date: currentDateId,
          exercises: updatedSession
        }, { merge: true });
      }
    } catch (error) { console.error(error); }
  };

  // --- FUNCIONES DE CLONAR DÍA ---

  const handleToggleCloneDate = (val) => {
    const dateId = formatDateId(val);
    if (dateId === currentDateId) return; // No clonar en el mismo día origen
    if (cloneDates.includes(dateId)) {
      setCloneDates(cloneDates.filter(d => d !== dateId));
    } else {
      setCloneDates([...cloneDates, dateId]);
    }
  };

  const handleSaveClone = async () => {
    if (cloneDates.length === 0 || dailySession.length === 0) return;
    
    // Al clonar, quitamos el progreso (actualSets) por si el origen ya tenía series marcadas como hechas
    const cleanSession = dailySession.map(ex => {
      const { actualSets, ...rest } = ex;
      return rest;
    });

    try {
      // Guardar en todas las fechas seleccionadas al mismo tiempo
      const promises = cloneDates.map(dateId => 
        setDoc(doc(db, 'clients', client.id, 'sessions', dateId), {
          date: dateId,
          exercises: cleanSession
        }, { merge: true })
      );
      await Promise.all(promises);
      
      setIsCloneModalOpen(false);
      setCloneDates([]);
      alert("¡Día replicado con éxito en las fechas seleccionadas!");
    } catch (error) {
       console.error(error);
       alert("Error al replicar el día.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in">
      
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
            <h2 className="text-2xl font-bold text-white uppercase">{client.name}</h2>
            <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
              <span className="flex items-center gap-1"><Dumbbell size={14}/> {client.plan}</span>
              <span className="flex items-center gap-1"><CalendarIcon size={14}/> Inicio: {client.startDate || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <h3 className="text-white font-bold uppercase mb-4 text-sm tracking-widest flex items-center gap-2">
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

        {/* COLUMNA DERECHA: RUTINA DEL DÍA */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col h-[calc(100vh-220px)] shadow-xl">
            
            {/* Cabecera del Día */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                  {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-zinc-500 text-sm font-medium mt-1">
                  {dailySession.length} ejercicios programados
                </p>
              </div>
              
              <div className="flex gap-2">
                {dailySession.length > 0 && (
                  <button 
                    onClick={() => setIsCloneModalOpen(true)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-zinc-700"
                    title="Copiar toda esta rutina a otros días"
                  >
                    <Copy size={18}/> <span className="hidden sm:inline">Replicar Día</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsAddingEx(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                >
                  <Plus size={18}/> Agregar
                </button>
              </div>
            </div>

            {/* Lista de Ejercicios */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-zinc-950/20">
              {dailySession.length > 0 ? (
                dailySession.map((ex, idx) => (
                  <div key={idx} className="bg-black p-4 rounded-xl border border-zinc-800 flex justify-between items-center group hover:border-yellow-400/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="bg-zinc-900 text-zinc-500 font-bold w-10 h-10 rounded-full flex items-center justify-center border border-zinc-800 group-hover:text-yellow-400 transition-colors">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-lg">{ex.name}</h4>
                          {ex.videoUrl && <Video size={16} className="text-blue-500" title="Contiene video"/>}
                        </div>
                        <p className="text-zinc-500 text-sm font-medium">
                          <span className="text-zinc-300">{ex.sets}</span> series x <span className="text-zinc-300">{ex.reps}</span> reps 
                          {ex.weight && ` @ ${ex.weight}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveExercise(idx)} className="text-zinc-600 hover:text-red-500 p-2 transition-colors">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-60">
                  <div className="bg-zinc-900 p-4 rounded-full mb-4"><Dumbbell size={40}/></div>
                  <p className="text-lg font-medium">Día de Descanso</p>
                  <p className="text-sm">O no hay rutina asignada.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL: AGREGAR EJERCICIO O RUTINA --- */}
      {isAddingEx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white uppercase">Agregar al Plan</h2>
              <button onClick={() => setIsAddingEx(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>

            <div className="p-6">
              {/* TABS */}
              <div className="flex gap-4 mb-6 border-b border-zinc-800">
                <button 
                  onClick={() => setAddMode('single')}
                  className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${addMode === 'single' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Ejercicio Individual
                </button>
                <button 
                  onClick={() => setAddMode('routine')}
                  className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${addMode === 'routine' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Plantilla
                </button>
              </div>

              {/* MODO SINGLE */}
              {addMode === 'single' && (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Buscar Ejercicio</label>
                    <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none" value={newExData.name} onChange={handleSelectExerciseName}>
                      <option value="">Seleccionar...</option>
                      {exercisesLibrary.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Series</label><input type="number" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none text-center" value={newExData.sets} onChange={e => setNewExData({...newExData, sets: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Reps</label><input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none text-center" value={newExData.reps} onChange={e => setNewExData({...newExData, reps: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Kg Ref.</label><input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none text-center" value={newExData.weight} onChange={e => setNewExData({...newExData, weight: e.target.value})} /></div>
                  </div>
                  <button type="submit" className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg mt-2 uppercase tracking-wide hover:bg-yellow-300 transition-colors">
                    Agregar Ejercicio
                  </button>
                </form>
              )}

              {/* MODO ROUTINE */}
              {addMode === 'routine' && (
                <form onSubmit={handleSaveNewItem} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Seleccionar Plantilla</label>
                    <select required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-yellow-400 outline-none" value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)}>
                      <option value="">Elegir rutina prearmada...</option>
                      {routines.map(r => <option key={r.id} value={r.id}>{r.name} ({r.exercises?.length || 0} ej)</option>)}
                    </select>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex gap-3 text-blue-400 text-sm mt-4">
                    <Layout className="shrink-0 mt-0.5" size={18}/>
                    <p>Al agregar, todos los ejercicios de esta plantilla se volcarán al día actual. Podrás editarlos individualmente después.</p>
                  </div>
                  <button type="submit" disabled={!selectedRoutineId} className="w-full bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-3 rounded-lg mt-2 uppercase tracking-wide hover:bg-yellow-300 transition-colors">
                    Volcar Rutina al Día
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: REPLICAR DÍA (CLONAR) --- */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-zinc-800 bg-zinc-900 text-center">
              <div className="bg-yellow-400 text-black w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                <Copy size={24}/>
              </div>
              <h2 className="text-xl font-bold text-white uppercase">Replicar Rutina</h2>
              <p className="text-zinc-400 text-sm mt-1">Toca los días en el calendario donde quieras pegar esta misma lista de ejercicios.</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
              <Calendar 
                onClickDay={handleToggleCloneDate}
                className="react-calendar-custom clone-mode"
                tileClassName={({ date }) => {
                  const dId = formatDateId(date);
                  if (dId === currentDateId) return 'bg-yellow-400 !text-black font-bold border-2 border-yellow-400'; // Día Origen
                  if (cloneDates.includes(dId)) return 'bg-green-500 !text-white font-bold shadow-[0_0_10px_rgba(34,197,94,0.5)]'; // Días Destino
                  return null;
                }}
              />
              
              <div className="w-full mt-4 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800 pt-4">
                 <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-full"></span> Día Origen</span>
                 <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Destinos ({cloneDates.length})</span>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button 
                onClick={() => { setIsCloneModalOpen(false); setCloneDates([]); }}
                className="flex-1 py-3 rounded-lg border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-800 transition-colors uppercase text-xs tracking-wide"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveClone}
                disabled={cloneDates.length === 0}
                className="flex-1 py-3 rounded-lg bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold hover:bg-yellow-300 transition-colors uppercase text-xs tracking-wide flex justify-center items-center gap-2"
              >
                <Save size={16}/> Pegar en {cloneDates.length} días
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
