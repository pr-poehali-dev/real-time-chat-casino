import { useState } from 'react';
import { Player } from '@/types/game';

const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
type UnoColor = typeof COLORS[number];

const COLOR_MAP: Record<UnoColor, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
};

const COLOR_BG: Record<UnoColor, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
};

const NUMS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPECIALS = ['+2', '⊘', '↺'];

type UnoCard = { color: UnoColor; value: string; id: string };

let uid = 0;
function mkCard(color: UnoColor, value: string): UnoCard {
  return { color, value, id: `c${uid++}` };
}

function createDeck(): UnoCard[] {
  const d: UnoCard[] = [];
  for (const color of COLORS) {
    for (const num of NUMS) d.push(mkCard(color, num));
    for (const sp of SPECIALS) { d.push(mkCard(color, sp)); d.push(mkCard(color, sp)); }
  }
  return d.sort(() => Math.random() - 0.5);
}

function canPlay(card: UnoCard, top: UnoCard): boolean {
  return card.color === top.color || card.value === top.value;
}

function UnoCardUI({ card, onClick, playable, small = false }: { card: UnoCard; onClick?: () => void; playable?: boolean; small?: boolean }) {
  const w = small ? 36 : 46;
  const h = small ? 54 : 70;
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border-2 border-white/30 flex items-center justify-center font-bold shadow-md transition-all
        ${playable ? 'hover:-translate-y-2 hover:ring-2 hover:ring-white cursor-pointer' : ''}
        ${COLOR_BG[card.color]}
      `}
      style={{ width: w, height: h, minWidth: w, fontSize: small ? 12 : 16, color: 'white', userSelect: 'none' }}
    >
      {card.value}
    </div>
  );
}

interface Props {
  currentPlayer: Player | null;
  onCoinsChange: (delta: number) => void;
  onMessage: (text: string) => void;
}

export default function UnoGame({ currentPlayer, onCoinsChange, onMessage }: Props) {
  const [phase, setPhase] = useState<'bet' | 'play' | 'done'>('bet');
  const [bet, setBet] = useState(5);
  const [deck, setDeck] = useState<UnoCard[]>([]);
  const [playerHand, setPlayerHand] = useState<UnoCard[]>([]);
  const [oppHand, setOppHand] = useState<UnoCard[]>([]);
  const [topCard, setTopCard] = useState<UnoCard | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const isSeated = currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined;

  const startGame = () => {
    if (!currentPlayer || currentPlayer.coins < bet) return;
    const d = createDeck();
    const ph = d.slice(0, 7);
    const oh = d.slice(7, 14);
    let top = d[14];
    while (SPECIALS.some(s => top.value === s)) { top = d[Math.floor(Math.random() * 20) + 15]; }
    const rest = d.slice(14).filter(c => c.id !== top.id);
    setDeck(rest);
    setPlayerHand(ph);
    setOppHand(oh);
    setTopCard(top);
    setPhase('play');
    setIsPlayerTurn(true);
    setResult(null);
    setMsg('Ваш ход!');
    onCoinsChange(-bet);
  };

  const playCard = (card: UnoCard) => {
    if (!isPlayerTurn || !topCard) return;
    if (!canPlay(card, topCard)) { setMsg('Эту карту нельзя сыграть!'); return; }

    const newHand = playerHand.filter(c => c.id !== card.id);
    setPlayerHand(newHand);
    setTopCard(card);
    setMsg('');

    // Special effects
    let newOppHand = [...oppHand];
    let newDeck = [...deck];
    if (card.value === '+2') {
      newOppHand = [...newOppHand, ...newDeck.slice(0, 2)];
      newDeck = newDeck.slice(2);
      setOppHand(newOppHand);
      setDeck(newDeck);
      setMsg('Противник берёт 2 карты!');
    } else if (card.value === '↺') {
      setMsg('Смена очерёдности!');
    } else if (card.value === '⊘') {
      setMsg('Ход пропущен!');
      if (newHand.length === 0) { winGame(); return; }
      setIsPlayerTurn(true);
      return;
    }

    if (newHand.length === 0) { winGame(); return; }
    if (newHand.length === 1) setMsg('UNO! 🎴');

    setIsPlayerTurn(false);
    setTimeout(() => oppTurn(card, newOppHand, newDeck), 900);
  };

  const oppTurn = (top: UnoCard, oh: UnoCard[], d: UnoCard[]) => {
    const playable = oh.filter(c => canPlay(c, top));
    if (playable.length === 0) {
      const drawn = d[0];
      if (drawn) { oh = [...oh, drawn]; d = d.slice(1); }
      setOppHand(oh);
      setDeck(d);
      setIsPlayerTurn(true);
      setMsg('Противник берёт карту. Ваш ход!');
      return;
    }
    const play = playable[Math.floor(Math.random() * playable.length)];
    const newOh = oh.filter(c => c.id !== play.id);
    setTopCard(play);
    setOppHand(newOh);

    if (newOh.length === 0) { loseGame(); return; }

    let playerNewHand = [...playerHand];
    if (play.value === '+2') {
      playerNewHand = [...playerNewHand, ...d.slice(0, 2)];
      d = d.slice(2);
      setPlayerHand(playerNewHand);
      setDeck(d);
      setMsg('Вы берёте 2 карты!');
    }

    setIsPlayerTurn(true);
    if (newOh.length === 1) setMsg('Противник кричит UNO! 😱');
    else setMsg('Ваш ход!');
  };

  const drawCard = () => {
    if (!isPlayerTurn || deck.length === 0) return;
    const card = deck[0];
    setPlayerHand(prev => [...prev, card]);
    setDeck(prev => prev.slice(1));
    if (topCard && canPlay(card, topCard)) {
      setMsg('Взяли карту — можете её сыграть!');
    } else {
      setMsg('Карта не подходит. Ход переходит.');
      setIsPlayerTurn(false);
      setTimeout(() => oppTurn(topCard!, oppHand, deck.slice(1)), 800);
    }
  };

  const winGame = () => {
    setPhase('done');
    const win = bet * 2;
    setResult(`UNO! Вы победили! +${win}🪙 🎉`);
    onCoinsChange(win);
    onMessage(`Победа в UNO! +${win}🪙`);
  };

  const loseGame = () => {
    setPhase('done');
    setResult(`Противник сыграл все карты. Вы проиграли! -${bet}🪙`);
    onMessage(`Проигрыш в UNO — -${bet}🪙`);
  };

  if (!isSeated) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        <div className="text-4xl mb-2">🟥</div>
        <div>Займите место чтобы играть</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      {/* Opp */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-white/50 text-xs uppercase tracking-widest">Противник ({oppHand.length} карт)</div>
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {oppHand.map((_, i) => (
            <div key={i} className="rounded-md bg-gray-700 border border-white/10" style={{ width: 32, height: 48 }} />
          ))}
        </div>
      </div>

      {/* Top card + deck */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-md bg-gray-700 border border-white/20 cursor-pointer hover:scale-105 transition-all"
            onClick={drawCard}
            style={{ width: 46, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🂠
          </div>
          <div className="text-white/40 text-xs">{deck.length} карт</div>
        </div>
        {topCard && (
          <div className="flex flex-col items-center gap-1">
            <UnoCardUI card={topCard} />
            <div className="text-white/40 text-xs">верхняя</div>
          </div>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div className="text-white/70 text-xs bg-black/30 px-3 py-1 rounded-xl">{msg}</div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white text-sm font-semibold animate-scale-in text-center">
          {result}
        </div>
      )}

      {/* Player hand */}
      {phase === 'play' && topCard && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1 flex-wrap justify-center max-w-sm">
            {playerHand.map((card) => (
              <UnoCardUI key={card.id} card={card} onClick={() => playCard(card)} playable={isPlayerTurn && canPlay(card, topCard)} />
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
            Начать UNO!
          </button>
        </div>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('bet'); setPlayerHand([]); setOppHand([]); setTopCard(null); setResult(null); setMsg(''); }}
          className="bg-gold hover:bg-gold-dark text-primary-foreground font-display uppercase tracking-widest px-8 py-2 rounded-xl transition-all hover:scale-105">
          Снова
        </button>
      )}
    </div>
  );
}
