import { useNavigate, Link } from 'react-router-dom';
import './Navbar.css';

export default function Navbar({ nomeAgencia }) {
  const navegar = useNavigate();

  const handleSair = () => {
    localStorage.clear();
    navegar('/login');
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-logo">
        <Link to="/painel" className="navbar-link-logo"> MOTO-TAXI THALES</Link>
      </div>
      
      <div className="navbar-menu">
        <Link to="/painel" className="navbar-link"> Operar</Link>
        <Link to="/motoristas" className="navbar-link"> Frota</Link>
        <Link to="/financeiro" className="navbar-link"> Financeiro</Link>
      </div>

      <div className="navbar-direita">
        {/* O SINO DE NOTIFICAÇÃO ATUALIZADO PARA SVG */}
        <div className="navbar-notificacao">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="navbar-sino-svg"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="navbar-badge">0</span>
        </div>
        
        <span className="navbar-usuario">Olá, <strong>{nomeAgencia}</strong></span>
        <button onClick={handleSair} className="botao-sair-navbar">Sair</button>
      </div>
    </nav>
  );
}