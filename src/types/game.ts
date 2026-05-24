export type GameId = 'poker' | 'durak' | 'uno' | 'blackjack';

export interface Game {
  id: GameId;
  name: string;
  emoji: string;
  description: string;
  minBet: number;
  vipOnly: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  coins: number;
  isVip: boolean;
  seatIndex: number | null;
}

export interface Seat {
  index: number;
  isVip: boolean;
  player: Player | null;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: string;
  isVip: boolean;
  text: string;
  timestamp: Date;
}

export interface Card {
  suit: '♠' | '♥' | '♦' | '♣';
  value: string;
  numValue: number;
  color?: string; // for UNO
}

export const GAMES: Game[] = [
  {
    id: 'poker',
    name: 'Техасский Покер',
    emoji: '🃏',
    description: 'Холдем с раундами торговли',
    minBet: 20,
    vipOnly: false,
  },
  {
    id: 'blackjack',
    name: 'Блэкджек',
    emoji: '21',
    description: 'Набери 21 очко',
    minBet: 10,
    vipOnly: false,
  },
  {
    id: 'durak',
    name: 'Дурак',
    emoji: '🎴',
    description: 'Русская игра с козырем',
    minBet: 15,
    vipOnly: false,
  },
  {
    id: 'uno',
    name: 'UNO',
    emoji: '🟥',
    description: 'Цвета, числа и спецкарты',
    minBet: 5,
    vipOnly: false,
  },
];

export const AVATARS = ['🦊', '🐻', '🐯', '🦁', '🐺', '🦝', '🦄', '🐲', '🦅', '🐉'];
