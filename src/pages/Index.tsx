import { useState } from 'react';
import { useGameStore } from '@/hooks/useGameStore';
import RegisterModal from '@/components/RegisterModal';
import ChatPanel from '@/components/ChatPanel';
import GameTable from '@/components/GameTable';
import Leaderboard from '@/components/Leaderboard';
import ProfilePanel from '@/components/ProfilePanel';
import BlackjackGame from '@/components/games/BlackjackGame';
import PokerGame from '@/components/games/PokerGame';
import DurakGame from '@/components/games/DurakGame';
import UnoGame from '@/components/games/UnoGame';
import Icon from '@/components/ui/icon';

export default function Index() {
  const store = useGameStore();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const renderGame = () => {
    const props = {
      currentPlayer: store.currentPlayer,
      onCoinsChange: store.updateCoins,
      onMessage: (text: string) => {
        if (store.currentPlayer) store.sendMessage(text);
      },
    };
    switch (store.activeGame) {
      case 'blackjack': return <BlackjackGame {...props} />;
      case 'poker': return <PokerGame {...props} />;
      case 'durak': return <DurakGame {...props} />;
      case 'uno': return <UnoGame {...props} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🃏</span>
          <span className="font-display text-xl text-foreground tracking-widest uppercase">CardClub</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-secondary text-sm"
          >
            <Icon name="Trophy" size={15} />
            <span className="hidden sm:inline">Лидеры</span>
          </button>

          {store.currentPlayer && (
            <>
              <div className="coin-badge rounded-xl px-3 py-1.5 text-sm flex items-center gap-1.5">
                <span>🪙</span>
                <span>{store.currentPlayer.coins}</span>
              </div>

              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 rounded-xl px-3 py-1.5 transition-all hover:scale-105"
              >
                <span className="text-lg leading-none">{store.currentPlayer.avatar}</span>
                <span className="text-foreground text-sm font-semibold hidden sm:inline max-w-[100px] truncate">
                  {store.currentPlayer.name}
                </span>
                {store.currentPlayer.isVip && <span className="text-gold text-xs">👑</span>}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          <GameTable
            seats={store.seats}
            currentPlayer={store.currentPlayer}
            activeGame={store.activeGame}
            onTakeSeat={store.takeSeat}
            onLeaveSeat={store.leaveSeat}
            onChangeGame={store.changeGame}
            onStartGame={() => store.setGameState('playing')}
            gameState={store.gameState}
          >
            {renderGame()}
          </GameTable>
        </div>

        <ChatPanel
          messages={store.messages}
          currentPlayer={store.currentPlayer}
          onSend={store.sendMessage}
        />
      </div>

      {!store.currentPlayer && (
        <RegisterModal onRegister={store.register} />
      )}
      {showLeaderboard && (
        <Leaderboard
          seats={store.seats}
          currentPlayer={store.currentPlayer}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showProfile && store.currentPlayer && (
        <ProfilePanel
          player={store.currentPlayer}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
