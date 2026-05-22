import { useEffect, useMemo, useState } from 'react';
import Navbar from '../../Components/Navbar';
import './Financeiro.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

const mesesDoAno = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const ehCorridaCancelada = (corrida) => {
  return String(corrida?.status || '').trim().toLowerCase() === 'cancelada';
};

const adicionarDias = (data, quantidadeDias) => {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + quantidadeDias);
  return novaData;
};

const obterDatasDoPeriodo = (periodo, mesSelecionado, anoSelecionado) => {
  const hoje = new Date();
  const datas = [];

  if (periodo === 'Mensal') {
    const ultimoDiaDoMes = new Date(anoSelecionado, mesSelecionado, 0).getDate();

    for (let dia = 1; dia <= ultimoDiaDoMes; dia += 1) {
      datas.push(new Date(anoSelecionado, mesSelecionado - 1, dia));
    }

    return datas;
  }

  if (periodo === 'Semanal') {
    const dataInicio = adicionarDias(hoje, -7);

    for (let i = 0; i <= 7; i += 1) {
      datas.push(adicionarDias(dataInicio, i));
    }

    return datas;
  }

  return [hoje];
};

const buscarCorridasPorData = async (token, data) => {
  const dia = data.getDate();
  const mes = data.getMonth() + 1;
  const ano = data.getFullYear();

  const resposta = await fetch(`${API_BASE}/api/Corrida/listar-hoje?dia=${dia}&mes=${mes}&ano=${ano}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!resposta.ok) return [];

  return await resposta.json();
};

const montarRanking = (itens, obterNome) => {
  const mapa = new Map();

  itens.forEach((item) => {
    const nome = obterNome(item);

    if (!nome) return;

    mapa.set(nome, (mapa.get(nome) || 0) + 1);
  });

  return Array.from(mapa.entries())
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);
};

const montarHorariosPico = (corridas) => {
  const mapa = new Map();

  corridas.forEach((corrida) => {
    const dataHora = new Date(corrida.dataHoraSolicitacao);

    if (Number.isNaN(dataHora.getTime())) return;

    const horaNumero = dataHora.getHours();
    const hora = `${String(horaNumero).padStart(2, '0')}:00 às ${String(horaNumero + 1).padStart(2, '0')}:00`;

    mapa.set(hora, (mapa.get(hora) || 0) + 1);
  });

  return Array.from(mapa.entries())
    .map(([hora, quantidade]) => ({ hora, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);
};

export default function Financeiro() {
  const nomeAgencia = localStorage.getItem('nomeAgencia') || 'Agência';

  const dataAtual = new Date();
  const [periodo, setPeriodo] = useState('Diario');
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());
  const [dadosFinanceiros, setDadosFinanceiros] = useState(null);

  const [mostrarValor, setMostrarValor] = useState(() => {
    const preferenciaSalva = localStorage.getItem('mostrarValorFinanceiro');
    return preferenciaSalva === 'false' ? false : true;
  });

  const anosDisponiveis = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];
  }, []);

  const referenciaTela = useMemo(() => {
    if (periodo === 'Mensal') return `${mesesDoAno[mesSelecionado - 1]} de ${anoSelecionado}`;
    if (periodo === 'Semanal') return 'Últimos 7 dias';
    return 'Hoje';
  }, [periodo, mesSelecionado, anoSelecionado]);

  const handleAlternarOlho = () => {
    const novoEstado = !mostrarValor;
    setMostrarValor(novoEstado);
    localStorage.setItem('mostrarValorFinanceiro', novoEstado);
  };

  useEffect(() => {
    const buscarDadosFinanceiros = async () => {
      const token = localStorage.getItem('tokenAgencia');

      try {
        const parametros = new URLSearchParams({ periodo });

        if (periodo === 'Mensal') {
          parametros.append('mes', String(mesSelecionado));
          parametros.append('ano', String(anoSelecionado));
        }

        const resposta = await fetch(`${API_BASE}/api/Financeiro/resumo?${parametros.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (resposta.ok) {
          const resumoFinanceiro = await resposta.json();
          const datasDoPeriodo = obterDatasDoPeriodo(periodo, mesSelecionado, anoSelecionado);
          const listasDeCorridas = await Promise.all(datasDoPeriodo.map((data) => buscarCorridasPorData(token, data)));
          const corridasDoPeriodo = listasDeCorridas.flat().filter((corrida) => !ehCorridaCancelada(corrida));

          setDadosFinanceiros({
            ...resumoFinanceiro,
            totalCorridas: corridasDoPeriodo.length,
            horarios: montarHorariosPico(corridasDoPeriodo),
            motoristas: montarRanking(corridasDoPeriodo, (corrida) => {
              if (!corrida.motorista || corrida.motorista === 'Buscando motorista...') return null;
              return corrida.motorista;
            }),
            passageiros: montarRanking(corridasDoPeriodo, (corrida) => corrida.passageiro)
          });
        }
      } catch (erro) {
        console.error('Erro ao buscar dados do financeiro:', erro);
      }
    };

    buscarDadosFinanceiros();
  }, [periodo, mesSelecionado, anoSelecionado]);

  const getClasseBotao = (nomeBotao) => {
    return `botao-filtro ${periodo === nomeBotao ? 'ativo' : ''}`;
  };

  return (
    <div className="financeiro-fundo">
      <Navbar nomeAgencia={nomeAgencia} />

      <main className="financeiro-conteudo">
        <div className="cabecalho-financeiro">
          <div>
            <h2>📊 Relatórios e Caixa</h2>
            <p className="subtitulo-financeiro">Referência atual: <strong>{referenciaTela}</strong></p>
          </div>

          <div className="controles-financeiro">
            <div className="grupo-botoes-filtro">
              <button onClick={() => setPeriodo('Diario')} className={getClasseBotao('Diario')}>Diário</button>
              <button onClick={() => setPeriodo('Semanal')} className={getClasseBotao('Semanal')}>Semanal</button>
              <button onClick={() => setPeriodo('Mensal')} className={getClasseBotao('Mensal')}>Mensal</button>
            </div>

            {periodo === 'Mensal' && (
              <div className="filtro-mes-financeiro">
                <select value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))}>
                  {mesesDoAno.map((mes, index) => (
                    <option key={mes} value={index + 1}>{mes}</option>
                  ))}
                </select>

                <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))}>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {dadosFinanceiros ? (
          <div className="grid-financeiro">
            <div className="cartao-financeiro cartao-destaque-verde">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ color: 'var(--cor-agencia, #111827)', margin: 0, fontWeight: 'bold' }}> Arrecadação de Diárias</h3>

                <button
                  onClick={handleAlternarOlho}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: '5px' }}
                  title={mostrarValor ? 'Ocultar valor' : 'Mostrar valor'}
                >
                  {mostrarValor ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>

              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 0 }}>Referência: {dadosFinanceiros.referencia || referenciaTela}</p>

              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0', color: '#1f2937' }}>
                R$ {mostrarValor ? Number(dadosFinanceiros.arrecadacao).toFixed(2) : '-----'}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>Diárias computadas no período</p>
            </div>

            <div className="cartao-financeiro cartao-destaque-azul">
              <h3 style={{ color: 'var(--cor-agencia-secundaria, #38bdf8)', marginTop: 0, fontWeight: 'bold' }}> Volume de Corridas</h3>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Referência: {dadosFinanceiros.referencia || referenciaTela}</p>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0' }}>
                {dadosFinanceiros.totalCorridas}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>Corridas efetuadas</p>
            </div>

            <div className="cartao-financeiro cartao-destaque-amarelo">
              <h3 style={{ color: '#ffc107', marginTop: 0, fontWeight: 'bold' }}> Horários de Pico</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>Horários com mais solicitações</p>
              <ul className="lista-ranking">
                {dadosFinanceiros.horarios.length === 0 ? <p>Sem dados.</p> :
                  dadosFinanceiros.horarios.map((h, index) => (
                    <li key={index} className="item-ranking">
                      <span>{index + 1}º - {h.hora}</span>
                      <span className="valor-ranking" style={{ color: '#ffc107' }}>{h.quantidade} corridas</span>
                    </li>
                  ))
                }
              </ul>
            </div>

            <div className="cartao-financeiro">
              <h3 style={{ marginTop: 0, fontWeight: 'bold' }}> Produtividade (Motoristas)</h3>
              <ul className="lista-ranking">
                {dadosFinanceiros.motoristas.length === 0 ? <p>Nenhum dado registado.</p> :
                  dadosFinanceiros.motoristas.map((m, index) => (
                    <li key={index} className="item-ranking">
                      <span>{index + 1}º - {m.nome}</span>
                      <span className="valor-ranking">{m.quantidade}</span>
                    </li>
                  ))
                }
              </ul>
            </div>

            <div className="cartao-financeiro">
              <h3 style={{ marginTop: 0, fontWeight: 'bold' }}>⭐ Melhores Clientes</h3>
              <ul className="lista-ranking">
                {dadosFinanceiros.passageiros.length === 0 ? <p>Nenhum dado registado.</p> :
                  dadosFinanceiros.passageiros.map((p, index) => (
                    <li key={index} className="item-ranking">
                      <span>{index + 1}º - {p.nome}</span>
                      <span className="valor-ranking">{p.quantidade}</span>
                    </li>
                  ))
                }
              </ul>
            </div>
          </div>
        ) : (
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '1.2rem' }}>A Carregar Relatórios Financeiros...</p>
        )}
      </main>
    </div>
  );
}