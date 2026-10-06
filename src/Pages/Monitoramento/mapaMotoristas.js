// Only the display coordinates move. GPS coordinates remain untouched for routes.
export function distribuirMarcadores(pontos, distancia = 56) {
  const grupos = [];
  const pendentes = [...pontos].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  while (pendentes.length) {
    const grupo = [pendentes.shift()];
    for (let i = 0; i < grupo.length; i++) {
      for (let j = pendentes.length - 1; j >= 0; j--) {
        if (Math.hypot(grupo[i].x - pendentes[j].x, grupo[i].y - pendentes[j].y) < distancia) grupo.push(pendentes.splice(j, 1)[0]);
      }
    }
    grupos.push(grupo);
  }
  const distribuidos = grupos.flatMap(grupo => {
    if (grupo.length === 1) return grupo;
    const centro = { x: grupo.reduce((n, p) => n + p.x, 0) / grupo.length, y: grupo.reduce((n, p) => n + p.y, 0) / grupo.length };
    const raio = Math.max(distancia, distancia / (2 * Math.sin(Math.PI / grupo.length)));
    return grupo.map((p, i) => ({ ...p, x: centro.x + Math.cos(i * 2 * Math.PI / grupo.length - Math.PI / 2) * raio, y: centro.y + Math.sin(i * 2 * Math.PI / grupo.length - Math.PI / 2) * raio, deslocado: true }));
  });
  // A expansão de um grupo também pode encostar em outro grupo. Resolve essas
  // colisões em ordem estável, sem modificar os pontos de GPS recebidos.
  const livres = [];
  for (const ponto of distribuidos) {
    let candidato = { ...ponto };
    let anel = 0;
    while (livres.some(p => Math.hypot(p.x - candidato.x, p.y - candidato.y) < distancia - 0.001)) {
      anel++;
      const passos = Math.max(12, anel * 12);
      for (let i = 0; i < passos; i++) {
        candidato = { ...ponto, x: ponto.x + Math.cos(i * 2 * Math.PI / passos) * distancia * anel,
          y: ponto.y + Math.sin(i * 2 * Math.PI / passos) * distancia * anel, deslocado: true };
        if (livres.every(p => Math.hypot(p.x - candidato.x, p.y - candidato.y) >= distancia - 0.001)) break;
      }
    }
    livres.push(candidato);
  }
  return livres;
}

export function svgMoto(comPassageiro = false) {
  return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="41" cy="72" rx="31" ry="5" fill="#0f172a" opacity=".14"/>
    <g stroke="#17202d" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      ${comPassageiro ? '<path d="M46 31Q53 26 59 34L63 48 51 51 44 40Z" fill="#475569"/><path d="M53 47L59 55 48 64 44 60 51 54 44 51" fill="#334155"/><circle cx="53" cy="22" r="10" fill="#dc4545"/><path d="M44 21Q54 25 62 19L62 26Q55 31 46 28Z" fill="#263443"/>' : ''}
      <circle cx="19" cy="62" r="12" fill="#25313c"/><circle cx="19" cy="62" r="6" fill="#cbd5e1"/><circle cx="61" cy="62" r="11" fill="#25313c"/><circle cx="61" cy="62" r="5" fill="#cbd5e1"/>
      <path d="M19 61L29 44 49 48 62 62 35 61Z" fill="#8d9ca8"/><path d="M31 50L42 42 57 45 54 53 37 57Z" fill="#374151"/><path d="M45 44L63 44" stroke-width="5"/><path d="M19 62L26 39 20 37" fill="none" stroke="#e2e8f0" stroke-width="5"/>
      <path d="M37 30Q43 26 48 34L45 46 32 49 28 43Z" fill="#243444"/><path d="M43 46L48 53 35 66 30 63 40 54 30 51" fill="#3f6078"/><path d="M36 34L29 42 20 42" fill="none" stroke="#273647" stroke-width="7"/>
      <circle cx="37" cy="21" r="11" fill="#f1f5f9"/><path d="M27 21Q36 25 46 19L46 26Q37 32 29 28Z" fill="#334155"/>
      <path d="M12 49Q18 43 24 48L23 52 14 54Z" fill="#f8fafc"/><path d="M56 56L70 54" stroke="#aab7c4" stroke-width="4"/>
    </g></svg>`;
}
