import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Dumbbell,
  CheckCircle,
} from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { db } from '../firebase';

export default function StudentRegistration({ inviteId, onRegisterSuccess }) {
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false); // Alternar entre registro y login
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const auth = getAuth();

  // 1. Identificar al cliente por el ID del link
  useEffect(() => {
    const fetchClientName = async () => {
      try {
        const docRef = doc(db, 'clients', inviteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClientName(data.name);
          // Si el cliente ya tiene un usuario vinculado, sugerimos iniciar sesión
          if (data.studentUserId) setIsLoginMode(true);
        } else {
          setError('Invitación no válida o expirada.');
        }
      } catch (err) {
        console.error(err);
        setError('Error de conexión.');
      } finally {
        setLoading(false);
      }
    };
    if (inviteId) fetchClientName();
  }, [inviteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userCredential;

      if (isLoginMode) {
        // Iniciar sesión existente
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        // Crear cuenta nueva
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // VINCULACIÓN MÁGICA: Guardamos el ID del usuario en la ficha del cliente
        const user = userCredential.user;
        await updateDoc(doc(db, 'clients', inviteId), {
          studentUserId: user.uid, // ¡Aquí conectamos al alumno con su ficha!
          email: user.email, // Guardamos el mail por referencia
        });
      }

      onRegisterSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. Prueba iniciar sesión.');
        setIsLoginMode(true);
      } else if (err.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else {
        setError('Ocurrió un error. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !clientName)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );

  if (error && !clientName)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 text-center">
        {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Decoración */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-yellow-400/10 to-transparent pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-yellow-400 rounded-full mb-4 shadow-[0_0_25px_rgba(250,204,21,0.3)] animate-bounce-slow">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
            Hola,{' '}
            <span className="text-yellow-400">{clientName.split(' ')[0]}</span>
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            {isLoginMode
              ? 'Ingresa para ver tu rutina.'
              : 'Crea tu cuenta para acceder a tu entrenamiento personalizado.'}
          </p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Email
              </label>
              <div className="relative mt-1">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={18}
                />
                <input
                  type="email"
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:border-yellow-400 focus:outline-none transition-colors"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Contraseña
              </label>
              <div className="relative mt-1">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={18}
                />
                <input
                  type="password"
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:border-yellow-400 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center bg-red-500/10 p-2 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3.5 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20"
            >
              {loading ? (
                'Procesando...'
              ) : (
                <>
                  {isLoginMode ? 'Ingresar' : 'Activar Cuenta'}{' '}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
              }}
              className="text-zinc-500 text-xs hover:text-white underline transition-colors"
            >
              {isLoginMode
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia Sesión'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2 text-zinc-600 text-[10px] uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <CheckCircle size={10} /> Planificación
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle size={10} /> Seguimiento
          </span>
        </div>
      </div>
    </div>
  );
}
