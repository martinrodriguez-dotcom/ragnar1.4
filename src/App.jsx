import React, { useState, useEffect } from 'react';
import {
  Menu,
  Dumbbell,
  Settings,
  BarChart3,
  Users,
  Calendar,
  X,
  LogOut,
  List,
} from 'lucide-react';

// --- Firebase ---
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  getDocs,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase';

// --- Componentes ---
import { Sidebar } from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import ClientDetailView from './views/ClientDetailView';
import ExercisesView from './views/ExercisesView';
import CalendarView from './views/CalendarView';
import LoginView from './views/LoginView';
import StudentView from './views/StudentView';
import StudentRegistration from './views/StudentRegistration';

export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Rol del usuario: 'trainer' | 'student' | null
  const [userRole, setUserRole] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null);

  // Estado de Invitación (Link Mágico)
  const [inviteId, setInviteId] = useState(null);

  // Estados de navegación y datos (Entrenador)
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const auth = getAuth();

  // --- EFECTO 1: Detectar Usuario y Parámetros de URL ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setInviteId(inviteParam);
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await checkUserRole(currentUser.uid);
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole(null);
        setStudentProfileId(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Función para determinar ROL ---
  const checkUserRole = async (uid) => {
    const q = query(
      collection(db, 'clients'),
      where('studentUserId', '==', uid)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const clientDoc = querySnapshot.docs[0];
      setUserRole('student');
      setStudentProfileId(clientDoc.id);
    } else {
      setUserRole('trainer');
    }
  };

  // --- EFECTO 2: Cargar Datos (Solo si es Entrenador) ---
  useEffect(() => {
    if (!user || userRole !== 'trainer') return;

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClients(clientsData);
    });

    const unsubExercises = onSnapshot(
      query(collection(db, 'exercises'), orderBy('name')),
      (snapshot) => {
        const exData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExercises(exData);
      }
    );

    return () => {
      unsubClients();
      unsubExercises();
    };
  }, [user, userRole]);

  // --- FUNCIONES ---

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddClient = async (data) => {
    const { id, ...rest } = data;
    await addDoc(collection(db, 'clients'), {
      ...rest,
      createdAt: new Date(),
      trainerId: user.uid,
    });
  };

  const navigateTo = (view, client = null) => {
    setActiveView(view);
    if (client) setSelectedClient(client);
    setIsMobileMenuOpen(false);
  };

  const updateClientRoutine = async (clientId, newEx) => {
    const clientRef = doc(db, 'clients', clientId);
    const current = clients.find((c) => c.id === clientId);
    const updated = [...(current.routine || []), newEx];
    await updateDoc(clientRef, { routine: updated });
    if (selectedClient?.id === clientId)
      setSelectedClient((prev) => ({ ...prev, routine: updated }));
  };

  const handleAddExercise = async (data) => {
    await addDoc(collection(db, 'exercises'), {
      name: data.name,
      videoUrl: data.videoUrl || '',
    });
  };

  const handleDeleteExercise = async (id) => {
    if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'exercises', id));
  };

  // --- RENDERIZADO ---

  if (loadingAuth)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );

  if (inviteId && (!user || (user && userRole !== 'student'))) {
    return (
      <StudentRegistration
        inviteId={inviteId}
        onRegisterSuccess={() => {
          window.history.pushState(
            {},
            document.title,
            window.location.pathname
          );
          setInviteId(null);
        }}
      />
    );
  }

  if (user && userRole === 'student' && studentProfileId) {
    return <StudentView clientId={studentProfileId} />;
  }

  if (!user) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  const PlaceholderView = ({ title }) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-600">
      <div className="bg-zinc-900 p-6 rounded-full mb-4">
        <Settings className="w-10 h-10 text-zinc-700" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-500 uppercase tracking-widest">
        {title}
      </h2>
      <p className="text-sm mt-2">En construcción...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-yellow-400 selection:text-black">
      <div className="hidden md:block">
        <Sidebar activeView={activeView} navigateTo={navigateTo} />
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden flex flex-col animate-in fade-in slide-in-from-left-10 backdrop-blur-sm">
          <div className="p-4 flex justify-between items-center border-b border-zinc-800">
            <h2 className="text-white font-bold text-xl">Menú</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-zinc-400 hover:text-white p-2"
            >
              <X size={24} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={() => navigateTo('dashboard')}
              className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900"
            >
              Panel General
            </button>
            <button
              onClick={() => navigateTo('clients')}
              className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900"
            >
              Clientes
            </button>
            <button
              onClick={() => navigateTo('exercises')}
              className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900"
            >
              Ejercicios
            </button>
            <button
              onClick={() => navigateTo('calendar')}
              className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900"
            >
              Agenda
            </button>
            <button
              onClick={() => navigateTo('settings')}
              className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900"
            >
              Configuración
            </button>
            <button
              onClick={handleLogout}
              className="p-4 text-left text-red-400 hover:text-red-300 font-bold flex items-center gap-2 mt-4"
            >
              <LogOut size={20} /> Salir
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
        <header className="md:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 p-1 rounded">
              <Dumbbell className="w-4 h-4 text-black" />
            </div>
            {/* CAMBIO DE MARCA EN MÓVIL */}
            <span className="font-black tracking-tighter text-lg italic">
              <span className="text-yellow-400">RAGNAR</span>
              <span className="text-white">-TRAINING</span>
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-zinc-400"
          >
            <Menu size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeView === 'dashboard' && (
            <DashboardView
              clients={clients}
              navigateTo={navigateTo}
              onAddClient={handleAddClient}
            />
          )}
          {activeView === 'clients' && (
            <ClientsView clients={clients} navigateTo={navigateTo} />
          )}
          {activeView === 'exercises' && (
            <ExercisesView
              exercises={exercises}
              onAddExercise={handleAddExercise}
              onDeleteExercise={handleDeleteExercise}
            />
          )}
          {activeView === 'client-detail' && selectedClient && (
            <ClientDetailView
              client={selectedClient}
              goBack={() => navigateTo('clients')}
              onAddExercise={updateClientRoutine}
              exercisesLibrary={exercises}
            />
          )}
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'settings' && (
            <PlaceholderView title="Configuración" />
          )}
        </div>
      </main>

      <button
        onClick={handleLogout}
        className="hidden md:flex fixed bottom-6 left-6 w-52 items-center gap-3 text-zinc-500 hover:text-red-400 transition-colors p-2 rounded z-10"
      >
        <LogOut size={20} />{' '}
        <span className="font-medium text-sm">Cerrar Sesión</span>
      </button>
    </div>
  );
}
