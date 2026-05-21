import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

function salvarPerfilAgencia(dados) {
  const agencia = dados?.agencia || {};

  localStorage.setItem('tokenAgencia', dados.token);
  localStorage.setItem('idAgencia', String(dados.agenciaId || agencia.id || ''));
  localStorage.setItem('nomeAgencia', dados.nome || agencia.nome || 'Minha Agência');
  localStorage.setItem('corAgenciaPrimaria', agencia.corPrimaria || '#111827');
  localStorage.setItem('corAgenciaSecundaria', agencia.corSecundaria || '#38bdf8');

  if (agencia.logoUrl) {
    localStorage.setItem('logoAgenciaUrl', agencia.logoUrl);
  } else {
    localStorage.removeItem('logoAgenciaUrl');
  }
}

export default function Login() {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navegar = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!telefone.trim() || !senha.trim()) {
      alert('Informe telefone e senha para entrar.');
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telefone: telefone.trim(),
          senha
        })
      });

      const textoResposta = await resposta.text();
      let dados = {};

      try {
        dados = textoResposta ? JSON.parse(textoResposta) : {};
      } catch {
        dados = { mensagem: textoResposta };
      }

      if (resposta.ok) {
        salvarPerfilAgencia(dados);
        navegar('/painel');
        return;
      }

      alert(`Erro: ${dados.mensagem || 'Não foi possível realizar o login.'}`);
    } catch (erro) {
      console.error('Erro na comunicação com a API:', erro);
      alert('Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="mil-lin-logo" aria-label="Logo MIL-LIN">
            <span className="mil-lin-logo__nome">M I L - L I N</span>
            <span className="mil-lin-logo__icone">
              <span className="mil-lin-logo__tela" />
              <span className="mil-lin-logo__base" />
            </span>
          </div>
          <h1 className="login-title">Acesso da Agência</h1>
          <p className="login-subtitle">Entre para carregar o painel personalizado do seu ponto</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label className="input-label" htmlFor="telefone">Telefone da Agência</label>
            <input
              id="telefone"
              type="text"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="input-field"
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-submit" disabled={carregando}>
            {carregando ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
