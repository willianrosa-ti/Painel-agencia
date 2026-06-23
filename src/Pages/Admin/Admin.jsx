import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useFeedback } from '../../Components/Feedback/useFeedback';
import './Admin.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const ADMIN_KEY_STORAGE = 'milLinAdminKey';
const ADMIN_SESSION_KEY_STORAGE = 'milLinAdminSessionKey';

const FORM_AGENCIA_INICIAL = {
  nomeAgencia: '',
  telefone: '',
  senha: '',
  logoUrl: '',
  corPrimaria: '#111827',
  corSecundaria: '#38bdf8',
  corFonteCabecalho: '#ffffff',
  cidadeBase: 'Ourinhos',
  estadoBase: 'SP',
  planoAssinatura: 'Profissional',
  assinaturaAtiva: true,
  assinaturaVenceEm: ''
};

const RELEASE_INICIAL = {
  produto: 'painel-agencia',
  versao: '',
  canal: 'main',
  data: new Date().toISOString().slice(0, 10),
  obrigatoria: false,
  changelog: '',
  link: '',
  ativa: true
};

const ROTAS_ADMIN = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/agencias', label: 'Agencias' },
  { to: '/admin/atualizacoes', label: 'Atualizações' },
  { to: '/admin/monitoramento', label: 'Monitoramento' },
  { to: '/admin/configuracoes', label: 'Configurações' }
];

function dataParaInput(valor) {
  if (!valor) return '';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor).slice(0, 10);

  return data.toISOString().slice(0, 10);
}

function formatarData(valor) {
  if (!valor) return 'Sem vencimento';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);

  return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(valor) {
  if (!valor) return 'Sem atividade';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);

  return data.toLocaleString('pt-BR');
}

function montarPayloadAgencia(formulario) {
  return {
    nomeAgencia: formulario.nomeAgencia.trim(),
    telefone: formulario.telefone.trim(),
    senha: formulario.senha.trim() || null,
    logoUrl: formulario.logoUrl.trim() || null,
    corPrimaria: formulario.corPrimaria,
    corSecundaria: formulario.corSecundaria,
    corFonteCabecalho: formulario.corFonteCabecalho,
    cidadeBase: formulario.cidadeBase.trim(),
    estadoBase: formulario.estadoBase.trim().toUpperCase(),
    planoAssinatura: formulario.planoAssinatura.trim() || 'Profissional',
    assinaturaAtiva: Boolean(formulario.assinaturaAtiva),
    assinaturaVenceEm: formulario.assinaturaVenceEm
      ? `${formulario.assinaturaVenceEm}T23:59:59`
      : null
  };
}

function statusAgencia(agencia) {
  if (agencia.statusOperacional) return agencia.statusOperacional;
  if (agencia.assinaturaAtiva === false) return 'suspensa';

  if (agencia.assinaturaVenceEm) {
    const vencimento = new Date(agencia.assinaturaVenceEm);
    if (!Number.isNaN(vencimento.getTime()) && vencimento < new Date()) return 'pendente';
  }

  return 'ativa';
}

function rotuloStatus(status) {
  const mapa = {
    ativa: 'Ativa',
    suspensa: 'Suspensa',
    pendente: 'Pendente',
    inativa: 'Inativa',
    excluida: 'Excluida'
  };

  return mapa[status] || 'Ativa';
}

function calcularResumo(agencias) {
  return agencias.reduce(
    (resumo, agencia) => {
      const status = statusAgencia(agencia);

      resumo.total += 1;
      resumo.motoristas += Number(agencia.totalMotoristas || 0);
      resumo.online += Number(agencia.totalMotoristasOnline || 0);
      resumo.corridas += Number(agencia.totalCorridas || 0);

      if (status === 'ativa') resumo.ativas += 1;
      else if (status === 'suspensa') resumo.suspensas += 1;
      else if (status === 'pendente') resumo.pendentes += 1;
      else resumo.inativas += 1;

      return resumo;
    },
    { total: 0, ativas: 0, suspensas: 0, pendentes: 0, inativas: 0, motoristas: 0, online: 0, corridas: 0 }
  );
}

function ordenarPorAtividade(agencias) {
  return [...agencias].sort((a, b) => {
    const dataA = a.ultimaAtividade ? new Date(a.ultimaAtividade).getTime() : 0;
    const dataB = b.ultimaAtividade ? new Date(b.ultimaAtividade).getTime() : 0;
    return dataB - dataA;
  });
}

function nomeProdutoAtualizacao(produto) {
  const mapa = {
    'painel-agencia': 'Painel da agencia',
    'app-motorista': 'App do motorista'
  };

  return mapa[produto] || produto;
}

function releaseParaFormulario(release) {
  if (!release) return RELEASE_INICIAL;

  return {
    produto: release.produto || 'painel-agencia',
    versao: release.versao || '',
    canal: release.canal || 'main',
    data: dataParaInput(release.dataPublicacao || release.data),
    obrigatoria: Boolean(release.obrigatoria),
    changelog: release.changelog || '',
    link: release.linkDownload || release.link || '',
    ativa: release.ativa !== false
  };
}

function montarPayloadAtualizacao(formulario) {
  return {
    produto: formulario.produto,
    versao: formulario.versao.trim(),
    canal: formulario.canal.trim() || 'main',
    changelog: formulario.changelog.trim(),
    dataPublicacao: formulario.data ? `${formulario.data}T12:00:00` : null,
    obrigatoria: Boolean(formulario.obrigatoria),
    linkDownload: formulario.link.trim() || null,
    ativa: Boolean(formulario.ativa)
  };
}

function ModalBase({ titulo, subtitulo, children, onFechar, largura = 'media' }) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div className={`admin-modal admin-modal--${largura}`} role="dialog" aria-modal="true" aria-labelledby="admin-modal-titulo">
        <header className="admin-modal__header">
          <div>
            <h2 id="admin-modal-titulo">{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="admin-icon-button" onClick={onFechar} aria-label="Fechar modal">
            x
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function AdminLogin({
  adminKey,
  setAdminKey,
  verificando,
  lembrarChave,
  setLembrarChave,
  temChaveSalva,
  onEntrar,
  onApagarChaveSalva
}) {
  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <div className="admin-brand">
          <span>MIL-LIN</span>
          <strong>Admin</strong>
        </div>
        <h1>Login administrativo</h1>
        <p className="admin-muted">Acesso operacional para agencias, atualizacoes e monitoramento geral.</p>

        <form
          className="admin-login-form"
          onSubmit={(evento) => {
            evento.preventDefault();
            onEntrar();
          }}
        >
          <label htmlFor="adminKey">Chave administrativa</label>
          <input
            id="adminKey"
            type="password"
            value={adminKey}
            onChange={(evento) => setAdminKey(evento.target.value)}
            placeholder="X-MIL-LIN-ADMIN-KEY"
            autoComplete="off"
          />
          <label className="admin-checkbox admin-checkbox--login">
            <input
              type="checkbox"
              checked={lembrarChave}
              onChange={(evento) => setLembrarChave(evento.target.checked)}
            />
            Lembrar chave neste computador
          </label>
          {temChaveSalva && (
            <div className="admin-saved-key">
              <span>Existe uma chave salva neste computador.</span>
              <button type="button" onClick={onApagarChaveSalva}>
                Apagar chave salva
              </button>
            </div>
          )}
          <button type="submit" className="admin-button admin-button--primary" disabled={verificando}>
            {verificando ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminShell({ children, apiStatus, ultimaSincronizacao, onAtualizar, onSair }) {
  const location = useLocation();
  const tituloAtual = ROTAS_ADMIN.find((rota) => location.pathname.startsWith(rota.to))?.label || 'Dashboard';

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span>MIL-LIN</span>
          <strong>Admin</strong>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Menu administrativo">
          {ROTAS_ADMIN.map((rota) => (
            <NavLink key={rota.to} to={rota.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {rota.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Area administrativa</p>
            <h1>{tituloAtual}</h1>
          </div>

          <div className="admin-topbar__actions">
            <span className={`admin-api-status admin-api-status--${apiStatus}`}>
              API {apiStatus === 'online' ? 'online' : apiStatus === 'offline' ? 'offline' : 'verificando'}
            </span>
            <span className="admin-sync-label">
              {ultimaSincronizacao ? `Atualizado ${formatarDataHora(ultimaSincronizacao)}` : 'Sem sincronizacao'}
            </span>
            <button type="button" className="admin-button admin-button--secondary" onClick={onAtualizar}>
              Atualizar
            </button>
            <button type="button" className="admin-button admin-button--ghost" onClick={onSair}>
              Sair
            </button>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}

function MetricCard({ titulo, valor, detalhe, variante = 'default' }) {
  return (
    <div className={`admin-metric admin-metric--${variante}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </div>
  );
}

function DashboardPage({ agencias }) {
  const resumo = useMemo(() => calcularResumo(agencias), [agencias]);
  const ranking = useMemo(
    () => [...agencias].sort((a, b) => Number(b.totalCorridas || 0) - Number(a.totalCorridas || 0)).slice(0, 5),
    [agencias]
  );
  const atividade = useMemo(() => ordenarPorAtividade(agencias).slice(0, 5), [agencias]);

  return (
    <div className="admin-content">
      <section className="admin-metrics">
        <MetricCard titulo="Agencias" valor={resumo.total} detalhe={`${resumo.ativas} ativas`} />
        <MetricCard titulo="Suspensas" valor={resumo.suspensas} detalhe={`${resumo.pendentes} pendentes`} variante="warn" />
        <MetricCard titulo="Motoboys" valor={resumo.motoristas} detalhe={`${resumo.online} online agora`} variante="ok" />
        <MetricCard titulo="Corridas" valor={resumo.corridas} detalhe="Total registrado" variante="info" />
      </section>

      <section className="admin-grid admin-grid--two">
        <div className="admin-panel">
          <header className="admin-section-header">
            <div>
              <p className="admin-eyebrow">Ranking</p>
              <h2>Agencias por corridas</h2>
            </div>
          </header>
          <TabelaRanking agencias={ranking} metrica="totalCorridas" rotuloMetrica="Corridas" />
        </div>

        <div className="admin-panel">
          <header className="admin-section-header">
            <div>
              <p className="admin-eyebrow">Atividade</p>
              <h2>Ultimas conexoes</h2>
            </div>
          </header>
          <TabelaAtividade agencias={atividade} />
        </div>
      </section>
    </div>
  );
}

function AgenciasPage({ agencias, carregando, salvando, onAtualizar, onSalvar, onSuspender, onReativar, onExcluir }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalAgencia, setModalAgencia] = useState(null);
  const [modalSuspensao, setModalSuspensao] = useState(null);
  const [modalExclusao, setModalExclusao] = useState(null);

  const agenciasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return agencias.filter((agencia) => {
      const status = statusAgencia(agencia);
      const texto = `${agencia.nome || ''} ${agencia.telefoneWhatsApp || ''} ${agencia.cidadeBase || ''} ${agencia.estadoBase || ''}`.toLowerCase();

      const passouBusca = !termo || texto.includes(termo);
      const passouStatus = filtroStatus === 'todos' || status === filtroStatus;

      return passouBusca && passouStatus;
    });
  }, [agencias, busca, filtroStatus]);

  return (
    <div className="admin-content">
      <section className="admin-panel">
        <header className="admin-section-header">
          <div>
            <p className="admin-eyebrow">Cadastro e controle</p>
            <h2>Agencias</h2>
          </div>
          <button type="button" className="admin-button admin-button--primary" onClick={() => setModalAgencia({ modo: 'nova', agencia: null })}>
            Adicionar agencia
          </button>
        </header>

        <div className="admin-toolbar">
          <label className="admin-search">
            Busca
            <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome, telefone ou cidade" />
          </label>
          <label className="admin-filter">
            Status
            <select value={filtroStatus} onChange={(evento) => setFiltroStatus(evento.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativa">Ativas</option>
              <option value="suspensa">Suspensas</option>
              <option value="pendente">Pendentes</option>
              <option value="inativa">Inativas</option>
            </select>
          </label>
          <button type="button" className="admin-button admin-button--secondary" onClick={onAtualizar} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar tabela'}
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Agencia</th>
                <th>Telefone</th>
                <th>Cidade</th>
                <th>Status</th>
                <th>Motoboys</th>
                <th>Online</th>
                <th>Ultima atividade</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {agenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="admin-empty">
                    Nenhuma agencia encontrada.
                  </td>
                </tr>
              ) : (
                agenciasFiltradas.map((agencia) => {
                  const status = statusAgencia(agencia);

                  return (
                    <tr key={agencia.id}>
                      <td data-label="ID">#{agencia.id}</td>
                      <td data-label="Agencia">
                        <strong>{agencia.nome}</strong>
                        <small>{agencia.planoAssinatura || 'Profissional'}</small>
                      </td>
                      <td data-label="Telefone">{agencia.telefoneWhatsApp}</td>
                      <td data-label="Cidade">{agencia.cidadeBase}/{agencia.estadoBase}</td>
                      <td data-label="Status">
                        <span className={`admin-status admin-status--${status}`}>{rotuloStatus(status)}</span>
                      </td>
                      <td data-label="Motoboys">{agencia.totalMotoristas || 0}</td>
                      <td data-label="Online">{agencia.totalMotoristasOnline || 0}</td>
                      <td data-label="Ultima atividade">{formatarDataHora(agencia.ultimaAtividade)}</td>
                      <td data-label="Acoes">
                        <div className="admin-row-actions">
                          <button type="button" className="admin-action admin-action--edit" onClick={() => setModalAgencia({ modo: 'editar', agencia })}>
                            Editar
                          </button>
                          {status === 'suspensa' ? (
                            <button type="button" className="admin-action admin-action--ok" onClick={() => onReativar(agencia)}>
                              Reativar
                            </button>
                          ) : (
                            <button type="button" className="admin-action admin-action--warn" onClick={() => setModalSuspensao(agencia)}>
                              Suspender
                            </button>
                          )}
                          <button type="button" className="admin-action admin-action--danger" onClick={() => setModalExclusao(agencia)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAgencia && (
        <AgenciaModal
          agencia={modalAgencia.agencia}
          salvando={salvando}
          onFechar={() => setModalAgencia(null)}
          onSalvar={async (formulario) => {
            await onSalvar(formulario, modalAgencia.agencia);
            setModalAgencia(null);
          }}
        />
      )}

      {modalSuspensao && (
        <SuspensaoModal
          agencia={modalSuspensao}
          onFechar={() => setModalSuspensao(null)}
          onConfirmar={async (motivo) => {
            await onSuspender(modalSuspensao, motivo);
            setModalSuspensao(null);
          }}
        />
      )}

      {modalExclusao && (
        <ExclusaoModal
          agencia={modalExclusao}
          onFechar={() => setModalExclusao(null)}
          onConfirmar={async () => {
            await onExcluir(modalExclusao);
            setModalExclusao(null);
          }}
        />
      )}
    </div>
  );
}

function AgenciaModal({ agencia, salvando, onFechar, onSalvar }) {
  const [formulario, setFormulario] = useState(() => ({
    nomeAgencia: agencia?.nome || '',
    telefone: agencia?.telefoneWhatsApp || '',
    senha: '',
    logoUrl: agencia?.logoUrl || '',
    corPrimaria: agencia?.corPrimaria || '#111827',
    corSecundaria: agencia?.corSecundaria || '#38bdf8',
    corFonteCabecalho: agencia?.corFonteCabecalho || '#ffffff',
    cidadeBase: agencia?.cidadeBase || 'Ourinhos',
    estadoBase: agencia?.estadoBase || 'SP',
    planoAssinatura: agencia?.planoAssinatura || 'Profissional',
    assinaturaAtiva: agencia ? agencia.assinaturaAtiva !== false : true,
    assinaturaVenceEm: dataParaInput(agencia?.assinaturaVenceEm)
  }));

  function atualizar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <ModalBase
      titulo={agencia ? 'Editar agencia' : 'Adicionar agencia'}
      subtitulo={agencia ? 'Atualize dados, plano, cores e acesso.' : 'Crie uma agencia real no backend.'}
      onFechar={onFechar}
      largura="grande"
    >
      <form
        className="admin-form admin-form--modal"
        onSubmit={(evento) => {
          evento.preventDefault();
          onSalvar(formulario);
        }}
      >
        <label>
          Nome
          <input value={formulario.nomeAgencia} onChange={(evento) => atualizar('nomeAgencia', evento.target.value)} required />
        </label>
        <label>
          Telefone WhatsApp
          <input value={formulario.telefone} onChange={(evento) => atualizar('telefone', evento.target.value)} required />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={formulario.senha}
            onChange={(evento) => atualizar('senha', evento.target.value)}
            placeholder={agencia ? 'Nova senha opcional' : 'Senha inicial'}
            required={!agencia}
          />
        </label>
        <label>
          Plano
          <input value={formulario.planoAssinatura} onChange={(evento) => atualizar('planoAssinatura', evento.target.value)} />
        </label>
        <label>
          Cidade base
          <input value={formulario.cidadeBase} onChange={(evento) => atualizar('cidadeBase', evento.target.value)} />
        </label>
        <label>
          Estado
          <input maxLength="2" value={formulario.estadoBase} onChange={(evento) => atualizar('estadoBase', evento.target.value.toUpperCase())} />
        </label>
        <label>
          Vencimento
          <input type="date" value={formulario.assinaturaVenceEm} onChange={(evento) => atualizar('assinaturaVenceEm', evento.target.value)} />
        </label>
        <label>
          Logo URL
          <input type="url" value={formulario.logoUrl} onChange={(evento) => atualizar('logoUrl', evento.target.value)} placeholder="https://" />
        </label>
        <label>
          Cor principal
          <input type="color" value={formulario.corPrimaria} onChange={(evento) => atualizar('corPrimaria', evento.target.value)} />
        </label>
        <label>
          Cor destaque
          <input type="color" value={formulario.corSecundaria} onChange={(evento) => atualizar('corSecundaria', evento.target.value)} />
        </label>
        <label>
          Cor cabecalho
          <input type="color" value={formulario.corFonteCabecalho} onChange={(evento) => atualizar('corFonteCabecalho', evento.target.value)} />
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={formulario.assinaturaAtiva} onChange={(evento) => atualizar('assinaturaAtiva', evento.target.checked)} />
          Assinatura ativa
        </label>

        <footer className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="admin-button admin-button--primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}

function SuspensaoModal({ agencia, onFechar, onConfirmar }) {
  const [motivo, setMotivo] = useState('Suspensao administrativa pelo painel MIL-LIN.');

  return (
    <ModalBase titulo="Suspender agencia" subtitulo={agencia.nome} onFechar={onFechar}>
      <div className="admin-modal-body">
        <p>A agencia e os motoboys ficarao sem acesso ate a reativacao.</p>
        <label>
          Motivo
          <textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} rows="4" />
        </label>
      </div>
      <footer className="admin-modal__actions">
        <button type="button" className="admin-button admin-button--secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="admin-button admin-button--danger" onClick={() => onConfirmar(motivo)}>
          Suspender
        </button>
      </footer>
    </ModalBase>
  );
}

function ExclusaoModal({ agencia, onFechar, onConfirmar }) {
  const [confirmacao, setConfirmacao] = useState('');

  return (
    <ModalBase titulo="Excluir agencia" subtitulo={agencia.nome} onFechar={onFechar}>
      <div className="admin-modal-body">
        <p>Esta acao remove definitivamente a agencia e dados relacionados no backend.</p>
        <label>
          Digite DELETAR para confirmar
          <input value={confirmacao} onChange={(evento) => setConfirmacao(evento.target.value)} />
        </label>
      </div>
      <footer className="admin-modal__actions">
        <button type="button" className="admin-button admin-button--secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="admin-button admin-button--danger" disabled={confirmacao !== 'DELETAR'} onClick={onConfirmar}>
          Excluir definitivamente
        </button>
      </footer>
    </ModalBase>
  );
}

function AtualizacoesPage({ adminKey, sucesso, aviso, mostrarErro }) {
  const [releases, setReleases] = useState([]);
  const [modalAtualizacao, setModalAtualizacao] = useState(null);
  const [filtroProduto, setFiltroProduto] = useState('todos');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const releasesFiltradas = useMemo(
    () => releases.filter((release) => filtroProduto === 'todos' || release.produto === filtroProduto),
    [releases, filtroProduto]
  );

  async function lerMensagemErroAtualizacao(resposta) {
    const texto = await resposta.text();

    try {
      const dados = texto ? JSON.parse(texto) : {};
      return dados.mensagem || dados.detalhe || texto;
    } catch {
      return texto || 'Erro inesperado.';
    }
  }

  async function carregarAtualizacoes() {
    setCarregando(true);

    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/atualizacoes`, {
        headers: {
          'Content-Type': 'application/json',
          'X-MIL-LIN-ADMIN-KEY': adminKey
        }
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErroAtualizacao(resposta));
        return;
      }

      const dados = await resposta.json();
      setReleases(Array.isArray(dados) ? dados : []);
    } catch (erro) {
      console.error('Erro ao carregar atualizacoes:', erro);
      mostrarErro('Nao foi possivel carregar as atualizacoes no backend.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarAtualizacao(formulario, releaseEditando) {
    if (!formulario.versao.trim()) {
      aviso('Informe a versao da atualizacao.');
      return;
    }

    setSalvando(true);

    const editando = Boolean(releaseEditando);
    const url = editando
      ? `${API_BASE}/api/Autenticacao/admin/atualizacoes/${releaseEditando.id}`
      : `${API_BASE}/api/Autenticacao/admin/atualizacoes`;

    try {
      const resposta = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MIL-LIN-ADMIN-KEY': adminKey
        },
        body: JSON.stringify(montarPayloadAtualizacao(formulario))
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErroAtualizacao(resposta));
        return;
      }

      sucesso(editando ? 'Versao atualizada no backend.' : 'Versao cadastrada no backend.');
      setModalAtualizacao(null);
      await carregarAtualizacoes();
    } catch (erro) {
      console.error('Erro ao salvar atualizacao:', erro);
      mostrarErro('Erro de conexao ao salvar atualizacao.');
    } finally {
      setSalvando(false);
    }
  }

  async function inativarAtualizacao(release) {
    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/atualizacoes/${release.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-MIL-LIN-ADMIN-KEY': adminKey
        }
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErroAtualizacao(resposta));
        return;
      }

      sucesso('Versao inativada.');
      await carregarAtualizacoes();
    } catch (erro) {
      console.error('Erro ao inativar atualizacao:', erro);
      mostrarErro('Erro de conexao ao inativar atualizacao.');
    }
  }

  async function copiarLink(link) {
    if (!link) {
      aviso('Cadastre um link de download antes de copiar.');
      return;
    }

    await navigator.clipboard.writeText(link);
    sucesso('Link copiado para a area de transferencia.');
  }

  useEffect(() => {
    carregarAtualizacoes();
    // Carrega quando a chave administrativa fica disponivel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  return (
    <div className="admin-content">
      <section className="admin-panel">
        <header className="admin-section-header">
          <div>
            <p className="admin-eyebrow">Distribuicao</p>
            <h2>Atualizacoes</h2>
          </div>
          <button type="button" className="admin-button admin-button--primary" onClick={() => setModalAtualizacao({ release: null })}>
            Nova versao
          </button>
        </header>

        <div className="admin-toolbar">
          <label className="admin-filter">
            Produto
            <select value={filtroProduto} onChange={(evento) => setFiltroProduto(evento.target.value)}>
              <option value="todos">Todos</option>
              <option value="painel-agencia">Painel da agencia</option>
              <option value="app-motorista">App do motorista</option>
            </select>
          </label>
          <button type="button" className="admin-button admin-button--secondary" onClick={carregarAtualizacoes} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar historico'}
          </button>
          <span className="admin-muted">As versoes abaixo estao salvas no backend e podem ser consultadas pelos apps.</span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Versao</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Changelog</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {releasesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-empty">
                    Nenhuma versao cadastrada.
                  </td>
                </tr>
              ) : (
                releasesFiltradas.map((release) => (
                  <tr key={release.id}>
                    <td data-label="Produto">{release.nomeProduto || nomeProdutoAtualizacao(release.produto)}</td>
                    <td data-label="Versao">{release.versao}</td>
                    <td data-label="Data">{formatarData(release.dataPublicacao || release.data)}</td>
                    <td data-label="Tipo">
                      <span className={`admin-status ${release.obrigatoria ? 'admin-status--pendente' : 'admin-status--ativa'}`}>
                        {release.obrigatoria ? 'Obrigatoria' : 'Opcional'}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`admin-status ${release.ativa === false ? 'admin-status--inativa' : 'admin-status--ativa'}`}>
                        {release.ativa === false ? 'Inativa' : 'Ativa'}
                      </span>
                    </td>
                    <td data-label="Changelog">{release.changelog}</td>
                    <td data-label="Acoes">
                      <div className="admin-row-actions">
                        <button type="button" className="admin-action admin-action--edit" onClick={() => setModalAtualizacao({ release })}>
                          Editar
                        </button>
                        <button type="button" className="admin-action admin-action--edit" onClick={() => copiarLink(release.linkDownload || release.link)}>
                          Copiar link
                        </button>
                        <button
                          type="button"
                          className="admin-action admin-action--ok"
                          disabled={!(release.linkDownload || release.link)}
                          onClick={() => window.open(release.linkDownload || release.link, '_blank', 'noopener,noreferrer')}
                        >
                          Baixar
                        </button>
                        {release.ativa !== false && (
                          <button type="button" className="admin-action admin-action--danger" onClick={() => inativarAtualizacao(release)}>
                            Inativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAtualizacao && (
        <ReleaseModal
          release={modalAtualizacao.release}
          salvando={salvando}
          onFechar={() => setModalAtualizacao(null)}
          onSalvar={(release) => salvarAtualizacao(release, modalAtualizacao.release)}
        />
      )}
    </div>
  );
}

function ReleaseModal({ release, salvando, onFechar, onSalvar }) {
  const [formulario, setFormulario] = useState(() => releaseParaFormulario(release));

  function atualizar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <ModalBase
      titulo={release ? 'Editar versao' : 'Nova versao'}
      subtitulo="Registro salvo no backend e consultado pelos apps"
      onFechar={onFechar}
    >
      <form
        className="admin-form admin-form--single"
        onSubmit={(evento) => {
          evento.preventDefault();
          onSalvar(formulario);
        }}
      >
        <label>
          Produto
          <select value={formulario.produto} onChange={(evento) => atualizar('produto', evento.target.value)}>
            <option value="painel-agencia">Painel da agencia</option>
            <option value="app-motorista">App do motorista</option>
          </select>
        </label>
        <label>
          Canal
          <input value={formulario.canal} onChange={(evento) => atualizar('canal', evento.target.value)} placeholder="main" />
        </label>
        <label>
          Versao
          <input value={formulario.versao} onChange={(evento) => atualizar('versao', evento.target.value)} placeholder="1.0.7" required />
        </label>
        <label>
          Data
          <input type="date" value={formulario.data} onChange={(evento) => atualizar('data', evento.target.value)} required />
        </label>
        <label>
          Link de download
          <input value={formulario.link} onChange={(evento) => atualizar('link', evento.target.value)} placeholder="https://storage..." />
        </label>
        <label>
          Changelog
          <textarea value={formulario.changelog} onChange={(evento) => atualizar('changelog', evento.target.value)} rows="5" required />
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={formulario.obrigatoria} onChange={(evento) => atualizar('obrigatoria', evento.target.checked)} />
          Atualizacao obrigatoria
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={formulario.ativa} onChange={(evento) => atualizar('ativa', evento.target.checked)} />
          Versao ativa
        </label>
        <footer className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="admin-button admin-button--primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar versao'}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}

function MonitoramentoPage({ agencias }) {
  const resumo = useMemo(() => calcularResumo(agencias), [agencias]);
  const rankingOnline = useMemo(
    () => [...agencias].sort((a, b) => Number(b.totalMotoristasOnline || 0) - Number(a.totalMotoristasOnline || 0)),
    [agencias]
  );
  const atividade = useMemo(() => ordenarPorAtividade(agencias), [agencias]);

  return (
    <div className="admin-content">
      <section className="admin-metrics">
        <MetricCard titulo="Agencias ativas" valor={resumo.ativas} detalhe={`${resumo.total} no total`} />
        <MetricCard titulo="Agencias suspensas" valor={resumo.suspensas} detalhe={`${resumo.pendentes} pendentes`} variante="warn" />
        <MetricCard titulo="Motoboys cadastrados" valor={resumo.motoristas} detalhe="Nao excluidos" variante="info" />
        <MetricCard titulo="Online simultaneo" valor={resumo.online} detalhe="Agora no backend" variante="ok" />
      </section>

      <section className="admin-grid admin-grid--two">
        <div className="admin-panel">
          <header className="admin-section-header">
            <div>
              <p className="admin-eyebrow">Tempo real</p>
              <h2>Ranking por online</h2>
            </div>
          </header>
          <TabelaRanking agencias={rankingOnline} metrica="totalMotoristasOnline" rotuloMetrica="Online" />
        </div>

        <div className="admin-panel">
          <header className="admin-section-header">
            <div>
              <p className="admin-eyebrow">Conexao</p>
              <h2>Ultima atividade por agencia</h2>
            </div>
          </header>
          <TabelaAtividade agencias={atividade} />
        </div>
      </section>
    </div>
  );
}

function TabelaRanking({ agencias, metrica, rotuloMetrica }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--compact">
        <thead>
          <tr>
            <th>Agencia</th>
            <th>Status</th>
            <th>{rotuloMetrica}</th>
          </tr>
        </thead>
        <tbody>
          {agencias.length === 0 ? (
            <tr>
              <td colSpan="3" className="admin-empty">Sem dados para exibir.</td>
            </tr>
          ) : (
            agencias.map((agencia) => {
              const status = statusAgencia(agencia);
              return (
                <tr key={agencia.id}>
                  <td data-label="Agencia">{agencia.nome}</td>
                  <td data-label="Status">
                    <span className={`admin-status admin-status--${status}`}>{rotuloStatus(status)}</span>
                  </td>
                  <td data-label={rotuloMetrica}>{agencia[metrica] || 0}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function TabelaAtividade({ agencias }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--compact">
        <thead>
          <tr>
            <th>Agencia</th>
            <th>Online</th>
            <th>Ultima atividade</th>
          </tr>
        </thead>
        <tbody>
          {agencias.length === 0 ? (
            <tr>
              <td colSpan="3" className="admin-empty">Sem atividade registrada.</td>
            </tr>
          ) : (
            agencias.map((agencia) => (
              <tr key={agencia.id}>
                <td data-label="Agencia">{agencia.nome}</td>
                <td data-label="Online">{agencia.totalMotoristasOnline || 0}</td>
                <td data-label="Ultima atividade">{formatarDataHora(agencia.ultimaAtividade)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfiguracoesPage({ apiStatus, adminKey, temChaveSalva, onApagarChaveSalva, onSair }) {
  return (
    <div className="admin-content">
      <section className="admin-panel">
        <header className="admin-section-header">
          <div>
            <p className="admin-eyebrow">Sistema</p>
            <h2>Configuracoes</h2>
          </div>
        </header>

        <div className="admin-settings-grid">
          <div className="admin-setting-row">
            <span>Backend</span>
            <strong>{API_BASE}</strong>
          </div>
          <div className="admin-setting-row">
            <span>Status da API</span>
            <strong>{apiStatus}</strong>
          </div>
          <div className="admin-setting-row">
            <span>Chave local</span>
            <strong>{temChaveSalva ? 'Salva neste computador' : adminKey ? 'Somente nesta sessao' : 'Nao salva'}</strong>
          </div>
        </div>

        <div className="admin-settings-actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={onApagarChaveSalva}>
            Apagar chave administrativa salva
          </button>
          <button type="button" className="admin-button admin-button--danger" onClick={onSair}>
            Encerrar sessao administrativa
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Admin() {
  const navegar = useNavigate();
  const { sucesso, erro: mostrarErro, aviso } = useFeedback();
  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem(ADMIN_KEY_STORAGE) || sessionStorage.getItem(ADMIN_SESSION_KEY_STORAGE) || ''
  );
  const [lembrarChave, setLembrarChave] = useState(
    () => !sessionStorage.getItem(ADMIN_SESSION_KEY_STORAGE)
  );
  const [temChaveSalva, setTemChaveSalva] = useState(() => Boolean(localStorage.getItem(ADMIN_KEY_STORAGE)));
  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [apiStatus, setApiStatus] = useState('verificando');
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(null);
  const [agencias, setAgencias] = useState([]);

  async function lerMensagemErro(resposta) {
    const texto = await resposta.text();

    try {
      const dados = texto ? JSON.parse(texto) : {};
      return dados.mensagem || dados.detalhe || texto;
    } catch {
      return texto || 'Erro inesperado.';
    }
  }

  function headersAdmin(chave = adminKey) {
    return {
      'Content-Type': 'application/json',
      'X-MIL-LIN-ADMIN-KEY': chave.trim()
    };
  }

  async function carregarAgencias(chave = adminKey, silencioso = false) {
    setCarregando(true);

    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/agencias`, {
        headers: headersAdmin(chave)
      });

      if (!resposta.ok) {
        setApiStatus('offline');
        if (!silencioso) mostrarErro(await lerMensagemErro(resposta));
        if (resposta.status === 401 || resposta.status === 500) setAutenticado(false);
        return;
      }

      const dados = await resposta.json();
      setAgencias(Array.isArray(dados) ? dados : []);
      setAutenticado(true);
      setApiStatus('online');
      setUltimaSincronizacao(new Date().toISOString());
    } catch (erro) {
      console.error('Erro ao carregar agencias:', erro);
      setApiStatus('offline');
      if (!silencioso) mostrarErro('Nao foi possivel conectar ao backend administrativo.');
    } finally {
      setCarregando(false);
    }
  }

  async function validarChave(chaveRecebida = adminKey, silencioso = false, deveLembrar = lembrarChave) {
    const chave = chaveRecebida.trim();

    if (!chave) {
      aviso('Informe a chave administrativa MIL-LIN.');
      return;
    }

    setVerificando(true);
    setApiStatus('verificando');

    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/validar-chave`, {
        method: 'POST',
        headers: headersAdmin(chave)
      });

      if (!resposta.ok) {
        setApiStatus('offline');
        if (!silencioso) mostrarErro(await lerMensagemErro(resposta));
        setAutenticado(false);
        return;
      }

      if (deveLembrar) {
        localStorage.setItem(ADMIN_KEY_STORAGE, chave);
        sessionStorage.removeItem(ADMIN_SESSION_KEY_STORAGE);
        setTemChaveSalva(true);
      } else {
        localStorage.removeItem(ADMIN_KEY_STORAGE);
        sessionStorage.setItem(ADMIN_SESSION_KEY_STORAGE, chave);
        setTemChaveSalva(false);
      }

      setAdminKey(chave);
      setAutenticado(true);
      setApiStatus('online');
      if (!silencioso) sucesso('Acesso administrativo liberado.');
      await carregarAgencias(chave, silencioso);
      navegar('/admin/dashboard', { replace: true });
    } catch (erro) {
      console.error('Erro ao validar chave administrativa:', erro);
      setApiStatus('offline');
      if (!silencioso) mostrarErro('Nao foi possivel validar a chave no backend.');
    } finally {
      setVerificando(false);
    }
  }

  useEffect(() => {
    const chaveSalva = localStorage.getItem(ADMIN_KEY_STORAGE);
    const chaveSessao = sessionStorage.getItem(ADMIN_SESSION_KEY_STORAGE);

    if (chaveSalva) {
      setLembrarChave(true);
      setTemChaveSalva(true);
      validarChave(chaveSalva, true, true);
      return;
    }

    if (chaveSessao) {
      setLembrarChave(false);
      setTemChaveSalva(false);
      validarChave(chaveSessao, true, false);
    }
    // Restauracao inicial da sessao administrativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarAgencia(formulario, agenciaEditando) {
    if (!formulario.nomeAgencia.trim() || !formulario.telefone.trim()) {
      aviso('Informe nome e telefone da agencia.');
      return;
    }

    if (!agenciaEditando && !formulario.senha.trim()) {
      aviso('Informe uma senha inicial para a nova agencia.');
      return;
    }

    setSalvando(true);

    const editando = Boolean(agenciaEditando);
    const url = editando
      ? `${API_BASE}/api/Autenticacao/admin/agencias/${agenciaEditando.id}`
      : `${API_BASE}/api/Autenticacao/admin/agencias`;

    try {
      const resposta = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: headersAdmin(),
        body: JSON.stringify(montarPayloadAgencia(formulario))
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErro(resposta));
        return;
      }

      sucesso(editando ? 'Agencia atualizada com sucesso.' : 'Agencia cadastrada com sucesso.');
      await carregarAgencias();
    } catch (erro) {
      console.error('Erro ao salvar agencia:', erro);
      mostrarErro('Erro de conexao ao salvar agencia.');
    } finally {
      setSalvando(false);
    }
  }

  async function suspenderAgencia(agencia, motivo) {
    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/agencias/${agencia.id}/suspender`, {
        method: 'POST',
        headers: headersAdmin(),
        body: JSON.stringify({ motivo: motivo || 'Suspensao administrativa pelo painel MIL-LIN.' })
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErro(resposta));
        return;
      }

      sucesso('Agencia suspensa com sucesso.');
      await carregarAgencias();
    } catch (erro) {
      console.error('Erro ao suspender agencia:', erro);
      mostrarErro('Erro de conexao ao suspender agencia.');
    }
  }

  async function reativarAgencia(agencia) {
    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/agencias/${agencia.id}/reativar`, {
        method: 'POST',
        headers: headersAdmin(),
        body: JSON.stringify({ planoAssinatura: agencia.planoAssinatura || 'Profissional' })
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErro(resposta));
        return;
      }

      sucesso('Agencia reativada com sucesso.');
      await carregarAgencias();
    } catch (erro) {
      console.error('Erro ao reativar agencia:', erro);
      mostrarErro('Erro de conexao ao reativar agencia.');
    }
  }

  async function excluirAgencia(agencia) {
    try {
      const resposta = await fetch(`${API_BASE}/api/Autenticacao/admin/agencias/${agencia.id}`, {
        method: 'DELETE',
        headers: headersAdmin(),
        body: JSON.stringify({ confirmacao: 'DELETAR' })
      });

      if (!resposta.ok) {
        mostrarErro(await lerMensagemErro(resposta));
        return;
      }

      sucesso('Agencia excluida definitivamente.');
      await carregarAgencias();
    } catch (erro) {
      console.error('Erro ao excluir agencia:', erro);
      mostrarErro('Erro de conexao ao excluir agencia.');
    }
  }

  function sairAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY_STORAGE);
    const chaveSalva = localStorage.getItem(ADMIN_KEY_STORAGE) || '';
    setAdminKey(chaveSalva);
    setAutenticado(false);
    setAgencias([]);
    setTemChaveSalva(Boolean(chaveSalva));
    setLembrarChave(true);
    navegar('/admin/login', { replace: true });
  }

  function apagarChaveSalva() {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    sessionStorage.removeItem(ADMIN_SESSION_KEY_STORAGE);
    setAdminKey('');
    setAutenticado(false);
    setAgencias([]);
    setTemChaveSalva(false);
    setLembrarChave(true);
    aviso('Chave administrativa removida deste computador.');
    navegar('/admin/login', { replace: true });
  }

  if (!autenticado) {
    return (
      <AdminLogin
        adminKey={adminKey}
        setAdminKey={setAdminKey}
        verificando={verificando}
        lembrarChave={lembrarChave}
        setLembrarChave={setLembrarChave}
        temChaveSalva={temChaveSalva}
        onEntrar={() => validarChave(adminKey, false, lembrarChave)}
        onApagarChaveSalva={apagarChaveSalva}
      />
    );
  }

  return (
    <AdminShell
      apiStatus={apiStatus}
      ultimaSincronizacao={ultimaSincronizacao}
      onAtualizar={() => carregarAgencias()}
      onSair={sairAdmin}
    >
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="login" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage agencias={agencias} />} />
        <Route
          path="agencias"
          element={
            <AgenciasPage
              agencias={agencias}
              carregando={carregando}
              salvando={salvando}
              onAtualizar={() => carregarAgencias()}
              onSalvar={salvarAgencia}
              onSuspender={suspenderAgencia}
              onReativar={reativarAgencia}
              onExcluir={excluirAgencia}
            />
          }
        />
        <Route path="atualizacoes" element={<AtualizacoesPage adminKey={adminKey} sucesso={sucesso} aviso={aviso} mostrarErro={mostrarErro} />} />
        <Route path="monitoramento" element={<MonitoramentoPage agencias={agencias} />} />
        <Route
          path="configuracoes"
          element={
            <ConfiguracoesPage
              apiStatus={apiStatus}
              adminKey={adminKey}
              temChaveSalva={temChaveSalva}
              onApagarChaveSalva={apagarChaveSalva}
              onSair={sairAdmin}
            />
          }
        />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </AdminShell>
  );
}
