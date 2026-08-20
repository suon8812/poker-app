'use client';

import { Card } from '@/lib/poker/types';
import { evaluateHand } from '@/lib/poker/handEvaluator';

const RANK_TIPS: Record<string, string> = {
  'High Card': '페어가 없어요. 가장 높은 카드로 승부합니다.',
  'One Pair': '같은 숫자 카드 2장을 갖고 있어요.',
  'Two Pair': '서로 다른 숫자의 페어가 2개 있어요.',
  'Three of a Kind': '같은 숫자 카드가 3장이에요.',
  'Straight': '숫자가 5개 연속으로 이어져요.',
  'Flush': '같은 무늬 카드 5장이에요.',
  'Full House': '트리플 + 페어 조합, 강력한 족보예요!',
  'Four of a Kind': '같은 숫자 카드가 4장, 매우 강력해요!',
  'Straight Flush': '같은 무늬로 연속된 5장 — 최상급 족보예요!',
};

export default function HandRankHint({ holeCards, communityCards }: { holeCards: Card[]; communityCards: Card[] }) {
  if (holeCards.length < 2) return null;

  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    return (
      <div className="mt-3 bg-blue-950/40 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-200">
        커뮤니티 카드가 더 공개되면 현재 족보를 알려드릴게요.
      </div>
    );
  }

  const evaluation = evaluateHand(allCards);

  return (
    <div className="mt-3 bg-blue-950/40 border border-blue-500/20 rounded-lg p-3">
      <p className="text-yellow-400 font-bold">내 현재 족보: {evaluation.description}</p>
      <p className="text-sm text-blue-200 mt-1">{RANK_TIPS[evaluation.rankName]}</p>
    </div>
  );
}
