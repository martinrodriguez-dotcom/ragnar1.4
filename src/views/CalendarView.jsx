import React, { useState, useEffect } from 'react';
import { Calendar as CalIcon, Clock, User, Plus, Trash2 } from 'lucide-react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

export default function CalendarView() {
  const [sessions, setSessions] = useState([]);
  const [newSession, setNewSession] = useState({
    clientName: '',
    date: new Date().toISOString().split('T')[0], // Hoy por defecto
    time: '10:00',
    activity: 'Entrenamiento Personal',
  });

  // Cargar sesiones desde Firebase
  useEffect(() => {
    const q = query(
      collection(db, 'sessions'),
      orderBy('date'),
      orderBy('time')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSessions(sessionsData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddSession = async (e) => {
    e.preventDefault();
    if (!newSession.clientName) return;
    try {
      await addDoc(collection(db, 'sessions'), newSession);
      setNewSession({ ...newSession, clientName: '' }); // Limpiar nombre
    } catch (error) {
      console.error('Error creando sesión:', error);
    }
  };

  const handleDeleteSession = async (id) => {
    if (confirm('¿Borrar esta sesión?')) {
      await deleteDoc(doc(db, 'sessions', id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white uppercase">
          Agenda Semanal
        </h2>
        <p className="text-zinc-500 text-sm">
          Programa las sesiones de tus atletas.
        </p>
      </div>

      {/* Formulario Nueva Sesión */}
      <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 mb-8">
        <h3 className="text-white font-bold mb-4 text-sm uppercase">
          Agendar Nueva Sesión
        </h3>
        <form
          onSubmit={handleAddSession}
          className="grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Nombre del Atleta"
              className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white focus:border-yellow-400 outline-none"
              value={newSession.clientName}
              onChange={(e) =>
                setNewSession({ ...newSession, clientName: e.target.value })
              }
            />
          </div>
          <input
            type="date"
            className="bg-black border border-zinc-700 rounded-lg p-2 text-white focus:border-yellow-400 outline-none [color-scheme:dark]"
            value={newSession.date}
            onChange={(e) =>
              setNewSession({ ...newSession, date: e.target.value })
            }
          />
          <input
            type="time"
            className="bg-black border border-zinc-700 rounded-lg p-2 text-white focus:border-yellow-400 outline-none [color-scheme:dark]"
            value={newSession.time}
            onChange={(e) =>
              setNewSession({ ...newSession, time: e.target.value })
            }
          />
          <button
            type="submit"
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg p-2 flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Agendar
          </button>
        </form>
      </div>

      {/* Lista de Sesiones */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center bg-zinc-900 border-l-4 border-yellow-400 rounded-r-lg p-4 shadow-sm group hover:bg-zinc-800 transition-colors"
          >
            <div className="mr-4 text-center min-w-[60px]">
              <span className="block text-lg font-bold text-white">
                {session.time}
              </span>
              <span className="text-xs text-zinc-500">{session.date}</span>
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold flex items-center gap-2">
                <User size={16} className="text-yellow-400" />{' '}
                {session.clientName}
              </h4>
              <p className="text-sm text-zinc-400 flex items-center gap-2 mt-1">
                <Dumbbell size={14} /> {session.activity}
              </p>
            </div>
            <button
              onClick={() => handleDeleteSession(session.id)}
              className="text-zinc-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <CalIcon className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p>No hay sesiones programadas próximamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
