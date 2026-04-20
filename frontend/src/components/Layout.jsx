import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sprout, Activity, History, LineChart, MessageCircle, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import '../index.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { name: 'Analyze', path: '/app/analyze', icon: <Activity size={20} />, emoji: '🔬' },
    { name: 'Results', path: '/app/results', icon: <Sprout size={20} />, emoji: '🌱' },
    { name: 'Insights', path: '/app/insights', icon: <LineChart size={20} />, emoji: '📊' },
    { name: 'History', path: '/app/history', icon: <History size={20} />, emoji: '📋' },
    { name: 'SMS', path: '/app/communication', icon: <MessageCircle size={20} />, emoji: '💬' },
  ];

  const farmer = JSON.parse(localStorage.getItem('soilai_farmer') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('soilai_farmer');
    navigate('/login', { replace: true });
  };

  return (
    <nav style={{
      background: '#FFFFFF',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      padding: '0.6rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            background: 'var(--primary)',
            padding: '0.45rem',
            borderRadius: '0.5rem',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sprout size={22} />
          </div>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            Krishi<span style={{ color: 'var(--primary)' }}>Mitra</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link key={link.path} to={link.path} style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.6rem',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: isActive ? 'rgba(76,175,80,0.08)' : 'transparent',
                transition: 'all 0.2s',
                position: 'relative',
              }}>
                <span style={{ fontSize: '1rem' }}>{link.emoji}</span>
                {link.name}
              </Link>
            );
          })}

          {/* Farmer name + Logout */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            marginLeft: '0.75rem', paddingLeft: '0.75rem',
            borderLeft: '1px solid var(--border)',
          }}>
            {farmer.name && (
              <span style={{
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 700,
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                🌾 {farmer.name}
              </span>
            )}
            <button
              id="logout-btn"
              onClick={handleLogout}
              title="Logout"
              style={{
                background: '#FFF5F5',
                border: '1px solid #FECACA',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.65rem',
                color: '#DC2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Layout = () => {
  const location = useLocation();
  
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main 
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="page-container"
          style={{ flexGrow: 1 }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
};

export default Layout;
