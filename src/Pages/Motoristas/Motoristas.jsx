import { useEffect, useState } from 'react';
import Navbar from '../../Components/Navbar';
import { useFeedback } from '../../Components/Feedback/useFeedback';
import './Motoristas.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

function aplicarTemaAgencia() {
  const corPrimaria = localStorage.getItem('corAgenciaPrimaria') || '#111827';
  const corSecundaria = localStorage.getItem('corAgenciaSecundaria') || '#38bdf8';
  const corFonteCabecalho = localStorage.getItem('corFonteCabecalhoAgencia') || '#ffffff';

  document.documentElement.style.setProperty('--cor-agencia', corPrimaria);
  document.documentElement.style.setProperty('--cor-agencia-secundaria', corSecundaria);
  document.documentElement.style.setProperty('--cor-fonte-cabecalho', corFonteCabecalho);
}

function formatarMoeda(valor) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero.toFixed(2).replace('.', ',') : '0,00';
}

function sanitizarValorDiaria(valor) {
  return valor.replace(/[^\d,.]/g, '');
}

function converterValorDiaria(valor) {
  const texto = String(valor).trim();
  if (!texto) return NaN;

  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto;

  return Number(normalizado);
}

export default function Motoristas() {
  const { sucesso, erro: mostrarErro, aviso, confirmar } = useFeedback();
  const [frota, setFrota] = useState([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placa, setPlaca] = useState('');
  const [valorDiaria, setValorDiaria] = useState('20,00');
  const [senha, setSenha] = useState('');
  const [motoristaEditando, setMotoristaEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const nomeAgencia = localStorage.getItem('nomeAgencia');

  const buscarFrota = async () => {
    const token = localStorage.getItem('tokenAgencia');
    try {
      const res = await fetch(`${API_BASE}/api/Motorista/listar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setFrota(await res.json());
    } catch (erro) {
      console.error('Erro ao buscar frota:', erro);
    }
  };

  useEffect(() => {
    aplicarTemaAgencia();
    buscarFrota();
  }, []);

  const limparFormulario = () => {
    setNome('');
    setTelefone('');
    setPlaca('');
    setValorDiaria('20,00');
    setSenha('');
    setMotoristaEditando(null);
  };

  const lerMensagemErro = async (res) => {
    const texto = await res.text();
    try {
      const json = JSON.parse(texto);
      return json.mensagem || texto;
    } catch {
      return texto || 'Erro inesperado.';
    }
  };

  const handleCadastrarOuEditar = async (e) => {
    e.preventDefault();

    if (!motoristaEditando && !senha.trim()) {
      aviso('Informe uma senha para o novo motorista.', 'Campo obrigatório');
      return;
    }

    const valorDiariaNumerico = converterValorDiaria(valorDiaria);

    if (!Number.isFinite(valorDiariaNumerico) || valorDiariaNumerico <= 0) {
      aviso('Informe uma diária válida para o motorista.', 'Valor inválido');
      return;
    }

    const token = localStorage.getItem('tokenAgencia');
    const editando = Boolean(motoristaEditando);
    const url = editando
      ? `${API_BASE}/api/Motorista/editar/${motoristaEditando.id}`
      : `${API_BASE}/api/Motorista/cadastrar`;

    setSalvando(true);

    try {
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nome,
          telefone,
          placaMoto: placa,
          valorDiaria: valorDiariaNumerico,
          senha: senha.trim() || null
        })
      });

      if (!res.ok) {
        mostrarErro(await lerMensagemErro(res));
        return;
      }

      sucesso(editando ? 'Motorista atualizado com sucesso.' : 'Motorista adicionado com sucesso.');
      limparFormulario();
      buscarFrota();
    } catch (erro) {
      console.error('Erro ao salvar motorista:', erro);
      mostrarErro('Erro de conexão ao salvar motorista.');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (motorista) => {
    setMotoristaEditando(motorista);
    setNome(motorista.nome || '');
    setTelefone(motorista.telefone || '');
    setPlaca(motorista.placaMoto || '');
    setValorDiaria(formatarMoeda(motorista.valorDiaria ?? 20));
    setSenha('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alterarSuspensao = async (motorista) => {
    const novoStatusSuspenso = !motorista.suspenso;
    const confirmou = await confirmar({
      titulo: novoStatusSuspenso ? 'Suspender motorista' : 'Reativar motorista',
      mensagem: novoStatusSuspenso
        ? `Suspender ${motorista.nome}? Ele não conseguirá entrar no app nem receber corridas.`
        : `Reativar ${motorista.nome}? Ele voltará a poder usar o app.`,
      textoConfirmar: novoStatusSuspenso ? 'Suspender' : 'Reativar',
      tipo: novoStatusSuspenso ? 'perigo' : 'padrao'
    });

    if (!confirmou) return;

    const token = localStorage.getItem('tokenAgencia');

    try {
      const res = await fetch(`${API_BASE}/api/Motorista/suspender/${motorista.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(novoStatusSuspenso)
      });

      if (!res.ok) {
        mostrarErro(await lerMensagemErro(res));
        return;
      }

      sucesso(
        novoStatusSuspenso
          ? 'Motorista suspenso com sucesso.'
          : 'Motorista reativado com sucesso.'
      );
      buscarFrota();
    } catch (erro) {
      console.error('Erro ao alterar suspensão:', erro);
      mostrarErro('Erro de conexão ao alterar status do motorista.');
    }
  };

  const excluirMotorista = async (motorista) => {
    const confirmou = await confirmar({
      titulo: 'Excluir motorista',
      mensagem: `Excluir ${motorista.nome} da frota? O histórico financeiro e de corridas será preservado, mas ele não aparecerá mais no painel nem conseguirá acessar o app.`,
      textoConfirmar: 'Excluir',
      tipo: 'perigo'
    });

    if (!confirmou) return;

    const token = localStorage.getItem('tokenAgencia');

    try {
      const res = await fetch(`${API_BASE}/api/Motorista/excluir/${motorista.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        mostrarErro(await lerMensagemErro(res));
        return;
      }

      if (motoristaEditando?.id === motorista.id) limparFormulario();
      sucesso('Motorista excluído com sucesso.');
      buscarFrota();
    } catch (erro) {
      console.error('Erro ao excluir motorista:', erro);
      mostrarErro('Erro de conexão ao excluir motorista.');
    }
  };

  return (
    <div>
      <Navbar nomeAgencia={nomeAgencia} />
      <div className="motoristas-container">
        <h2 className="motoristas-titulo">📋 Gestão da Frota ({frota.length} motoristas)</h2>

        <div className="cartao-adicionar-motorista">
          <div className="cabecalho-form-motorista">
            <h3>{motoristaEditando ? `✏️ Editando: ${motoristaEditando.nome}` : '➕ Adicionar Novo Motorista'}</h3>
            {motoristaEditando && (
              <button type="button" className="botao-cancelar-edicao" onClick={limparFormulario}>Cancelar edição</button>
            )}
          </div>

          <form onSubmit={handleCadastrarOuEditar} className="formulario-motorista">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="input-motorista" />
            <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} required className="input-motorista" />
            <input type="text" placeholder="Placa da Moto" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} required className="input-motorista" />
            <input type="text" inputMode="decimal" placeholder="Diária (R$)" value={valorDiaria} onChange={(e) => setValorDiaria(sanitizarValorDiaria(e.target.value))} required className="input-motorista input-motorista-valor" />
            <input
              type="password"
              placeholder={motoristaEditando ? 'Nova senha (opcional)' : 'Senha para o App'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required={!motoristaEditando}
              className="input-motorista"
            />

            <button type="submit" className="botao-cadastrar-motorista" disabled={salvando}>
              {salvando ? 'Salvando...' : motoristaEditando ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </form>
        </div>

        <table className="tabela-motoristas">
          <thead className="cabecalho-tabela">
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Placa</th>
              <th>Diária</th>
              <th>Status</th>
              <th>Online</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {frota.length === 0 ? (
              <tr>
                <td colSpan="8" className="celula-vazia">Nenhum motorista cadastrado.</td>
              </tr>
            ) : (
              frota.map((m) => (
                <tr key={m.id} className="linha-tabela-motorista">
                  <td data-label="ID" className="celula-id">#{m.id}</td>
                  <td data-label="Nome">{m.nome}</td>
                  <td data-label="Telefone">{m.telefone}</td>
                  <td data-label="Placa">{m.placaMoto}</td>
                  <td data-label="Diária">R$ {formatarMoeda(m.valorDiaria ?? 20)}</td>
                  <td data-label="Status">
                    {m.suspenso ? (
                      <span className="status-motorista-suspenso">● Suspenso</span>
                    ) : (
                      <span className="status-motorista-ativo">● Ativo</span>
                    )}
                  </td>
                  <td data-label="Online">
                    {m.online ? (
                      <span className="status-motorista-online">● Online</span>
                    ) : (
                      <span className="status-motorista-offline">● Offline</span>
                    )}
                  </td>
                  <td data-label="Ações">
                    <div className="acoes-motorista">
                      <button type="button" className="botao-acao editar" onClick={() => iniciarEdicao(m)}>Editar</button>
                      <button type="button" className={m.suspenso ? 'botao-acao reativar' : 'botao-acao suspender'} onClick={() => alterarSuspensao(m)}>
                        {m.suspenso ? 'Reativar' : 'Suspender'}
                      </button>
                      <button type="button" className="botao-acao excluir" onClick={() => excluirMotorista(m)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
