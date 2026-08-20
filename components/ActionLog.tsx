import { ActionLogEntry, RoundPhase } from '@/lib/poker/types';

const PHASE_LABELS: Record<RoundPhase, string> = {
  waiting: '대기 중',
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
  showdown: '쇼다운',
  handOver: '핸드 종료',
};

const ACTION_LABELS: Record<string, string> = {
  check: '체크',
  call: '콜',
  raise: '레이즈',
  fold: '폴드',
  allin: '올인',
  'post-blind': '블라인드',
};

export default function ActionLog({ log, phase }: { log: ActionLogEntry[]; phase: RoundPhase }) {
  return (
    <div>
      <h3 className="text-white font-bold mb-3">진행 상태: {PHASE_LABELS[phase] ?? phase}</h3>
      <div className="space-y-1.5">
        {log
          .slice()
          .reverse()
          .map((entry, i) => (
            <p key={i} className="text-sm text-white/80">
              <span className="text-yellow-400">{entry.nickname}</span>{' '}
              {ACTION_LABELS[entry.action] ?? entry.action}
              {entry.amount !== undefined ? ` (${entry.amount})` : ''}
            </p>
          ))}
        {log.length === 0 && <p className="text-white/30 text-sm">아직 액션이 없습니다.</p>}
      </div>
    </div>
  );
}
