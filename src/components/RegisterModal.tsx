import { useState } from 'react';
import { AVATARS } from '@/types/game';
import Icon from '@/components/ui/icon';

interface Props {
  onRegister: (name: string, avatarIndex: number) => void;
}

export default function RegisterModal({ onRegister }: Props) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Имя должно быть не менее 2 символов');
      return;
    }
    if (trimmed.length > 16) {
      setError('Имя слишком длинное (макс. 16 символов)');
      return;
    }
    onRegister(trimmed, selectedAvatar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="animate-scale-in bg-card border border-border rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="font-display text-3xl text-foreground tracking-widest uppercase mb-1">
            CardClub
          </h1>
          <p className="text-muted-foreground text-sm">Онлайн карточный клуб</p>
        </div>

        {/* Coins info */}
        <div className="flex items-center gap-3 bg-secondary/50 rounded-xl p-4 mb-6 border border-border">
          <div className="coin-badge rounded-full w-10 h-10 flex items-center justify-center text-lg">
            🪙
          </div>
          <div>
            <div className="text-foreground font-semibold">Стартовый бонус</div>
            <div className="text-muted-foreground text-sm">Вы получите <span className="text-gold font-bold">100 монет</span> для игры</div>
          </div>
        </div>

        {/* Avatar picker */}
        <div className="mb-5">
          <label className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-3 block">
            Выберите аватар
          </label>
          <div className="grid grid-cols-5 gap-2">
            {AVATARS.map((avatar, i) => (
              <button
                key={i}
                onClick={() => setSelectedAvatar(i)}
                className={`
                  aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-200
                  ${selectedAvatar === i
                    ? 'bg-gold/20 border-2 border-gold scale-110 shadow-lg'
                    : 'bg-secondary border-2 border-transparent hover:border-border hover:scale-105'
                  }
                `}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-2 block">
            Ваше имя
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Введите имя игрока..."
            maxLength={16}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
          />
          {error && (
            <p className="text-destructive text-xs mt-2 flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full bg-gold hover:bg-gold-dark text-primary-foreground font-display text-lg tracking-widest uppercase py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
        >
          За стол!
        </button>

        <p className="text-muted-foreground text-xs text-center mt-4">
          Регистрация бесплатна · Без реальных денег
        </p>
      </div>
    </div>
  );
}
