import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../img/logo.png';

const Header = ({ onMenuClick }) => {
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10 overflow-hidden">
      {/* Mobile/Tablet: chỉ hamburger + logo nhỏ */}
      <div className="lg:hidden max-w-7xl mx-auto w-full flex items-center gap-2 px-3 py-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          aria-label="Mở menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <img src={logo} alt="SolarEV" className="h-8 w-auto object-contain shrink-0" />
        <span className="text-sm font-semibold text-slate-900 truncate">SolarEV Platform</span>
      </div>

      {/* Desktop: header đầy đủ */}
      <div className="hidden lg:block">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <img
                src={logo}
                alt="SolarEV Logo"
                className="h-8 sm:h-10 w-auto object-contain shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-semibold text-slate-900 truncate">SolarEV Platform</h1>
                <p className="text-xs sm:text-sm text-slate-500 hidden sm:block truncate">Hệ thống quản lý trạm sạc OCPP</p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
                <div className="text-right min-w-0 hidden sm:block max-w-[120px] md:max-w-[180px]">
                  <p className="text-sm font-medium text-slate-900 truncate" title={user.fullName || user.username}>{user.fullName || user.username}</p>
                  <p className="text-xs text-slate-500 truncate" title={user.email || user.username || 'N/A'}>{user.email || user.username || 'N/A'}</p>
                </div>
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors shrink-0"
                  onClick={handleLogout}
                  title="Đăng xuất"
                >
                  <span className="text-blue-600 font-semibold text-sm sm:text-base">{getInitials(user.fullName || user.username)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
