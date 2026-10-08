import { createContext, useContext } from 'react';
export const RadioContext = createContext({ chamar: () => {}, estado: {} });
export const useRadio = () => useContext(RadioContext);
