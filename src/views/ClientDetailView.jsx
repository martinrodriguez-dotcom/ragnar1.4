import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  User,
  Dumbbell,
  Plus,
  Trash2,
  CheckCircle,
  Share2,
  Video,
} from 'lucide-react';
import {
  doc,
  collection,
  setDoc,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export default function ClientDetailView({ client, goBack, exercisesLibrary }) {
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: '10',
    weight: '',
    videoUrl: '',
  });
  const [isAdding, setIsAdding] = useState(false);

  const formatDateId = (d) => d.toISOString().split('T')[0];
  const currentDateId = formatDateId(date);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'clients', client.id, 'sessions'),
      (snapshot) => {
        setAllSessionsIds(snapshot.docs.map((doc) => doc.id));
      }
    );
    return () => unsubscribe();
  }, [client.id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'clients', client.id, 'sessions', currentDateId),
      (docSnap) => {
        setDailySession(docSnap.exists() ? docSnap.data().exercises : []);
      }
    );
    return () => unsubscribe();
  }, [date, client.id]);

  const handleExerciseSelect = (e) => {
    const selectedName = e.target.value;
    const selectedEx = exercisesLibrary.find((ex) => ex.name === selectedName);
    setNewExercise({
      ...newExercise,
      name: selectedName,
      videoUrl: selectedEx?.videoUrl || '',
    });
  };

  const handleSaveExercise = async () => {
    if (!newExercise.name) return;
    const updatedSession = [
      ...dailySession,
      { ...newExercise, id: Date.now() },
    ];
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        exercises: updatedSession,
      });
      setIsAdding(false);
      setNewExercise((prev) => ({ ...prev, name: '', videoUrl: '' }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteExercise = async (exerciseId) => {
    const updatedSession = dailySession.filter((ex) => ex.id !== exerciseId);
    try {
      if (updatedSession.length === 0) {
        await deleteDoc(
          doc(db, 'clients', client.id, 'sessions', currentDateId)
        );
      } else {
        await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
          date: currentDateId,
          exercises: updatedSession,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const copyStudentLink = () => {
    const url = `${window.location.origin}/?invite=${client.id}`;
    navigator.clipboard.writeText(url);
    alert('Link de Invitación copiado: ' + url);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="text-zinc-500 hover:text-white font-bold"
          >
            ← Volver
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{client.name}</h2>
            <p className="text-zinc-500 text-sm">{client.plan}</p>
          </div>
        </div>
        <button
          onClick={copyStudentLink}
          className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-yellow-900/20"
        >
          <Share2 size={16} /> Link Invitación
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 h-fit">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-yellow-400" /> Planificador
          </h3>
          <Calendar
            onChange={setDate}
            value={date}
            className="react-calendar-custom"
            tileClassName={({ date }) =>
              allSessionsIds.includes(formatDateId(date)) ? 'has-workout' : null
            }
          />
          <p className="text-center mt-4 text-yellow-400 font-bold capitalize">
            {date.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        <div className="lg:col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Dumbbell size={18} className="text-zinc-400" /> Rutina del Día
            </h3>
            <button
              onClick={() => setIsAdding(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded text-sm border border-zinc-700 flex items-center gap-1"
            >
              <Plus size={14} /> Ejercicio
            </button>
          </div>

          {isAdding && (
            <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-4 gap-3 mb-2">
                <div className="col-span-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                    Seleccionar Ejercicio
                  </label>
                  <select
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mt-1"
                    value={newExercise.name}
                    onChange={handleExerciseSelect}
                  >
                    <option value="">Elegir de la lista...</option>
                    {exercisesLibrary.map((ex) => (
                      <option key={ex.id} value={ex.name}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  {newExercise.videoUrl && (
                    <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1 ml-1">
                      <Video size={10} /> Video vinculado automáticamente
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                    Series
                  </label>
                  <input
                    type="number"
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mt-1"
                    value={newExercise.sets}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, sets: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                    Reps
                  </label>
                  <input
                    type="text"
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mt-1"
                    value={newExercise.reps}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, reps: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                    Kg
                  </label>
                  <input
                    type="text"
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mt-1"
                    value={newExercise.weight}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, weight: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSaveExercise}
                    className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded text-sm font-bold h-[38px]"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="text-xs text-zinc-500 hover:text-white underline mt-2 ml-1"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="p-4 space-y-2 flex-1 overflow-y-auto">
            {dailySession.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                <p>Día libre.</p>
                <p className="text-xs">
                  Agrega ejercicios para armar la rutina.
                </p>
              </div>
            ) : (
              dailySession.map((ex, idx) => (
                <div
                  key={ex.id || idx}
                  className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800 group hover:border-zinc-600 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold">{ex.name}</h4>
                      {ex.videoUrl && (
                        <Video size={14} className="text-blue-500" />
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">
                      <span className="text-zinc-300 font-bold">{ex.sets}</span>{' '}
                      series x{' '}
                      <span className="text-zinc-300 font-bold">{ex.reps}</span>{' '}
                      reps @{' '}
                      <span className="text-yellow-400 font-bold">
                        {ex.weight}
                      </span>
                    </p>
                    {ex.actualSets &&
                      ex.actualSets.some((s) => s && s.completed) && (
                        <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded px-2 py-1 inline-block">
                          <p className="text-green-400 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle size={10} />{' '}
                            {ex.actualSets.filter((s) => s.completed).length} /{' '}
                            {ex.sets} series completadas
                          </p>
                        </div>
                      )}
                  </div>
                  <button
                    onClick={() => handleDeleteExercise(ex.id)}
                    className="text-zinc-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar ejercicio"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
