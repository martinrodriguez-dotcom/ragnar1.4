import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  ChevronLeft, Calendar as CalendarIcon, Dumbbell, Plus, 
  Trash2, Edit, Save, Activity, Droplets, Target, User, Video, X 
} from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function ClientDetailView({ client, goBack, exercisesLibrary = [], routines = [] }) {
  const [date, setDate] = useState(new Date());
  
  // --- ESTADOS DE LA SESIÓN DEL DÍA ---
  const [dailySession, setDailySession] = useState([]); // Arreglo de ejercicios
  const [hydrationTarget, setHydrationTarget] = useState('');
  const [cardioTargetMinutes, setCardioTargetMinutes] = useState('');
  const [cardioTargetIntensity, setCardioTargetIntensity] = useState('Baja');
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  
  // Para marcar los días con rutina en el calendario
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE MODALES ---
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);

  // --- FORMULARIO DE EJERCICIO ---
  const [exForm, setExForm] = useState({
    name: '',
    videoUrl: '',
    sets: '',
    reps: '',
    rir: '2'
  });

  // --- FORMATEO DE FECHAS PARA FIREBASE ---
  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // Ej: "2026-04-13"
  };

  const currentDateId = formatDateId(date);

  // --- ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    if (!client) return;

    // 1. Buscamos todas las sesiones para marcar el calendario
    const fetchAllSessions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'clients', client.id, 'sessions'));
        const ids = querySnapshot.docs
          // Solo marcamos los días que realmente tienen ejercicios asignados
          .filter(doc => doc.data().exercises && doc.data().exercises.length > 0)
          .map(doc => doc.id);
        setAllSessionsIds(ids);
      } catch (error) { console.error(error); }
    };
    fetchAllSessions();

    // 2. Escuchamos en vivo la sesión del día seleccionado
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubDaily = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailySession(data.exercises || []);
        setIsSessionFinalized(data.isFinalized || false);
        // Cargamos los extras si el coach ya los había configurado
        setHydrationTarget(data.targetHydration || '');
        setCardioTargetMinutes(data.targetCardioMinutes || '');
        setCardioTargetIntensity(data.targetCardioIntensity || 'Baja');
      } else {
        // Día vacío
        setDailySession([]);
        setIsSessionFinalized(false);
        setHydrationTarget('');
        setCardioTargetMinutes('');
        setCardioTargetIntensity('Baja');
      }
      setLoading(false);
    });

    return () => unsubDaily();
  }, [client, currentDateId]);

  // --- MANEJO DEL CALENDARIO ---
  const handleDateChange = (newDate) => {
    setDate(newDate);
    setLoading(true);
  };

  // --- ABRIR MODAL DE EJERCICIO (AGREGAR O EDITAR) ---
  const openExerciseModal = (index = null) => {
    if (index !== null) {
      // MODO EDITAR
      const ex = dailySession[index];
      setExForm({
        name: ex.name || '',
        videoUrl: ex.videoUrl || '',
        sets: ex.sets || '',
        reps: ex.reps || '',
        rir: ex.rir || '2'
      });
      setEditingExerciseIndex(index);
    } else {
      // MODO AGREGAR
      setExForm({
        name: exercisesLibrary.length > 0 ? exercisesLibrary[0].name : '',
        videoUrl: exercisesLibrary.length > 0 ? exercisesLibrary[0].videoUrl : '',
        sets: '',
        reps: '',
        rir: '2'
      });
      setEditingExerciseIndex(null);
    }
    setIsExerciseModalOpen(true);
  };

  // --- GUARDAR EJERCICIO EN FIREBASE ---
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!exForm.name || !exForm.sets || !exForm.reps) return;

    let updatedSession = [...dailySession];

    const exerciseToSave = {
      name: String(exForm.name),
      videoUrl: String(exForm.videoUrl || ''),
      sets: String(exForm.sets),
      reps: String(exForm.reps),
      rir: String(exForm.rir),
      actualSets: [] // Aquí el alumno anotará sus resultados
    };

    if (editingExerciseIndex !== null) {
      // Si estamos editando, reemplazamos el ejercicio en esa posición
      // Mantenemos los actualSets si el alumno ya había anotado algo
      exerciseToSave.actualSets = updatedSession[editingExerciseIndex].actualSets || [];
      updatedSession[editingExerciseIndex] = exerciseToSave;
    } else {
      // Si es nuevo, lo agregamos al final
      updatedSession.push(exerciseToSave);
    }

    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession
      }, { merge: true });
      
      setIsExerciseModalOpen(false);
      // Actualizamos los puntos del calendario por si es el primer ejercicio del día
      if (updatedSession.length === 1 && !allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
    } catch (error) {
      console.error(error);
      alert("Error al guardar el ejercicio.");
    }
  };

  // --- ELIMINAR EJERCICIO ---
  const handleDeleteExercise = async (index) => {
    if (!window.confirm('¿Seguro que deseas eliminar este ejercicio de la rutina del día?')) return;
    
    const updatedSession = dailySession.filter((_, i) => i !== index);
    
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        exercises: updatedSession
      }, { merge: true });

      // Si borramos todos los ejercicios, quitamos el punto del calendario
      if (updatedSession.length === 0) {
        setAllSessionsIds(allSessionsIds.filter(id => id !== currentDateId));
      }
    } catch (error) { console.error(error); }
  };

  // --- GUARDAR EXTRAS (AGUA Y CARDIO) EN FIREBASE ---
  const handleSaveExtras = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        targetHydration: String(hydrationTarget),
        targetCardioMinutes: String(cardioTargetMinutes),
        targetCardioIntensity: String(cardioTargetIntensity)
      }, { merge: true });
      
      setIsExtrasModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Error al guardar los objetivos extra.");
    }
  };

  // --- COPIAR RUTINA COMPLETA ---
  const handleAssignRoutine = async (routineObj) => {
    if (!window.confirm(`¿Copiar la rutina "${routineObj.name}" a este día? Se reemplazarán los ejercicios actuales.`)) return;
    try {
      const formattedExercises = routineObj.exercises.map(ex => ({
        name: String(ex.name),
        videoUrl: String(ex.videoUrl || ''),
        sets: String(ex.sets || '3'),
        reps: String(ex.reps || '10'),
        rir: String(ex.rir || '2'),
        actualSets: []
      }));

      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: formattedExercises
      }, { merge: true });

      if (!allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
    } catch (error) { console.error(error); }
  };

  if (!client) return null;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER: BOTÓN VOLVER Y DATOS DEL ALUMNO */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={goBack} 
          className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-white hover:text-yellow-400 hover:border-yellow-400 transition-colors shadow-lg shrink-0"
        >
          <ChevronLeft size={28}/>
        </button>
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
            {client.name}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest rounded-md">
              Planificación
            </span>
            <span className="text-zinc-500 text-xs font-bold">{client.email}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO Y RUTINAS GUARDADAS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <CalendarIcon size={20} className="text-yellow-400"/>
              <h3 className="text-lg font-black uppercase tracking-widest text-white italic">
                Fechas
              </h3>
            </div>
            <Calendar 
              onChange={handleDateChange} 
              value={date} 
              className="react-calendar-custom" 
              tileClassName={({ date: tDate }) => allSessionsIds.includes(formatDateId(tDate)) ? 'has-workout' : null} 
            />
          </div>

          {/* ASIGNACIÓN RÁPIDA DE RUTINAS PREDETERMINADAS */}
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
            <h3 className="text-white font-bold uppercase text-sm tracking-widest mb-4 flex items-center gap-2">
              <Save size={16} className="text-yellow-400"/> Pegar Rutina Guardada
            </h3>
            {routines.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {routines.map(routine => (
                  <button 
                    key={routine.id}
                    onClick={() => handleAssignRoutine(routine)}
                    className="w-full text-left p-3 bg-black/40 hover:bg-yellow-400/10 border border-zinc-800 hover:border-yellow-400/30 rounded-xl text-sm font-bold text-zinc-300 hover:text-yellow-400 transition-colors uppercase tracking-tight flex justify-between items-center"
                  >
                    {routine.name}
                    <Plus size={16}/>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-xs text-center py-4 font-medium border border-dashed border-zinc-800 rounded-xl">
                No tienes rutinas pre-armadas creadas.
              </p>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: EDICIÓN DEL DÍA SELECCIONADO */}
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/50 rounded-[2rem] border border-zinc-800 p-6 md:p-8 min-h-[600px] flex flex-col shadow-xl">
            
            {/* CABECERA DEL DÍA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Target className="text-yellow-400" size={24}/>
                  Día de Entrenamiento
                </h3>
                <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mt-1">
                  {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              {/* BOTONES DE ACCIÓN PRINCIPALES */}
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsExtrasModalOpen(true)}
                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                  title="Configurar Agua y Cardio"
                >
                  <Droplets size={16}/> Extras
                </button>
                <button 
                  onClick={() => openExerciseModal(null)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg"
                >
                  <Plus size={16}/> Ejercicio
                </button>
              </div>
            </div>

            {/* AVISO DE SESIÓN FINALIZADA */}
            {isSessionFinalized && (
              <div className="mb-6 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-full text-black"><CheckCircle size={20}/></div>
                <div>
                  <h4 className="text-green-500 font-black uppercase text-sm tracking-widest">Sesión Finalizada</h4>
                  <p className="text-green-500/70 text-xs font-medium">El alumno ya marcó este día como completado.</p>
                </div>
              </div>
            )}

            {/* MOSTRADOR DE EXTRAS (AGUA Y CARDIO) */}
            {(hydrationTarget || cardioTargetMinutes) && (
              <div className="flex gap-3 mb-6">
                {hydrationTarget && (
                  <div className="flex-1 bg-black/40 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Droplets size={24}/></div>
                    <div>
                      <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest">Objetivo Hidratación</p>
                      <p className="text-xl font-black text-white">{hydrationTarget} Litros</p>
                    </div>
                  </div>
                )}
                {cardioTargetMinutes && (
                  <div className="flex-1 bg-black/40 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-400"><Activity size={24}/></div>
                    <div>
                      <p className="text-[10px] text-red-400/60 font-black uppercase tracking-widest">Cardio Extra</p>
                      <p className="text-xl font-black text-white">{cardioTargetMinutes} Min <span className="text-sm text-red-400">({cardioTargetIntensity})</span></p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LISTA DE EJERCICIOS DEL DÍA */}
            <div className="space-y-4 flex-1">
              {loading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-400"></div></div>
              ) : dailySession.length > 0 ? (
                dailySession.map((ex, idx) => (
                  <div key={idx} className="bg-black/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-xl flex items-center justify-center font-black text-lg border border-yellow-400/20">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-white font-black text-lg uppercase tracking-tighter leading-none mb-1">{ex.name}</h4>
                          <div className="flex gap-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            <span className="bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">{ex.sets} Series</span>
                            <span className="bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">{ex.reps} Reps</span>
                            {ex.rir && <span className="bg-yellow-400/10 text-yellow-400 px-2 py-1 rounded-md border border-yellow-400/20">RIR {ex.rir}</span>}
                          </div>
                        </div>
                      </div>
                      
                      {/* BOTONES DE EDICIÓN Y BORRADO */}
                      <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openExerciseModal(idx)}
                          className="p-2 text-zinc-400 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                          title="Editar Ejercicio"
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          onClick={() => handleDeleteExercise(idx)}
                          className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                          title="Eliminar Ejercicio"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-black/30">
                  <Dumbbell size={48} className="text-zinc-800 mb-4"/>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Día de Descanso</p>
                  <p className="text-zinc-600 text-xs mt-2 max-w-xs text-center font-medium">Agrega ejercicios con el botón "+" o pega una rutina guardada desde la izquierda.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* --- MODAL 1: AGREGAR / EDITAR EJERCICIO --- */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                {editingExerciseIndex !== null ? 'Editar Ejercicio' : 'Configurar Ejercicio'}
              </h2>
              <button onClick={() => setIsExerciseModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveExercise} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Seleccionar de Biblioteca</label>
                <select 
                  required 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm font-bold uppercase"
                  value={exForm.name}
                  onChange={(e) => {
                    const selected = exercisesLibrary.find(ex => ex.name === e.target.value);
                    setExForm({ ...exForm, name: e.target.value, videoUrl: selected?.videoUrl || '' });
                  }}
                >
                  <option value="" disabled>Elige un ejercicio...</option>
                  {exercisesLibrary.map(ex => (
                    <option key={ex.id} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nº de Series</label>
                  <input 
                    type="number" 
                    required min="1" max="10"
                    placeholder="Ej: 3"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors font-bold text-center" 
                    value={exForm.sets} 
                    onChange={e => setExForm({...exForm, sets: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Repeticiones</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej: 10-12 o Fallo"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors font-bold text-center" 
                    value={exForm.reps} 
                    onChange={e => setExForm({...exForm, reps: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">RIR (Repeticiones en Reserva)</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setExForm({...exForm, rir: String(val)})}
                      className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border ${exForm.rir === String(val) ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button type="button" onClick={() => setIsExerciseModalOpen(false)} className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20">
                  {editingExerciseIndex !== null ? 'Guardar Cambios' : 'Agregar a la Rutina'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* --- MODAL 2: OBJETIVOS EXTRAS (AGUA Y CARDIO) --- */}
      {isExtrasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-blue-500/30 shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-red-500"></div>

            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                Objetivos Extra
              </h2>
              <button onClick={() => setIsExtrasModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveExtras} className="p-6 space-y-6">
              
              {/* INPUT HIDRATACIÓN */}
              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl">
                <label className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">
                  <Droplets size={14}/> Meta de Hidratación
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    step="0.1" min="0" max="10"
                    placeholder="Ej: 2.5"
                    className="flex-1 bg-zinc-900 border border-blue-500/30 rounded-xl p-3 text-white outline-none focus:border-blue-400 transition-colors font-black text-lg text-center" 
                    value={hydrationTarget} 
                    onChange={e => setHydrationTarget(e.target.value)} 
                  />
                  <span className="text-zinc-400 font-bold uppercase text-xs">Litros</span>
                </div>
              </div>

              {/* INPUT CARDIO */}
              <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl">
                <label className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">
                  <Activity size={14}/> Meta de Cardio
                </label>
                <div className="flex items-center gap-3 mb-4">
                  <input 
                    type="number" 
                    min="0" max="120"
                    placeholder="Ej: 15"
                    className="flex-1 bg-zinc-900 border border-red-500/30 rounded-xl p-3 text-white outline-none focus:border-red-400 transition-colors font-black text-lg text-center" 
                    value={cardioTargetMinutes} 
                    onChange={e => setCardioTargetMinutes(e.target.value)} 
                  />
                  <span className="text-zinc-400 font-bold uppercase text-xs">Minutos</span>
                </div>
                
                <div className="flex gap-2">
                  {['Baja', 'Media', 'Alta'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCardioTargetIntensity(level)}
                      className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border ${cardioTargetIntensity === level ? 'bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-red-400 hover:border-red-500/30'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button type="submit" className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-white/10">
                  Guardar Objetivos
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
