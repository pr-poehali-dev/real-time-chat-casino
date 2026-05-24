import { useState, useEffect } from 'react';
import { Player } from '@/types/game';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardValue(val: string): number {
  if (['J', 'Q', 'K'].includes(val)) return 10;
  if (val === 'A') return 11;
  return parseInt(val);
}

function createDeck() {
  const deck: { suit: string; value: string; color: string }[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, color: ['♥', '♦'].includes(suit) ? '#e53e3e' : '#1a202c' });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function calcScore(hand: { value: string }[]): number {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    score += cardValue(card.value);
    if (card.value === 'A') aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

interface CardUI {
  suit: string;
  value: string;
  color: string;
}

function PlayingCard({ card, hidden = false }: { card: CardUI; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="card-back rounded-lg w-12 h-18 border-2 border-white/20 flex items-center justify-center shadow-lg"
        style={{ width: 48, height: 72 }}>
        <div className="text-white/30 text-xl">🂠</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col justify-between p-1.5 animate-deal"
      style={{ width: 48, height: 72, minWidth: 48 }}>
      <div className="text-xs font-bold leading-none" style={{ color: card.color }}>{card.value}</div>
      <div className="text-center text-lg leading-none" style={{ color: card.color }}>{card.suit}</div>
      <div className="text-xs font-bold leading-none self-end rotate-180" style={{ color: card.color }}>{card.value}</div>
    </div>
  );
}

interface Props {
  currentPlayer: Player | null;
  onCoinsChange: (delta: number) => void;
  onMessage: (text: string) => void;
}

export default function BlackjackGame({ currentPlayer, onCoinsChange, onMessage }: Props) {
  const [deck, setDeck] = useState(createDeck());
  const [playerHand, setPlayerHand] = useState<CardUI[]>([]);
  const [dealerHand, setDealerHand] = useState<CardUI[]>([]);
  const [phase, setPhase] = useState<'bet' | 'play' | 'done'>('bet');
  const [bet, setBet] = useState(10);
  const [result, setResult] = useState<string | null>(null);
  const [showDealer, setShowDealer] = useState(false);

  const isSeated = currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined;

  const startGame = () => {
    if (!currentPlayer || currentPlayer.coins < bet) return;
    const d = createDeck();
    const ph = [d[0], d[2]];
    const dh = [d[1], d[3]];
    setDeck(d.slice(4));
    setPlayerHand(ph);
    setDealerHand(dh);
    setPhase('play');
    setResult(null);
    setShowDealer(false);
    onCoinsChange(-bet);
  };

  const hit = () => {
    const card = deck[0];
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(prev => prev.slice(1));
    if (calcScore(newHand) > 21) {
      endGame(newHand, dealerHand, true);
    }
  };

  const stand = () => {
    let dh = [...dealerHand];
    let d = [...deck];
    while (calcScore(dh) < 17) {
      dh = [...dh, d[0]];
      d = d.slice(1);
    }
    setDealerHand(dh);
    setDeck(d);
    setShowDealer(true);
    endGame(playerHand, dh, false);
  };

  const endGame = (ph: CardUI[], dh: CardUI[], playerBust: boolean) => {
    setPhase('done');
    setShowDealer(true);
    const ps = calcScore(ph);
    const ds = calcScore(dh);
    if (playerBust) {
      setResult('Перебор! Дилер победил 😔');
      onMessage(`Перебор на блэкджеке (${ps} очков) — проиграл ${bet}🪙`);
    } else if (ds > 21 || ps > ds) {
      const win = bet * 2;
      setResult(`Вы победили! +${win}🪙 🎉`);
      onCoinsChange(win);
      onMessage(`Победа в блэкджеке! +${win}🪙`);
    } else if (ps === ds) {
      setResult('Ничья — ставка возвращена');
      onCoinsChange(bet);
      onMessage(`Ничья в блэкджеке`);
    } else {
      setResult(`Дилер победил (${ds} vs ${ps}) 😔`);
      onMessage(`Проигрыш в блэкджеке — -${bet}🪙`);
    }
  };

  if (!isSeated) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        <div className="text-4xl mb-2">21</div>
        <div>Займите место чтобы играть</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {/* Dealer */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-white/60 text-xs uppercase tracking-widest">Дилер {showDealer ? `(${calcScore(dealerHand)})` : ''}</div>
        <div className="flex gap-2">
          {dealerHand.length === 0 && <div className="text-white/20 text-xs">нет карт</div>}
          {dealerHand.map((c, i) => (
            <PlayingCard key={i} card={c} hidden={!showDealer && i === 1} />
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 text-white text-sm font-semibold animate-scale-in">
          {result}
        </div>
      )}

      {/* Player */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          {playerHand.length === 0 && <div className="text-white/20 text-xs">нет карт</div>}
          {playerHand.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
        </div>
        <div className="text-white/60 text-xs uppercase tracking-widest">
          Вы {playerHand.length > 0 ? `(${calcScore(playerHand)})` : ''}
        </div>
      </div>

      {/* Controls */}
      {phase === 'bet' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setBet(b => Math.max(5, b - 5))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">−</button>
            <span className="text-gold font-bold text-lg min-w-[60px] text-center">{bet} 🪙</span>
            <button onClick={() => setBet(b => Math.min(currentPlayer?.coins || 100, b + 5))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">+</button>
          </div>
          <button
            onClick={startGame}
            disabled={(currentPlayer?.coins || 0) < bet}
            className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl disabled:opacity-40 transition-all hover:scale-105"
          >
            Сдать карты
          </button>
        </div>
      )}

      {phase === 'play' && (
        <div className="flex gap-3">
          <button onClick={hit} className="bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2 rounded-xl transition-all hover:scale-105">
            Ещё
          </button>
          <button onClick={stand} className="bg-red-700 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-xl transition-all hover:scale-105">
            Стоп
          </button>
        </div>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('bet'); setPlayerHand([]); setDealerHand([]); setResult(null); }} className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl transition-all hover:scale-105">
          Снова
        </button>
      )}
    </div>
  );
}
