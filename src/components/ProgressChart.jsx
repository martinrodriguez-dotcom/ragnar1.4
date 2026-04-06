import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, TrendingUp } from 'lucide-react';

export default function ProgressChart({ clientId }) {
  const [sessions, setSessions] = useState([]);
  const [exercisesList, setExercisesList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar todas las sesiones finalizadas del cliente
  useEffect(() => {
    if (!clientId) return;
    const q = query(collection(db, 'clients', clientId, 'sessions'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetchedSessions = snap.docs.map(doc => doc.data()).filter(s => s.isFinalized && s.exercises);
      setSessions(fetchedSessions);

      // 2. Extraer lista única de ejercicios que haya hecho al menos una vez
      const uniqueEx = new Set();
      fetchedSessions.forEach(sess => {
        sess.exercises.forEach(ex => {
          if (ex.name) uniqueEx.add(ex.name);
        });
      });
      
      const exArray = Array.from(uniqueEx).sort();
      setExercisesList(exArray);
      if (exArray.length > 0 && !selectedExercise) {
        setSelectedExercise(exArray[0]); // Seleccionar el primero por defecto
      }
      setLoading(false);
    });
    return () => unsub();
  }, [clientId, selectedExercise]);

  // 3. Procesar datos para el gráfico según el ejercicio seleccionado
  useEffect(() => {
    if (!selectedExercise || sessions.length === 0) return;
    const data = [];
    
    sessions.forEach(sess => {
      const exObj = sess.exercises.find(e => e.name === selectedExercise);
      if (exObj && exObj.actualSets) {
        // Encontrar el peso máximo levantado ese día en cualquiera de las series
        let maxWeight = 0;
        exObj.actualSets.forEach(set => {
          if (set.completed && set.weight) {
            const w = parseFloat(set.weight);
            if (!isNaN(w) && w > maxWeight) maxWeight = w;
          }
        });
        
        if (maxWeight > 0) {
          // Formatear fecha para el eje X (solo Día/Mes para que entre en celular)
          const [y, m, d] = sess.date.split('-');
          data.push({ date: `${d}/${m}`, peso: maxWeight });
        }
      }
    });
    setChartData(data);
  }, [selectedExercise, sessions]);

  if (loading) {
    return <div className="flex justify-center py-10"><Activity className="animate-spin text-yellow-400" /></div>;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400"><TrendingUp size={24}/></div>
        <div>
          <h3 className="text-white font-bold uppercase tracking-widest text-sm">Evolución de Fuerza</h3>
          <p className="text-zinc-500 text-[10px] uppercase font-black mt-1">Peso Máximo Diario</p>
        </div>
      </div>

      <div className="mb-6">
        <select 
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none font-bold uppercase tracking-wide"
          value={selectedExercise}
          onChange={e => setSelectedExercise(e.target.value)}
        >
          {exercisesList.length === 0 ? <option value="">Sin datos suficientes...</option> : null}
          {exercisesList.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
      </div>

      <div className="h-64 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }}
                itemStyle={{ color: '#facc15' }}
              />
              <Line 
                type="monotone" 
                dataKey="peso" 
                name="Kg" 
                stroke="#facc15" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#09090b', stroke: '#facc15', strokeWidth: 2 }} 
                activeDot={{ r: 6, fill: '#facc15' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600">
            <Activity size={32} className="mb-2 opacity-50"/>
            <p className="text-[10px] uppercase font-black tracking-widest text-center px-4">
              Completa entrenamientos registrando tu peso para ver tu gráfica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
