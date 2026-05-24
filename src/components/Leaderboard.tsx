import { Player, Seat } from '@/types/game';

interface Props {
  seats: Seat[];
  currentPlayer: Player | null;
  onClose: () => void;
}

const MOCK_LEADERS = [
  { name: 'Виктор', avatar: '🐉', coins: 2840, wins: 34 },
  { name: 'Анастасия', avatar: '🦄', coins: 1960, wins: 28 },
  { name: 'Макс', avatar: '🦊', coins: 1540, wins: 21 },
  { name: 'Ольга', avatar: '🐯', wins: 15, coins: 980 },
  { name: 'Дима', avatar: '🦁', coins: 760, wins: 11 },
];

export default function Leaderboard({ seats, currentPlayer, onClose }: Props) {
  const activePlayers = seats
    .filter(s => s.player !== null)
    .map(s => s.player!);

  const allPlayers = [
    ...MOCK_LEADERS,
    ...(currentPlayer ? [{ name: currentPlayer.name + ' (вы)', avatar: currentPlayer.avatar, coins: currentPlayer.coins, wins: 0 }] : []),
  ].sort((a, b) => b.coins - a.coins);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-scale-in bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-xl text-foreground tracking-widest uppercase">Таблица лидеров</h2>
            <p className="text-muted-foreground text-xs">Топ игроков по монетам</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl">✕</button>
        </div>

        <div className="space-y-2">
          {allPlayers.map((p, i) => {
            const isMe = p.name.includes('(вы)');
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all
                  ${isMe ? 'bg-blue-600/20 border border-blue-600/30' : 'bg-secondary/50'}
                `}
              >
                <span className="text-lg w-6 text-center">{medals[i] || <span className="text-muted-foreground text-sm">{i + 1}</span>}</span>
                <span className="text-2xl">{p.avatar}</span>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${isMe ? 'text-blue-400' : 'text-foreground'}`}>
                    {p.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gold font-bold text-sm">{p.coins} 🪙</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active at table */}
        {activePlayers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-muted-foreground text-xs uppercase tracking-widest mb-2">За столом сейчас</p>
            <div className="flex gap-2 flex-wrap">
              {activePlayers.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 bg-secondary rounded-xl px-2 py-1">
                  <span>{p.avatar}</span>
                  <span className="text-foreground text-xs">{p.name}</span>
                  {p.isVip && <span className="text-gold text-xs">👑</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
