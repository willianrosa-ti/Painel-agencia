import { useEffect, useState } from 'react';
import Navbar from '../../Components/Navbar'; 
import './Motoristas.css';

export default function Motoristas() {
  const [frota, setFrota] = useState([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placa, setPlaca] = useState('');
  
  // 1. NOVO ESTADO: Variável para guardar a senha
  const [senha, setSenha] = useState('');
  
  const nomeAgencia = localStorage.getItem('nomeAgencia');

  const buscarFrota = async () => {
    const token = localStorage.getItem('tokenAgencia');
    const res = await fetch('http://localhost:5022/api/Motorista/listar', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setFrota(await res.json());
  };

  useEffect(() => { buscarFrota(); }, []);

  const handleCadastrar = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('tokenAgencia');
    const res = await fetch('http://localhost:5022/api/Motorista/cadastrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      // 2. MUDANÇA: Enviamos a variável 'senha' para a API junto com os outros dados
      body: JSON.stringify({ nome, telefone, placaMoto: placa, senha })
    });
    if (res.ok) {
      alert("Motorista adicionado com sucesso!");
      // 3. Limpa os campos, incluindo a senha
      setNome(''); setTelefone(''); setPlaca(''); setSenha('');
      buscarFrota();
    }
  };

  return (
    <div>
      <Navbar nomeAgencia={nomeAgencia} />
      <div className="motoristas-container">
        <h2 className="motoristas-titulo">📋 Gestão da Frota ({frota.length} motoristas)</h2>
        
        <div className="cartao-adicionar-motorista">
          <h3>➕ Adicionar Novo Motorista</h3>
          <form onSubmit={handleCadastrar} className="formulario-motorista" style={{ flexWrap: 'wrap' }}>
            <input type="text" placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} required className="input-motorista" />
            <input type="text" placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} required className="input-motorista" />
            <input type="text" placeholder="Placa da Moto" value={placa} onChange={e => setPlaca(e.target.value)} required className="input-motorista" />
            
            {/* 4. MUDANÇA: O novo campo de senha na tela */}
            <input type="password" placeholder="Senha para o App" value={senha} onChange={e => setSenha(e.target.value)} required className="input-motorista" />
            
            <button type="submit" className="botao-cadastrar-motorista">Cadastrar</button>
          </form>
        </div>

        <table className="tabela-motoristas">
          <thead className="cabecalho-tabela">
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Placa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {frota.map(m => (
              <tr key={m.id} className="linha-tabela-motorista">
                <td className="celula-id">#{m.id}</td>
                <td>{m.nome}</td>
                <td>{m.telefone}</td>
                <td>{m.placaMoto}</td>
                <td><span className="status-motorista-ativo">● Ativo</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}