import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

function aplicarTemaAgencia(corPrimaria, corSecundaria) {
  document.documentElement.style.setProperty('--cor-agencia', corPrimaria || '#111827');
  document.documentElement.style.setProperty('--cor-agencia-secundaria', corSecundaria || '#38bdf8');
}

function salvarPerfilAgencia(dados) {
  const agencia = dados?.agencia || {};

  const idAgencia = agencia.id || dados.agenciaId || '';
  const nomeAgencia = agencia.nome || dados.nome || 'Agência';

  // Aceita tanto o formato novo: dados.agencia.corPrimaria
  // quanto um formato mais simples: dados.corPrimaria
  const corPrimaria = agencia.corPrimaria || dados.corPrimaria || '#111827';
  const corSecundaria = agencia.corSecundaria || dados.corSecundaria || '#38bdf8';
  const logoUrl = agencia.logoUrl || dados.logoUrl || '';

  localStorage.setItem('tokenAgencia', dados.token);
  localStorage.setItem('idAgencia', String(idAgencia));
  localStorage.setItem('nomeAgencia', nomeAgencia);
  localStorage.setItem('corAgenciaPrimaria', corPrimaria);
  localStorage.setItem('corAgenciaSecundaria', corSecundaria);

  // Mantive as duas chaves para compatibilidade com arquivos antigos e novos.
  localStorage.setItem('logoAgencia', logoUrl);
  localStorage.setItem('logoAgenciaUrl', logoUrl);

  aplicarTemaAgencia(corPrimaria, corSecundaria);
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

      if (!resposta.ok) {
        alert(`Erro: ${dados.mensagem || 'Não foi possível realizar o login.'}`);
        return;
      }

      if (!dados.token) {
        alert('A API respondeu sem token. Verifique o retorno da rota de login.');
        return;
      }

      salvarPerfilAgencia(dados);
      navegar('/painel');
    } catch (erro) {
      console.error('Erro na comunicação com a API:', erro);
      alert('Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <div className="mil-lin-logo" aria-label="Logo M I L - L I N">
          <span className="mil-lin-logo__nome">M I L - L I N</span>

          <span className="mil-lin-logo__icone">
            <span className="mil-lin-logo__tela" />
            <span className="mil-lin-logo__base" />
          </span>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Acesso da Agência</h1>
            <p className="login-subtitle">
              Entre para carregar o painel personalizado do seu ponto.
            </p>
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
                placeholder="Digite sua senha"
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
    </div>
  );
}
