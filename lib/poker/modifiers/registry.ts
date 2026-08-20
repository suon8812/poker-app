import { GameModifier } from './types';
import { wildCardModifier } from './examples/wildCard';
import { chipBonusModifier, aggressorBonusModifier } from './examples/chipBonus';

/**
 * ============================================================
 * 새 특수 규칙/증강 모디파이어를 추가할 때는
 * 1) lib/poker/modifiers/examples/ 에 파일 생성 (GameModifier 구현)
 * 2) 아래 레지스트리에 한 줄 등록
 * 만 하면 됩니다. 게임 엔진 코드는 수정할 필요가 없습니다.
 * ============================================================
 */
const MODIFIER_REGISTRY: Record<string, GameModifier> = {
  [wildCardModifier.id]: wildCardModifier,
  [chipBonusModifier.id]: chipBonusModifier,
  [aggressorBonusModifier.id]: aggressorBonusModifier,
};

export function getModifier(id: string): GameModifier | undefined {
  return MODIFIER_REGISTRY[id];
}

export function getActiveModifiers(activeIds: string[]): GameModifier[] {
  return activeIds.map(id => MODIFIER_REGISTRY[id]).filter((m): m is GameModifier => m !== undefined);
}

export function listAvailableModifiers(): GameModifier[] {
  return Object.values(MODIFIER_REGISTRY);
}
