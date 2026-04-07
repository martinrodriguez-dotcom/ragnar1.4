import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { db } from '../firebase';
import { ShieldCheck, LogIn, Dumbbell } from 'lucide-react';

export default function StudentRegistration({ inviteId, onRegisterSuccess }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const auth = getAuth();
  const provider = new GoogleAuthProvider();

  useEffect(() => {
    const fetchInviteProfile = async () => {
      try {
        const docRef = doc(db, 'clients', inviteId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Verificamos si el link ya fue usado por alguien más
          if (data.studentUserId) {
            setError("Este link de invitación ya ha sido utilizado o el alumno ya está registrado.");
          } else {
            setProfile(data);
          }
        } else {
          setError("Invitación inválida o el perfil ha sido eliminado.");
        }
      } catch (e) { 
        console.error(e);
        setError("Ocurrió un error al cargar la invitación."); 
      } finally { 
        setLoading(false); 
      }
    };

    if (inviteId) {
      fetchInviteProfile();
    }
  }, [inviteId]);

  const handleGoogleRegister = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // VINCULACIÓN: Guardamos el UID de Google y el Email en el documento que creó el entrenador
      await updateDoc(doc(db, 'clients', inviteId), {
        studentUserId: user.uid,
        email: user.email, // Actualizamos con su email real de Google
        linkedAt: new Date()
      });

      // Llamamos a la función de éxito para redirigirlo a su app
      onRegisterSuccess();
    } catch (e) { 
      console.error(e); 
      alert("Error al intentar iniciar sesión con Google. Por favor, intenta nuevamente."); 
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        
        {/* Barra decorativa superior */}
        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
        
        <div className="bg-yellow-400/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-yellow-400 shadow-inner">
          <ShieldCheck size={48} />
        </div>

        {error ? (
          <div className="animate-in slide-in-from-bottom-4">
            <h2 className="text-white font-black uppercase text-xl mb-4 italic tracking-tighter">Ups...</h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed px-4">{error}</p>
            <button 
              onClick={() => window.location.href = '/'} 
              className="text-yellow-400 hover:text-yellow-300 font-bold uppercase text-xs tracking-widest transition-colors"
            >
              Volver al Inicio
            </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4">
            <h2 className="text-white font-black uppercase text-2xl mb-2 italic tracking-tighter">¡Bienvenido Atleta!</h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
              Estás a un paso de vincular tu cuenta con el perfil de <span className="text-white font-bold">{profile?.name}</span> en Ragnar Training.
            </p>
            
            <div className="bg-black/50 border border-zinc-800 rounded-2xl p-4 mb-8 flex items-center gap-4 text-left shadow-inner">
              <div className="bg-zinc-800 p-2 rounded-xl text-yellow-400">
                <Dumbbell size={20}/>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Plan Asignado</p>
                <p className="text-white font-bold text-sm uppercase">{profile?.plan || 'Plan Base'}</p>
              </div>
            </div>

            <button 
              onClick={handleGoogleRegister}
              className="w-full bg-white text-black hover:bg-zinc-200 font-black py-4 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <LogIn size={20}/> Unirme con Google
            </button>
            
            <p className="text-zinc-600 text-[10px] uppercase font-bold mt-6 tracking-widest">
              Usa tu cuenta personal de Google
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
