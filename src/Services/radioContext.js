import { createContext, useContext } from 'react';
// alertar(perfil, id): alerta avulso (BIP BIP ALERTA) pelo chat; devolve a confirmação ou lança o motivo.
export const RadioContext = createContext({ chamar: () => {}, alertar: async () => '', estado: {} });
export const useRadio = () => useContext(RadioContext);
