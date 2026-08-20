import { Card, Rank, HandEvaluation } from './types';

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const RANK_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

const RANK_NAMES_KO: Record<string, string> = {
  'High Card': '하이카드',
  'One Pair': '원 페어',
  'Two Pair': '투 페어',
  'Three of a Kind': '트리플',
  'Straight': '스트레이트',
  'Flush': '플러시',
  'Full House': '풀하우스',
  'Four of a Kind': '포카드',
  'Straight Flush': '스트레이트 플러시',
};

/** 7장(홀카드 2 + 커뮤니티 5) 중 최적 5장 조합을 찾아 평가합니다. */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error('evaluateHand requires at least 5 cards');
  }
  const combos = combinations(cards, 5);
  let best: HandEvaluation | null = null;

  for (const combo of combos) {
    const evalResult = evaluateFive(combo);
    if (!best || evalResult.score > best.score) best = evalResult;
  }
  return best!;
}

function evaluateFive(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => cardValue(b) - cardValue(a));
  const isFlush = cards.every(c => c.suit === cards[0].suit) && !cards.some(c => c.isWild);
  const values = sorted.map(cardValue);
  const straightHigh = getStraightHigh(values);
  const isStraight = straightHigh !== null;

  const counts: Record<number, number> = {};
  values.forEach(v => (counts[v] = (counts[v] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([val, count]) => ({ val: Number(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  const kickers = groups.map(g => g.val);

  if (isStraight && isFlushIgnoringWild(cards)) {
    return mkResult(8, [straightHigh!], sorted);
  }
  if (groups[0].count === 4) {
    return mkResult(7, [groups[0].val, groups[1].val], sorted);
  }
  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return mkResult(6, [groups[0].val, groups[1].val], sorted);
  }
  if (isFlush) {
    return mkResult(5, kickers, sorted);
  }
  if (isStraight) {
    return mkResult(4, [straightHigh!], sorted);
  }
  if (groups[0].count === 3) {
    return mkResult(3, [groups[0].val, ...kickers.filter(k => k !== groups[0].val)], sorted);
  }
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairVals = [groups[0].val, groups[1].val].sort((a, b) => b - a);
    const kicker = kickers.find(k => k !== pairVals[0] && k !== pairVals[1])!;
    return mkResult(2, [...pairVals, kicker], sorted);
  }
  if (groups[0].count === 2) {
    return mkResult(1, [groups[0].val, ...kickers.filter(k => k !== groups[0].val)], sorted);
  }
  return mkResult(0, kickers, sorted);
}

function cardValue(c: Card): number {
  // 와일드카드는 최고값으로 취급 (실제 조합 결정은 조합 탐색에서 처리)
  return RANK_VALUES[c.rank];
}

function isFlushIgnoringWild(cards: Card[]): boolean {
  const nonWild = cards.filter(c => !c.isWild);
  if (nonWild.length === 0) return true;
  return nonWild.every(c => c.suit === nonWild[0].suit);
}

function mkResult(tier: number, tiebreakers: number[], cards: Card[]): HandEvaluation {
  // score = tier * 큰 배수 + 킥커들을 내림차순 가중치로 인코딩
  let score = tier * Math.pow(15, 5);
  tiebreakers.slice(0, 5).forEach((v, i) => {
    score += v * Math.pow(15, 4 - i);
  });
  const name = RANK_NAMES[tier];
  return {
    rankName: name,
    rankTier: tier,
    score,
    description: RANK_NAMES_KO[name] ?? name,
    bestFive: cards,
  };
}

/** 스트레이트의 최고 카드 값을 반환. 없으면 null. A-2-3-4-5 로우스트레이트 지원. */
function getStraightHigh(values: number[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  // A-2-3-4-5 특수 케이스 (Ace low)
  if (unique.includes(14) && [2, 3, 4, 5].every(v => unique.includes(v))) {
    return 5;
  }
  return null;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  return a.score - b.score;
}
