import { useContext } from 'react';
import { FeedbackContext } from './FeedbackContext';

export function useFeedback() {
  const contexto = useContext(FeedbackContext);

  if (!contexto) {
    throw new Error('useFeedback deve ser usado dentro de FeedbackProvider.');
  }

  return contexto;
}
