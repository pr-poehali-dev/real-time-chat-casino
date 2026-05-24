import { useState, useRef, useEffect } from 'react';
import { ChatMessage, Player } from '@/types/game';
import Icon from '@/components/ui/icon';

interface Props {
  messages: ChatMessage[];
  currentPlayer: Player | null;
  onSend: (text: string) => void;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, currentPlayer, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !currentPlayer) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="chat-panel flex flex-col h-full w-72 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-foreground font-semibold text-sm font-display tracking-wider uppercase">Чат</span>
        <span className="ml-auto text-muted-foreground text-xs">{messages.length} сообщ.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3">
        {messages.map(msg => {
          const isMe = currentPlayer?.id === msg.playerId;
          const isSystem = msg.playerId === 'system';
          if (isSystem) {
            return (
              <div key={msg.id} className="text-center animate-fade-in">
                <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex gap-2 animate-fade-in ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="text-xl flex-shrink-0 mt-0.5">{msg.playerAvatar}</div>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className="flex items-center gap-1.5">
                  {msg.isVip && <span className="text-gold text-xs">👑</span>}
                  <span className={`text-xs font-semibold ${isMe ? 'text-blue-400' : 'text-muted-foreground'}`}>
                    {isMe ? 'Вы' : msg.playerName}
                  </span>
                  <span className="text-muted-foreground text-xs opacity-60">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={`
                  px-3 py-2 rounded-2xl text-sm leading-snug
                  ${isMe
                    ? 'bg-blue-600/30 border border-blue-600/30 text-foreground rounded-tr-sm'
                    : 'bg-secondary text-foreground rounded-tl-sm'
                  }
                `}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border">
        {currentPlayer ? (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Сообщение..."
              maxLength={120}
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-gold hover:bg-gold-dark disabled:opacity-40 text-primary-foreground rounded-xl px-3 py-2 transition-all hover:scale-105 active:scale-95"
            >
              <Icon name="Send" size={16} />
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs text-center py-1">
            Войдите чтобы писать в чат
          </p>
        )}
      </div>
    </div>
  );
}
