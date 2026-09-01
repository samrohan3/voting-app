import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VoterApp from './VoterApp';
import AdminApp from './AdminApp';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/voters" element={<VoterApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/voters" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
