import { GameModifier } from '../types';

/**
 * 예시 증강 패시브: 핸드 종료 시 칩이 가장 적은 플레이어에게
 * '컴백 보너스' 칩을 지급합니다. (초보자 배려용 밸런싱 규칙 예시)
 */
export const chipBonusModifier: GameModifier = {
  id: 'chip-bonus-comeback',
  name: '컴백 보너스',
  description: '매 핸드 종료 시, 칩이 가장 적은 플레이어가 +5칩을 받습니다.',
  type: 'augment',

  onHandEnd(state, winnerIds) {
    const eligible = state.players.filter(p => p.chips > 0);
    if (eligible.length === 0) return state;

    const minChips = Math.min(...eligible.map(p => p.chips));
    return {
      ...state,
      players: state.players.map(p =>
        p.chips === minChips && p.chips > 0 ? { ...p, chips: p.chips + 5 } : p
      ),
    };
  },
};

/**
 * 예시 증강 패시브: 같은 라운드에서 3회 이상 레이즈한 '어그레시브' 플레이어는
 * 다음 라운드 시작 시 +3칩 보너스를 받습니다.
 */
export const aggressorBonusModifier: GameModifier = {
  id: 'aggressor-bonus',
  name: '공격 보너스',
  description: '한 라운드에서 3회 이상 레이즈하면 다음 핸드 시작 시 +3칩을 받습니다.',
  type: 'augment',

  onPlayerAction(state, playerId, action) {
    if (action !== 'raise') return state;

    const raiseCount = state.actionLog.filter(
      e => e.playerId === playerId && e.action === 'raise' && e.phase === state.phase
    ).length;

    if (raiseCount + 1 < 3) return state;

    return {
      ...state,
      players: state.players.map(p =>
        p.id === playerId
          ? { ...p, augments: [...p.augments, { id: 'aggressor-bonus-pending', appliedAtHand: state.handNumber }] }
          : p
      ),
    };
  },

  onHandStart(state) {
    return {
      ...state,
      players: state.players.map(p => {
        const hasPending = p.augments.some(a => a.id === 'aggressor-bonus-pending');
        if (!hasPending) return p;
        return {
          ...p,
          chips: p.chips + 3,
          augments: p.augments.filter(a => a.id !== 'aggressor-bonus-pending'),
        };
      }),
    };
  },
};
