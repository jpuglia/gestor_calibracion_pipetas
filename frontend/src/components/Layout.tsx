/**
 * Layout component providing the main application structure.
 * Includes a persistent sidebar for navigation and a main content area for page outlets.
 */

import './Layout.css';

import { Beaker, ClipboardList, LayoutDashboard } from 'lucide-react';
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="Urufarma" className="corporate-logo" />
        </div>
        <div className="sidebar-divider"></div>
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/inventory"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <Beaker size={20} />
            <span>Inventario</span>
          </NavLink>
          <NavLink
            to="/calibration"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <ClipboardList size={20} />
            <span>Calibración</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-role">Laboratorio - Gestión</span>
            <div className="author-credits">
              <span>Author: Juan D. Puglia; URUFARMA S.A. 2026</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <div className="header-info">
            <h2>Gestor de Calibración de Pipetas</h2>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
