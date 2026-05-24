import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/hooks/useApi';
import { GAMES, AVATARS } from '@/types/game';
import Icon from '@/components/ui/icon';

const QUOTES = [
  "Удача — это когда ты сделал ставку и забыл, что у тебя в кармане осталось только на такси 🚕",
  "Покер — это когда ты блефуешь с таким лицом, что сам начинаешь себе верить 😐",
  "— Ты выиграл! — Да. — Много? — Хватит вернуть то, что проиграл в прошлый раз 🎉",
  "Мой психолог сказал перестать играть в карты. Я поставил 20 монет, что он неправ 🃏",
  "Наука утверждает: в среднем выигрывает именно тот, у кого лучше карты. Совпадение? 🔬",
  "UNO — игра, где друзья превращаются во врагов, а враги... тоже во врагов 😅",
  "Говорят, новичкам везёт. Наверное, я уже не новичок... уже 300-й раз 📉",
  "Блэкджек: берёшь — перебор. Не берёшь — мало. Всё идёт по плану 👍",
  "— Сколько ты выиграл? — Воспоминания. Бесценные воспоминания 😭",
  "Дурак — игра, которая честно говорит тебе, кто ты такой 🎴",
];

const SEAT_POSITIONS = [
  { top: '10%', left: '50%', transform: 'translateX(-50%)' },
  { top: '35%', left: '7%', transform: 'translateY(-50%)' },
  { top: '72%', left: '7%', transform: 'translateY(-50%)' },
  { top: '35%', right: '7%', transform: 'translateY(-50%)' },
  { top: '72%', right: '7%', transform: 'translateY(-50%)' },
];

interface Player { id: string; name: string; avatar: string; coins: number; wins: number; losses: number; is_vip?: boolean; seat_index?: number | null; }
interface Seat { index: number; is_vip: boolean; player: Player | null; }
interface Msg { id: string; player_id: string | null; player_name: string; player_avatar: string; is_vip: boolean; text: string; created_at: string; }

export default function Index() {
  const [me, setMe] = useState<Player | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [activeGame, setActiveGame] = useState('blackjack');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [leaders, setLeaders] = useState<Player[]>([]);
  const [regName, setRegName] = useState('');
  const [regAvatar, setRegAvatar] = useState(0);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const lastMsgTime = useRef<string | null>(null);
  const chatBottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 8000);
    return () => clearInterval(t);
  }, []);

  const loadTable = useCallback(async () => {
    const data = await api.getTable();
    if (data.session_id) {
      setSessionId(data.session_id);
      setSeats(data.seats || []);
      setActiveGame(data.game_id || 'blackjack');
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const msgs = await api.getMessages(lastMsgTime.current || undefined);
    if (msgs.length > 0) {
      setMessages(prev => {
        const ids = new Set(prev.map((m: Msg) => m.id));
        const newOnes = msgs.filter((m: Msg) => !ids.has(m.id));
        if (newOnes.length === 0) return prev;
        lastMsgTime.current = newOnes[newOnes.length - 1].created_at;
        return [...prev, ...newOnes].slice(-80);
      });
    }
  }, []);

  useEffect(() => {
    loadTable();
    loadMessages();
    const poll = setInterval(() => { loadTable(); loadMessages(); }, 3000);
    return () => clearInterval(poll);
  }, [loadTable, loadMessages]);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const register = async () => {
    const name = regName.trim();
    if (name.length < 2) { setRegError('Имя минимум 2 символа'); return; }
    setRegLoading(true);
    const player = await api.registerPlayer(name, AVATARS[regAvatar]);
    if (player.error) { setRegError(player.error); setRegLoading(false); return; }
    setMe({ ...player, is_vip: false, seat_index: null });
    setRegLoading(false);
  };

  const takeSeat = async (seatIndex: number) => {
    if (!me || !sessionId) return;
    const seat = seats[seatIndex];
    if (seat?.player !== null) return;
    const alreadySeated = seats.some(s => s.player?.id === me.id);
    if (alreadySeated) return;
    const data = await api.takeSeat(sessionId, me.id, seatIndex);
    if (data.error) return;
    setSeats(data.seats || seats);
    setMe(prev => prev ? { ...prev, is_vip: data.is_vip, seat_index: seatIndex } : null);
  };

  const leaveSeat = async () => {
    if (!me || !sessionId) return;
    const data = await api.leaveSeat(sessionId, me.id);
    setSeats(data.seats || seats);
    setMe(prev => prev ? { ...prev, is_vip: false, seat_index: null } : null);
  };

  const changeGame = async (gameId: string) => {
    if (!me?.is_vip || !sessionId) return;
    await api.changeGame(sessionId, me.id, gameId);
    setActiveGame(gameId);
    loadTable();
  };

  const sendChat = async () => {
    if (!me || !chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    const text = chatInput.trim();
    setChatInput('');
    await api.sendMessage(me.id, me.name, me.avatar, me.is_vip || false, text);
    await loadMessages();
    setChatLoading(false);
  };

  const openLeaderboard = async () => {
    const data = await api.getLeaderboard();
    setLeaders(data);
    setShowLeaderboard(true);
  };

  const refreshCoins = async () => {
    if (!me) return;
    const data = await api.getPlayer(me.id);
    if (!data.error) setMe(prev => prev ? { ...prev, coins: data.coins, wins: data.wins, losses: data.losses } : null);
  };

  const isSeated = seats.some(s => s.player?.id === me?.id);
  const currentGame = GAMES.find(g => g.id === activeGame) || GAMES[0];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* Quote ticker */}
      <div className="overflow-hidden flex-shrink-0 px-0 py-1.5 border-b border-pink-900/30"
        style={{ background: 'linear-gradient(90deg, hsl(265 30% 10%), hsl(280 40% 13%), hsl(265 30% 10%))' }}>
        <div className="ticker-text text-sm px-4" style={{ color: 'hsl(330 100% 68%)', fontStyle: 'italic' }}>
          {QUOTES[quoteIdx]}
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-2xl">🃏</span>
        <span className="font-display text-xl neon-text-pink tracking-widest uppercase">CardClub</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={openLeaderboard}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-secondary text-sm">
            <Icon name="Trophy" size={14} />
            <span className="hidden sm:inline text-xs">Лидеры</span>
          </button>
          {me && (
            <button onClick={() => { setShowProfile(true); refreshCoins(); }}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 rounded-xl px-3 py-1.5 transition-all hover:scale-105 border border-border">
              <span className="text-xl leading-none">{me.avatar}</span>
              <span className="text-foreground text-sm font-semibold hidden sm:inline max-w-[90px] truncate">{me.name}</span>
              {me.is_vip && <span className="neon-text-gold text-xs">👑</span>}
            </button>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top half: info + game selector */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 overflow-hidden">
            <div className="text-center">
              <div className="font-display text-4xl neon-text-pink tracking-widest uppercase mb-1">{currentGame.name}</div>
              <div className="text-muted-foreground text-sm">{currentGame.description} · Ставка от {currentGame.minBet}🪙</div>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              {GAMES.map(g => {
                const isActive = activeGame === g.id;
                const canClick = me?.is_vip;
                return (
                  <button key={g.id} onClick={() => canClick && changeGame(g.id)}
                    title={canClick ? g.name : 'Только VIP выбирает игру'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                      ${isActive ? 'btn-primary scale-105' : canClick
                        ? 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border cursor-pointer'
                        : 'bg-secondary/40 text-muted-foreground border border-border/40 cursor-default opacity-70'}`}>
                    <span>{g.emoji}</span>
                    <span className="hidden sm:inline">{g.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {me?.is_vip && <div className="text-xs neon-text-gold">👑 VIP-место — вы выбираете игру для стола</div>}
            {me && !isSeated && <p className="text-muted-foreground text-xs">Займите место за столом, чтобы играть</p>}
            {!me && <p className="text-muted-foreground text-xs">Войдите чтобы присоединиться</p>}
          </div>

          {/* Bottom half: Table */}
          <div className="relative overflow-hidden flex-shrink-0" style={{ height: '50%' }}>
            <div className="felt-table absolute inset-4 rounded-[50px] border-4 border-green-900/60">
              <div className="absolute inset-3 border border-white/5 rounded-[44px] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none select-none">
                <div className="font-display text-white text-7xl tracking-widest">CARDCLUB</div>
              </div>
            </div>

            {Array.from({ length: 5 }, (_, i) => {
              const pos = SEAT_POSITIONS[i];
              const seat = seats[i] || { index: i, is_vip: i === 0, player: null };
              const isMyCurrentSeat = seat.player?.id === me?.id;
              const isEmpty = seat.player === null;
              const canTake = isEmpty && me && !isSeated;

              return (
                <div key={i} className="absolute flex flex-col items-center gap-1 z-10" style={pos}>
                  <div onClick={() => canTake && takeSeat(i)}
                    className={`relative rounded-2xl p-2 transition-all duration-300
                      ${seat.is_vip ? isMyCurrentSeat ? 'seat-vip animate-pulse-gold' : 'seat-vip'
                        : isMyCurrentSeat ? 'seat-me' : isEmpty ? 'seat-empty' : 'seat-player'}
                      ${canTake ? 'cursor-pointer seat-empty-hover' : 'cursor-default'}`}>
                    {seat.is_vip && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-base">👑</div>}
                    {isEmpty ? (
                      <div className="w-12 h-12 flex items-center justify-center flex-col gap-0.5">
                        {canTake
                          ? <><Icon name="Plus" size={18} className="text-muted-foreground" /><span className="text-muted-foreground text-xs">Сесть</span></>
                          : <Icon name="User" size={18} className="text-muted-foreground/30" />}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-12">
                        <div className="text-3xl leading-none">{seat.player!.avatar}</div>
                        <div className="text-foreground text-xs font-semibold mt-0.5 truncate max-w-full">
                          {isMyCurrentSeat ? 'Вы' : seat.player!.name}
                        </div>
                        <div className="text-xs neon-text-gold">{seat.player!.coins}🪙</div>
                      </div>
                    )}
                  </div>
                  {isMyCurrentSeat && (
                    <button onClick={leaveSeat}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors px-2 py-0.5 rounded-lg hover:bg-red-900/20">
                      Встать
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        <div className="chat-panel flex flex-col w-72 flex-shrink-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="font-display text-sm tracking-wider uppercase neon-text-cyan">Чат</span>
            <span className="ml-auto text-muted-foreground text-xs">{messages.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-xs text-center mt-8">Пока тихо в чате...</p>
            )}
            {messages.map(msg => {
              const isMe = me?.id === msg.player_id;
              return (
                <div key={msg.id} className={`flex gap-2 animate-fade-in ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="text-xl flex-shrink-0 mt-0.5">{msg.player_avatar}</div>
                  <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1">
                      {msg.is_vip && <span className="neon-text-gold text-xs">👑</span>}
                      <span className={`text-xs font-semibold ${isMe ? 'neon-text-cyan' : 'text-muted-foreground'}`}>
                        {isMe ? 'Вы' : msg.player_name}
                      </span>
                    </div>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-snug
                      ${isMe ? 'bg-cyan-900/30 border border-cyan-500/25 text-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottom} />
          </div>

          <div className="px-3 py-3 border-t border-border">
            {me ? (
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Сообщение..." maxLength={120}
                  className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-pink-500/50 transition-all" />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                  className="btn-primary rounded-xl px-3 py-2 disabled:opacity-40">
                  <Icon name="Send" size={15} />
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs text-center">Войдите чтобы писать</p>
            )}
          </div>
        </div>
      </div>

      {/* Register modal */}
      {!me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="animate-scale-in bg-card neon-border rounded-2xl p-8 w-full max-w-sm shadow-2xl mx-4">
            <div className="text-center mb-7">
              <div className="text-5xl mb-3">🃏</div>
              <h1 className="font-display text-3xl neon-text-pink tracking-widest uppercase mb-1">CardClub</h1>
              <p className="text-muted-foreground text-sm">Онлайн карточный клуб</p>
            </div>

            <div className="flex items-center gap-3 bg-secondary/60 rounded-xl p-3 mb-5 border border-border">
              <div className="coin-badge rounded-full w-9 h-9 flex items-center justify-center text-base flex-shrink-0">🪙</div>
              <div>
                <div className="text-foreground text-sm font-semibold">Стартовый бонус</div>
                <div className="text-muted-foreground text-xs"><span className="neon-text-gold font-bold">100 монет</span> для игры</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-2 block">Аватар</label>
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((av, i) => (
                  <button key={i} onClick={() => setRegAvatar(i)}
                    className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all
                      ${regAvatar === i ? 'bg-pink-900/40 border-2 border-pink-500 scale-110 shadow-lg' : 'bg-secondary border-2 border-transparent hover:border-border hover:scale-105'}`}>
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-2 block">Имя</label>
              <input type="text" value={regName}
                onChange={e => { setRegName(e.target.value); setRegError(''); }}
                onKeyDown={e => e.key === 'Enter' && register()}
                placeholder="Введите имя игрока..." maxLength={16}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/30 transition-all" />
              {regError && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                  <Icon name="AlertCircle" size={11} />{regError}
                </p>
              )}
            </div>

            <button onClick={register} disabled={regLoading} className="w-full btn-primary py-3 rounded-xl text-lg">
              {regLoading ? 'Входим...' : 'За стол!'}
            </button>
            <p className="text-muted-foreground text-xs text-center mt-3">Без реальных денег · Только веселье</p>
          </div>
        </div>
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowLeaderboard(false)}>
          <div className="animate-scale-in bg-card neon-border rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl neon-text-pink tracking-widest uppercase">Таблица лидеров</h2>
                <p className="text-muted-foreground text-xs">Топ по монетам</p>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            {leaders.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Пока никого нет — станьте первым! 🏆</p>
            ) : (
              <div className="space-y-2">
                {leaders.map((p, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const isMe = me?.id === p.id;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-cyan-900/20 border border-cyan-500/30' : 'bg-secondary/50'}`}>
                      <span className="text-lg w-6 text-center">{medals[i] || (i + 1)}</span>
                      <span className="text-2xl">{p.avatar}</span>
                      <div className="flex-1">
                        <div className={`font-semibold text-sm ${isMe ? 'neon-text-cyan' : 'text-foreground'}`}>{p.name}{isMe ? ' (вы)' : ''}</div>
                        <div className="text-muted-foreground text-xs">{p.wins} побед</div>
                      </div>
                      <div className="neon-text-gold font-bold text-sm">{p.coins}🪙</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowProfile(false)}>
          <div className="animate-scale-in bg-card neon-border rounded-2xl p-6 w-full max-w-xs shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <h2 className="font-display text-xl neon-text-pink tracking-widest uppercase">Профиль</h2>
              <button onClick={() => setShowProfile(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className={`text-5xl p-4 rounded-2xl ${me.is_vip ? 'seat-vip animate-pulse-gold' : 'bg-secondary'}`}>{me.avatar}</div>
              <div className="text-center">
                <div className="font-display text-2xl tracking-wider text-foreground">{me.name}</div>
                {me.is_vip && <div className="neon-text-gold text-sm mt-0.5">👑 VIP-место</div>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-secondary rounded-xl p-3 text-center">
                <div className="neon-text-gold font-bold text-xl">{me.coins}</div>
                <div className="text-muted-foreground text-xs mt-0.5">Монеты</div>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <div className="text-green-400 font-bold text-xl">{me.wins}</div>
                <div className="text-muted-foreground text-xs mt-0.5">Победы</div>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <div className="text-red-400 font-bold text-xl">{me.losses}</div>
                <div className="text-muted-foreground text-xs mt-0.5">Пораж.</div>
              </div>
            </div>
            {!me.is_vip && (
              <p className="text-muted-foreground text-xs text-center">Займите <span className="neon-text-gold">VIP-место №1</span> чтобы выбирать игру</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
