import { GameState, Card, Player, HandEvaluation, ActionType } from '../types';

/**
 * 모든 특수 규칙(rule)과 증강 패시브(augment)는 이 인터페이스를 구현합니다.
 * 게임 엔진은 정해진 시점(훅)에서 활성화된 모디파이어들을 순서대로 호출합니다.
 * 새 규칙을 추가할 때 게임 엔진 코드는 절대 수정하지 않습니다.
 */
export interface GameModifier {
  id: string; // 고유 ID (e.g., 'wild-card-deuces')
  name: string;
  description: string;
  type: 'rule' | 'augment';

  /** 새 핸드 시작 시 덱 생성 직후 개입 (와일드카드 지정 등) */
  onDeckCreate?(deck: Card[]): Card[];

  /** 족보 판정 직후 개입 (변형 족보, 보너스 점수 등) */
  onHandEvaluate?(cards: Card[], baseEvaluation: HandEvaluation): HandEvaluation;

  /** 플레이어가 액션을 취할 때마다 개입 (조건부 칩 지급 등) */
  onPlayerAction?(state: GameState, playerId: string, action: ActionType): GameState;

  /** 베팅 라운드(프리플랍/플랍/턴/리버)가 끝나고 다음 단계로 넘어가기 직전 개입 */
  onBettingRoundEnd?(state: GameState): GameState;

  /** 핸드가 완전히 종료되고 승자가 결정된 후 개입 (보너스 지급 등) */
  onHandEnd?(state: GameState, winnerIds: string[]): GameState;

  /** 새 핸드가 시작되기 직전 개입 (매 핸드 시작 시 조건부 효과) */
  onHandStart?(state: GameState): GameState;
}
