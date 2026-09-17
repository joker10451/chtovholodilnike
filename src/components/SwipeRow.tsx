import { useRef, useState, type ReactNode } from 'react';
import { IconCart, IconCheck } from './icons';

interface SwipeRowProps {
  children: ReactNode;
  onEat: () => void;
  onAddShopping: () => void;
  onClick: () => void;
}

const THRESHOLD = 72; // пикселей для активации жеста

export function SwipeRow({ children, onEat, onAddShopping, onClick }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [acting, setActing] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const crossedThreshold = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    if (acting) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    isHorizontal.current = null;
    crossedThreshold.current = false;
    setSwiping(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (acting) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Определяем направление первого движения: вертикальный скролл или горизонтальный свайп
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (!isHorizontal.current) return;

    // Лёгкое сопротивление при глубоком свайпе
    const maxDrag = 140;
    const clampedDx = Math.sign(dx) * Math.min(Math.abs(dx), maxDrag + (Math.abs(dx) - maxDrag) * 0.3);
    setOffset(clampedDx);

    // Тактильный щелчок при пересечении порога
    if (Math.abs(clampedDx) >= THRESHOLD && !crossedThreshold.current) {
      crossedThreshold.current = true;
      navigator.vibrate?.(25);
    } else if (Math.abs(clampedDx) < THRESHOLD && crossedThreshold.current) {
      crossedThreshold.current = false;
    }
  }

  function handleTouchEnd() {
    if (acting) return;
    setSwiping(false);

    const isTap = isHorizontal.current === null && Math.abs(offset) < 5 && Date.now() - startTime.current < 350;
    if (isTap) {
      onClick();
      setOffset(0);
      return;
    }

    if (offset >= THRESHOLD) {
      // Свайп вправо: Съели
      setActing(true);
      setOffset(360);
      navigator.vibrate?.(40);
      setTimeout(() => {
        onEat();
      }, 180);
    } else if (offset <= -THRESHOLD) {
      // Свайп влево: В покупки
      setActing(true);
      navigator.vibrate?.(40);
      onAddShopping();
      // Мягко отпружиниваем обратно
      setTimeout(() => {
        setOffset(0);
        setActing(false);
      }, 180);
    } else {
      // Не дотянули до порога — плавный возврат
      setOffset(0);
    }
  }

  const isEat = offset > 0;
  const isShop = offset < 0;
  const isActivated = Math.abs(offset) >= THRESHOLD;

  return (
    <div className="swipe-wrap">
      {/* Подложка быстрого действия под строкой */}
      <div
        className={`swipe-underlay ${isEat ? 'eat' : isShop ? 'shop' : ''}${isActivated ? ' active' : ''}`}
        aria-hidden="true"
      >
        {isEat && (
          <div className="swipe-action left">
            <IconCheck className="swipe-icon" width={22} height={22} />
            <span className="swipe-label">Съели</span>
          </div>
        )}
        {isShop && (
          <div className="swipe-action right">
            <span className="swipe-label">В покупки</span>
            <IconCart className="swipe-icon" width={22} height={22} />
          </div>
        )}
      </div>

      {/* Сама строка, которая двигается при свайпе */}
      <div
        className={`swipe-content${!swiping ? ' smooth' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (offset === 0) onClick();
        }}
      >
        {children}
      </div>
    </div>
  );
}
