import React, { useState, useEffect } from 'react';
import { Menu, Dumbbell, Settings, BarChart3, Users, Calendar, X, LogOut, List, Layout, Bell, MessageSquare, CreditCard } from 'lucide-react';

// --- Firebase ---
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase'; 

// --- Componentes ---
import { Sidebar } from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import ClientDetailView from './views/ClientDetailView';
import ExercisesView from './views/ExercisesView';
import RoutinesView from './views/RoutinesView';
import CalendarView from './views/CalendarView';
import LoginView from './views/LoginView';
import StudentView from './views/StudentView';
import StudentRegistration from './views/StudentRegistration';
import NotificationsView from './views/NotificationsView';
import SettingsView from './views/SettingsView';
import CommunityView from './views/CommunityView'; 
import PaymentsView from './views/PaymentsView'; 

export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Rol del usuario: 'trainer' | 'student' | null
  const [userRole, setUserRole] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null); 

  // Estado de Invitación (Link Mágico para nuevos alumnos)
  const [inviteId, setInviteId] = useState(null);

  // Estados de navegación y datos (Modo Entrenador)
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [routines, setRoutines] = useState([]); 
  const [settings, setSettings] = useState(null); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const auth = getAuth();

  // --- EFECTO 1: Gestión de Sesión y Parámetros de URL ---
  useEffect(() => {
    // 1. Detectar si el usuario viene por un link de invitación
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) setInviteId(inviteParam);

    // 2. Escuchar cambios en la autenticación
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

  // Función para determinar si el UID pertenece a un alumno o al entrenador
  const checkUserRole = async (uid) => {
    try {
      const q = query(collection(db, 'clients'), where('studentUserId', '==', uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const clientDoc = querySnapshot.docs[0];
        setUserRole('student');
        setStudentProfileId(clientDoc.id);
      } else {
        setUserRole('trainer');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- EFECTO 2: Sincronización de Datos en Tiempo Real (Solo Trainer) ---
  useEffect(() => {
    if (!user || userRole !== 'trainer') return;

    // Escuchar Clientes
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Biblioteca de Ejercicios
    const qExercises = query(collection(db, 'exercises'), orderBy('name'));
    const unsubExercises = onSnapshot(qExercises, (snapshot) => {
      setExercises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Rutinas
    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Configuración General
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    // Escuchar Notificaciones no leídas
    const qNotif = query(collection(db, 'trainerNotifications'), where('read', '==', false));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => {
      unsubClients();
      unsubExercises();
      unsubRoutines();
      unsubSettings();
      unsubNotif();
    };
  }, [user, userRole]);

  // --- FUNCIONES DE NAVEGACIÓN Y AUTH ---

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Limpiar URL para evitar re-entradas accidentales a registro
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    } catch (error) { console.error("Error logout:", error); }
  };

  const navigateTo = (view, client = null) => {
    setActiveView(view);
    if (client) setSelectedClient(client);
    setIsMobileMenuOpen(false);
  };

  // --- FUNCIONES DE GESTIÓN (CRUD) ---

  const handleAddClient = async (data) => {
    try {
      await addDoc(collection(db, 'clients'), { 
        ...data, 
        createdAt: new Date(), 
        active: true,
        trainerId: user.uid 
      });
    } catch (error) { console.error(error); }
  };

  const handleUpdateClientData = async (updatedData) => {
    try {
      const { id, ...rest } = updatedData;
      await updateDoc(doc(db, 'clients', id), rest);
    } catch (error) { console.error(error); }
  };

  const handleDeleteClient = async (clientId) => {
    if(window.confirm('¿Estás seguro de eliminar este cliente y todos sus registros?')) {
      try {
        await deleteDoc(doc(db, 'clients', clientId));
        if (selectedClient?.id === clientId) {
          setCurrentView('clients');
          setSelectedClient(null);
        }
      } catch (error) { console.error(error); }
    }
  };

  const updateClientRoutine = async (clientId, newEx) => {
    try {
      const clientRef = doc(db, 'clients', clientId);
      const current = clients.find(c => c.id === clientId);
      const updated = [...(current.routine || []), newEx];
      await updateDoc(clientRef, { routine: updated });
      if (selectedClient?.id === clientId) setSelectedClient(prev => ({ ...prev, routine: updated }));
    } catch (error) { console.error(error); }
  };

  const handleAddExercise = async (data) => { 
    try { 
      await addDoc(collection(db, 'exercises'), { 
        name: data.name, 
        videoUrl: data.videoUrl || '' 
      }); 
    } catch (error) { console.error(error); }
  };

  const handleUpdateExercise = async (updatedData) => {
    try { 
      const { id, ...rest } = updatedData; 
      await updateDoc(doc(db, 'exercises', id), rest); 
    } catch (error) { console.error(error); }
  };
  
  const handleDeleteExercise = async (id) => { 
    if(window.confirm('¿Eliminar este ejercicio de la biblioteca global?')) {
      try { await deleteDoc(doc(db, 'exercises', id)); } catch (error) { console.error(error); }
    }
  };

  const handleAddRoutine = async (data) => {
    try { await addDoc(collection(db, 'routines'), data); } catch (error) { console.error(error); }
  };

  const handleUpdateRoutine = async (data) => {
    try { const { id, ...rest } = data; await updateDoc(doc(db, 'routines', id), rest); } catch (error) { console.error(error); }
  };

  const handleDeleteRoutine = async (id) => {
    if(window.confirm('¿Eliminar esta rutina?')) {
      try { await deleteDoc(doc(db, 'routines', id)); } catch (error) { console.error(error); }
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try { await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true }); } catch (error) { console.error(error); }
  };


  // --- LÓGICA DE RENDERIZADO ---

  // 1. Pantalla de Carga Inicial
  if (loadingAuth) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  // 2. Registro de Alumno (Link de invitación activo)
  if (inviteId && (!user || (user && userRole !== 'student'))) {
    return (
      <StudentRegistration 
        inviteId={inviteId} 
        onRegisterSuccess={() => {
          window.history.pushState({}, document.title, window.location.pathname);
          setInviteId(null);
        }} 
      />
    );
  }

  // 3. Vista del Alumno
  if (user && userRole === 'student' && studentProfileId) {
    return <StudentView clientId={studentProfileId} />;
  }

  // 4. Pantalla de Login (Si no hay usuario)
  if (!user) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // 5. Interfaz del Entrenador (Layout Principal)
  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      
      {/* Sidebar para Escritorio (Tu archivo Sidebar.jsx intacto) */}
      <div className="hidden md:block">
        <Sidebar 
          activeView={activeView} 
          navigateTo={navigateTo} 
          notificationCount={unreadCount} 
        />
      </div>
      
      {/* Menú Móvil Desplegable (AHORA CON SCROLL MEJORADO Y NOMBRES SINCRONIZADOS) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden flex flex-col animate-in fade-in backdrop-blur-sm">
          
          <div className="p-4 flex justify-between items-center border-b border-zinc-800 shrink-0">
            <h2 className="text-white font-bold text-xl uppercase tracking-tighter">Menú</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 p-2"><X size={24} /></button>
          </div>
          
          <div className="p-4 flex flex-col gap-1 overflow-y-auto flex-1 custom-scrollbar">
            <button onClick={() => navigateTo('dashboard')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><BarChart3 size={20}/> Dashboard</button>
            <button onClick={() => navigateTo('notifications')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex justify-between items-center transition-colors">
               <span className="flex items-center gap-3"><Bell size={20}/> Notificaciones</span>
               {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
            <button onClick={() => navigateTo('clients')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><Users size={20}/> Mis Atletas</button>
            <button onClick={() => navigateTo('exercises')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><List size={20}/> Ejercicios</button>
            <button onClick={() => navigateTo('routines')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><Layout size={20}/> Rutinas</button>
            <button onClick={() => navigateTo('calendar')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><Calendar size={20}/> Agenda</button>
            <button onClick={() => navigateTo('community')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><MessageSquare size={20}/> Comunidad</button>
            <button onClick={() => navigateTo('payments')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><CreditCard size={20}/> Pagos</button>
            <button onClick={() => navigateTo('settings')} className="p-4 text-left text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl flex items-center gap-3 transition-colors"><Settings size={20}/> Configuración</button>

            {/* BOTÓN CERRAR SESIÓN EMPUJADO AL FONDO */}
            <div className="mt-auto pt-6 pb-4 shrink-0">
              <div className="h-px bg-zinc-800 mb-4"></div>
              <button onClick={handleLogout} className="w-full p-4 text-left text-red-500 hover:bg-red-500/10 rounded-xl font-bold flex items-center gap-3 transition-colors">
                <LogOut size={20} /> Cerrar Sesión
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Área de Contenido Principal */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
        
        {/* Header para Móviles */}
        <header className="md:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800 shadow-xl">
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" onError={(e) => e.target.style.display = 'none'}/>
             <span className="font-black italic text-lg tracking-tighter">
                <span className="text-yellow-400">RAGNAR</span><span className="text-white">-TRAINING</span>
             </span>
          </div>
          <div className="flex items-center gap-1">
             <button onClick={() => navigateTo('notifications')} className="relative p-2 text-zinc-400">
               <Bell size={24}/>
               {unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black"></span>}
             </button>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-400"><Menu size={24} /></button>
          </div>
        </header>

        {/* Inyección de Vistas Dinámicas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
          {activeView === 'dashboard' && (
            <DashboardView clients={clients} navigateTo={navigateTo} onAddClient={handleAddClient} />
          )}
          
          {activeView === 'notifications' && (
            <NotificationsView navigateTo={navigateTo} clients={clients} />
          )}

          {activeView === 'clients' && (
            <ClientsView 
              clients={clients} 
              settings={settings}
              routines={routines}
              navigateTo={navigateTo} 
              onAddClient={handleAddClient} 
              onUpdateClient={handleUpdateClientData} 
              onDeleteClient={handleDeleteClient}
            />
          )}

          {activeView === 'exercises' && (
            <ExercisesView 
              exercises={exercises} 
              exercisesLibrary={exercises}
              onAddExercise={handleAddExercise} 
              onUpdateExercise={handleUpdateExercise} 
              onDeleteExercise={handleDeleteExercise}
            />
          )}

          {activeView === 'routines' && (
            <RoutinesView 
              routines={routines}
              exercisesLibrary={exercises}
              onAddRoutine={handleAddRoutine}
              onUpdateRoutine={handleUpdateRoutine}
              onDeleteRoutine={handleDeleteRoutine}
            />
          )}

          {activeView === 'client-detail' && selectedClient && (
            <ClientDetailView 
              client={selectedClient} 
              goBack={() => navigateTo('clients')} 
              exercisesLibrary={exercises}
              routines={routines}
              onUpdateClient={handleUpdateClientData}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView clients={clients} />
          )}

          {activeView === 'settings' && (
            <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />
          )}

          {activeView === 'community' && (
            <CommunityView isCoach={true} coachName="Coach Ragnar" />
          )}

          {activeView === 'payments' && (
            <PaymentsView clients={clients} onUpdateClient={handleUpdateClientData} />
          )}
        </div>
      </main>

      {/* Botón Flotante de Logout para Desktop */}
      <button 
        onClick={handleLogout} 
        className="hidden md:flex fixed bottom-6 left-6 w-52 items-center gap-3 text-zinc-500 hover:text-red-400 transition-all p-2 z-10 font-bold text-xs uppercase tracking-widest"
      >
        <LogOut size={18} /> Cerrar Sesión
      </button>

    </div>
  );
}
