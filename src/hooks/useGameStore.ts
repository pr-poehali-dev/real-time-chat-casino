import { useState, useCallback } from 'react';
import { Player, Seat, ChatMessage, GameId, AVATARS } from '@/types/game';

const TOTAL_SEATS = 5;
const VIP_SEAT_INDEX = 0; // первое место — VIP

function createInitialSeats(): Seat[] {
  return Array.from({ length: TOTAL_SEATS }, (_, i) => ({
    index: i,
    isVip: i === VIP_SEAT_INDEX,
    player: null,
  }));
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const BOT_NAMES = ['Иван', 'Мария', 'Дмитрий', 'Алексей'];
const BOT_MESSAGES = [
  'Удача сегодня на моей стороне!',
  'Хорошая партия!',
  'Повышаю ставку!',
  'Интересный ход...',
  'Пас.',
  'Ва-банк!',
  'Везёт тому, кто везёт себя сам.',
  'Сегодня мой день!',
];

export function useGameStore() {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [seats, setSeats] = useState<Seat[]>(createInitialSeats());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      playerId: 'bot-0',
      playerName: 'Иван',
      playerAvatar: '🦁',
      isVip: true,
      text: 'Добро пожаловать в CardClub! 🎴',
      timestamp: new Date(),
    },
    {
      id: generateId(),
      playerId: 'bot-1',
      playerName: 'Мария',
      playerAvatar: '🦄',
      isVip: false,
      text: 'Сегодня играем в покер, присоединяйтесь!',
      timestamp: new Date(Date.now() - 30000),
    },
  ]);
  const [activeGame, setActiveGame] = useState<GameId>('blackjack');
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  const register = useCallback((name: string, avatarIndex: number) => {
    const player: Player = {
      id: generateId(),
      name,
      avatar: AVATARS[avatarIndex],
      coins: 100,
      isVip: false,
      seatIndex: null,
    };
    setCurrentPlayer(player);

    // Add bots to some seats
    setSeats(prev => {
      const next = [...prev];
      BOT_NAMES.slice(0, 3).forEach((botName, i) => {
        const seatIdx = i + 1;
        if (seatIdx < TOTAL_SEATS) {
          next[seatIdx] = {
            ...next[seatIdx],
            player: {
              id: `bot-${i}`,
              name: botName,
              avatar: AVATARS[i + 1],
              coins: 100 + Math.floor(Math.random() * 400),
              isVip: seatIdx === VIP_SEAT_INDEX,
              seatIndex: seatIdx,
            },
          };
        }
      });
      return next;
    });

    // Bots send welcome messages
    setTimeout(() => {
      addBotMessage(`${name}, удачи за столом! 🍀`);
    }, 1500);
  }, []);

  const takeSeat = useCallback((seatIndex: number) => {
    if (!currentPlayer) return;
    if (seats[seatIndex].player !== null) return;

    const isVipSeat = seatIndex === VIP_SEAT_INDEX;
    const updatedPlayer: Player = {
      ...currentPlayer,
      isVip: isVipSeat,
      seatIndex,
    };

    setCurrentPlayer(updatedPlayer);
    setSeats(prev => {
      const next = [...prev];
      // Remove from old seat
      if (currentPlayer.seatIndex !== null) {
        next[currentPlayer.seatIndex] = { ...next[currentPlayer.seatIndex], player: null };
      }
      next[seatIndex] = { ...next[seatIndex], player: updatedPlayer };
      return next;
    });

    if (isVipSeat) {
      addSystemMessage(`${currentPlayer.name} занял VIP-место и стал ведущим! 👑`);
    }
  }, [currentPlayer, seats]);

  const leaveSeat = useCallback(() => {
    if (!currentPlayer || currentPlayer.seatIndex === null) return;
    setSeats(prev => {
      const next = [...prev];
      next[currentPlayer.seatIndex!] = { ...next[currentPlayer.seatIndex!], player: null };
      return next;
    });
    setCurrentPlayer(prev => prev ? { ...prev, isVip: false, seatIndex: null } : null);
  }, [currentPlayer]);

  const sendMessage = useCallback((text: string) => {
    if (!currentPlayer || !text.trim()) return;
    const msg: ChatMessage = {
      id: generateId(),
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      playerAvatar: currentPlayer.avatar,
      isVip: currentPlayer.isVip,
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);

    // Random bot reply
    if (Math.random() < 0.4) {
      setTimeout(() => {
        addBotMessage(BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)]);
      }, 1000 + Math.random() * 2000);
    }
  }, [currentPlayer]);

  const addBotMessage = (text: string) => {
    const botIdx = Math.floor(Math.random() * BOT_NAMES.length);
    const msg: ChatMessage = {
      id: generateId(),
      playerId: `bot-${botIdx}`,
      playerName: BOT_NAMES[botIdx],
      playerAvatar: AVATARS[botIdx + 1],
      isVip: false,
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const addSystemMessage = (text: string) => {
    const msg: ChatMessage = {
      id: generateId(),
      playerId: 'system',
      playerName: 'Система',
      playerAvatar: '🎲',
      isVip: false,
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const changeGame = useCallback((gameId: GameId) => {
    if (!currentPlayer?.isVip) return;
    setActiveGame(gameId);
    setGameState('waiting');
    addSystemMessage(`VIP сменил игру на: ${gameId === 'poker' ? 'Техасский Покер' : gameId === 'blackjack' ? 'Блэкджек' : gameId === 'durak' ? 'Дурак' : 'UNO'} 👑`);
  }, [currentPlayer]);

  const updateCoins = useCallback((delta: number) => {
    setCurrentPlayer(prev => {
      if (!prev) return null;
      const newCoins = Math.max(0, prev.coins + delta);
      return { ...prev, coins: newCoins };
    });
  }, []);

  return {
    currentPlayer,
    seats,
    messages,
    activeGame,
    gameState,
    setGameState,
    register,
    takeSeat,
    leaveSeat,
    sendMessage,
    changeGame,
    updateCoins,
    addSystemMessage,
    VIP_SEAT_INDEX,
  };
}
