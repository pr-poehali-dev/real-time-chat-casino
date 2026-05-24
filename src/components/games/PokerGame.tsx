import { useState } from 'react';
import { Player } from '@/types/game';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKS = ['Пара', 'Две пары', 'Тройка', 'Стрит', 'Флэш', 'Фулл хаус', 'Каре', 'Стрит-флэш', 'Роял-флэш'];

function createDeck() {
  const d: { suit: string; value: string; color: string; num: number }[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < VALUES.length; i++) {
      d.push({ suit, value: VALUES[i], color: ['♥', '♦'].includes(suit) ? '#e53e3e' : '#1a202c', num: i + 2 });
    }
  }
  return d.sort(() => Math.random() - 0.5);
}

type CardData = { suit: string; value: string; color: string; num: number };

function SmallCard({ card, hidden = false }: { card: CardData; hidden?: boolean }) {
  if (hidden) return (
    <div className="card-back rounded-md border border-white/20 shadow-md" style={{ width: 40, height: 60 }} />
  );
  return (
    <div className="bg-white rounded-md shadow-md flex flex-col justify-between p-1 animate-deal" style={{ width: 40, height: 60, minWidth: 40 }}>
      <div className="text-xs font-bold" style={{ color: card.color, fontSize: 11 }}>{card.value}</div>
      <div className="text-center" style={{ color: card.color, fontSize: 14 }}>{card.suit}</div>
      <div className="text-xs font-bold self-end rotate-180" style={{ color: card.color, fontSize: 11 }}>{card.value}</div>
    </div>
  );
}

function evaluateHand(cards: CardData[]): string {
  if (cards.length < 2) return '';
  const nums = cards.map(c => c.num).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts: Record<number, number> = {};
  nums.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
  const vals = Object.values(counts).sort((a, b) => b - a);
  const isFlush = suits.every(s => s === suits[0]) && cards.length >= 5;
  const isStraight = cards.length >= 5 && (Math.max(...nums) - Math.min(...nums) === 4 && new Set(nums).size === 5);
  if (isFlush && isStraight && Math.max(...nums) === 14) return 'Роял-флэш 🏆';
  if (isFlush && isStraight) return 'Стрит-флэш 🌟';
  if (vals[0] === 4) return 'Каре 💎';
  if (vals[0] === 3 && vals[1] === 2) return 'Фулл хаус 🎯';
  if (isFlush) return 'Флэш ♠';
  if (isStraight) return 'Стрит 📏';
  if (vals[0] === 3) return 'Тройка';
  if (vals[0] === 2 && vals[1] === 2) return 'Две пары';
  if (vals[0] === 2) return 'Пара';
  return 'Старшая карта';
}

interface Props {
  currentPlayer: Player | null;
  onCoinsChange: (delta: number) => void;
  onMessage: (text: string) => void;
}

export default function PokerGame({ currentPlayer, onCoinsChange, onMessage }: Props) {
  const [deck, setDeck] = useState<CardData[]>([]);
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [communityCards, setCommunityCards] = useState<CardData[]>([]);
  const [oppHand, setOppHand] = useState<CardData[]>([]);
  const [phase, setPhase] = useState<'bet' | 'preflop' | 'flop' | 'turn' | 'river' | 'done'>('bet');
  const [pot, setPot] = useState(0);
  const [bet, setBet] = useState(20);
  const [callAmount, setCallAmount] = useState(20);
  const [result, setResult] = useState<string | null>(null);
  const [showOpp, setShowOpp] = useState(false);

  const isSeated = currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined;

  const startGame = () => {
    if (!currentPlayer || currentPlayer.coins < bet) return;
    const d = createDeck();
    const ph = [d[0], d[2]];
    const oh = [d[1], d[3]];
    const comm = d.slice(4, 9);
    setDeck(d.slice(9));
    setPlayerHand(ph);
    setOppHand(oh);
    setCommunityCards(comm);
    setPhase('preflop');
    setPot(bet * 2);
    setCallAmount(bet);
    setResult(null);
    setShowOpp(false);
    onCoinsChange(-bet);
  };

  const advance = (action: 'call' | 'raise' | 'fold') => {
    if (action === 'fold') {
      setPhase('done');
      setResult(`Вы сбросили карты. Потеряно ${pot}🪙`);
      setShowOpp(true);
      onMessage(`Пас в покере — потерял ${pot}🪙`);
      return;
    }
    if (action === 'raise') {
      const raise = callAmount + 20;
      if ((currentPlayer?.coins || 0) < raise) return;
      setPot(p => p + raise);
      setCallAmount(raise);
      onCoinsChange(-raise);
    } else {
      setPot(p => p + callAmount);
      onCoinsChange(-callAmount);
    }
    const next = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'done' } as Record<string, string>;
    const nextPhase = next[phase] as typeof phase;
    setPhase(nextPhase);
    if (nextPhase === 'done') {
      showdown();
    }
  };

  const showdown = () => {
    setShowOpp(true);
    const pCards = [...playerHand, ...communityCards];
    const oCards = [...oppHand, ...communityCards];
    const pRank = evaluateHand(pCards);
    const oRank = evaluateHand(oCards);
    const pIdx = RANKS.findIndex(r => pRank.startsWith(r));
    const oIdx = RANKS.findIndex(r => oRank.startsWith(r));
    const win = pot;
    if (pIdx >= oIdx) {
      setResult(`Вы победили! ${pRank} +${win}🪙 🎉`);
      onCoinsChange(win);
      onMessage(`Победа в покере (${pRank}) +${win}🪙!`);
    } else {
      setResult(`Противник победил (${oRank}) 😔`);
      onMessage(`Проигрыш в покере (${oRank}) -${callAmount}🪙`);
    }
  };

  const communityVisible = {
    preflop: 0,
    flop: 3,
    turn: 4,
    river: 5,
    done: 5,
    bet: 0,
  }[phase];

  if (!isSeated) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        <div className="text-4xl mb-2">🃏</div>
        <div>Займите место чтобы играть</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-sm">
      {/* Opponent */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-white/60 text-xs uppercase tracking-widest">Противник</div>
        <div className="flex gap-1.5">
          {oppHand.map((c, i) => <SmallCard key={i} card={c} hidden={!showOpp} />)}
        </div>
        {showOpp && <div className="text-xs text-white/60">{evaluateHand([...oppHand, ...communityCards])}</div>}
      </div>

      {/* Community */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-white/50 text-xs uppercase tracking-widest">Общие карты</div>
        <div className="flex gap-1.5">
          {communityCards.slice(0, communityVisible).map((c, i) => <SmallCard key={i} card={c} />)}
          {Array.from({ length: 5 - communityVisible }).map((_, i) => (
            <div key={i} className="rounded-md border border-white/10" style={{ width: 40, height: 60 }} />
          ))}
        </div>
      </div>

      {/* Pot */}
      {phase !== 'bet' && (
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-1.5 text-gold text-sm font-bold">
          Банк: {pot} 🪙
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white text-sm font-semibold animate-scale-in text-center">
          {result}
        </div>
      )}

      {/* Player */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1.5">
          {playerHand.map((c, i) => <SmallCard key={i} card={c} />)}
        </div>
        {playerHand.length > 0 && <div className="text-xs text-white/60">{evaluateHand([...playerHand, ...communityCards.slice(0, communityVisible)])}</div>}
        <div className="text-white/60 text-xs uppercase tracking-widest">Вы</div>
      </div>

      {/* Phase indicator */}
      {phase !== 'bet' && phase !== 'done' && (
        <div className="text-white/40 text-xs uppercase tracking-widest">
          {{ preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер' }[phase]}
        </div>
      )}

      {/* Controls */}
      {phase === 'bet' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setBet(b => Math.max(20, b - 10))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">−</button>
            <span className="text-gold font-bold text-lg min-w-[60px] text-center">{bet} 🪙</span>
            <button onClick={() => setBet(b => Math.min(currentPlayer?.coins || 100, b + 10))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">+</button>
          </div>
          <button onClick={startGame} disabled={(currentPlayer?.coins || 0) < bet}
            className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl disabled:opacity-40 transition-all hover:scale-105">
            Раздать карты
          </button>
        </div>
      )}

      {['preflop', 'flop', 'turn', 'river'].includes(phase) && (
        <div className="flex gap-2">
          <button onClick={() => advance('fold')} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105">Пас</button>
          <button onClick={() => advance('call')} className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105">
            Колл {callAmount}🪙
          </button>
          <button onClick={() => advance('raise')} disabled={(currentPlayer?.coins || 0) < callAmount + 20}
            className="bg-gold hover:bg-gold-dark text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:scale-105">
            Рейз +20🪙
          </button>
        </div>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('bet'); setPlayerHand([]); setCommunityCards([]); setOppHand([]); setPot(0); setResult(null); setShowOpp(false); }}
          className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl transition-all hover:scale-105">
          Снова
        </button>
      )}
    </div>
  );
}
