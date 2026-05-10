import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Ferramenta para trocar de tela
import './Login.css'; 

export default function Login() {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  
  const navegar = useNavigate(); // Criamos a variável de navegação

  const handleLogin = async (e) => {
    e.preventDefault(); 
    
    try {
      const resposta = await fetch('http://motoapp.azurewebsites.net/api/Autenticacao/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telefone: telefone,
          senha: senha
        })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        // 1. Guardamos o crachá (Token) e o Nome na memória do navegador
        localStorage.setItem('tokenAgencia', dados.token);
        localStorage.setItem('nomeAgencia', dados.nome);
        localStorage.setItem('idAgencia', dados.agenciaId);

        // 2. Trocamos de tela automaticamente para o Painel!
        navegar('/painel');
      } else {
        alert(`Erro: ${dados.mensagem}`);
      }

    } catch (erro) {
      console.error("Erro na comunicação com a API:", erro);
      alert("Não foi possível conectar ao servidor.");
    }
  };

  return (
    <div className="login-container">
      {/* ... o restante do seu HTML (Hypertext Markup Language) continua exatamente igual ... */}
      <div className="login-card">
        <div className="login-header">
          <div className="logo-box">
            <span className="logo-letter">T</span>
          </div>
          <h1 className="agency-name">MOTO-THALES</h1>
          <p className="agency-subtitle">Painel da Agência</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label className="input-label">Telefone da Agência</label>
            <input 
              type="text" placeholder="(00) 00000-0000"
              value={telefone} onChange={(e) => setTelefone(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="input-group">
            <label className="input-label">Senha</label>
            <input 
              type="password" placeholder="Senha"
              value={senha} onChange={(e) => setSenha(e.target.value)}
              className="input-field"
            />
          </div>
          <div><a href="#" className="forgot-password-link">Esqueceu o acesso?</a></div>
          <button type="submit" className="btn-submit">ENTRAR</button>
        </form>
      </div>
    </div>
  );
}