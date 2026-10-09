import { reservarMicrofone } from './audioFocus';
import { criarRadioMediaWeb } from './vozWeb';

// Rádio pelo servidor: a voz vai e vem em pedaços pela conexão com a API (sem ligação direta nem TURN).
export const radioMedia = criarRadioMediaWeb(reservarMicrofone);
