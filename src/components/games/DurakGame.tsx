import { useState } from 'react';
import { Player } from '@/types/game';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'пики', '♥': 'червы', '♦': 'бубны', '♣': 'трефы' };
const VALUES = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardNum(v: string) { return VALUES.indexOf(v); }

type CardData = { suit: string; value: string; color: string };

function createDeck(): CardData[] {
  const d: CardData[] = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      d.push({ suit, value, color: ['♥', '♦'].includes(suit) ? '#e53e3e' : '#1a202c' });
  return d.sort(() => Math.random() - 0.5);
}

function DurakCard({ card, onClick, selected, small = false }: { card: CardData; onClick?: () => void; selected?: boolean; small?: boolean }) {
  const w = small ? 36 : 44;
  const h = small ? 54 : 66;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md flex flex-col justify-between cursor-pointer transition-all ${selected ? 'ring-2 ring-gold -translate-y-2' : 'hover:-translate-y-1'}`}
      style={{ width: w, height: h, padding: 4, minWidth: w }}
    >
      <div style={{ color: card.color, fontSize: small ? 10 : 12, fontWeight: 700 }}>{card.value}</div>
      <div style={{ color: card.color, fontSize: small ? 12 : 16, textAlign: 'center' }}>{card.suit}</div>
      <div style={{ color: card.color, fontSize: small ? 10 : 12, fontWeight: 700, transform: 'rotate(180deg)', alignSelf: 'flex-end' }}>{card.value}</div>
    </div>
  );
}

function canBeat(attacker: CardData, defender: CardData, trump: string): boolean {
  if (defender.suit === trump && attacker.suit !== trump) return true;
  if (defender.suit === attacker.suit && cardNum(defender.value) > cardNum(attacker.value)) return true;
  return false;
}

interface Props {
  currentPlayer: Player | null;
  onCoinsChange: (delta: number) => void;
  onMessage: (text: string) => void;
}

export default function DurakGame({ currentPlayer, onCoinsChange, onMessage }: Props) {
  const [phase, setPhase] = useState<'bet' | 'play' | 'done'>('bet');
  const [bet, setBet] = useState(15);
  const [deck, setDeck] = useState<CardData[]>([]);
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [oppHand, setOppHand] = useState<CardData[]>([]);
  const [trump, setTrump] = useState('');
  const [tableAttack, setTableAttack] = useState<CardData | null>(null);
  const [tableDefend, setTableDefend] = useState<CardData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [isAttacking, setIsAttacking] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  const isSeated = currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined;

  const startGame = () => {
    if (!currentPlayer || currentPlayer.coins < bet) return;
    const d = createDeck();
    const ph = d.slice(0, 6);
    const oh = d.slice(6, 12);
    const rest = d.slice(12);
    const trumpSuit = rest[rest.length - 1]?.suit || SUITS[0];
    setDeck(rest);
    setPlayerHand(ph);
    setOppHand(oh);
    setTrump(trumpSuit);
    setPhase('play');
    setIsAttacking(true);
    setTableAttack(null);
    setTableDefend(null);
    setSelected(null);
    setResult(null);
    setRound(0);
    setPlayerScore(0);
    setOppScore(0);
    onCoinsChange(-bet);
  };

  const playCard = (index: number) => {
    if (!isAttacking) return;
    if (selected === index) { setSelected(null); return; }
    setSelected(index);
  };

  const attack = () => {
    if (selected === null) return;
    const card = playerHand[selected];
    setTableAttack(card);
    setPlayerHand(prev => prev.filter((_, i) => i !== selected));
    setSelected(null);
    setIsAttacking(false);
    // Opp tries to defend
    setTimeout(() => oppDefend(card), 700);
  };

  const oppDefend = (attacked: CardData) => {
    const defending = oppHand.find(c => canBeat(attacked, c, trump));
    if (defending) {
      setTableDefend(defending);
      setOppHand(prev => prev.filter(c => c !== defending));
      setTimeout(() => {
        setTableAttack(null);
        setTableDefend(null);
        setIsAttacking(true);
        setRound(r => r + 1);
        checkWin();
      }, 1200);
    } else {
      // Opp takes cards
      setOppHand(prev => [...prev, attacked, ...(tableDefend ? [tableDefend] : [])]);
      setTableAttack(null);
      setTableDefend(null);
      setIsAttacking(true);
      setPlayerScore(s => s + 1);
      setRound(r => r + 1);
      checkWin();
    }
  };

  const checkWin = () => {
    if (playerHand.length === 0 || oppHand.length === 0 || round >= 5) {
      finishGame();
    }
  };

  const finishGame = () => {
    setPhase('done');
    const win = bet * 2;
    if (playerScore >= oppScore) {
      setResult(`Вы выиграли! +${win}🪙 🎉`);
      onCoinsChange(win);
      onMessage(`Победа в дураке! +${win}🪙`);
    } else {
      setResult(`Вы дурак! 😔 Проигрыш ${bet}🪙`);
      onMessage(`Проигрыш в дураке — -${bet}🪙`);
    }
  };

  const takeCards = () => {
    if (!tableAttack) return;
    setPlayerHand(prev => [...prev, tableAttack!, ...(tableDefend ? [tableDefend] : [])]);
    setTableAttack(null);
    setTableDefend(null);
    setIsAttacking(false);
    // Opp attacks
    setTimeout(() => {
      if (oppHand.length > 0) {
        const card = oppHand[0];
        setTableAttack(card);
        setOppHand(prev => prev.slice(1));
        setIsAttacking(true);
      }
    }, 800);
    setOppScore(s => s + 1);
    setRound(r => r + 1);
  };

  if (!isSeated) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        <div className="text-4xl mb-2">🎴</div>
        <div>Займите место чтобы играть</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      {/* Trump indicator */}
      {trump && (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>Козырь:</span>
          <span style={{ color: ['♥', '♦'].includes(trump) ? '#fc8181' : '#e2e8f0', fontSize: 18 }}>{trump}</span>
          <span>{SUIT_NAMES[trump as keyof typeof SUIT_NAMES]}</span>
          {deck.length > 0 && <span className="ml-2 text-white/40">Колода: {deck.length}</span>}
        </div>
      )}

      {/* Opponent hand */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-white/50 text-xs uppercase tracking-widest">Противник ({oppHand.length} карт)</div>
        <div className="flex gap-1 flex-wrap justify-center">
          {oppHand.map((_, i) => (
            <div key={i} className="card-back rounded-md" style={{ width: 36, height: 54, border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex items-center gap-4 min-h-[80px]">
        {tableAttack && (
          <div className="flex flex-col items-center gap-1">
            <DurakCard card={tableAttack} small />
            <span className="text-white/40 text-xs">атака</span>
          </div>
        )}
        {tableDefend && (
          <div className="flex flex-col items-center gap-1">
            <DurakCard card={tableDefend} small />
            <span className="text-white/40 text-xs">отбито</span>
          </div>
        )}
        {!tableAttack && !tableDefend && phase === 'play' && (
          <div className="text-white/20 text-xs">стол пуст</div>
        )}
      </div>

      {/* Score */}
      {phase === 'play' && (
        <div className="flex gap-4 text-xs text-white/50">
          <span>Ваши победы: {playerScore}</span>
          <span>|</span>
          <span>Раунд: {round + 1}/6</span>
          <span>|</span>
          <span>Победы врага: {oppScore}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white text-sm font-semibold animate-scale-in">
          {result}
        </div>
      )}

      {/* Player hand */}
      {phase === 'play' && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1 flex-wrap justify-center">
            {playerHand.map((card, i) => (
              <DurakCard key={i} card={card} onClick={() => isAttacking && playCard(i)} selected={selected === i} />
            ))}
          </div>
          <div className="text-white/50 text-xs uppercase tracking-widest">Вы ({playerHand.length} карт)</div>
        </div>
      )}

      {/* Controls */}
      {phase === 'bet' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setBet(b => Math.max(5, b - 5))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">−</button>
            <span className="text-gold font-bold text-lg min-w-[60px] text-center">{bet} 🪙</span>
            <button onClick={() => setBet(b => Math.min(currentPlayer?.coins || 100, b + 5))} className="bg-secondary text-foreground w-7 h-7 rounded-lg text-sm hover:bg-secondary/80">+</button>
          </div>
          <button onClick={startGame} disabled={(currentPlayer?.coins || 0) < bet}
            className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl disabled:opacity-40 transition-all hover:scale-105">
            Раздать карты
          </button>
        </div>
      )}

      {phase === 'play' && isAttacking && tableAttack && (
        <button onClick={takeCards} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105">
          Взять карты
        </button>
      )}

      {phase === 'play' && isAttacking && !tableAttack && selected !== null && (
        <button onClick={attack} className="bg-gold hover:bg-gold-dark text-primary-foreground px-6 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105">
          Атаковать
        </button>
      )}

      {phase === 'play' && isAttacking && !tableAttack && (
        <button onClick={finishGame} className="text-muted-foreground hover:text-foreground text-xs underline transition-colors">
          Завершить игру
        </button>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('bet'); setPlayerHand([]); setOppHand([]); setResult(null); setTableAttack(null); setTableDefend(null); }}
          className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl transition-all hover:scale-105">
          Снова
        </button>
      )}
    </div>
  );
}
