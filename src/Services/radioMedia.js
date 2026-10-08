import { reservarMicrofone } from './audioFocus';
let player, liberar;
export const radioMedia = {
  async microphone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Use HTTPS e permita o microfone para abrir o rádio.');
    liberar = reservarMicrofone('radio');
    try {
      player ??= document.createElement('audio'); player.autoplay = true;
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    } catch (e) { liberar?.(); liberar = null; throw e; }
  },
  peer: config => new RTCPeerConnection(config),
  candidate: data => new RTCIceCandidate(data),
  description: data => new RTCSessionDescription(data),
  remote(stream) { player.srcObject = stream; player.play().catch(() => {}); },
  clear() { liberar?.(); liberar = null; if (player) { player.pause(); player.srcObject = null; } },
};
