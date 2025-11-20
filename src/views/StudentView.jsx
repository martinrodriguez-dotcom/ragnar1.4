import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  Dumbbell,
  CheckCircle,
  User,
  Save,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export default function StudentView({ clientId }) {
  const [client, setClient] = useState(null);
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDateId = (d) => d.toISOString().split('T')[0];
  const currentDateId = formatDateId(date);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setClient({ id: docSnap.id, ...docSnap.data() });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    if (clientId) fetchClient();
  }, [clientId]);

  useEffect(() => {
    if (!client) return;
    const sessionsRef = collection(db, 'clients', client.id, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      setAllSessionsIds(snapshot.docs.map((doc) => doc.id));
    });
    return () => unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const sessionDocRef = doc(
      db,
      'clients',
      client.id,
      'sessions',
      currentDateId
    );
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailySession(docSnap.data().exercises || []);
      } else {
        setDailySession([]);
      }
    });
    return () => unsubscribe();
  }, [date, client]);

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    const updatedSession = [...dailySession];
    if (!updatedSession[exerciseIndex].actualSets)
      updatedSession[exerciseIndex].actualSets = [];
    if (!updatedSession[exerciseIndex].actualSets[setIndex])
      updatedSession[exerciseIndex].actualSets[setIndex] = {
        reps: '',
        weight: '',
        completed: false,
      };

    updatedSession[exerciseIndex].actualSets[setIndex] = {
      ...updatedSession[exerciseIndex].actualSets[setIndex],
      [field]: value,
    };

    try {
      await setDoc(
        doc(db, 'clients', clientId, 'sessions', currentDateId),
        {
          date: currentDateId,
          exercises: updatedSession,
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error guardando:', error);
    }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    const currentStatus =
      dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  if (!client)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Atleta no encontrado
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      <div className="bg-yellow-400 text-black p-4 pb-8 rounded-b-[2rem] shadow-lg z-10 relative">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase leading-none">
              {client.name}
            </h1>
            <p className="text-xs font-medium mt-1 opacity-80">{client.plan}</p>
          </div>
          <div className="bg-black/10 p-2 rounded-full">
            <User size={20} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 -mt-6 pt-8 pb-4 space-y-6 relative z-0">
        <div className="flex justify-between items-end mb-1 px-1">
          <h2 className="text-xl font-bold text-white uppercase">
            Rutina de Hoy
          </h2>
          <span className="text-xs text-yellow-400 font-bold uppercase">
            {date.toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="space-y-4">
          {dailySession.length > 0 ? (
            dailySession.map((ex, idx) => {
              const planSets = parseInt(ex.sets) || 1;
              const setsData = ex.actualSets || [];
              const completedCount = setsData.filter(
                (s) => s && s.completed
              ).length;
              const isExerciseComplete = completedCount >= planSets;

              return (
                <div
                  key={idx}
                  className={`bg-zinc-900 border ${
                    isExerciseComplete
                      ? 'border-green-500/50'
                      : 'border-zinc-800'
                  } rounded-xl overflow-hidden transition-all`}
                >
                  <div className="p-4 bg-zinc-800/30">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            isExerciseComplete
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-400 text-black'
                          }`}
                        >
                          {isExerciseComplete ? (
                            <CheckCircle size={16} />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div>
                          <h3 className="font-bold text-white text-lg leading-tight">
                            {ex.name}
                          </h3>
                          <p className="text-zinc-500 text-xs mt-1">
                            Objetivo:{' '}
                            <span className="text-zinc-300">
                              {ex.sets} series
                            </span>{' '}
                            x <span className="text-zinc-300">{ex.reps}</span> @{' '}
                            {ex.weight}
                          </p>
                          {ex.videoUrl && (
                            <a
                              href={ex.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 text-[10px] font-bold mt-1 hover:text-blue-300"
                            >
                              <PlayCircle size={10} /> Ver técnica
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="grid grid-cols-10 gap-2 mb-2 text-[9px] uppercase text-zinc-500 font-bold text-center">
                      <div className="col-span-1">#</div>
                      <div className="col-span-3">Reps Reales</div>
                      <div className="col-span-3">Kg Reales</div>
                      <div className="col-span-3">Estado</div>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: planSets }).map((_, setIdx) => {
                        const currentSet = setsData[setIdx] || {
                          reps: '',
                          weight: '',
                          completed: false,
                        };
                        return (
                          <div
                            key={setIdx}
                            className={`grid grid-cols-10 gap-2 items-center p-2 rounded-lg transition-colors ${
                              currentSet.completed
                                ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-black/20 border border-zinc-800'
                            }`}
                          >
                            <div className="col-span-1 text-center text-zinc-400 font-bold text-xs">
                              {setIdx + 1}
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                className={`w-full bg-zinc-950 border ${
                                  currentSet.completed
                                    ? 'border-green-500/30 text-green-400'
                                    : 'border-zinc-700 text-white'
                                } rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400 transition-colors`}
                                placeholder={ex.reps}
                                value={currentSet.reps}
                                onChange={(e) =>
                                  handleUpdateSet(
                                    idx,
                                    setIdx,
                                    'reps',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="text"
                                className={`w-full bg-zinc-950 border ${
                                  currentSet.completed
                                    ? 'border-green-500/30 text-green-400'
                                    : 'border-zinc-700 text-white'
                                } rounded p-1.5 text-center text-sm outline-none focus:border-yellow-400 transition-colors`}
                                placeholder={ex.weight}
                                value={currentSet.weight}
                                onChange={(e) =>
                                  handleUpdateSet(
                                    idx,
                                    setIdx,
                                    'weight',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="col-span-3 flex justify-center">
                              <button
                                onClick={() => toggleSetComplete(idx, setIdx)}
                                className={`w-full py-1.5 rounded flex items-center justify-center gap-1 text-[10px] font-bold transition-all ${
                                  currentSet.completed
                                    ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                                }`}
                              >
                                {currentSet.completed ? 'LISTO' : 'HECHO'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
              <Dumbbell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Descanso o sin asignar.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border-t border-zinc-800 p-4 pb-6 text-center">
        <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">
          Navegar otros días
        </p>
        <Calendar
          onChange={setDate}
          value={date}
          className="react-calendar-custom-mini"
          tileClassName={({ date }) =>
            allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null
          }
        />
        {/* CAMBIO DE MARCA FOOTER */}
        <p className="text-[10px] text-zinc-700 mt-4 uppercase tracking-widest">
          Powered by RAGNAR-TRAINING
        </p>
      </div>
    </div>
  );
}
