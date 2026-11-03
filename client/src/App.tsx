import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Container, Navbar, Offcanvas, Button, Badge } from 'react-bootstrap';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings as SettingsIcon, 
  Menu, 
  Bell, 
  Sun, 
  Moon, 
  Activity,
  Sparkles
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Reminders from './pages/Reminders';
import CalendarView from './pages/CalendarView';
import SettingsView from './pages/SettingsView';
import { useTheme } from './context/ThemeContext';

function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMenu, setShowMenu] = useState(false);
  const { mode: theme, toggleMode: toggleTheme } = useTheme();

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--bs-body-bg)' }}>
      {/* Modern Sticky Navigation Bar */}
      <Navbar expand="lg" className="sticky-top border-bottom py-2 shadow-sm" style={{ 
        backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderColor: 'var(--bs-border-color)'
      }}>
        <Container fluid="xl" className="px-3 px-sm-4">
          <div className="d-flex align-items-center justify-content-between w-100">
            {/* Left: Brand & Mobile Toggle */}
            <div className="d-flex align-items-center gap-3">
              <button 
                className="btn btn-link text-body p-1 d-lg-none border-0 shadow-none" 
                onClick={() => setShowMenu(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={24} />
              </button>

              <Link to="/" className="text-decoration-none d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded-3 p-2" style={{
                  background: 'var(--primary-gradient)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
                }}>
                  <Bell size={20} className="text-white" />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold fs-5 text-body tracking-tight">OmniReminders</span>
                    <Badge bg="primary" className="rounded-pill" style={{ fontSize: '0.65rem' }}>
                      v2.1
                    </Badge>
                  </div>
                  <div className="d-none d-sm-flex align-items-center gap-1 text-muted" style={{ fontSize: '0.7rem' }}>
                    <Sparkles size={11} className="text-primary" />
                    <span>Powered by Gemini AI</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation Links */}
            <div className="d-none d-lg-flex align-items-center gap-1 bg-body-tertiary p-1 rounded-pill border">
              <NavLink 
                to="/" 
                end
                className={({ isActive }) => 
                  `btn btn-sm rounded-pill px-3 py-1 fw-medium text-decoration-none d-flex align-items-center gap-2 transition-all ${
                    isActive 
                      ? 'btn-primary text-white shadow-sm' 
                      : 'text-body-secondary btn-link text-decoration-none'
                  }`
                }
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </NavLink>

              <NavLink 
                to="/reminders" 
                className={({ isActive }) => 
                  `btn btn-sm rounded-pill px-3 py-1 fw-medium text-decoration-none d-flex align-items-center gap-2 transition-all ${
                    isActive 
                      ? 'btn-primary text-white shadow-sm' 
                      : 'text-body-secondary btn-link text-decoration-none'
                  }`
                }
              >
                <Bell size={16} />
                <span>All Reminders</span>
              </NavLink>

              <NavLink 
                to="/calendar" 
                className={({ isActive }) => 
                  `btn btn-sm rounded-pill px-3 py-1 fw-medium text-decoration-none d-flex align-items-center gap-2 transition-all ${
                    isActive 
                      ? 'btn-primary text-white shadow-sm' 
                      : 'text-body-secondary btn-link text-decoration-none'
                  }`
                }
              >
                <Calendar size={16} />
                <span>Calendar</span>
              </NavLink>

              <NavLink 
                to="/settings" 
                className={({ isActive }) => 
                  `btn btn-sm rounded-pill px-3 py-1 fw-medium text-decoration-none d-flex align-items-center gap-2 transition-all ${
                    isActive 
                      ? 'btn-primary text-white shadow-sm' 
                      : 'text-body-secondary btn-link text-decoration-none'
                  }`
                }
              >
                <SettingsIcon size={16} />
                <span>Settings</span>
              </NavLink>
            </div>

            {/* Right: Theme Toggle & Pulse API quick info */}
            <div className="d-flex align-items-center gap-2">
              <Link 
                to="/settings"
                state={{ activeTab: 'pulse' }}
                className="btn btn-sm btn-outline-secondary rounded-pill d-none d-md-flex align-items-center gap-1 px-2 py-1"
                title="Pulse App API Integration"
              >
                <Activity size={14} className="text-success" />
                <span style={{ fontSize: '0.78rem' }}>Pulse API</span>
              </Link>

              <Button 
                variant="outline-secondary" 
                size="sm"
                className="rounded-circle p-2 d-flex align-items-center justify-content-center border-0 shadow-none"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                style={{ width: 36, height: 36 }}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-warning" />}
              </Button>
            </div>
          </div>
        </Container>
      </Navbar>

      {/* Mobile Sidebar Offcanvas */}
      <Offcanvas show={showMenu} onHide={() => setShowMenu(false)} placement="start" style={{ width: 280 }}>
        <Offcanvas.Header closeButton className="border-bottom">
          <Offcanvas.Title className="fw-bold d-flex align-items-center gap-2">
            <div className="rounded p-1 bg-primary text-white">
              <Bell size={18} />
            </div>
            <span>OmniReminders</span>
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-3 d-flex flex-column justify-content-between">
          <div className="d-flex flex-column gap-1">
            <NavLink 
              to="/" 
              end
              className={({ isActive }) => 
                `d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-decoration-none fw-medium ${
                  isActive ? 'bg-primary text-white' : 'text-body hover-bg-theme'
                }`
              }
              onClick={() => setShowMenu(false)}
            >
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>

            <NavLink 
              to="/reminders" 
              className={({ isActive }) => 
                `d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-decoration-none fw-medium ${
                  isActive ? 'bg-primary text-white' : 'text-body hover-bg-theme'
                }`
              }
              onClick={() => setShowMenu(false)}
            >
              <Bell size={18} /> All Reminders
            </NavLink>

            <NavLink 
              to="/calendar" 
              className={({ isActive }) => 
                `d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-decoration-none fw-medium ${
                  isActive ? 'bg-primary text-white' : 'text-body hover-bg-theme'
                }`
              }
              onClick={() => setShowMenu(false)}
            >
              <Calendar size={18} /> Calendar
            </NavLink>

            <hr className="my-2" />

            <NavLink 
              to="/settings" 
              className={({ isActive }) => 
                `d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-decoration-none fw-medium ${
                  isActive ? 'bg-primary text-white' : 'text-body hover-bg-theme'
                }`
              }
              onClick={() => setShowMenu(false)}
            >
              <SettingsIcon size={18} /> Settings & API
            </NavLink>
          </div>

          <div className="p-3 rounded-3 bg-body-tertiary border text-center">
            <div className="small fw-semibold mb-1">HomeServer Pulse API</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              Connect your reminders widget via <code>/api/pulse/reminders</code>
            </div>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Page Content */}
      <main className="flex-grow-1 w-100">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-top py-3 text-center text-muted small mt-auto">
        <Container fluid="xl" className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 px-4">
          <div className="d-flex align-items-center gap-2">
            <span>OmniReminders v2.1</span>
            <span>•</span>
            <span className="text-primary fw-medium">Gemini AI Inside</span>
          </div>
          <div className="text-secondary">
            Homelab & HomeServer Pulse App Ready
          </div>
        </Container>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        } />
        
        <Route path="/reminders" element={
          <AppLayout>
            <Reminders />
          </AppLayout>
        } />
        
        <Route path="/calendar" element={
          <AppLayout>
            <CalendarView />
          </AppLayout>
        } />
        
        <Route path="/settings" element={
          <AppLayout>
            <SettingsView />
          </AppLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
