import { Card } from '@/lib/poker/types';

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export default function PlayingCard({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <div className="w-10 h-14 sm:w-14 sm:h-20 rounded-lg border-2 border-blue-700 bg-gradient-to-br from-blue-800 to-blue-950 shadow-md shrink-0" />
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div
      className={[
        'w-10 h-14 sm:w-14 sm:h-20 bg-white rounded-lg flex flex-col items-center justify-center font-bold shadow-md shrink-0',
        isRed ? 'text-red-600' : 'text-black',
        card.isWild ? 'ring-2 ring-yellow-400' : '',
      ].join(' ')}
    >
      <span className="text-xs sm:text-base leading-none">{card.rank}</span>
      <span className="text-base sm:text-xl leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
