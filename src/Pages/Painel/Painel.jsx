import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../Components/Navbar';
import './Painel.css';

export default function Painel() {
  const [nomeAgencia, setNomeAgencia] = useState('');
  const [dadosResumo, setDadosResumo] = useState(null); 
  const navegar = useNavigate();

  // Estados para contagem do resumo e listar corridas
  const [frota, setFrota] = useState([]); 
  const [corridasAtivas, setCorridasAtivas] = useState([]);

  // Estados exclusivos do formulário de Nova Corrida
  const [telPassageiro, setTelPassageiro] = useState('');
  const [nomePassageiro, setNomePassageiro] = useState('');
  const [endBusca, setEndBusca] = useState('');
  const [endDestino, setEndDestino] = useState('');
  const [valorCorrida, setValorCorrida] = useState(7.00); 

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('nomeAgencia');
    const tokenSalvo = localStorage.getItem('tokenAgencia');

    if (!tokenSalvo) { navegar('/login'); return; } 
    setNomeAgencia(nomeSalvo);

    const buscarTudo = async () => {
      try {
        const resResumo = await fetch('http://localhost:5022/api/Agencia/resumo', { headers: { 'Authorization': `Bearer ${tokenSalvo}` } });
        if (resResumo.ok) setDadosResumo(await resResumo.json());

        const resFrota = await fetch('http://localhost:5022/api/Motorista/listar', { headers: { 'Authorization': `Bearer ${tokenSalvo}` } });
        if (resFrota.ok) setFrota(await resFrota.json());

        const resCorridas = await fetch('http://localhost:5022/api/Corrida/listar-hoje', { headers: { 'Authorization': `Bearer ${tokenSalvo}` } });
        if (resCorridas.ok) setCorridasAtivas(await resCorridas.json());

      } catch (erro) { console.error(erro); }
    };

    buscarTudo(); 

    // ITEM 2: Atualização em tempo real a cada 5 segundos
    const intervalo = setInterval(buscarTudo, 5000);
    return () => clearInterval(intervalo);

  }, [navegar]);

  const handleDespacharCorrida = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('tokenAgencia');
    try {
      const resposta = await fetch('http://localhost:5022/api/Corrida/nova', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ telefonePassageiro: telPassageiro, nomePassageiro: nomePassageiro, enderecoBusca: endBusca, enderecoDestino: endDestino, valorDaCorrida: valorCorrida })
      });

      if (resposta.ok) {
        // 1. --- A MÁGICA DO WHATSAPP ENTRA AQUI ---
        const textoWhatsApp = `🏍️ *NOVA CORRIDA*\n*Passageiro:* ${nomePassageiro}\n*Buscar em:* ${endBusca}\n*Levar para:* ${endDestino}\n*Valor:* R$ ${valorCorrida.toFixed(2)}`;
        const linkWhatsApp = `https://web.whatsapp.com/send?text=${encodeURIComponent(textoWhatsApp)}`;
        window.open(linkWhatsApp, 'aba_do_WhatApp');
        // ------------------------------------------

        alert("🚀 Corrida despachada e enviada para o WhatsApp!");
        
        setTelPassageiro(''); setNomePassageiro(''); setEndBusca(''); setEndDestino(''); setValorCorrida(7.00); 
        
        const resCorridas = await fetch('http://localhost:5022/api/Corrida/listar-hoje', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resCorridas.ok) setCorridasAtivas(await resCorridas.json());
        
        const resResumo = await fetch('http://localhost:5022/api/Agencia/resumo', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resResumo.ok) setDadosResumo(await resResumo.json());
      }
    } catch (erro) { console.error("Erro:", erro); }
  };

  // --- MATEMÁTICA DO RESUMO ---
  const qtdEmAndamento = corridasAtivas.filter(c => c.status === 'Em Andamento').length;
  const qtdConcluidas = corridasAtivas.filter(c => c.status === 'Concluída').length;
  const qtdPendentes = corridasAtivas.filter(c => c.status === 'Pendente').length;

  return (
    <div className="painel-fundo">
      
      <Navbar nomeAgencia={nomeAgencia} />

      <main className="painel-conteudo">
        
        {/* CARTÃO DE RESUMO ATUALIZADO */}
<div className="cartao-informativo cartao-resumo">
  <h3 className="label-valor">Resumo da Operação</h3>
  {dadosResumo ? (
    <ul className="lista-resumo">
      <li> Ativos: {frota.length}</li>
      <li> Corridas: {corridasAtivas.length}</li>
      <li style={{ color: '#ff9800' }}> Pendente: {qtdPendentes}</li>
      <li style={{ color: '#17a2b8' }}> Em Andamento: {qtdEmAndamento}</li>
      <li style={{ color: '#28a745' }}> Concluídas: {qtdConcluidas}</li>
    </ul>
  ) : ( <p>CARREGANDO...</p> )}
</div>

        {/* CARTÃO DE NOVA CORRIDA */}
        <div className="cartao-informativo cartao-nova-corrida">
          <h3 className="titulo-verde">🚀 Nova Corrida</h3>
          <form onSubmit={handleDespacharCorrida} className="formulario-corrida">
            <div className="grupo-inputs-duplo">
              <input type="text" placeholder="Telefone" value={telPassageiro} onChange={(e) => setTelPassageiro(e.target.value)} required className="input-pequeno" />
              <input type="text" placeholder="Nome do Passageiro" value={nomePassageiro} onChange={(e) => setNomePassageiro(e.target.value)} required className="input-grande" />
            </div>
            <input type="text" placeholder="Endereço de Busca" value={endBusca} onChange={(e) => setEndBusca(e.target.value)} required className="input-padrao" />
            <input type="text" placeholder="Destino" value={endDestino} onChange={(e) => setEndDestino(e.target.value)} required className="input-padrao" />
            <div className="grupo-radio-valor">
              <span className="label-valor">Valor:</span>
              <label className="opcao-radio"><input type="radio" value={7} checked={valorCorrida === 7} onChange={() => setValorCorrida(7)} /> R$ 7,00</label>
              <label className="opcao-radio"><input type="radio" value={12} checked={valorCorrida === 12} onChange={() => setValorCorrida(12)} /> R$ 12,00</label>
            </div>
            <button type="submit" className="botao-despachar">DESPACHAR</button>
          </form>
        </div>

        {/* CARTÃO DO RADAR DE CORRIDAS */}
        <div className="cartao-informativo cartao-radar">
          <h3 className="titulo-azul">📡 Radar de Corridas (Hoje)</h3>
          {corridasAtivas.length === 0 ? ( <p className="texto-vazio">Nenhuma corrida registrada hoje.</p> ) : (
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
                    <td className="celula-trajeto">De: {c.busca}<br/>Para: {c.destino}</td>
                    <td className="celula-valor">R$ {c.valor.toFixed(2)}</td>
                    <td>
                      <span className={c.motorista === "Buscando motorista..." ? "motorista-buscando" : "motorista-encontrado"}>
                        {c.motorista === "Buscando motorista..." ? "⏳ " + c.motorista : "🏍️ " + c.motorista}
                      </span>
                    </td>
                    <td>
                      {/* ITEM 3: Suporte ao status concluída com substituição de caractere especial no CSS */}
                      <span className={`badge-status status-${c.status.toLowerCase().replace(' ', '-').replace('í', 'i')}`}>
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