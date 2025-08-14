import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reservar from './components/ReservarEvento';
import DashboardCliente from './components/DashboardCliente';

function AppWrapper() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const handleLoginSuccess = (userData) => {
    console.log('Usuario logueado: ', userData);
    setUser(userData);
    navigate('/dashboard');
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
      <Route path="/dashboard" element={<Dashboard user={user} />} />
      <Route path="/reservar" element={<Reservar />} />
      <Route path="/cliente/dashboard" element={<DashboardCliente/>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;
