import { GameModifier } from '../types';

/**
 * 예시 특수 규칙: 모든 '2' 카드를 와일드카드로 지정합니다.
 * 와일드카드는 handEvaluator에서 최고 조합을 만들도록 취급됩니다.
 */
export const wildCardModifier: GameModifier = {
  id: 'wild-card-deuces',
  name: '2 와일드카드',
  description: "숫자 '2' 카드가 모두 와일드카드로 작동합니다.",
  type: 'rule',

  onDeckCreate(deck) {
    return deck.map(card => (card.rank === '2' ? { ...card, isWild: true } : card));
  },
};
