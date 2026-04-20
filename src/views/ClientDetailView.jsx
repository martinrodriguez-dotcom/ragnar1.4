import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  ChevronLeft, Calendar as CalendarIcon, Dumbbell, Plus, 
  Trash2, Edit, Save, Activity, Droplets, Target, User, Video, X, CheckCircle 
} from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function ClientDetailView({ client, goBack, exercisesLibrary = [], routines = [] }) {
  const [date, setDate] = useState(new Date());
  
  // --- ESTADOS DE LA SESIÓN DEL DÍA ---
  const [dailySession, setDailySession] = useState([]); 
  const [hydrationTarget, setHydrationTarget] = useState('');
  const [cardioTargetMinutes, setCardioTargetMinutes] = useState('');
  const [cardioTargetIntensity, setCardioTargetIntensity] = useState('Baja');
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  
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
    plannedSets: [{ reps: '', rir: '2' }] 
  });

  // --- FORMATEO DE FECHAS PARA FIREBASE ---
  const formatDateId = (d) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
  };

  const currentDateId = formatDateId(date);

  // --- ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    if (!client?.id) return;

    // 1. Buscamos todas las sesiones para marcar el calendario con puntos
    const fetchAllSessions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'clients', client.id, 'sessions'));
        const ids = querySnapshot.docs
          .filter(doc => doc.data().exercises && doc.data().exercises.length > 0)
          .map(doc => doc.id);
        setAllSessionsIds(ids);
      } catch (error) { 
        console.error(error); 
      }
    };
    fetchAllSessions();

    // 2. Escuchamos en vivo el día seleccionado
    const sessionDocRef = doc(db, 'clients', client.id, 'sessions', currentDateId);
    const unsubDaily = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailySession(data.exercises || []);
        setIsSessionFinalized(data.isFinalized || false);
        setHydrationTarget(data.targetHydration || '');
        setCardioTargetMinutes(data.targetCardioMinutes || '');
        setCardioTargetIntensity(data.targetCardioIntensity || 'Baja');
      } else {
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

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setLoading(true);
  };

  // --- LÓGICA DE ASIGNACIÓN AUTOMÁTICA DE RUTINA ---
  const handleAssignRoutine = async (routineObj) => {
    if (!window.confirm(`¿Copiar la rutina "${routineObj.name}" al día ${date.toLocaleDateString()}? Se sobrescribirá lo que haya.`)) return;
    
    try {
      // Transformamos los ejercicios de la rutina pre-armada al formato de sesión diaria
      const formattedExercises = routineObj.exercises.map(ex => {
        // Si ya tiene series dinámicas (plannedSets), las usamos. Si no, las creamos desde el formato viejo.
        let safePlannedSets = ex.plannedSets;
        if (!safePlannedSets || !Array.isArray(safePlannedSets) || safePlannedSets.length === 0) {
          const count = Math.max(1, parseInt(ex.sets) || 3);
          safePlannedSets = Array.from({ length: count }).map(() => ({
            reps: String(ex.reps || '10'),
            rir: String(ex.rir || '2')
          }));
        }

        return {
          name: String(ex.name || 'Ejercicio'),
          videoUrl: String(ex.videoUrl || ''),
          sets: String(safePlannedSets.length),
          reps: String(safePlannedSets[0]?.reps || '10'),
          rir: String(safePlannedSets[0]?.rir || '2'),
          plannedSets: safePlannedSets,
          actualSets: [] // Inicializamos para el alumno
        };
      });

      // Guardamos en Firebase
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: formattedExercises,
        isFinalized: false // Por si el día estaba finalizado, lo abrimos de nuevo
      }, { merge: true });

      // Agregamos el punto al calendario visualmente
      if (!allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
      
      alert("Rutina asignada correctamente.");
    } catch (error) {
      console.error(error);
      alert("Error al asignar la rutina.");
    }
  };

  // --- GESTIÓN DE SERIES DINÁMICAS ---
  const updateSetField = (index, field, value) => {
    const updatedSets = [...exForm.plannedSets];
    updatedSets[index] = { ...updatedSets[index], [field]: value };
    setExForm({ ...exForm, plannedSets: updatedSets });
  };

  const addSet = () => {
    setExForm(prev => ({ 
      ...prev, 
      plannedSets: [...prev.plannedSets, { reps: '', rir: '2' }] 
    }));
  };

  const removeSet = (indexToRemove) => {
    setExForm(prev => ({ 
      ...prev, 
      plannedSets: prev.plannedSets.filter((_, idx) => idx !== indexToRemove) 
    }));
  };

  // --- ABRIR MODAL DE EJERCICIO ---
  const openExerciseModal = (index = null) => {
    if (index !== null) {
      const ex = dailySession[index];
      let loadedSets = ex.plannedSets;
      
      if (!loadedSets || loadedSets.length === 0) {
        loadedSets = Array.from({ length: Math.max(1, parseInt(ex.sets) || 1) }).map(() => ({
          reps: String(ex.reps || ''),
          rir: String(ex.rir || '2')
        }));
      }
      
      setExForm({
        name: ex.name || '',
        videoUrl: ex.videoUrl || '',
        plannedSets: loadedSets
      });
      setEditingExerciseIndex(index);
    } else {
      setExForm({
        name: exercisesLibrary?.length > 0 ? exercisesLibrary[0].name : '',
        videoUrl: exercisesLibrary?.length > 0 ? exercisesLibrary[0].videoUrl : '',
        plannedSets: [{ reps: '', rir: '2' }]
      });
      setEditingExerciseIndex(null);
    }
    setIsExerciseModalOpen(true);
  };

  // --- GUARDAR EJERCICIO ---
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!exForm.name || exForm.plannedSets.length === 0) {
      alert("Faltan datos en el ejercicio.");
      return;
    }

    let updatedSession = [...dailySession];
    
    const exerciseToSave = {
      name: String(exForm.name),
      videoUrl: String(exForm.videoUrl || ''),
      sets: String(exForm.plannedSets.length),
      reps: String(exForm.plannedSets[0]?.reps || ''),
      rir: String(exForm.plannedSets[0]?.rir || '2'),
      plannedSets: exForm.plannedSets,
      actualSets: editingExerciseIndex !== null ? (updatedSession[editingExerciseIndex].actualSets || []) : []
    };

    if (editingExerciseIndex !== null) {
      updatedSession[editingExerciseIndex] = exerciseToSave;
    } else {
      updatedSession.push(exerciseToSave);
    }

    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession
      }, { merge: true });
      
      setIsExerciseModalOpen(false);
      if (!allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- ELIMINAR EJERCICIO ---
  const handleDeleteExercise = async (idx) => {
    if (!window.confirm('¿Borrar este ejercicio?')) return;
    
    const updated = dailySession.filter((_, i) => i !== idx);
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), { 
        exercises: updated 
      }, { merge: true });
      
      if (updated.length === 0) {
        setAllSessionsIds(allSessionsIds.filter(id => id !== currentDateId));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- GUARDAR EXTRAS ---
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
    }
  };

  if (!client) return null;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER: BOTÓN VOLVER Y DATOS DEL ALUMNO */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={goBack} 
          className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-white hover:text-yellow-400 transition-colors shadow-lg shrink-0"
        >
          <ChevronLeft size={28}/>
        </button>
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
            {client.name || 'Atleta'}
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
        
        {/* COLUMNA IZQUIERDA: CALENDARIO Y RUTINAS AUTOMÁTICAS */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <CalendarIcon size={20} className="text-yellow-400"/>
              <h3 className="text-lg font-black uppercase tracking-widest text-white italic">Planificador</h3>
            </div>
            <Calendar 
              onChange={handleDateChange} 
              value={date} 
              className="react-calendar-custom" 
              tileClassName={({ date: tDate }) => allSessionsIds.includes(formatDateId(tDate)) ? 'has-workout' : null} 
            />
          </div>

          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
            <h3 className="text-white font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
              <Save size={16} className="text-yellow-400"/> Mis Rutinas Guardadas
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {routines && routines.length > 0 ? (
                routines.map(routine => (
                  <button 
                    key={routine.id}
                    onClick={() => handleAssignRoutine(routine)}
                    className="w-full text-left p-4 bg-black/40 hover:bg-yellow-400/10 border border-zinc-800 hover:border-yellow-400/30 rounded-xl text-xs font-black text-zinc-400 hover:text-yellow-400 transition-all uppercase tracking-widest flex justify-between items-center group"
                  >
                    {routine.name}
                    <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </button>
                ))
              ) : (
                <p className="text-zinc-600 text-[10px] text-center py-4 uppercase font-bold italic border border-dashed border-zinc-800 rounded-xl">
                  No hay rutinas creadas
                </p>
              )}
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: EDICIÓN DEL DÍA */}
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/50 rounded-[2rem] border border-zinc-800 p-6 md:p-8 min-h-[600px] flex flex-col shadow-xl">
            
            {/* CABECERA DEL DÍA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Target className="text-yellow-400" size={24}/> Programación
                </h3>
                <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mt-1">
                  {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setIsExtrasModalOpen(true)} 
                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                  <Droplets size={16}/> Extras
                </button>
                <button 
                  onClick={() => openExerciseModal(null)} 
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg"
                >
                  <Plus size={16}/> Ejercicio
                </button>
              </div>
            </div>

            {/* ESTADO FINALIZADO */}
            {isSessionFinalized && (
              <div className="mb-6 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3">
                <CheckCircle className="text-green-500" size={20}/>
                <span className="text-green-500 font-black uppercase text-xs tracking-widest">
                  Día Completado por Atleta
                </span>
              </div>
            )}

            {/* RESUMEN DE EXTRAS */}
            {(hydrationTarget || cardioTargetMinutes) && (
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {hydrationTarget && (
                  <div className="flex-1 bg-black/40 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <Droplets size={24} className="text-blue-400"/>
                    <div>
                      <p className="text-[9px] text-blue-400/60 font-black uppercase">Hidratación</p>
                      <p className="text-lg font-black text-white">{hydrationTarget} Lts</p>
                    </div>
                  </div>
                )}
                {cardioTargetMinutes && (
                  <div className="flex-1 bg-black/40 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <Activity size={24} className="text-red-400"/>
                    <div>
                      <p className="text-[9px] text-red-400/60 font-black uppercase">Cardio</p>
                      <p className="text-lg font-black text-white">{cardioTargetMinutes} Min <span className="text-xs opacity-50">({cardioTargetIntensity})</span></p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LISTA DE EJERCICIOS */}
            <div className="space-y-4 flex-1">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-400"></div>
                </div>
              ) : dailySession.length > 0 ? (
                dailySession.map((ex, idx) => (
                  <div key={idx} className="bg-black/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all group">
                    <div className="flex justify-between items-start">
                      
                      <div className="flex gap-4 w-full">
                        <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-xl flex items-center justify-center font-black text-lg border border-yellow-400/20 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-black text-lg uppercase tracking-tighter mb-3">{ex.name}</h4>
                          <div className="space-y-1.5">
                            {(ex.plannedSets || []).map((set, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className="text-zinc-600 w-12 shrink-0">Set {sIdx + 1}:</span>
                                <span className="text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700">{set.reps} Reps</span>
                                <span className="text-yellow-400 bg-yellow-400/5 px-2 py-1 rounded border border-yellow-400/20">RIR {set.rir}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          onClick={() => openExerciseModal(idx)} 
                          className="p-2 text-zinc-400 hover:text-blue-400 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-blue-500/30 transition-colors"
                          title="Editar"
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          onClick={() => handleDeleteExercise(idx)} 
                          className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-red-500/30 transition-colors"
                          title="Borrar"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>

                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-black/30 text-zinc-700">
                  <Dumbbell size={48} className="mb-4 opacity-20"/>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Día de Descanso</p>
                  <p className="text-[10px] mt-2 text-center max-w-[200px] uppercase font-bold">Agrega un ejercicio o pega una rutina prearmada</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* --- MODAL 1: EJERCICIO CON SERIES --- */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                {editingExerciseIndex !== null ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h2>
              <button 
                onClick={() => setIsExerciseModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
              
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Ejercicio</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 text-sm font-bold uppercase transition-colors" 
                  value={exForm.name} 
                  onChange={e => {
                    const sel = exercisesLibrary.find(ex => ex.name === e.target.value);
                    setExForm({...exForm, name: e.target.value, videoUrl: sel?.videoUrl || ''});
                  }}
                >
                  <option value="" disabled>Elegir...</option>
                  {exercisesLibrary?.map(ex => (
                    <option key={ex.id || Math.random()} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Configurar Series</label>
                
                {exForm.plannedSets.map((set, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-zinc-800 animate-in slide-in-from-bottom-2">
                    
                    <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 rounded-lg text-[10px] font-black text-zinc-500 shrink-0">
                      {idx + 1}
                    </div>

                    <input 
                      type="text" 
                      placeholder="Reps (ej: 10)" 
                      className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center font-bold text-xs outline-none focus:border-yellow-400" 
                      value={set.reps} 
                      onChange={e => updateSetField(idx, 'reps', e.target.value)} 
                    />
                    
                    <select 
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold text-xs outline-none focus:border-yellow-400" 
                      value={set.rir} 
                      onChange={e => updateSetField(idx, 'rir', e.target.value)}
                    >
                      {[0,1,2,3,4].map(v => (
                        <option key={v} value={v}>RIR {v}</option>
                      ))}
                    </select>
                    
                    <button 
                      onClick={() => removeSet(idx)} 
                      disabled={exForm.plannedSets.length === 1} 
                      className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={addSet} 
                  className="w-full py-3 mt-2 border border-dashed border-zinc-700 text-zinc-500 hover:border-yellow-400 hover:text-yellow-400 hover:bg-yellow-400/5 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 rounded-xl transition-all"
                >
                  <Plus size={14}/> Añadir Serie
                </button>

              </div>

            </div>
            
            <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex gap-3 shrink-0">
              <button 
                onClick={() => setIsExerciseModalOpen(false)} 
                className="flex-1 py-4 text-zinc-500 font-bold uppercase text-xs bg-black rounded-xl hover:bg-zinc-900 border border-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveExercise} 
                className="flex-1 bg-yellow-400 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-yellow-400/20 hover:bg-yellow-300 transition-colors"
              >
                Guardar
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* --- MODAL 2: EXTRAS --- */}
      {isExtrasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-blue-500/20 shadow-2xl p-6 space-y-6 relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-red-500"></div>

            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
              Metas del Día
            </h2>
            
            <div className="space-y-4">
              
              <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                <label className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
                  <Droplets size={14}/> Agua (Litros)
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white font-black text-lg outline-none focus:border-blue-400 transition-colors" 
                  value={hydrationTarget} 
                  onChange={e => setHydrationTarget(e.target.value)} 
                />
              </div>
              
              <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/20">
                <label className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">
                  <Activity size={14}/> Cardio (Minutos)
                </label>
                <input 
                  type="number" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white font-black text-lg outline-none focus:border-red-400 transition-colors mb-3" 
                  value={cardioTargetMinutes} 
                  onChange={e => setCardioTargetMinutes(e.target.value)} 
                />
                
                <div className="flex gap-2">
                  {['Baja','Media','Alta'].map(level => (
                    <button 
                      key={level} 
                      onClick={() => setCardioTargetIntensity(level)} 
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${cardioTargetIntensity === level ? 'bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsExtrasModalOpen(false)} 
                className="flex-1 py-4 text-zinc-500 font-bold uppercase text-xs bg-black rounded-xl border border-zinc-800 transition-colors hover:bg-zinc-900"
              >
                Cerrar
              </button>
              <button 
                onClick={handleSaveExtras} 
                className="flex-1 bg-white text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-white/10 hover:bg-zinc-200 transition-colors"
              >
                Confirmar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
