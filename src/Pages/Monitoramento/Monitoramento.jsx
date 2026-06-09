import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navbar from '../../Components/Navbar';
import { useFeedback } from '../../Components/Feedback/useFeedback';
import './Monitoramento.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const CENTRO_PADRAO = [-22.9782, -49.8718];

const STATUS_LABEL = {
  livre: 'Livre',
  em_corrida: 'Em corrida',
  offline: 'Sem sinal'
};

function corValida(valor, corPadrao) {
  if (typeof valor !== 'string') return corPadrao;

  const cor = valor.trim();

  if (!cor || cor.toLowerCase() === 'null' || cor.toLowerCase() === 'undefined') {
    return corPadrao;
  }

  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(cor) ? cor : corPadrao;
}

function aplicarTemaAgencia() {
  document.documentElement.style.setProperty(
    '--cor-agencia',
    corValida(localStorage.getItem('corAgenciaPrimaria'), '#111827')
  );

  document.documentElement.style.setProperty(
    '--cor-agencia-secundaria',
    corValida(localStorage.getItem('corAgenciaSecundaria'), '#38bdf8')
  );

  document.documentElement.style.setProperty(
    '--cor-fonte-cabecalho',
    corValida(localStorage.getItem('corFonteCabecalhoAgencia'), '#ffffff')
  );
}

function temCoordenadaValida(motorista) {
  const latitude = Number(motorista?.latitude);
  const longitude = Number(motorista?.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizarMotorista(dados) {
  if (!dados) return null;

  const id = dados.id ?? dados.motoristaId;
  if (!id) return null;

  return {
    id,
    nome: dados.nome || 'Motorista',
    telefone: dados.telefone || '',
    placaMoto: dados.placaMoto || '',
    latitude: dados.latitude,
    longitude: dados.longitude,
    online: Boolean(dados.online),
    suspenso: Boolean(dados.suspenso),
    temLocalizacao: Boolean(dados.temLocalizacao),
    ultimaAtividade: dados.ultimaAtividade,
    emCorrida: Boolean(dados.emCorrida),
    corridaAtivaId: dados.corridaAtivaId ?? null,
    corridaAtivaBusca: dados.corridaAtivaBusca || '',
    corridaAtivaDestino: dados.corridaAtivaDestino || '',
    statusMapa: dados.statusMapa || (dados.emCorrida ? 'em_corrida' : dados.online ? 'livre' : 'offline')
  };
}

function atualizarMotoristaNaLista(listaAtual, dados) {
  const motoristaAtualizado = normalizarMotorista(dados);
  if (!motoristaAtualizado) return listaAtual;

  const indice = listaAtual.findIndex((motorista) => String(motorista.id) === String(motoristaAtualizado.id));

  if (indice === -1) {
    return [...listaAtual, motoristaAtualizado].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  const novaLista = [...listaAtual];
  novaLista[indice] = {
    ...novaLista[indice],
    ...motoristaAtualizado
  };

  return novaLista;
}

function criarIconeMoto(statusMapa) {
  const status = statusMapa === 'em_corrida' ? 'em-corrida' : statusMapa === 'livre' ? 'livre' : 'offline';

  return L.divIcon({
    className: `monitoramento-moto-marker monitoramento-moto-marker--${status}`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `
      <div class="monitoramento-moto-icone" aria-hidden="true">
        <span class="monitoramento-moto-roda monitoramento-moto-roda--traseira"></span>
        <span class="monitoramento-moto-roda monitoramento-moto-roda--dianteira"></span>
        <span class="monitoramento-moto-corpo"></span>
        <span class="monitoramento-moto-banco"></span>
        <span class="monitoramento-moto-guidom"></span>
      </div>
    `
  });
}

function formatarData(valor) {
  if (!valor) return 'Sem registro';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem registro';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatarValor(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2).replace('.', ',') : '0,00';
}

export default function Monitoramento() {
  const navegar = useNavigate();
  const { sucesso, erro: mostrarErro, aviso } = useFeedback();

  const mapaContainerRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef(new Map());
  const mapaEnquadradoRef = useRef(false);

  const [nomeAgencia, setNomeAgencia] = useState('');
  const [motoristas, setMotoristas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [conectadoTempoReal, setConectadoTempoReal] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [motoristaSelecionadoId, setMotoristaSelecionadoId] = useState(null);
  const [cidadeBase, setCidadeBase] = useState('');
  const [estadoBase, setEstadoBase] = useState('');

  const [telPassageiro, setTelPassageiro] = useState('');
  const [nomePassageiro, setNomePassageiro] = useState('');
  const [endBusca, setEndBusca] = useState('');
  const [endDestino, setEndDestino] = useState('');
  const [tipoValor, setTipoValor] = useState('7');
  const [valorPersonalizado, setValorPersonalizado] = useState('');
  const [enviandoCorrida, setEnviandoCorrida] = useState(false);

  const motoristaSelecionado = useMemo(
    () => motoristas.find((motorista) => String(motorista.id) === String(motoristaSelecionadoId)),
    [motoristas, motoristaSelecionadoId]
  );

  const valorCorrida = useMemo(() => {
    if (tipoValor === 'custom') {
      const valorConvertido = Number(String(valorPersonalizado).replace(',', '.'));
      return Number.isFinite(valorConvertido) ? valorConvertido : 0;
    }

    return Number(tipoValor);
  }, [tipoValor, valorPersonalizado]);

  const resumo = useMemo(() => {
    return motoristas.reduce(
      (acc, motorista) => {
        if (motorista.statusMapa === 'livre') acc.livres += 1;
        if (motorista.statusMapa === 'em_corrida') acc.emCorrida += 1;
        if (motorista.statusMapa === 'offline') acc.offline += 1;
        if (temCoordenadaValida(motorista)) acc.localizados += 1;
        return acc;
      },
      { livres: 0, emCorrida: 0, offline: 0, localizados: 0 }
    );
  }, [motoristas]);

  const buscarMotoristas = useCallback(
    async (mostrarCarregando = false) => {
      const token = localStorage.getItem('tokenAgencia');

      if (!token) {
        navegar('/login');
        return;
      }

      if (mostrarCarregando) setCarregando(true);

      try {
        const resposta = await fetch(`${API_BASE}/api/Monitoramento/motoristas`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (resposta.status === 401) {
          localStorage.clear();
          navegar('/login');
          return;
        }

        if (!resposta.ok) {
          const textoErro = await resposta.text();
          mostrarErro(textoErro || 'Nao foi possivel carregar o monitoramento.');
          return;
        }

        const dados = await resposta.json();
        const lista = Array.isArray(dados.motoristas)
          ? dados.motoristas.map(normalizarMotorista).filter(Boolean)
          : [];

        setMotoristas(lista);
        setCidadeBase(dados.agencia?.cidadeBase || '');
        setEstadoBase(dados.agencia?.estadoBase || '');
        setAtualizadoEm(dados.atualizadoEm || new Date().toISOString());
      } catch (erro) {
        console.error('Erro ao buscar monitoramento:', erro);
        mostrarErro('Erro de conexao ao carregar o monitoramento.');
      } finally {
        if (mostrarCarregando) setCarregando(false);
        else setCarregando(false);
      }
    },
    [mostrarErro, navegar]
  );

  useEffect(() => {
    aplicarTemaAgencia();
    setNomeAgencia(localStorage.getItem('nomeAgencia') || 'Agencia');
    buscarMotoristas(true);

    const intervalo = setInterval(() => buscarMotoristas(false), 15000);

    return () => clearInterval(intervalo);
  }, [buscarMotoristas]);

  useEffect(() => {
    const token = localStorage.getItem('tokenAgencia');
    const agenciaId = localStorage.getItem('idAgencia');

    if (!token || !agenciaId) return undefined;

    const conexao = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hub-corridas`)
      .withAutomaticReconnect()
      .build();

    conexao.onreconnected(async () => {
      setConectadoTempoReal(true);
      await conexao.invoke('EntrarNoGrupoAgencia', agenciaId);
      buscarMotoristas(false);
    });

    conexao.onclose(() => {
      setConectadoTempoReal(false);
    });

    conexao.on('MotoristaMonitoramentoAtualizado', (payload) => {
      setMotoristas((listaAtual) => atualizarMotoristaNaLista(listaAtual, payload));
      setAtualizadoEm(new Date().toISOString());
    });

    conexao.on('AtualizarMonitoramento', () => buscarMotoristas(false));
    conexao.on('AtualizarCorridas', () => buscarMotoristas(false));
    conexao.on('StatusMotoristaAtualizado', () => buscarMotoristas(false));

    conexao
      .start()
      .then(async () => {
        setConectadoTempoReal(true);
        await conexao.invoke('EntrarNoGrupoAgencia', agenciaId);
      })
      .catch((erro) => {
        console.error('Erro ao conectar SignalR no monitoramento:', erro);
        setConectadoTempoReal(false);
      });

    return () => {
      conexao.stop();
    };
  }, [buscarMotoristas]);

  useEffect(() => {
    if (!mapaContainerRef.current || mapaRef.current) return undefined;

    const mapa = L.map(mapaContainerRef.current, {
      center: CENTRO_PADRAO,
      zoom: 14,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);

    L.control.zoom({ position: 'bottomright' }).addTo(mapa);

    mapaRef.current = mapa;
    const marcadores = marcadoresRef.current;

    const ajustarTamanho = () => mapa.invalidateSize();
    window.setTimeout(ajustarTamanho, 100);
    window.addEventListener('resize', ajustarTamanho);

    return () => {
      window.removeEventListener('resize', ajustarTamanho);
      marcadores.clear();
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const idsAtuais = new Set();
    const pontos = [];

    motoristas.forEach((motorista) => {
      if (!temCoordenadaValida(motorista)) return;

      const id = String(motorista.id);
      const latitude = Number(motorista.latitude);
      const longitude = Number(motorista.longitude);
      idsAtuais.add(id);
      pontos.push([latitude, longitude]);

      const marcadorExistente = marcadoresRef.current.get(id);
      const icone = criarIconeMoto(motorista.statusMapa);

      if (marcadorExistente) {
        marcadorExistente.setLatLng([latitude, longitude]);
        marcadorExistente.setIcon(icone);
        marcadorExistente.off('click');
        marcadorExistente.on('click', () => setMotoristaSelecionadoId(motorista.id));
      } else {
        const marcador = L.marker([latitude, longitude], {
          icon: icone,
          title: motorista.nome
        });

        marcador.on('click', () => setMotoristaSelecionadoId(motorista.id));
        marcador.addTo(mapa);
        marcadoresRef.current.set(id, marcador);
      }
    });

    marcadoresRef.current.forEach((marcador, id) => {
      if (!idsAtuais.has(id)) {
        marcador.removeFrom(mapa);
        marcadoresRef.current.delete(id);
      }
    });

    if (!mapaEnquadradoRef.current && pontos.length > 0) {
      mapa.fitBounds(L.latLngBounds(pontos), {
        padding: [48, 48],
        maxZoom: 15
      });
      mapaEnquadradoRef.current = true;
    }

    window.setTimeout(() => mapa.invalidateSize(), 50);
  }, [motoristas]);

  useEffect(() => {
    if (!motoristaSelecionadoId) return;

    const aindaExiste = motoristas.some((motorista) => String(motorista.id) === String(motoristaSelecionadoId));
    if (!aindaExiste) setMotoristaSelecionadoId(null);
  }, [motoristas, motoristaSelecionadoId]);

  const centralizarMotoristas = () => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const pontos = motoristas
      .filter(temCoordenadaValida)
      .map((motorista) => [Number(motorista.latitude), Number(motorista.longitude)]);

    if (pontos.length === 0) {
      mapa.setView(CENTRO_PADRAO, 14);
      return;
    }

    mapa.fitBounds(L.latLngBounds(pontos), {
      padding: [48, 48],
      maxZoom: 15
    });
  };

  const limparFormularioCorrida = () => {
    setTelPassageiro('');
    setNomePassageiro('');
    setEndBusca('');
    setEndDestino('');
    setTipoValor('7');
    setValorPersonalizado('');
  };

  const despacharCorrida = async (evento) => {
    evento.preventDefault();

    if (!motoristaSelecionado) {
      aviso('Selecione uma moto livre no mapa.');
      return;
    }

    if (motoristaSelecionado.statusMapa !== 'livre') {
      aviso('Este motoboy nao esta livre para receber nova corrida.');
      return;
    }

    if (valorCorrida <= 0) {
      aviso('Informe um valor valido para a corrida.');
      return;
    }

    const token = localStorage.getItem('tokenAgencia');
    if (!token) {
      navegar('/login');
      return;
    }

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
          motoristaExclusivoId: Number(motoristaSelecionado.id)
        })
      });

      const textoResposta = await resposta.text();

      if (!resposta.ok) {
        let mensagemErro = textoResposta;
        try {
          mensagemErro = JSON.parse(textoResposta).mensagem || mensagemErro;
        } catch {
          mensagemErro = mensagemErro || 'Nao foi possivel despachar a corrida.';
        }

        mostrarErro(mensagemErro || 'Nao foi possivel despachar a corrida.');
        return;
      }

      sucesso(`Corrida direcionada para ${motoristaSelecionado.nome}.`);
      limparFormularioCorrida();
      buscarMotoristas(false);
    } catch (erro) {
      console.error('Erro ao despachar corrida pelo monitoramento:', erro);
      mostrarErro('Erro de conexao ao despachar a corrida.');
    } finally {
      setEnviandoCorrida(false);
    }
  };

  const statusSelecionado = motoristaSelecionado?.statusMapa || 'offline';
  const podeDespachar = Boolean(motoristaSelecionado && statusSelecionado === 'livre');
  const localizacaoBaseTexto = cidadeBase && estadoBase ? `${cidadeBase}/${estadoBase}` : 'Cidade base';

  return (
    <div className="monitoramento-fundo">
      <Navbar nomeAgencia={nomeAgencia} />

      <main className="monitoramento-shell">
        <header className="monitoramento-topo">
          <div>
            <p className="monitoramento-contexto">{localizacaoBaseTexto}</p>
            <h2>Monitoramento</h2>
          </div>

          <div className="monitoramento-acoes-topo">
            <span className={`monitoramento-tempo-real ${conectadoTempoReal ? 'monitoramento-tempo-real--ativo' : ''}`}>
              {conectadoTempoReal ? 'Tempo real ligado' : 'Atualizando por consulta'}
            </span>

            <button type="button" className="monitoramento-botao-secundario" onClick={centralizarMotoristas}>
              Centralizar
            </button>

            <button type="button" className="monitoramento-botao-secundario" onClick={() => buscarMotoristas(true)}>
              Atualizar
            </button>
          </div>
        </header>

        <section className="monitoramento-resumo" aria-label="Resumo do monitoramento">
          <div className="monitoramento-resumo-item monitoramento-resumo-item--livre">
            <span>Livres</span>
            <strong>{resumo.livres}</strong>
          </div>

          <div className="monitoramento-resumo-item monitoramento-resumo-item--corrida">
            <span>Em corrida</span>
            <strong>{resumo.emCorrida}</strong>
          </div>

          <div className="monitoramento-resumo-item">
            <span>Sem sinal</span>
            <strong>{resumo.offline}</strong>
          </div>

          <div className="monitoramento-resumo-item">
            <span>Com GPS</span>
            <strong>{resumo.localizados}</strong>
          </div>
        </section>

        <section className="monitoramento-grade">
          <div className="monitoramento-mapa-area">
            <div ref={mapaContainerRef} className="monitoramento-mapa" aria-label="Mapa de motoboys" />

            {carregando && (
              <div className="monitoramento-mapa-overlay">
                <span>Carregando monitoramento...</span>
              </div>
            )}

            {!carregando && resumo.localizados === 0 && (
              <div className="monitoramento-mapa-overlay monitoramento-mapa-overlay--vazio">
                <span>Nenhum motoboy com GPS recente.</span>
              </div>
            )}

            <div className="monitoramento-legenda">
              <span><i className="monitoramento-legenda-cor monitoramento-legenda-cor--livre" /> Livre</span>
              <span><i className="monitoramento-legenda-cor monitoramento-legenda-cor--corrida" /> Em corrida</span>
            </div>
          </div>

          <aside className="monitoramento-lateral">
            {motoristaSelecionado ? (
              <>
                <div className="monitoramento-motorista-topo">
                  <div>
                    <span className={`monitoramento-status monitoramento-status--${statusSelecionado}`}>
                      {STATUS_LABEL[statusSelecionado] || 'Sem sinal'}
                    </span>
                    <h3>{motoristaSelecionado.nome}</h3>
                  </div>
                </div>

                <dl className="monitoramento-dados">
                  <div>
                    <dt>Telefone</dt>
                    <dd>{motoristaSelecionado.telefone || 'Nao informado'}</dd>
                  </div>

                  <div>
                    <dt>Placa</dt>
                    <dd>{motoristaSelecionado.placaMoto || 'Nao informada'}</dd>
                  </div>

                  <div>
                    <dt>Ultima atualizacao</dt>
                    <dd>{formatarData(motoristaSelecionado.ultimaAtividade)}</dd>
                  </div>

                  {motoristaSelecionado.emCorrida && (
                    <div>
                      <dt>Corrida atual</dt>
                      <dd>
                        {motoristaSelecionado.corridaAtivaBusca || 'Busca nao informada'}
                        <br />
                        {motoristaSelecionado.corridaAtivaDestino || 'Destino nao informado'}
                      </dd>
                    </div>
                  )}
                </dl>

                <form className="monitoramento-form" onSubmit={despacharCorrida}>
                  <h4>Despachar para este motoboy</h4>

                  <div className="monitoramento-input-duplo">
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="Telefone"
                      value={telPassageiro}
                      onChange={(e) => setTelPassageiro(e.target.value)}
                      required
                      disabled={!podeDespachar || enviandoCorrida}
                    />

                    <input
                      type="text"
                      placeholder="Passageiro"
                      value={nomePassageiro}
                      onChange={(e) => setNomePassageiro(e.target.value)}
                      required
                      disabled={!podeDespachar || enviandoCorrida}
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Endereco de busca"
                    value={endBusca}
                    onChange={(e) => setEndBusca(e.target.value)}
                    required
                    disabled={!podeDespachar || enviandoCorrida}
                  />

                  <input
                    type="text"
                    placeholder="Destino"
                    value={endDestino}
                    onChange={(e) => setEndDestino(e.target.value)}
                    required
                    disabled={!podeDespachar || enviandoCorrida}
                  />

                  <div className="monitoramento-valores">
                    <label>
                      <input
                        type="radio"
                        value="7"
                        checked={tipoValor === '7'}
                        onChange={() => setTipoValor('7')}
                        disabled={!podeDespachar || enviandoCorrida}
                      />
                      R$ 7,00
                    </label>

                    <label>
                      <input
                        type="radio"
                        value="12"
                        checked={tipoValor === '12'}
                        onChange={() => setTipoValor('12')}
                        disabled={!podeDespachar || enviandoCorrida}
                      />
                      R$ 12,00
                    </label>

                    <label>
                      <input
                        type="radio"
                        value="custom"
                        checked={tipoValor === 'custom'}
                        onChange={() => setTipoValor('custom')}
                        disabled={!podeDespachar || enviandoCorrida}
                      />
                      Outro
                    </label>
                  </div>

                  {tipoValor === 'custom' && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Valor"
                      value={valorPersonalizado}
                      onChange={(e) => setValorPersonalizado(e.target.value)}
                      required
                      disabled={!podeDespachar || enviandoCorrida}
                    />
                  )}

                  <button type="submit" className="monitoramento-botao-despachar" disabled={!podeDespachar || enviandoCorrida}>
                    {enviandoCorrida ? 'Despachando...' : `Despachar R$ ${formatarValor(valorCorrida)}`}
                  </button>

                  {!podeDespachar && (
                    <p className="monitoramento-alerta-form">
                      Selecione uma moto verde para direcionar uma nova corrida.
                    </p>
                  )}
                </form>
              </>
            ) : (
              <div className="monitoramento-selecao-vazia">
                <h3>Selecione uma moto verde</h3>
                <p>Ao clicar em um motoboy livre, os dados aparecem aqui e a corrida pode ser direcionada para ele.</p>
              </div>
            )}

            <footer className="monitoramento-rodape-lateral">
              Atualizado: {formatarData(atualizadoEm)}
            </footer>
          </aside>
        </section>
      </main>
    </div>
  );
}
