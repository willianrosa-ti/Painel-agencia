import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../Components/Navbar';
import './Painel.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

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

  document.documentElement.style.setProperty('--cor-agencia', corPrimaria);
  document.documentElement.style.setProperty('--cor-agencia-secundaria', corSecundaria);
}

export default function Painel() {
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

    setNomeAgencia(nomeSalvo || '');
    aplicarTemaAgencia();
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
      alert('Informe um valor válido para a corrida.');
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
        } catch {}
        alert(`Erro ao despachar corrida: ${mensagemErro}`);
        return;
      }

      const textoWhatsApp = `🏍️ *NOVA CORRIDA*\n*Passageiro:* ${nomePassageiro}\n*Buscar em:* ${endBusca}\n*Levar para:* ${endDestino}\n*Valor:* R$ ${valorCorrida.toFixed(2)}${motoristaSelecionado ? `\n*Direcionada para:* ${motoristaSelecionado.nome}` : ''}`;
      const linkWhatsApp = `https://web.whatsapp.com/send?text=${encodeURIComponent(textoWhatsApp)}`;
      window.open(linkWhatsApp, 'aba_do_WhatsApp');

      alert(motoristaSelecionado ? '🚀 Corrida direcionada com sucesso!' : '🚀 Corrida despachada com sucesso!');

      limparFormularioCorrida();
      buscarTudo();
    } catch (erro) {
      console.error('Erro ao despachar corrida:', erro);
      alert('Erro de conexão ao despachar corrida.');
    } finally {
      setEnviandoCorrida(false);
    }
  };

  const qtdEmAndamento = corridasAtivas.filter((c) => c.status === 'Em Andamento').length;
  const qtdConcluidas = corridasAtivas.filter((c) => c.status === 'Concluída').length;
  const qtdPendentes = corridasAtivas.filter((c) => c.status === 'Pendente').length;
  const motoristasDisponiveisParaDirecionar = frota.filter((m) => !m.suspenso);

  return (
    <div className="painel-fundo">
      <Navbar nomeAgencia={nomeAgencia} />

      <main className="painel-conteudo">
        <div className="cartao-informativo cartao-resumo">
          <h3 className="label-valor">Resumo da Operação</h3>
          {dadosResumo ? (
            <ul className="lista-resumo">
              <li className="item-resumo"><span>Online:</span> <strong>{dadosResumo.online ?? dadosResumo.ativos ?? 0}</strong></li>
              <li className="item-resumo"><span>Total da Frota:</span> <strong>{dadosResumo.totalMotoristas ?? frota.length}</strong></li>
              <li className="item-resumo"><span>Corridas no filtro:</span> <strong>{corridasAtivas.length}</strong></li>
              <li className="item-resumo texto-laranja"><span>Pendentes:</span> <strong>{qtdPendentes}</strong></li>
              <li className="item-resumo texto-azul"><span>Em Andamento:</span> <strong>{qtdEmAndamento}</strong></li>
              <li className="item-resumo texto-verde"><span>Concluídas:</span> <strong>{qtdConcluidas}</strong></li>
            </ul>
          ) : (
            <p>CARREGANDO...</p>
          )}
        </div>

        <div className="cartao-informativo cartao-nova-corrida">
          <h3 className="titulo-verde">🚀 Nova Corrida</h3>
          <form onSubmit={handleDespacharCorrida} className="formulario-corrida">
            <div className="grupo-inputs-duplo">
              <input type="text" placeholder="Telefone" value={telPassageiro} onChange={(e) => setTelPassageiro(e.target.value)} required className="input-pequeno" />
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

        <div className="cartao-informativo cartao-radar">
          <div className="cabecalho-radar-painel">
            <h3 className="titulo-azul">📡 Radar de Corridas</h3>
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {corridasAtivas.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.passageiro}</strong></td>
                    <td className="celula-trajeto">De: {c.busca}<br />Para: {c.destino}</td>
                    <td className="celula-valor">R$ {Number(c.valor).toFixed(2)}</td>
                    <td>
                      <span className={c.motorista === 'Buscando motorista...' || c.motorista === 'Buscando...' ? 'motorista-buscando' : 'motorista-encontrado'}>
                        {c.motorista === 'Buscando motorista...' || c.motorista === 'Buscando...'
                          ? `${c.motoristaExclusivoId ? ' ' : ' '}${c.motorista}`
                          : `🏍️ ${c.motorista}`}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-status status-${normalizarStatusParaClasse(c.status)}`}>
                        {c.status}
                      </span>
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
