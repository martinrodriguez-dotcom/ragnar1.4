import React from 'react';
import { Dumbbell, BarChart3, Users, Calendar, Settings, LogOut, List, Layout, Bell } from 'lucide-react';

export function Sidebar({ activeView, navigateTo, notificationCount = 0 }) {
  
  const SidebarItem = ({ icon, label, view, badge }) => (
    <button 
      onClick={() => navigateTo(view)}
      className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 relative ${
        activeView === view 
          ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.2)] font-bold' 
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="tracking-wide">{label}</span>
      {badge > 0 && (
        <span className="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-r border-zinc-800 h-screen">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
        <div className="bg-yellow-400 p-2 rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.3)]">
          <Dumbbell className="w-6 h-6 text-black" />
        </div>
        <h1 className="text-lg font-black tracking-tighter italic">
          <span className="text-yellow-400">RAGNAR</span>
          <span className="text-white">-TRAINING</span>
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <SidebarItem icon={<BarChart3 />} label="Panel General" view="dashboard" />
        <SidebarItem icon={<Bell />} label="Notificaciones" view="notifications" badge={notificationCount} />
        <SidebarItem icon={<Users />} label="Clientes" view="clients" />
        <SidebarItem icon={<List />} label="Ejercicios" view="exercises" />
        {/* AQUÍ ESTÁ EL BOTÓN DE RUTINAS */}
        <SidebarItem icon={<Layout />} label="Rutinas" view="routines" />
        <SidebarItem icon={<Calendar />} label="Agenda" view="calendar" />
        <SidebarItem icon={<Settings />} label="Configuración" view="settings" />
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <button className="flex items-center gap-3 text-zinc-500 hover:text-yellow-400 w-full p-2 rounded transition-colors">
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
