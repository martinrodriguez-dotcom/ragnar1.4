import React from 'react';
import {
  Dumbbell,
  BarChart3,
  Users,
  Calendar,
  Settings,
  LogOut,
  List,
} from 'lucide-react';

export function Sidebar({ activeView, navigateTo }) {
  const SidebarItem = ({ icon, label, view }) => (
    <button
      onClick={() => navigateTo(view)}
      className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 ${
        activeView === view
          ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.2)] font-bold'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="tracking-wide">{label}</span>
    </button>
  );

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-r border-zinc-800 h-screen">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
        <div className="bg-yellow-400 p-2 rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.3)]">
          <Dumbbell className="w-6 h-6 text-black" />
        </div>
        {/* CAMBIO DE MARCA: RAGNAR AMARILLO - TRAINING BLANCO */}
        <h1 className="text-lg font-black tracking-tighter italic">
          <span className="text-yellow-400">RAGNAR</span>
          <span className="text-white">-TRAINING</span>
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <SidebarItem
          icon={<BarChart3 />}
          label="Panel General"
          view="dashboard"
        />
        <SidebarItem icon={<Users />} label="Clientes" view="clients" />
        <SidebarItem icon={<List />} label="Ejercicios" view="exercises" />
        <SidebarItem icon={<Calendar />} label="Agenda" view="calendar" />
        <SidebarItem
          icon={<Settings />}
          label="Configuración"
          view="settings"
        />
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
