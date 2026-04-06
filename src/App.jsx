import React, { useState, useEffect } from 'react';
import { 
  Menu, Dumbbell, Settings, BarChart3, Users, Calendar, 
  X, LogOut, List, Layout, Bell, DollarSign, ShieldCheck 
} from 'lucide-react';

// --- Firebase ---
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase'; 

// --- Componentes y Vistas ---
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
import PaymentsView from './views/PaymentsView';
import CommunityView from './views/CommunityView';

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
  const [unreadCount, setUnreadCount] = useState(0);

  const auth = getAuth();

  // --- ESCÁNER AUTOMÁTICO DE COBROS ---
  const checkPaymentsStatus = async (clientsData) => {
    const today = new Date();
    const currentMonthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    for (const client of clientsData) {
      if (!client.startDate) continue;

      const start = new Date(client.startDate);
      const day = start.getDate();
      const expirationDate = new Date(today.getFullYear(), today.getMonth(), day);
      const diffTime = expirationDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const paymentRef = doc(db, 'clients', client.id, 'payments', currentMonthId);
      const paymentSnap = await getDoc(paymentRef);
      const hasPaid = paymentSnap.exists() && paymentSnap.data().status === 'paid';

      if (!hasPaid) {
        let type = null;
        let message = "";

        if (diffDays <= 0) {
          type = 'payment_expired';
          message = `CUOTA VENCIDA: ${client.name} ya debería haber pagado su cuota del mes.`;
        } else if (diffDays <= 10) {
          type = 'payment_warning';
          message = `PRÓXIMO VENCIMIENTO: A ${client.name} le quedan ${diffDays} días para el pago de su cuota.`;
        }

        if (type) {
          const notifId = `notif_pay_${client.id}_${currentMonthId}`;
          const notifRef = doc(db, 'trainerNotifications', notifId);
          const notifSnap = await getDoc(notifRef);

          if (!notifSnap.exists() || notifSnap.data().type !== type) {
            await setDoc(notifRef, {
              id: notifId,
              type: type,
              clientId: client.id,
              clientName: client.name,
              message: message,
              read: false,
              createdAt: new Date(),
              monthId: currentMonthId
            });
          }
        }
      }
    }
  };

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

  const checkUserRole = async (uid) => {
    const q = query(collection(db, 'clients'), where('studentUserId', '==', uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const clientDoc = querySnapshot.docs[0];
      setUserRole('student');
      setStudentProfileId(clientDoc.id);
    } else {
      setUserRole('trainer');
    }
  };

  // --- EFECTO 2: Cargar Datos (Solo Entrenador) ---
  useEffect(() => {
    if (!user || userRole !== 'trainer') return;

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
      checkPaymentsStatus(clientsData);
    });

    const qExercises = query(collection(db, 'exercises'), orderBy('name'));
    const unsubExercises = onSnapshot(qExercises, (snapshot) => {
      const exData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExercises(exData);
    });

    const qNotif = query(collection(db, 'trainerNotifications'), where('read', '==', false));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

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
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    } catch (error) { console.error(error); }
  };

  const navigateTo = (view, client = null) => {
    setActiveView(view);
    if (client) setSelectedClient(client);
    setIsMobileMenuOpen(false);
  };

  // --- FUNCIONES DE GESTIÓN DE CLIENTES ---
  const handleAddClient = async (data) => {
    const { id, ...rest } = data;
    await addDoc(collection(db, 'clients'), { ...rest, createdAt: new Date(), trainerId: user.uid });
  };

  const handleUpdateClientData = async (updatedData) => {
    try {
      const clientRef = doc(db, 'clients', updatedData.id);
      await updateDoc(clientRef, updatedData);
    } catch (error) {
      console.error(error);
      alert("Error al actualizar.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    if(window.confirm('¿Estás seguro de eliminar este cliente y todos sus registros?')) {
      try {
          await deleteDoc(doc(db, 'clients', clientId));
      } catch (error) {
          console.error(error);
          alert("Error al eliminar.");
      }
    }
  };

  // --- FUNCIONES DE RUTINAS Y EJERCICIOS ---
  const handleAddExercise = async (data) => { 
    await addDoc(collection(db, 'exercises'), { name: data.name, videoUrl: data.videoUrl || '' }); 
  };

  const handleUpdateExercise = async (updatedData) => {
    try {
      const exRef = doc(db, 'exercises', updatedData.id);
      const { id, ...rest } = updatedData;
      await updateDoc(exRef, rest);
    } catch (error) {
      console.error(error);
      alert("Error al actualizar el ejercicio.");
    }
  };
  
  const handleDeleteExercise = async (id) => { 
    if(window.confirm('¿Estás seguro de eliminar este ejercicio de la biblioteca?')) {
      await deleteDoc(doc(db, 'exercises', id)); 
    }
  };

  // --- RENDERIZADO ---

  if (loadingAuth) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  if (inviteId && (!user || (user && userRole !== 'student'))) {
    return <StudentRegistration inviteId={inviteId} onRegisterSuccess={() => {
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    }} />;
  }

  if (user && userRole === 'student' && studentProfileId) {
    return <StudentView clientId={studentProfileId} />;
  }

  if (!user) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // --- INTERFAZ DEL ENTRENADOR ---
  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-yellow-400 selection:text-black">
      
      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} navigateTo={navigateTo} notificationCount={unreadCount} />
      </div>
      
      {/* Menú Móvil */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden flex flex-col animate-in fade-in slide-in-from-left-10 backdrop-blur-sm">
          <div className="p-4 flex justify-between items-center border-b border-zinc-800">
            <h2 className="text-white font-bold text-xl uppercase tracking-tighter">Menú</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-2">
              <X size={24} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2 overflow-y-auto">
            <button onClick={() => navigateTo('dashboard')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><BarChart3 size={20}/> Panel Principal</button>
            <button onClick={() => navigateTo('community')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><ShieldCheck size={20}/> El Gran Salón</button>
            <button onClick={() => navigateTo('notifications')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex justify-between items-center">
               <div className="flex items-center gap-3"><Bell size={20}/> Notificaciones</div>
               {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
            <button onClick={() => navigateTo('clients')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><Users size={20}/> Clientes</button>
            <button onClick={() => navigateTo('payments')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><DollarSign size={20}/> Cobros</button>
            <button onClick={() => navigateTo('exercises')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><List size={20}/> Ejercicios</button>
            <button onClick={() => navigateTo('routines')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><Layout size={20}/> Rutinas</button>
            <button onClick={() => navigateTo('calendar')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><Calendar size={20}/> Agenda</button>
            <button onClick={() => navigateTo('settings')} className="p-4 text-left text-zinc-400 hover:text-white border-b border-zinc-900 flex items-center gap-3"><Settings size={20}/> Configuración</button>
            
            <button onClick={handleLogout} className="p-4 text-left text-red-400 hover:text-red-300 font-bold flex items-center gap-3 mt-4">
              <LogOut size={20} /> Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
        
        <header className="md:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800 shadow-xl">
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="Ragnar Training Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]" onError={(e) => { e.target.style.display = 'none'; }}/>
             <span className="font-black tracking-tighter text-lg italic"><span className="text-yellow-400">RAGNAR</span><span className="text-white">-TRAINING</span></span>
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

        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
          {activeView === 'dashboard' && <DashboardView clients={clients} navigateTo={navigateTo} onAddClient={handleAddClient} />}
          {activeView === 'community' && <CommunityView currentUserId={user?.uid} userName="Coach Ragnar" />}
          {activeView === 'notifications' && <NotificationsView />}
          {activeView === 'clients' && <ClientsView clients={clients} navigateTo={navigateTo} onUpdateClient={handleUpdateClientData} onDeleteClient={handleDeleteClient} />}
          {activeView === 'payments' && <PaymentsView />}
          {activeView === 'exercises' && <ExercisesView exercises={exercises} onAddExercise={handleAddExercise} onUpdateExercise={handleUpdateExercise} onDeleteExercise={handleDeleteExercise} />}
          {activeView === 'routines' && <RoutinesView exercisesLibrary={exercises} />}
          {activeView === 'client-detail' && selectedClient && <ClientDetailView client={selectedClient} goBack={() => navigateTo('clients')} exercisesLibrary={exercises} />}
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
      </main>

      <button onClick={handleLogout} className="hidden md:flex fixed bottom-6 left-6 w-52 items-center gap-3 text-zinc-500 hover:text-red-400 transition-colors p-2 rounded z-10">
        <LogOut size={20} />
        <span className="font-medium text-sm">Cerrar Sesión</span>
      </button>

    </div>
  );
}
