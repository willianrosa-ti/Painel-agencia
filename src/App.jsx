import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Pages/Login/Login';
import Painel from './Pages/Painel/Painel'; 
import Motoristas from './Pages/Motoristas/Motoristas';
import Financeiro from './Pages/Financeiro/Financeiro';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota padrão: se entrar vazio, joga pro login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Rota do Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Rota do Painel da agência */}
        <Route path="/painel" element={<Painel />} />

        {/* --- O QUE FOI ADICIONADO AQUI --- */}
        {/* Rota dos Motoristas: Criamos o caminho "/motoristas". 
            Assim, quando o link no Navbar for clicado, o React sabe 
            que precisa renderizar a tela de Gestão da Frota. */}
        <Route path="/motoristas" element={<Motoristas />} />
        <Route path="/financeiro" element={<Financeiro />} />
        
      </Routes>
    </BrowserRouter>
  );
}