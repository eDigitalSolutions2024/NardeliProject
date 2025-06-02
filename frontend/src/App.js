import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reservar from './components/Reservar';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    console.log('Usuario logueado: ', userData);
    setUser(userData);

    window.location.href = '/dashboard';
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reservar" element={<Reservar/>} />
      </Routes>
    </Router>
  );
}

export default App;
