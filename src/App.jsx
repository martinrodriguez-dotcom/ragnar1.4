import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, doc, getDocs, updateDoc, deleteDoc, 
  query, where, onSnapshot, collectionGroup, orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

// --- IMPORTACIÓN DE COMPONENTES Y VISTAS ---
import { Sidebar } from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import RoutinesView from './views/RoutinesView';
import ExercisesView from './views/ExercisesView';
import SettingsView from './views/SettingsView';
import NotificationsView from './views/NotificationsView';
import CommunityView from './views/CommunityView';
import ClientDetailView from './views/ClientDetailView';
import StudentView from './views/StudentView';
import StudentRegistration from './views/StudentRegistration';

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'coach', 'student', o null
  const [studentData, setStudentData] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Parámetro de invitación mágica por URL
  const queryParams = new URLSearchParams(window.location.search);
  const inviteId = queryParams.get('invite');

  // --- ESTADOS DEL PANEL DEL COACH ---
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [exercisesLibrary, setExercisesLibrary] = useState([]);
  const [settings, setSettings] = useState(null);

  // --- ESTADOS DE NOTIFICACIONES (TIEMPO REAL) ---
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [systemNotifications, setSystemNotifications] = useState([]);

  const auth = getAuth();

  // 1. VERIFICAR SESIÓN Y ROL (¿Quién está entrando?)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Buscar si el UID de este usuario pertenece a un alumno registrado
        const q = query(collection(db, 'clients'), where('studentUserId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Es un Alumno
          setUserRole('student');
          setStudentData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
        } else {
          // Si no es un alumno, asumimos que es el Coach/Administrador
          setUserRole('coach');
        }
      } else {
        // No hay nadie logueado
        setUser(null);
        setUserRole(null);
        setStudentData(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // 2. CARGA DE DATOS DEL COACH (Cerebro Global en Tiempo Real)
  useEffect(() => {
    // Si no es el coach, no escuchamos toda la base de datos
    if (userRole !== 'coach') return;

    // Escuchar Atletas
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const loadedClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(loadedClients);
    });

    // Escuchar Plantillas de Rutinas
    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Librería de Ejercicios
    const unsubExercises = onSnapshot(collection(db, 'exercises'), (snapshot) => {
      setExercisesLibrary(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Configuración General (Pagos, Alias, etc)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    // Escuchar TODOS los mensajes no leídos (Para la campanita del chat)
    const qMessages = query(
      collectionGroup(db, 'messages'), 
      where('sender', '==', 'student'), 
      where('read', '==', false)
    );
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setUnreadMessagesCount(snapshot.docs.length);
    });

    // Escuchar TODAS las notificaciones de sistema (Entrenamientos listos, faltas, etc)
    const qNotifs = query(collection(db, 'trainerNotifications'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSystemNotifications(notifs);
    });

    // Apagar los micrófonos al desmontar
    return () => {
      unsubClients();
      unsubRoutines();
      unsubExercises();
      unsubSettings();
      unsubMessages();
      unsubNotifs();
    };
  }, [userRole]);

  // --- FUNCIONES CRUD GLOBALES ---
  const handleUpdateClient = async (updatedClient) => {
    try {
      const { id, ...data } = updatedClient;
      await updateDoc(doc(db, 'clients', id), data);
    } catch (error) {
      console.error("Error actualizando cliente: ", error);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('¿Estás seguro de eliminar este atleta? Perderá el acceso y se borrarán sus datos.')) return;
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      // Si justo estaba viendo a este cliente, lo devuelvo a la lista
      if (selectedClient && selectedClient.id === clientId) {
        setCurrentView('clients');
        setSelectedClient(null);
      }
    } catch (error) {
      console.error("Error eliminando cliente: ", error);
    }
  };

  const navigateTo = (view, clientData = null) => {
    setCurrentView(view);
    if (clientData) setSelectedClient(clientData);
  };

  // Cálculo total de notificaciones para la campana roja del menú
  const unreadSystemCount = systemNotifications.filter(n => !n.read).length;
  const totalNotifications = unreadMessagesCount + unreadSystemCount;

  // --- RENDERIZADO CONDICIONAL DE PANTALLAS ---

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  // 1. FLUJO DE INVITACIÓN (Si hay un link de invitación y el alumno no está logueado)
  if (inviteId && userRole !== 'student') {
    return (
      <StudentRegistration 
        inviteId={inviteId} 
        onRegisterSuccess={() => window.location.href = '/'} 
      />
    );
  }

  // 2. PANTALLA DE LOGIN GENERAL (Para el Coach y Alumnos que entran directo)
  if (!user) {
    return <LoginScreen />;
  }

  // 3. VISTA EXCLUSIVA DEL ALUMNO
  if (userRole === 'student' && studentData) {
    return <StudentView clientId={studentData.id} />;
  }

  // 4. VISTA EXCLUSIVA DEL ENTRENADOR (Dashboard)
  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      
      {/* Menú Lateral (Sidebar) */}
      <Sidebar 
        activeView={currentView} 
        navigateTo={navigateTo} 
        notificationCount={totalNotifications} 
      />
      
      {/* Contenedor Principal con Scroll */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 md:p-8 custom-scrollbar relative">
        {currentView === 'dashboard' && <DashboardView clients={clients} navigateTo={navigateTo} />}
        
        {currentView === 'clients' && (
          <ClientsView 
            clients={clients} 
            navigateTo={navigateTo} 
            onUpdateClient={handleUpdateClient} 
            onDeleteClient={handleDeleteClient} 
          />
        )}
        
        {currentView === 'client-detail' && selectedClient && (
          <ClientDetailView 
            client={selectedClient} 
            goBack={() => navigateTo('clients')} 
            exercisesLibrary={exercisesLibrary} 
          />
        )}
        
        {currentView === 'routines' && (
          <RoutinesView 
            routines={routines} 
            exercisesLibrary={exercisesLibrary} 
          />
        )}
        
        {currentView === 'exercises' && (
          <ExercisesView 
            exercisesLibrary={exercisesLibrary} 
          />
        )}
        
        {currentView === 'settings' && (
          <SettingsView 
            settings={settings} 
          />
        )}
        
        {currentView === 'notifications' && (
          <NotificationsView /> // Ya lee sus propios datos en tiempo real internamente
        )}

        {currentView === 'community' && (
          <CommunityView 
            isCoach={true} 
            coachName="Coach Ragnar" 
          />
        )}
      </main>

    </div>
  );
}

// --- COMPONENTE DE LOGIN INTEGRADO ---
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('Credenciales incorrectas o usuario no encontrado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
        
        <div className="w-20 h-20 bg-yellow-400/10 rounded-3xl mx-auto mb-6 flex items-center justify-center border border-yellow-400/20">
          <span className="text-3xl font-black text-yellow-400 italic">R</span>
        </div>
        
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
          RAGNAR
        </h2>
        <p className="text-zinc-500 text-sm mb-8 font-bold uppercase tracking-widest">
          Centro de Comando
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold py-3 px-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            required 
            placeholder="Correo electrónico" 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            required 
            placeholder="Contraseña" 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-black py-4 rounded-xl uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_20px_rgba(250,204,21,0.2)] mt-4"
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
