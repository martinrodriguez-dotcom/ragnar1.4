import React from 'react';
import { User, Mail, Shield, Bell, Smartphone, LogOut } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function SettingsView() {
  const auth = getAuth();
  const user = auth.currentUser;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white uppercase">
          Configuración
        </h2>
        <p className="text-zinc-500 text-sm">
          Gestiona tu perfil y preferencias de la cuenta.
        </p>
      </div>

      {/* Tarjeta de Perfil */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-6">
        <div className="bg-zinc-800/50 p-6 border-b border-zinc-800 flex items-center gap-4">
          <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-black text-2xl font-bold">
            {user?.email?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{user?.email}</h3>
            <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded border border-yellow-400/20">
              Plan Entrenador Pro
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                Correo Electrónico
              </label>
              <div className="flex items-center gap-3 bg-black p-3 rounded-lg border border-zinc-800 text-zinc-400">
                <Mail size={18} />
                <span>{user?.email}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                ID de Usuario
              </label>
              <div className="flex items-center gap-3 bg-black p-3 rounded-lg border border-zinc-800 text-zinc-400">
                <User size={18} />
                <span className="truncate">{user?.uid}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preferencias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-400/50 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-yellow-400 group-hover:text-black transition-colors">
              <Bell size={20} />
            </div>
            <h4 className="font-bold text-white">Notificaciones</h4>
          </div>
          <p className="text-sm text-zinc-500">
            Configura alertas de check-in de alumnos.
          </p>
        </div>

        <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-400/50 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-yellow-400 group-hover:text-black transition-colors">
              <Shield size={20} />
            </div>
            <h4 className="font-bold text-white">Seguridad</h4>
          </div>
          <p className="text-sm text-zinc-500">
            Cambiar contraseña y autenticación.
          </p>
        </div>
      </div>

      {/* Info de la App */}
      <div className="text-center pt-8 border-t border-zinc-900">
        <p className="text-zinc-600 text-xs">EntrenaPro v1.0.0</p>
        <p className="text-zinc-700 text-[10px] mt-1">
          Desarrollado con React + Firebase
        </p>
      </div>
    </div>
  );
}
