import { Seat, Player, GameId, GAMES } from '@/types/game';
import Icon from '@/components/ui/icon';

interface Props {
  seats: Seat[];
  currentPlayer: Player | null;
  activeGame: GameId;
  onTakeSeat: (index: number) => void;
  onLeaveSeat: () => void;
  onChangeGame: (gameId: GameId) => void;
  onStartGame: () => void;
  gameState: 'waiting' | 'playing' | 'finished';
  children?: React.ReactNode;
}

const SEAT_POSITIONS = [
  { top: '8%', left: '50%', transform: 'translateX(-50%)' },         // 0 — VIP — top center
  { top: '30%', left: '8%', transform: 'translateY(-50%)' },         // 1 — left top
  { top: '70%', left: '8%', transform: 'translateY(-50%)' },         // 2 — left bottom
  { top: '30%', right: '8%', transform: 'translateY(-50%)' },        // 3 — right top
  { top: '70%', right: '8%', transform: 'translateY(-50%)' },        // 4 — right bottom
];

export default function GameTable({
  seats,
  currentPlayer,
  activeGame,
  onTakeSeat,
  onLeaveSeat,
  onChangeGame,
  onStartGame,
  gameState,
  children,
}: Props) {
  const currentGame = GAMES.find(g => g.id === activeGame)!;
  const isVip = currentPlayer?.isVip;
  const isSeated = currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <div className="text-2xl">{currentGame.emoji}</div>
        <div>
          <div className="font-display text-foreground text-lg tracking-wider uppercase">{currentGame.name}</div>
          <div className="text-muted-foreground text-xs">{currentGame.description} · Ставка от {currentGame.minBet}🪙</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isVip && (
            <div className="flex items-center gap-1 bg-gold/10 border border-gold/30 rounded-xl px-3 py-1">
              <span className="text-gold text-xs">👑 VIP — выберите игру:</span>
            </div>
          )}
          {isVip ? (
            <div className="flex gap-1">
              {GAMES.map(g => (
                <button
                  key={g.id}
                  onClick={() => onChangeGame(g.id)}
                  title={g.name}
                  className={`
                    px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
                    ${activeGame === g.id
                      ? 'bg-gold text-primary-foreground shadow-md'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                    }
                  `}
                >
                  {g.emoji} {g.name.split(' ')[0]}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1">
              {GAMES.map(g => (
                <div
                  key={g.id}
                  title={`${g.name} (VIP выбирает игру)`}
                  className={`
                    px-3 py-1.5 rounded-xl text-xs font-semibold
                    ${activeGame === g.id
                      ? 'bg-secondary text-foreground border border-gold/40'
                      : 'bg-secondary/40 text-muted-foreground'
                    }
                  `}
                >
                  {g.emoji} {g.name.split(' ')[0]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 relative overflow-hidden p-4">
        {/* Felt surface */}
        <div className="felt-table absolute inset-4 rounded-[60px] border-4 border-felt-dark shadow-2xl">
          {/* Table inner border */}
          <div className="absolute inset-3 border border-white/10 rounded-[52px] pointer-events-none" />
          
          {/* Center area */}
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
            {children}
          </div>
        </div>

        {/* Seats */}
        {seats.map((seat, i) => {
          const pos = SEAT_POSITIONS[i];
          const isMyCurrentSeat = currentPlayer?.seatIndex === i;
          const isEmpty = seat.player === null;
          const canTake = isEmpty && currentPlayer && !isSeated;

          return (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-1 z-10"
              style={pos}
            >
              {/* Seat badge */}
              <div
                onClick={() => canTake && onTakeSeat(i)}
                className={`
                  relative rounded-2xl p-2 transition-all duration-300 cursor-default
                  ${seat.isVip
                    ? isMyCurrentSeat
                      ? 'seat-vip vip-glow animate-pulse-glow'
                      : isEmpty
                        ? 'seat-vip hover:scale-110 hover:cursor-pointer'
                        : 'seat-vip'
                    : isMyCurrentSeat
                      ? 'seat-me'
                      : isEmpty
                        ? 'seat-empty hover:border-border/60 hover:bg-secondary/80 ' + (canTake ? 'hover:scale-105 hover:cursor-pointer' : '')
                        : 'seat-player'
                  }
                `}
              >
                {/* VIP crown */}
                {seat.isVip && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg">👑</div>
                )}

                {isEmpty ? (
                  <div className="w-12 h-12 flex items-center justify-center">
                    {canTake ? (
                      <div className="flex flex-col items-center">
                        <Icon name="Plus" size={20} className="text-muted-foreground" />
                        <span className="text-muted-foreground text-xs mt-0.5">Сесть</span>
                      </div>
                    ) : (
                      <Icon name="User" size={20} className="text-muted-foreground/40" />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-12">
                    <div className="text-3xl leading-none">{seat.player!.avatar}</div>
                    <div className="text-foreground text-xs font-semibold mt-0.5 truncate max-w-full">
                      {isMyCurrentSeat ? 'Вы' : seat.player!.name}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="text-gold text-xs">{seat.player!.coins}</span>
                      <span className="text-xs">🪙</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Leave button */}
              {isMyCurrentSeat && (
                <button
                  onClick={onLeaveSeat}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-0.5 rounded-lg hover:bg-destructive/10"
                >
                  Встать
                </button>
              )}
            </div>
          );
        })}

        {/* Start game button overlay */}
        {!isSeated && currentPlayer && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
            <p className="text-muted-foreground text-sm text-center bg-black/40 backdrop-blur-sm px-4 py-2 rounded-xl">
              Займите место за столом чтобы играть
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
