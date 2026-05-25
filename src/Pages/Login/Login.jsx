import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

function corValida(valor, corPadrao) {
  if (typeof valor !== 'string') return corPadrao;

  const cor = valor.trim();

  if (!cor || cor.toLowerCase() === 'null' || cor.toLowerCase() === 'undefined') {
    return corPadrao;
  }

  const ehHexadecimal = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(cor);

  return ehHexadecimal ? cor : corPadrao;
}

function pegarCampo(objeto, ...nomes) {
  for (const nome of nomes) {
    if (objeto && objeto[nome] !== undefined && objeto[nome] !== null) {
      return objeto[nome];
    }
  }

  return undefined;
}

function aplicarTemaAgencia(corPrimaria, corSecundaria, corFonteCabecalho) {
  document.documentElement.style.setProperty(
    '--cor-agencia',
    corPrimaria || '#111827'
  );

  document.documentElement.style.setProperty(
    '--cor-agencia-secundaria',
    corSecundaria || '#38bdf8'
  );

  document.documentElement.style.setProperty(
    '--cor-fonte-cabecalho',
    corFonteCabecalho || '#ffffff'
  );
}

function salvarPerfilAgencia(dados) {
  const agencia = dados?.agencia || dados?.Agencia || {};

  const idAgencia =
    pegarCampo(agencia, 'id', 'Id') ||
    pegarCampo(dados, 'agenciaId', 'AgenciaId') ||
    '';

  const nomeAgencia =
    pegarCampo(agencia, 'nome', 'Nome') ||
    pegarCampo(dados, 'nome', 'Nome') ||
    'Agência';

  const corPrimariaRecebida =
    pegarCampo(agencia, 'corPrimaria', 'CorPrimaria') ||
    pegarCampo(dados, 'corPrimaria', 'CorPrimaria');

  const corSecundariaRecebida =
    pegarCampo(agencia, 'corSecundaria', 'CorSecundaria') ||
    pegarCampo(dados, 'corSecundaria', 'CorSecundaria');

  const corFonteCabecalhoRecebida =
    pegarCampo(agencia, 'corFonteCabecalho', 'CorFonteCabecalho') ||
    pegarCampo(dados, 'corFonteCabecalho', 'CorFonteCabecalho');

  const corPrimaria = corValida(corPrimariaRecebida, '#111827');
  const corSecundaria = corValida(corSecundariaRecebida, '#38bdf8');
  const corFonteCabecalho = corValida(corFonteCabecalhoRecebida, '#ffffff');

  const logoUrl =
    pegarCampo(agencia, 'logoUrl', 'LogoUrl') ||
    pegarCampo(dados, 'logoUrl', 'LogoUrl') ||
    '';

  const telefoneWhatsApp =
    pegarCampo(agencia, 'telefoneWhatsApp', 'TelefoneWhatsApp') ||
    pegarCampo(dados, 'telefoneWhatsApp', 'TelefoneWhatsApp') ||
    '';

  localStorage.setItem('tokenAgencia', dados.token || dados.Token);
  localStorage.setItem('idAgencia', String(idAgencia));
  localStorage.setItem('nomeAgencia', nomeAgencia);
  localStorage.setItem('corAgenciaPrimaria', corPrimaria);
  localStorage.setItem('corAgenciaSecundaria', corSecundaria);
  localStorage.setItem('corFonteCabecalhoAgencia', corFonteCabecalho);
  localStorage.setItem('logoAgencia', logoUrl);
  localStorage.setItem('logoAgenciaUrl', logoUrl);
  localStorage.setItem('telefoneAgencia', telefoneWhatsApp);

  aplicarTemaAgencia(corPrimaria, corSecundaria, corFonteCabecalho);

  console.log('[LOGIN] Resposta completa da API:', dados);
  console.log('[LOGIN] Agência salva:', {
    idAgencia,
    nomeAgencia,
    corPrimaria,
    corSecundaria,
    corFonteCabecalho,
    logoUrl,
    telefoneWhatsApp
  });

  if (!corPrimariaRecebida || !corSecundariaRecebida) {
    console.warn(
      '[LOGIN] Atenção: a API não retornou corPrimaria/corSecundaria. O frontend usou cores padrão.'
    );
  }
}

export default function Login() {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');

  const navegar = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMensagemErro('');

    if (!telefone.trim() || !senha.trim()) {
      setMensagemErro('Informe telefone e senha para entrar.');
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
        setMensagemErro(dados.mensagem || 'Não foi possível realizar o login.');
        return;
      }

      const token = dados.token || dados.Token;

      if (!token) {
        setMensagemErro('A API respondeu sem token. Verifique o retorno da rota de login.');
        console.error('[LOGIN] Resposta sem token:', dados);
        return;
      }

      salvarPerfilAgencia(dados);

      navegar('/painel', { replace: true });
    } catch (erro) {
      console.error('Erro na comunicação com a API:', erro);
      setMensagemErro('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <div className="mil-lin-logo" aria-label="Logo M I L - L I N">
          <span className="mil-lin-logo__nome">M I L - L I N</span>

          <div className="notebook-icon">
            <div className="center-logo"></div>
            <div className="center2-logo"></div>
        </div>
          
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
              <label className="input-label" htmlFor="telefone">
                Telefone da Agência
              </label>

              <input
                id="telefone"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => {
                  setTelefone(e.target.value);
                  setMensagemErro('');
                }}
                className="input-field"
                autoComplete="tel"
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="senha">
                Senha
              </label>

              <input
                id="senha"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setMensagemErro('');
                }}
                className="input-field"
                autoComplete="current-password"
              />
            </div>

            {mensagemErro && (
              <p className="login-message login-message--error" role="alert">
                {mensagemErro}
              </p>
            )}

            <button type="submit" className="btn-submit" disabled={carregando}>
              {carregando ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
