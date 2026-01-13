import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import './App.css';
import Dashboard from './pages/Dashboard';
import AskAI from './pages/AskAI';
import DataSources from './pages/DataSources';
import Knowledge from './pages/Knowledge';
import Decisions from './pages/Decisions';
import Insights from './pages/Insights';
import { FiHome, FiMessageSquare, FiDatabase, FiBook, FiTrendingUp, FiGrid } from 'react-icons/fi';

const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: FiHome, label: 'Dashboard' },
    { path: '/ask', icon: FiMessageSquare, label: 'Ask AI' },
    { path: '/sources', icon: FiDatabase, label: 'Data Sources' },
    { path: '/knowledge', icon: FiBook, label: 'Knowledge' },
    { path: '/decisions', icon: FiGrid, label: 'Decisions' },
    { path: '/insights', icon: FiTrendingUp, label: 'Insights' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center neon-glow">
              <span className="text-white font-bold text-xl">OM</span>
            </div>
            <span className="text-xl font-heading font-bold tracking-tight">DecisionMind</span>
          </Link>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  className={`relative px-4 py-2 rounded-lg transition-all duration-300 flex items-center space-x-2 ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <div className="App">
      <div className="hero-glow" />
      <BrowserRouter>
        <Navigation />
        <main className="relative z-10 pt-20 pb-12">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ask" element={<AskAI />} />
            <Route path="/sources" element={<DataSources />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;