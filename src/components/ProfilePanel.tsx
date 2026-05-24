import { Player } from '@/types/game';

interface Props {
  player: Player;
  onClose: () => void;
}

export default function ProfilePanel({ player, onClose }: Props) {
  const rank = player.coins >= 1000 ? 'Акула 🦈' :
    player.coins >= 500 ? 'Профи 🎯' :
    player.coins >= 200 ? 'Игрок 🃏' : 'Новичок 🌱';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-scale-in bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h2 className="font-display text-xl text-foreground tracking-widest uppercase">Профиль</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl">✕</button>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className={`text-6xl p-4 rounded-2xl ${player.isVip ? 'seat-vip vip-glow' : 'bg-secondary'}`}>
            {player.avatar}
          </div>
          <div className="text-center">
            <div className="text-foreground font-display text-2xl tracking-wider">{player.name}</div>
            {player.isVip && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-gold text-sm">👑 VIP-место</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <div className="text-gold font-bold text-xl">{player.coins}</div>
            <div className="text-muted-foreground text-xs mt-0.5">Монеты 🪙</div>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <div className="text-foreground font-bold text-xl">{rank.split(' ')[0]}</div>
            <div className="text-muted-foreground text-xs mt-0.5">Ранг {rank.split(' ')[1]}</div>
          </div>
        </div>

        {/* Seat info */}
        <div className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
          <div className="text-muted-foreground text-xs">
            {player.seatIndex !== null
              ? `Место №${(player.seatIndex || 0) + 1}${player.isVip ? ' (VIP — право выбора игры)' : ''}`
              : 'Пока не за столом'
            }
          </div>
        </div>

        {/* Tip */}
        {!player.isVip && (
          <p className="text-muted-foreground text-xs text-center mt-4">
            Займите <span className="text-gold">VIP-место №1</span> чтобы выбирать игру
          </p>
        )}
      </div>
    </div>
  );
}
