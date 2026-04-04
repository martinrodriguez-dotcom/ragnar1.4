import React, { useState, useEffect } from 'react';
import { Menu, Dumbbell, Settings, BarChart3, Users, Calendar, X, LogOut, List, Layout, Bell } from 'lucide-react';

// --- Firebase ---
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs } from 'firebase/firestore';
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

export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Rol del usuario: 'trainer' | 'student' | null
  const [userRole, setUserRole] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null); // ID del documento del cliente vinculado

  // Estado de Invitación (Link Mágico)
  const [inviteId, setInviteId] = useState(null);

  // Estados de navegación y datos (Entrenador)
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const auth = getAuth();

  // --- EFECTO 1: Detectar Usuario y Parámetros de URL ---
  useEffect(() => {
    // 1. Chequear si hay link de invitación (?invite=XYZ)
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setInviteId(inviteParam);
    }

    // 2. Escuchar Auth de Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Usuario logueado: ¿Es Alumno o Entrenador?
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
    // Buscamos en la colección 'clients' si hay alguien con este studentUserId
    const q = query(collection(db, 'clients'), where('studentUserId', '==', uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // ¡Es un alumno!
      const clientDoc = querySnapshot.docs[0];
      setUserRole('student');
      setStudentProfileId(clientDoc.id);
    } else {
      // Si no está vinculado a ningún cliente, asumimos que es Entrenador
      setUserRole('trainer');
    }
  };

  // --- EFECTO 2: Cargar Datos (Solo si es Entrenador) ---
  useEffect(() => {
    if (!user || userRole !== 'trainer') return;

    // A. Escuchar CLIENTES
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
    });

    // B. Escuchar EJERCICIOS (Ordenados alfabéticamente)
    const qExercises = query(collection(db, 'exercises'), orderBy('name'));
    const unsubExercises = onSnapshot(qExercises, (snapshot) => {
      const exData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExercises(exData);
    });

    // C. Escuchar NOTIFICACIONES no leídas
    const qNotif = query(collection(db, 'trainerNotifications'), where('read', '==', false));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    // Limpieza al desmontar
    return () => {
      unsubClients();
      unsubExercises();
      unsubNotif();
    };
  }, [user, userRole]);

  // --- FUNCIONES DEL SISTEMA ---

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Limpiar parámetros de URL para evitar bucles
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    } catch (error) { console.error(error); }
  };

  const navigateTo = (view, client = null) => {
    setActiveView(view);
    if (client) setSelectedClient(client);
    setIsMobileMenuOpen(false);
  };

  // --- FUNCIONES DE GESTIÓN DE CLIENTES (CRUD) ---

  const handleAddClient = async (data) => {
    const { id, ...rest } = data;
    await addDoc(collection(db, 'clients'), { ...rest, createdAt: new Date(), trainerId: user.uid });
  };

  // Función para actualizar datos del cliente
  const handleUpdateClientData = async (updatedData) => {
    try {
      const clientRef = doc(db, 'clients', updatedData.id);
      await updateDoc(clientRef, updatedData);
    } catch (error) {
      console.error("Error al actualizar cliente:", error);
      alert("Error al actualizar.");
    }
  };

  // Función para eliminar cliente
  const handleDeleteClient = async (clientId) => {
    try {
        await deleteDoc(doc(db, 'clients', clientId));
    } catch (error) {
        console.error("Error al eliminar cliente:", error);
        alert("Error al eliminar.");
    }
  };

  // --- FUNCIONES DE RUTINAS Y EJERCICIOS ---

  const updateClientRoutine = async (clientId, newEx) => {
    const clientRef = doc(db, 'clients', clientId);
    const current = clients.find(c => c.id === clientId);
    const updated = [...(current.routine || []), newEx];
    await updateDoc(clientRef, { routine: updated });
    if (selectedClient?.id === clientId) setSelectedClient(prev => ({ ...prev, routine: updated }));
  };

  const handleAddExercise = async (data) => { 
    // Guardamos nombre y videoUrl si existe
    await addDoc(collection(db, 'exercises'), { name: data.name, videoUrl: data.videoUrl || '' }); 
  };

  // NUEVO: Función para actualizar ejercicio
  const handleUpdateExercise = async (updatedData) => {
    try {
      const exRef = doc(db, 'exercises', updatedData.id);
      // Actualizamos solo los campos necesarios, quitando el ID que ya viene en la ruta
      const { id, ...rest } = updatedData;
      await updateDoc(exRef, rest);
    } catch (error) {
      console.error("Error al actualizar ejercicio:", error);
      alert("Error al actualizar el ejercicio.");
    }
  };
  
  const handleDeleteExercise = async (id) => { 
    if(confirm('¿Estás seguro de eliminar este ejercicio de la biblioteca?')) {
      await deleteDoc(doc(db, 'exercises', id)); 
    }
  };

  // --- RENDERIZADO ---

  // 1. Cargando
  if (loadingAuth) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  // 2. CASO INVITACIÓN (Usuario llega con link y no está logueado o no coincide)
  if (inviteId && (!user || (user && userRole !== 'student'))) {
    return <StudentRegistration inviteId={inviteId} onRegisterSuccess={() => {
      // Limpiamos la URL para que quede limpia
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    }} />;
  }

  // 3. CASO ALUMNO LOGUEADO
  if (user && userRole === 'student' && studentProfileId) {
    return <StudentView clientId={studentProfileId} />;
  }

  // 4. CASO NO LOGUEADO (Login General)
  if (!user) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // 5. CASO ENTRENADOR (Panel Completo)
  
  const PlaceholderView = ({ title }) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-600">
      <div className="bg-zinc-900 p-6 rounded-full mb-4">
        <Settings className="w-10 h-10 text-zinc-700" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-500 uppercase tracking-widest">{title}</h2>
      <p className="text-sm mt-2">En construcción...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-yellow-400 selection:text-black">
      
      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} navigateTo={navigateTo} notificationCount={unreadCount} />
      </div>
      
      {/* Menú Móvil (Overlay) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden flex flex-col animate-in fade-in slide-in-from-left-10 backdrop-blur-sm">
          <div className="p-4 flex justify-between items-center border-b border-zinc-800">
            <h2 className="text-white font-bold text-xl">Menú</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-2">
              <X size={24} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <button onClick={() => navigateTo('dashboard')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Panel General</button>
            <button onClick={() => navigateTo('notifications')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex justify-between">
               Notificaciones {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
            <button onClick={() => navigateTo('clients')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Clientes</button>
            <button onClick={() => navigateTo('exercises')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Ejercicios</button>
            <button onClick={() => navigateTo('routines')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Rutinas</button>
            <button onClick={() => navigateTo('calendar')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Agenda</button>
            <button onClick={() => navigateTo('settings')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900">Configuración</button>
            
            <button 
              onClick={handleLogout} 
              className="p-4 text-left text-red-400 hover:text-red-300 font-bold flex items-center gap-2 mt-4"
            >
              <LogOut size={20} /> Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* Área de Contenido Principal */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
        
        {/* Header Móvil */}
        <header className="md:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
             <div className="bg-yellow-400 p-1 rounded">
               <Dumbbell className="w-4 h-4 text-black" /> 
             </div>
             {/* MARCA EN MÓVIL */}
             <span className="font-black tracking-tighter text-lg italic">
               <span className="text-yellow-400">RAGNAR</span>
               <span className="text-white">-TRAINING</span>
             </span>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => navigateTo('notifications')} className="relative p-2 text-zinc-400">
               <Bell size={24}/>
               {unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black"></span>}
             </button>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-400">
               <Menu size={24} />
             </button>
          </div>
        </header>

        {/* Contenedor de Vistas con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* 1. VISTA DASHBOARD */}
          {activeView === 'dashboard' && (
            <DashboardView 
              clients={clients} 
              navigateTo={navigateTo} 
              onAddClient={handleAddClient} 
            />
          )}
          
          {/* 2. VISTA NOTIFICACIONES */}
          {activeView === 'notifications' && <NotificationsView />}

          {/* 3. VISTA CLIENTES */}
          {activeView === 'clients' && (
            <ClientsView 
              clients={clients} 
              navigateTo={navigateTo} 
              onUpdateClient={handleUpdateClientData}
              onDeleteClient={handleDeleteClient}
            />
          )}

          {/* 4. VISTA EJERCICIOS (NUEVO PROPS AÑADIDO AQUI) */}
          {activeView === 'exercises' && (
            <ExercisesView 
              exercises={exercises} 
              onAddExercise={handleAddExercise}
              onUpdateExercise={handleUpdateExercise}
              onDeleteExercise={handleDeleteExercise}
            />
          )}

          {/* 5. VISTA RUTINAS (PLANTILLAS) */}
          {activeView === 'routines' && (
            <RoutinesView 
              exercisesLibrary={exercises} 
            />
          )}
          
          {/* 6. VISTA DETALLE CLIENTE */}
          {activeView === 'client-detail' && selectedClient && (
            <ClientDetailView 
              client={selectedClient} 
              goBack={() => navigateTo('clients')} 
              onAddExercise={updateClientRoutine}
              exercisesLibrary={exercises}
            />
          )}
          
          {/* 7. VISTA AGENDA */}
          {activeView === 'calendar' && <CalendarView />}
          
          {/* 8. VISTA CONFIGURACIÓN */}
          {activeView === 'settings' && <PlaceholderView title="Configuración" />}

        </div>
      </main>

      {/* Botón Flotante de Cerrar Sesión (Escritorio) */}
      <button 
        onClick={handleLogout}
        className="hidden md:flex fixed bottom-6 left-6 w-52 items-center gap-3 text-zinc-500 hover:text-red-400 transition-colors p-2 rounded z-10"
      >
        <LogOut size={20} />
        <span className="font-medium text-sm">Cerrar Sesión</span>
      </button>

    </div>
  );
}
