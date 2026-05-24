import { useState, useEffect, useCallback } from 'react';
import { api } from '@/hooks/useApi';
import Icon from '@/components/ui/icon';

// ─── Types ───────────────────────────────────────────────────
interface CardData { s?: string; v: string; c?: string; }
interface GameState {
  phase: string;
  bet?: number;
  hands?: Record<string, CardData[]>;
  dealer?: CardData[];
  community?: CardData[];
  community_revealed?: number;
  top?: CardData;
  deck?: CardData[];
  trump?: string;
  trump_card?: CardData;
  table_attack?: CardData | null;
  table_defend?: CardData | null;
  attacker?: string;
  defender?: string;
  folded?: string[];
  stood?: string[];
  busted?: string[];
  direction?: number;
  results?: Record<string, { result?: string; rank_name?: string; delta?: number; coins?: number; rank?: number }>;
  winner?: string;
  call_amount?: number;
  pot?: number;
}

interface Player { id: string; name: string; avatar: string; coins: number; is_vip?: boolean; }

interface Props {
  sessionId: string;
  me: Player | null;
  isSeated: boolean;
  activeGame: string;
  seatedPlayers: { id: string; name: string; avatar: string }[];
  onCoinsUpdate: (coins: number) => void;
}

// ─── Playing Card UI ────────────────────────────────────────
const RED_SUITS = ['♥', '♦'];

function PlayingCard({ card, hidden = false, small = false, animate = false }: {
  card: CardData; hidden?: boolean; small?: boolean; animate?: boolean;
}) {
  const w = small ? 38 : 48;
  const h = small ? 57 : 72;
  if (hidden) return (
    <div style={{ width: w, height: h, minWidth: w }}
      className={`card-back rounded-lg border border-white/20 shadow-lg ${animate ? 'animate-deal' : ''}`} />
  );
  const isRed = card.s ? RED_SUITS.includes(card.s) : false;
  const color = isRed ? '#f87171' : '#f1f5f9';
  return (
    <div style={{ width: w, height: h, minWidth: w, padding: small ? 3 : 5 }}
      className={`bg-white rounded-lg shadow-lg flex flex-col justify-between ${animate ? 'animate-deal' : ''}`}>
      <span style={{ color, fontSize: small ? 11 : 13, fontWeight: 700, lineHeight: 1 }}>{card.v}</span>
      <span style={{ color, fontSize: small ? 15 : 20, textAlign: 'center', display: 'block', lineHeight: 1 }}>{card.s || ''}</span>
      <span style={{ color, fontSize: small ? 11 : 13, fontWeight: 700, transform: 'rotate(180deg)', display: 'block', alignSelf: 'flex-end', lineHeight: 1 }}>{card.v}</span>
    </div>
  );
}

// UNO card
const UNO_BG: Record<string, string> = {
  red: 'bg-red-600', blue: 'bg-blue-600', green: 'bg-green-600', yellow: 'bg-yellow-500'
};
function UnoCard({ card, playable, onClick, animate }: { card: CardData; playable?: boolean; onClick?: () => void; animate?: boolean }) {
  return (
    <div onClick={onClick}
      style={{ width: 44, height: 66, minWidth: 44, fontSize: 14, userSelect: 'none' }}
      className={`${UNO_BG[card.c || 'red']} rounded-lg border-2 border-white/30 flex items-center justify-center font-bold text-white shadow-lg transition-all
        ${playable ? 'cursor-pointer hover:-translate-y-2 hover:ring-2 hover:ring-white hover:shadow-xl' : 'opacity-60'}
        ${animate ? 'animate-deal' : ''}`}>
      {card.v === '+2' ? '+2' : card.v === 'skip' ? '⊘' : card.v === 'reverse' ? '↺' : card.v}
    </div>
  );
}

// Result banner
function ResultBanner({ results, myId, game }: { results: GameState['results']; myId: string; game: string }) {
  const mine = results?.[myId];
  if (!mine) return null;
  const isWin = mine.result === 'win';
  const isPush = mine.result === 'push';
  return (
    <div className={`px-6 py-3 rounded-2xl font-display text-xl tracking-widest uppercase animate-scale-in shadow-2xl
      ${isWin ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' : isPush ? 'bg-secondary text-foreground' : 'bg-gradient-to-r from-red-800 to-red-600 text-white'}`}>
      {isWin ? `🏆 ПОБЕДА! +${mine.delta}🪙` : isPush ? '🤝 НИЧЬЯ' : `💀 ПРОИГРЫШ ${mine.delta}🪙`}
      {mine.rank_name && <div className="text-sm font-body opacity-80 normal-case tracking-normal mt-0.5">{mine.rank_name}</div>}
    </div>
  );
}

// Bet selector
function BetSelector({ value, onChange, max, minVal = 5 }: { value: number; onChange: (v: number) => void; max: number; minVal?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(minVal, value - 5))}
        className="bg-secondary hover:bg-secondary/80 text-foreground w-8 h-8 rounded-xl text-lg font-bold transition-all hover:scale-110">−</button>
      <span className="neon-text-gold font-bold text-xl min-w-[70px] text-center">{value}🪙</span>
      <button onClick={() => onChange(Math.min(max, value + 5))}
        className="bg-secondary hover:bg-secondary/80 text-foreground w-8 h-8 rounded-xl text-lg font-bold transition-all hover:scale-110">+</button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function GameZone({ sessionId, me, isSeated, activeGame, seatedPlayers, onCoinsUpdate }: Props) {
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [gameState, setGameState] = useState<GameState>({} as GameState);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [pot, setPot] = useState(0);
  const [bet, setBet] = useState(10);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const syncGame = useCallback(async () => {
    if (!sessionId) return;
    const data = await api.getGameState(sessionId);
    if (data.error) return;
    setGameStatus(data.status || 'waiting');
    setGameState(data.state || {});
    setCurrentTurn(data.current_turn || null);
    setPot(data.pot || 0);
    const myResult = data.state?.results?.[me?.id || ''];
    if (myResult?.coins !== undefined) onCoinsUpdate(myResult.coins);
  }, [sessionId, me?.id, onCoinsUpdate]);

  useEffect(() => {
    syncGame();
    const t = setInterval(syncGame, 2500);
    return () => clearInterval(t);
  }, [syncGame]);

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!me || !sessionId || loading) return;
    setLoading(true);
    const data = await api.gameAction(sessionId, me.id, action, extra);
    if (!data.error) {
      setGameStatus(data.status || 'waiting');
      setGameState(data.state || {});
      setCurrentTurn(data.current_turn || null);
      setPot(data.pot || 0);
      const myResult = data.state?.results?.[me.id];
      if (myResult?.coins !== undefined) onCoinsUpdate(myResult.coins);
    }
    setLoading(false);
  };

  const startGame = () => doAction('start', { bet });
  const resetGame = () => doAction('reset');

  const isMyTurn = currentTurn === me?.id;
  const myHand = gameState.hands?.[me?.id || ''] || [];
  const phase = gameState.phase || '';
  const results = gameState.results || {};
  const isFinished = gameStatus === 'finished';

  // ── NOT SEATED ──
  if (!isSeated || !me) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <div className="text-5xl opacity-30">🃏</div>
        <p className="text-muted-foreground text-sm">Займите место за столом чтобы играть</p>
      </div>
    );
  }

  // ── WAITING / START ──
  if (gameStatus === 'waiting') {
    const isVip = me.is_vip;
    const minBet = activeGame === 'poker' ? 20 : activeGame === 'durak' ? 10 : activeGame === 'uno' ? 5 : 10;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="text-center">
          <div className="font-display text-2xl neon-text-pink tracking-widest uppercase">Ожидание</div>
          <div className="text-muted-foreground text-sm mt-1">
            {seatedPlayers.length} / 5 игроков за столом
          </div>
        </div>
        <div className="flex gap-2">
          {seatedPlayers.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{p.avatar}</span>
              <span className="text-xs text-muted-foreground">{p.name}</span>
            </div>
          ))}
        </div>
        {isVip && (
          <div className="flex flex-col items-center gap-3">
            <BetSelector value={bet} onChange={setBet} max={me.coins} minVal={minBet} />
            <button onClick={startGame} disabled={loading || seatedPlayers.length === 0}
              className="btn-primary px-10 py-3 rounded-2xl text-lg disabled:opacity-40">
              {loading ? 'Запуск...' : '🃏 Начать игру'}
            </button>
            <p className="text-muted-foreground text-xs">👑 VIP запускает игру</p>
          </div>
        )}
        {!isVip && (
          <p className="text-muted-foreground text-sm">Ожидаем запуска от VIP...</p>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // ── BLACKJACK ──
  // ─────────────────────────────────────────────────────────
  if (activeGame === 'blackjack') {
    const dealer = gameState.dealer || [];
    const showDealer = isFinished || phase === 'done';

    const bjScore = (hand: CardData[]) => {
      let s = 0, aces = 0;
      for (const c of hand) {
        if (['J','Q','K'].includes(c.v)) s += 10;
        else if (c.v === 'A') { s += 11; aces++; }
        else s += parseInt(c.v) || 0;
      }
      while (s > 21 && aces > 0) { s -= 10; aces--; }
      return s;
    };

    return (
      <div className="flex flex-col items-center h-full gap-3 py-3 px-2 overflow-hidden">
        {/* Dealer */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-white/50 text-xs uppercase tracking-widest">
            Дилер {showDealer ? `· ${bjScore(dealer)} очков` : ''}
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {dealer.map((c, i) => (
              <PlayingCard key={i} card={c} hidden={!showDealer && i === 1} animate={i === dealer.length - 1} small />
            ))}
          </div>
        </div>

        {/* Pot */}
        <div className="neon-text-gold text-sm font-bold bg-black/30 px-4 py-1 rounded-full border border-yellow-500/20">
          Банк: {pot}🪙
        </div>

        {/* Results / Turn indicator */}
        {isFinished && <ResultBanner results={results} myId={me.id} game="blackjack" />}
        {!isFinished && (
          <div className="text-xs text-muted-foreground">
            {isMyTurn ? <span className="neon-text-cyan animate-pulse">← Ваш ход →</span> : `Ход: ${seatedPlayers.find(p => p.id === currentTurn)?.name || '...'}`}
          </div>
        )}

        {/* Other players */}
        <div className="flex gap-3 flex-wrap justify-center">
          {seatedPlayers.filter(p => p.id !== me.id).map(p => {
            const hand = gameState.hands?.[p.id] || [];
            const score = bjScore(hand);
            const res = results[p.id];
            return (
              <div key={p.id} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
                ${currentTurn === p.id ? 'border-pink-500/50 bg-pink-900/10' : 'border-border bg-secondary/30'}`}>
                <span className="text-xl">{p.avatar}</span>
                <span className="text-xs text-muted-foreground">{p.name}</span>
                <div className="flex gap-1">
                  {hand.map((c, i) => <PlayingCard key={i} card={c} small hidden={!isFinished} />)}
                </div>
                {isFinished && <span className="text-xs">{score}pts {res?.result === 'win' ? '🏆' : res?.result === 'bust' ? '💥' : '💀'}</span>}
              </div>
            );
          })}
        </div>

        {/* My hand */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <div className="flex gap-1.5 flex-wrap justify-center">
            {myHand.map((c, i) => <PlayingCard key={i} card={c} animate={i === myHand.length - 1} />)}
          </div>
          <div className="text-white/60 text-xs">Вы · {bjScore(myHand)} очков
            {results[me.id]?.result === 'bust' && <span className="text-red-400 ml-2">Перебор!</span>}
          </div>
        </div>

        {/* Controls */}
        {!isFinished && isMyTurn && !(gameState.stood || []).includes(me.id) && !(gameState.busted || []).includes(me.id) && (
          <div className="flex gap-3">
            <button onClick={() => doAction('hit')} disabled={loading}
              className="btn-cyan px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:scale-105">
              Ещё карту
            </button>
            <button onClick={() => doAction('stand')} disabled={loading}
              className="bg-red-700 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:scale-105">
              Хватит
            </button>
          </div>
        )}
        {!isFinished && !isMyTurn && <p className="text-muted-foreground text-xs">Ожидаем других игроков...</p>}
        {isFinished && (
          <button onClick={resetGame} disabled={loading} className="btn-primary px-8 py-2 rounded-xl disabled:opacity-40">
            Новая игра
          </button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // ── POKER ──
  // ─────────────────────────────────────────────────────────
  if (activeGame === 'poker') {
    const community = gameState.community || [];
    const revealed = isFinished ? 5 : (gameState.community_revealed || 0);
    const folded = gameState.folded || [];
    const isFolded = folded.includes(me.id);
    const callAmt = gameState.call_amount || gameState.bet || 20;
    const phaseNames: Record<string, string> = { preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер', done: 'Финал' };

    return (
      <div className="flex flex-col items-center h-full gap-2.5 py-3 px-2 overflow-hidden">
        {/* Phase + Pot */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{phaseNames[phase] || phase}</span>
          <span className="neon-text-gold text-sm font-bold bg-black/30 px-3 py-0.5 rounded-full border border-yellow-500/20">Банк: {pot}🪙</span>
        </div>

        {/* Community cards */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-white/40 text-xs uppercase tracking-widest">Общие карты</div>
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              i < revealed
                ? <PlayingCard key={i} card={community[i]} small animate={i === revealed - 1} />
                : <div key={i} style={{ width: 38, height: 57 }} className="rounded-lg border border-white/10 bg-white/5" />
            ))}
          </div>
        </div>

        {/* Turn indicator */}
        {!isFinished && (
          <div className="text-xs">
            {isMyTurn && !isFolded
              ? <span className="neon-text-cyan animate-pulse">← Ваш ход →</span>
              : <span className="text-muted-foreground">Ход: {seatedPlayers.find(p => p.id === currentTurn)?.name || '...'}</span>
            }
          </div>
        )}

        {isFinished && <ResultBanner results={results} myId={me.id} game="poker" />}

        {/* Other players */}
        <div className="flex gap-2 flex-wrap justify-center">
          {seatedPlayers.filter(p => p.id !== me.id).map(p => {
            const hand = gameState.hands?.[p.id] || [];
            const isFold = folded.includes(p.id);
            const res = results[p.id];
            return (
              <div key={p.id} className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-all
                ${isFold ? 'opacity-40 border-border' : currentTurn === p.id ? 'border-pink-500/50 bg-pink-900/10' : 'border-border bg-secondary/30'}`}>
                <span className="text-xl">{p.avatar}</span>
                <span className="text-xs text-muted-foreground">{p.name}{isFold ? ' (пас)' : ''}</span>
                <div className="flex gap-1">
                  {hand.map((c, i) => <PlayingCard key={i} card={c} small hidden={!isFinished} />)}
                </div>
                {isFinished && res?.rank_name && <span className="text-xs neon-text-gold">{res.rank_name}</span>}
                {p.id === gameState.winner && <span className="text-xs">🏆</span>}
              </div>
            );
          })}
        </div>

        {/* My hand */}
        <div className="flex flex-col items-center gap-1.5 mt-auto">
          <div className="flex gap-1.5">
            {myHand.map((c, i) => <PlayingCard key={i} card={c} animate />)}
          </div>
          {isFinished && results[me.id]?.rank_name && (
            <span className="text-xs neon-text-gold">{results[me.id].rank_name}</span>
          )}
          <div className="text-white/50 text-xs">Ваши карты {isFolded && '· Пас'}</div>
        </div>

        {/* Controls */}
        {!isFinished && isMyTurn && !isFolded && (
          <div className="flex gap-2">
            <button onClick={() => doAction('fold')} disabled={loading}
              className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-40">Пас</button>
            <button onClick={() => doAction('call')} disabled={loading || me.coins < callAmt}
              className="btn-cyan px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">Колл {callAmt}🪙</button>
            <button onClick={() => doAction('raise')} disabled={loading || me.coins < callAmt + 20}
              className="btn-gold px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">Рейз +20🪙</button>
          </div>
        )}
        {!isFinished && isFolded && <p className="text-muted-foreground text-xs">Вы сбросили карты</p>}
        {!isFinished && !isMyTurn && !isFolded && <p className="text-muted-foreground text-xs">Ожидаем других...</p>}
        {isFinished && (
          <button onClick={resetGame} disabled={loading} className="btn-primary px-8 py-2 rounded-xl disabled:opacity-40">Новая игра</button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // ── DURAK ──
  // ─────────────────────────────────────────────────────────
  if (activeGame === 'durak') {
    const trump = gameState.trump || '';
    const trumpCard = gameState.trump_card;
    const tableAttack = gameState.table_attack;
    const tableDefend = gameState.table_defend;
    const attacker = gameState.attacker;
    const defender = gameState.defender;
    const deckLen = (gameState.deck || []).length;
    const isAttacker = attacker === me.id;
    const isDefender = defender === me.id;

    const DURAK_ORDER = ['6','7','8','9','10','J','Q','K','A'];
    const canBeat = (att: CardData, def: CardData) => {
      if (def.s === trump && att.s !== trump) return true;
      if (def.s === att.s) return DURAK_ORDER.indexOf(def.v) > DURAK_ORDER.indexOf(att.v);
      return false;
    };

    return (
      <div className="flex flex-col items-center h-full gap-2.5 py-3 px-2 overflow-hidden">
        {/* Trump + deck */}
        <div className="flex items-center gap-4 text-xs">
          {trumpCard && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Козырь:</span>
              <span style={{ color: ['♥','♦'].includes(trump) ? '#f87171' : '#e2e8f0', fontSize: 18 }}>{trump}</span>
              <PlayingCard card={trumpCard} small />
            </div>
          )}
          <span className="text-muted-foreground">Колода: {deckLen}</span>
          <span className="neon-text-gold font-bold">Банк: {pot}🪙</span>
        </div>

        {/* Role indicator */}
        {!isFinished && (
          <div className="text-xs">
            {isAttacker && <span className="neon-text-pink animate-pulse">⚔️ Вы атакуете</span>}
            {isDefender && <span className="neon-text-cyan animate-pulse">🛡️ Вы отбиваете</span>}
            {!isAttacker && !isDefender && <span className="text-muted-foreground">Наблюдаете</span>}
          </div>
        )}

        {isFinished && <ResultBanner results={results} myId={me.id} game="durak" />}

        {/* Table */}
        <div className="flex items-center gap-4 min-h-[70px] bg-black/20 rounded-2xl px-6 py-3 border border-border/40">
          {tableAttack ? (
            <div className="flex flex-col items-center gap-1">
              <PlayingCard card={tableAttack} animate />
              <span className="text-white/40 text-xs">атака</span>
            </div>
          ) : <span className="text-white/20 text-xs">Стол пуст</span>}
          {tableDefend && (
            <div className="flex flex-col items-center gap-1">
              <PlayingCard card={tableDefend} animate />
              <span className="text-white/40 text-xs">отбито</span>
            </div>
          )}
        </div>

        {/* Other players hands (back) */}
        <div className="flex gap-3 flex-wrap justify-center">
          {seatedPlayers.filter(p => p.id !== me.id).map(p => {
            const hand = gameState.hands?.[p.id] || [];
            return (
              <div key={p.id} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border
                ${p.id === attacker ? 'border-pink-500/50 bg-pink-900/10' : p.id === defender ? 'border-cyan-500/50 bg-cyan-900/10' : 'border-border'}`}>
                <span className="text-xl">{p.avatar}</span>
                <span className="text-xs text-muted-foreground">{p.name} {p.id === attacker ? '⚔️' : p.id === defender ? '🛡️' : ''}</span>
                <div className="flex gap-0.5">{hand.map((_, i) => <div key={i} style={{ width: 24, height: 36 }} className="card-back rounded" />)}</div>
                <span className="text-xs text-muted-foreground">{hand.length} карт</span>
              </div>
            );
          })}
        </div>

        {/* My hand */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <div className="flex gap-1 flex-wrap justify-center">
            {myHand.map((c, i) => {
              const isSel = selectedCard?.v === c.v && selectedCard?.s === c.s;
              const isPlayable = isAttacker && !tableAttack;
              const isDefendable = isDefender && tableAttack && !tableDefend && canBeat(tableAttack, c);
              return (
                <div key={i} onClick={() => {
                  if (isPlayable || isDefendable) setSelectedCard(isSel ? null : c);
                }}
                  className={`transition-all ${(isPlayable || isDefendable) ? 'cursor-pointer hover:-translate-y-2' : ''}
                    ${isSel ? '-translate-y-3 ring-2 ring-yellow-400' : ''}`}>
                  <PlayingCard card={c} small={false} />
                </div>
              );
            })}
          </div>
          <div className="text-white/50 text-xs">Вы · {myHand.length} карт</div>
        </div>

        {/* Controls */}
        {!isFinished && (
          <div className="flex gap-2 flex-wrap justify-center">
            {isAttacker && !tableAttack && selectedCard && (
              <button onClick={() => { doAction('attack', { card: selectedCard }); setSelectedCard(null); }} disabled={loading}
                className="btn-primary px-6 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">⚔️ Атаковать</button>
            )}
            {isDefender && tableAttack && !tableDefend && selectedCard && canBeat(tableAttack, selectedCard) && (
              <button onClick={() => { doAction('defend', { card: selectedCard }); setSelectedCard(null); }} disabled={loading}
                className="btn-cyan px-6 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">🛡️ Отбить</button>
            )}
            {isDefender && tableAttack && !tableDefend && (
              <button onClick={() => doAction('take_cards')} disabled={loading}
                className="bg-red-800 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">Взять карты</button>
            )}
            {isAttacker && !tableAttack && (
              <button onClick={() => doAction('end_round')} disabled={loading}
                className="bg-secondary hover:bg-secondary/80 text-muted-foreground px-4 py-2 rounded-xl text-xs disabled:opacity-40">Завершить раунд</button>
            )}
          </div>
        )}
        {isFinished && (
          <button onClick={resetGame} disabled={loading} className="btn-primary px-8 py-2 rounded-xl disabled:opacity-40">Новая игра</button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // ── UNO ──
  // ─────────────────────────────────────────────────────────
  if (activeGame === 'uno') {
    const top = gameState.top;
    const deckLen = (gameState.deck || []).length;
    const direction = gameState.direction === -1 ? '↺' : '→';
    const UNO_CAN_PLAY = (card: CardData) => top ? (card.c === top.c || card.v === top.v) : false;

    return (
      <div className="flex flex-col items-center h-full gap-2.5 py-3 px-2 overflow-hidden">
        {/* Top info */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Направление: {direction}</span>
          <span className="neon-text-gold font-bold">Банк: {pot}🪙</span>
          <span className="text-muted-foreground">Колода: {deckLen}</span>
        </div>

        {/* Top card */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-white/40 text-xs uppercase tracking-widest">Верхняя карта</div>
          {top && <UnoCard card={top} animate />}
        </div>

        {/* Turn */}
        {!isFinished && (
          <div className="text-xs">
            {isMyTurn
              ? <span className="neon-text-cyan animate-pulse">← Ваш ход →</span>
              : <span className="text-muted-foreground">Ход: {seatedPlayers.find(p => p.id === currentTurn)?.name || '...'}</span>
            }
          </div>
        )}

        {isFinished && <ResultBanner results={results} myId={me.id} game="uno" />}

        {/* Other players */}
        <div className="flex gap-2 flex-wrap justify-center">
          {seatedPlayers.filter(p => p.id !== me.id).map(p => {
            const hand = gameState.hands?.[p.id] || [];
            const res = results[p.id];
            return (
              <div key={p.id} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
                ${currentTurn === p.id ? 'border-pink-500/50 bg-pink-900/10' : 'border-border bg-secondary/30'}`}>
                <span className="text-2xl">{p.avatar}</span>
                <span className="text-xs text-muted-foreground">{p.name}</span>
                <div className="flex gap-0.5 flex-wrap justify-center max-w-[100px]">
                  {hand.map((_, i) => <div key={i} style={{ width: 16, height: 24 }} className="bg-gray-600 rounded border border-white/10" />)}
                </div>
                <span className="text-xs text-muted-foreground">{hand.length} карт</span>
                {hand.length === 1 && !isFinished && <span className="text-xs neon-text-pink font-bold animate-pulse">UNO!</span>}
                {isFinished && res?.result === 'win' && <span>🏆</span>}
              </div>
            );
          })}
        </div>

        {/* My hand */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <div className="flex gap-1.5 flex-wrap justify-center max-w-md">
            {myHand.map((c, i) => (
              <UnoCard key={i} card={c}
                playable={isMyTurn && UNO_CAN_PLAY(c)}
                onClick={() => isMyTurn && UNO_CAN_PLAY(c) && doAction('play_card', { card: c })}
                animate={false} />
            ))}
          </div>
          {myHand.length === 1 && !isFinished && (
            <div className="neon-text-pink font-display text-2xl tracking-widest animate-pulse">UNO!!!</div>
          )}
          <div className="text-white/50 text-xs">Вы · {myHand.length} карт</div>
        </div>

        {/* Controls */}
        {!isFinished && isMyTurn && (
          <button onClick={() => doAction('draw_card')} disabled={loading || deckLen === 0}
            className="btn-primary px-6 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-all hover:scale-105">
            +1 карта из колоды
          </button>
        )}
        {!isFinished && !isMyTurn && <p className="text-muted-foreground text-xs">Ожидаем ход...</p>}
        {isFinished && (
          <button onClick={resetGame} disabled={loading} className="btn-primary px-8 py-2 rounded-xl disabled:opacity-40">Новая игра</button>
        )}
      </div>
    );
  }

  return null;
}