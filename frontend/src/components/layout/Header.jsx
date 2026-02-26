import React from 'react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../img/logo.png';

const Header = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Lấy chữ cái đầu của tên
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="SolarEV Logo"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">SolarEV Platform</h1>
              <p className="text-sm text-slate-500">Hệ thống quản lý trạm sạc OCPP</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user.fullName || user.username}</p>
                <p className="text-xs text-slate-500">{user.email || user.username || 'N/A'}</p>
              </div>
              <div 
                className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors" 
                onClick={handleLogout}
                title="Đăng xuất"
              >
                <span className="text-blue-600 font-semibold">{getInitials(user.fullName || user.username)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
