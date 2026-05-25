import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../Components/Navbar';
import { useFeedback } from '../../Components/Feedback/useFeedback';
import './Painel.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

const SECOES_OPERAR = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'nova-corrida', label: 'Nova corrida' },
  { id: 'radar', label: 'Corridas' }
];

function obterDataHojeInput() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function normalizarStatusParaClasse(status) {
  return String(status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

function aplicarTemaAgencia() {
  const corPrimaria = localStorage.getItem('corAgenciaPrimaria') || '#111827';
  const corSecundaria = localStorage.getItem('corAgenciaSecundaria') || '#38bdf8';
  const corFonteCabecalho = localStorage.getItem('corFonteCabecalhoAgencia') || '#ffffff';

  document.documentElement.style.setProperty('--cor-agencia', corPrimaria);
  document.documentElement.style.setProperty('--cor-agencia-secundaria', corSecundaria);
  document.documentElement.style.setProperty('--cor-fonte-cabecalho', corFonteCabecalho);
}

export default function Painel() {
  const { sucesso, erro: mostrarErro, aviso, confirmar } = useFeedback();
  const [nomeAgencia, setNomeAgencia] = useState('');
  const [dadosResumo, setDadosResumo] = useState(null);
  const navegar = useNavigate();

  const [frota, setFrota] = useState([]);
  const [corridasAtivas, setCorridasAtivas] = useState([]);
  const [dataFiltroRadar, setDataFiltroRadar] = useState(obterDataHojeInput());

  const [telPassageiro, setTelPassageiro] = useState('');
  const [nomePassageiro, setNomePassageiro] = useState('');
  const [endBusca, setEndBusca] = useState('');
  const [endDestino, setEndDestino] = useState('');
  const [tipoValor, setTipoValor] = useState('7');
  const [valorPersonalizado, setValorPersonalizado] = useState('');
  const [motoristaExclusivoId, setMotoristaExclusivoId] = useState('');
  const [enviandoCorrida, setEnviandoCorrida] = useState(false);
  const [cancelandoCorridaId, setCancelandoCorridaId] = useState(null);
  const [secaoOperarAtiva, setSecaoOperarAtiva] = useState('nova-corrida');

  const valorCorrida = useMemo(() => {
    if (tipoValor === 'custom') {
      const valorConvertido = Number(String(valorPersonalizado).replace(',', '.'));
      return Number.isFinite(valorConvertido) ? valorConvertido : 0;
    }

    return Number(tipoValor);
  }, [tipoValor, valorPersonalizado]);

  const buscarTudo = useCallback(async () => {
    const tokenSalvo = localStorage.getItem('tokenAgencia');
    if (!tokenSalvo) {
      navegar('/login');
      return;
    }

    try {
      const resResumo = await fetch(`${API_BASE}/api/Agencia/resumo`, {
        headers: { Authorization: `Bearer ${tokenSalvo}` }
      });
      if (resResumo.ok) setDadosResumo(await resResumo.json());

      const resFrota = await fetch(`${API_BASE}/api/Motorista/listar`, {
        headers: { Authorization: `Bearer ${tokenSalvo}` }
      });
      if (resFrota.ok) setFrota(await resFrota.json());

      const [ano, mes, dia] = dataFiltroRadar.split('-');
      const urlCorridas = `${API_BASE}/api/Corrida/listar-hoje?dia=${Number(dia)}&mes=${Number(mes)}&ano=${Number(ano)}`;

      const resCorridas = await fetch(urlCorridas, {
        headers: { Authorization: `Bearer ${tokenSalvo}` }
      });
      if (resCorridas.ok) setCorridasAtivas(await resCorridas.json());
    } catch (erro) {
      console.error('Erro ao buscar dados do painel:', erro);
    }
  }, [dataFiltroRadar, navegar]);

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('nomeAgencia');
    const tokenSalvo = localStorage.getItem('tokenAgencia');

    if (!tokenSalvo) {
      navegar('/login');
      return;
    }

    aplicarTemaAgencia();
    setNomeAgencia(nomeSalvo || 'Agência');
    buscarTudo();

    const intervalo = setInterval(buscarTudo, 5000);
    return () => clearInterval(intervalo);
  }, [buscarTudo, navegar]);

  const limparFormularioCorrida = () => {
    setTelPassageiro('');
    setNomePassageiro('');
    setEndBusca('');
    setEndDestino('');
    setTipoValor('7');
    setValorPersonalizado('');
    setMotoristaExclusivoId('');
  };

  const handleDespacharCorrida = async (e) => {
    e.preventDefault();

    if (valorCorrida <= 0) {
      aviso('Informe um valor válido para a corrida.', 'Valor inválido');
      return;
    }

    const token = localStorage.getItem('tokenAgencia');
    const motoristaSelecionado = frota.find((m) => String(m.id) === String(motoristaExclusivoId));

    setEnviandoCorrida(true);

    try {
      const resposta = await fetch(`${API_BASE}/api/Corrida/nova`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          telefonePassageiro: telPassageiro,
          nomePassageiro,
          enderecoBusca: endBusca,
          enderecoDestino: endDestino,
          valorDaCorrida: valorCorrida,
          motoristaExclusivoId: motoristaExclusivoId ? Number(motoristaExclusivoId) : null
        })
      });

      const textoResposta = await resposta.text();

      if (!resposta.ok) {
        let mensagemErro = textoResposta;
        try {
          mensagemErro = JSON.parse(textoResposta).mensagem || mensagemErro;
        } catch {
          mensagemErro = mensagemErro || 'Não foi possível despachar a corrida.';
        }
        mostrarErro(mensagemErro || 'Não foi possível despachar a corrida.', 'Erro ao despachar corrida');
        return;
      }

      
      sucesso(
        motoristaSelecionado
          ? 'Corrida direcionada com sucesso.'
          : 'Corrida despachada com sucesso.'
      );

      limparFormularioCorrida();
      buscarTudo();
    } catch (erro) {
      console.error('Erro ao despachar corrida:', erro);
      mostrarErro('Erro de conexão ao despachar corrida.');
    } finally {
      setEnviandoCorrida(false);
    }
  };

  const handleCancelarCorrida = async (corrida) => {
    if (!corrida || corrida.status === 'Concluída' || corrida.status === 'Cancelada') return;

    const confirmou = await confirmar({
      titulo: 'Cancelar corrida',
      mensagem: `Tem certeza que deseja cancelar a corrida do passageiro ${corrida.passageiro}?`,
      textoConfirmar: 'Cancelar corrida',
      tipo: 'perigo'
    });

    if (!confirmou) return;

    const token = localStorage.getItem('tokenAgencia');
    setCancelandoCorridaId(corrida.id);

    try {
      const resposta = await fetch(`${API_BASE}/api/Corrida/cancelar/${corrida.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const textoResposta = await resposta.text();

      if (!resposta.ok) {
        let mensagemErro = textoResposta;
        try {
          mensagemErro = JSON.parse(textoResposta).mensagem || mensagemErro;
        } catch {
          mensagemErro = mensagemErro || 'Não foi possível cancelar a corrida.';
        }
        mostrarErro(mensagemErro || 'Não foi possível cancelar a corrida.', 'Erro ao cancelar corrida');
        return;
      }

      sucesso('Corrida cancelada com sucesso.');
      buscarTudo();
    } catch (erro) {
      console.error('Erro ao cancelar corrida:', erro);
      mostrarErro('Erro de conexão ao cancelar corrida.');
    } finally {
      setCancelandoCorridaId(null);
    }
  };

  const qtdEmAndamento = corridasAtivas.filter((c) => c.status === 'Em Andamento').length;
  const qtdConcluidas = corridasAtivas.filter((c) => c.status === 'Concluída').length;
  const qtdPendentes = corridasAtivas.filter((c) => c.status === 'Pendente').length;
  const qtdCanceladas = corridasAtivas.filter((c) => c.status === 'Cancelada').length;
  const motoristasDisponiveisParaDirecionar = frota.filter((m) => !m.suspenso);

  return (
    <div className="painel-fundo">
      <Navbar nomeAgencia={nomeAgencia} />

      <main className="painel-conteudo">
        <div className="painel-abas-operar" role="tablist" aria-label="Seções da operação">
          {SECOES_OPERAR.map((secao) => (
            <button
              key={secao.id}
              type="button"
              className={`painel-aba-operar ${secaoOperarAtiva === secao.id ? 'painel-aba-operar--ativa' : ''}`}
              onClick={() => setSecaoOperarAtiva(secao.id)}
              role="tab"
              aria-selected={secaoOperarAtiva === secao.id}
            >
              {secao.label}
            </button>
          ))}
        </div>

        <div className={`cartao-informativo cartao-resumo painel-secao-operar ${secaoOperarAtiva === 'resumo' ? 'painel-secao-operar--ativa' : ''}`}>
          <h3 className="label-valor">Resumo da Operação</h3>
          {dadosResumo ? (
            <ul className="lista-resumo">
              <li className="item-resumo"><span>Online:</span> <strong>{dadosResumo.online ?? dadosResumo.ativos ?? 0}</strong></li>
              <li className="item-resumo"><span>Total da Frota:</span> <strong>{dadosResumo.totalMotoristas ?? frota.length}</strong></li>
              <li className="item-resumo"><span>Corridas no filtro:</span> <strong>{corridasAtivas.length}</strong></li>
              <li className="item-resumo texto-laranja"><span>Pendentes:</span> <strong>{qtdPendentes}</strong></li>
              <li className="item-resumo texto-azul"><span>Em Andamento:</span> <strong>{qtdEmAndamento}</strong></li>
              <li className="item-resumo texto-verde"><span>Concluídas:</span> <strong>{qtdConcluidas}</strong></li>
              <li className="item-resumo texto-vermelho"><span>Canceladas:</span> <strong>{qtdCanceladas}</strong></li>
            </ul>
          ) : (
            <p>CARREGANDO...</p>
          )}
        </div>

        <div className={`cartao-informativo cartao-nova-corrida painel-secao-operar ${secaoOperarAtiva === 'nova-corrida' ? 'painel-secao-operar--ativa' : ''}`}>
          <h3 className="titulo-verde">🚀 Nova Corrida</h3>
          <form onSubmit={handleDespacharCorrida} className="formulario-corrida">
            <div className="grupo-inputs-duplo">
              <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="Telefone" value={telPassageiro} onChange={(e) => setTelPassageiro(e.target.value)} required className="input-pequeno" />
              <input type="text" placeholder="Nome do Passageiro" value={nomePassageiro} onChange={(e) => setNomePassageiro(e.target.value)} required className="input-grande" />
            </div>

            <input type="text" placeholder="Endereço de Busca" value={endBusca} onChange={(e) => setEndBusca(e.target.value)} required className="input-padrao" />
            <input type="text" placeholder="Destino" value={endDestino} onChange={(e) => setEndDestino(e.target.value)} required className="input-padrao" />

            <div className="grupo-radio-valor grupo-radio-valor-expandido">
              <span className="label-valor">Valor:</span>
              <label className="opcao-radio"><input type="radio" value="7" checked={tipoValor === '7'} onChange={() => setTipoValor('7')} /> R$ 7,00</label>
              <label className="opcao-radio"><input type="radio" value="12" checked={tipoValor === '12'} onChange={() => setTipoValor('12')} /> R$ 12,00</label>
              <label className="opcao-radio"><input type="radio" value="custom" checked={tipoValor === 'custom'} onChange={() => setTipoValor('custom')} /> Outro valor</label>
              {tipoValor === 'custom' && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 15,00"
                  value={valorPersonalizado}
                  onChange={(e) => setValorPersonalizado(e.target.value)}
                  className="input-valor-personalizado"
                  required
                />
              )}
            </div>

            <div className="grupo-direcionamento">
              <label className="label-valor" htmlFor="motoristaExclusivo">Direcionar corrida:</label>
              <select
                id="motoristaExclusivo"
                value={motoristaExclusivoId}
                onChange={(e) => setMotoristaExclusivoId(e.target.value)}
                className="select-padrao"
              >
                <option value="">Todos os motoristas disponíveis</option>
                {motoristasDisponiveisParaDirecionar.map((motorista) => (
                  <option key={motorista.id} value={motorista.id}>
                    {motorista.nome} - {motorista.placaMoto}{motorista.online ? ' (online)' : ' (offline)'}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="botao-despachar" disabled={enviandoCorrida}>
              {enviandoCorrida ? 'DESPACHANDO...' : 'DESPACHAR'}
            </button>
          </form>
        </div>

        <div className={`cartao-informativo cartao-radar painel-secao-operar ${secaoOperarAtiva === 'radar' ? 'painel-secao-operar--ativa' : ''}`}>
          <div className="cabecalho-radar-painel">
            <h3 className="titulo-azul">Corridas</h3>
            <div className="filtro-data-radar">
              <label htmlFor="dataRadar">Filtrar data:</label>
              <input
                id="dataRadar"
                type="date"
                value={dataFiltroRadar}
                onChange={(e) => setDataFiltroRadar(e.target.value)}
                className="input-data-radar"
              />
            </div>
          </div>

          {corridasAtivas.length === 0 ? (
            <p className="texto-vazio">Nenhuma corrida registrada nesta data.</p>
          ) : (
            <table className="tabela-radar">
              <thead>
                <tr>
                  <th>Passageiro</th>
                  <th>Trajeto</th>
                  <th>Valor</th>
                  <th>Motorista</th>
                  <th>Status / Ação</th>
                </tr>
              </thead>
              <tbody>
                {corridasAtivas.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Passageiro"><strong>{c.passageiro}</strong></td>
                    <td data-label="Trajeto" className="celula-trajeto">De: {c.busca}<br />Para: {c.destino}</td>
                    <td data-label="Valor" className="celula-valor">R$ {Number(c.valor).toFixed(2)}</td>
                    <td data-label="Motorista">
                      <span className={c.motorista === 'Buscando motorista...' || c.motorista === 'Buscando...' ? 'motorista-buscando' : 'motorista-encontrado'}>
                        {c.motorista === 'Buscando motorista...' || c.motorista === 'Buscando...'
                          ? `${c.motoristaExclusivoId ? ' ' : ' '}${c.motorista}`
                          : `🏍️ ${c.motorista}`}
                      </span>
                    </td>
                    <td data-label="Status / Ação" className="celula-status-acao">
                      <div className="radar-status-acoes">
                        <span className={`badge-status status-${normalizarStatusParaClasse(c.status)}`}>
                          {c.status}
                        </span>

                        {c.status !== 'Concluída' && c.status !== 'Cancelada' && (
                          <button
                            type="button"
                            className="botao-cancelar-corrida"
                            onClick={() => handleCancelarCorrida(c)}
                            disabled={cancelandoCorridaId === c.id}
                          >
                            {cancelandoCorridaId === c.id ? 'Cancelando...' : 'Cancelar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
