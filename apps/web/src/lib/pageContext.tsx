import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export interface PageContextState {
  page: string;
  fen?: string;
  details?: string;
  player_color?: 'white' | 'black';
}

interface PageContextValue {
  context: PageContextState;
  setPageContext: (ctx: PageContextState | null) => void;
}

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Главная',
  '/puzzles': 'Задачи',
  '/play': 'Игра с ботом',
  '/coach': 'Тренер',
  '/openings': 'Дебюты',
  '/championships': 'Чемпионаты',
  '/learn': 'Обучение',
  '/games': 'Мои партии',
  '/settings': 'Настройки',
};

const PageContext = createContext<PageContextValue | null>(null);

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageContextState | null>(null);
  const location = useLocation();

  const basePage =
    ROUTE_LABELS[location.pathname] ??
    (location.pathname.startsWith('/play/')
      ? 'Игра с ботом'
      : location.pathname.startsWith('/coach/')
        ? 'Игра с тренером'
        : location.pathname.startsWith('/games/')
          ? 'Отчёт по партии'
          : 'ChessTrain');

  const context = useMemo(
    () =>
      override ?? {
        page: basePage,
      },
    [override, basePage]
  );

  const value = useMemo(
    () => ({
      context,
      setPageContext: setOverride,
    }),
    [context]
  );

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePageContext() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePageContext must be used within PageContextProvider');
  return ctx;
}

export function usePageContextSync(
  page: string,
  fen?: string,
  details?: string,
  player_color?: 'white' | 'black'
) {
  const { setPageContext } = usePageContext();

  useEffect(() => {
    setPageContext({ page, fen, details, player_color });
    return () => setPageContext(null);
  }, [page, fen, details, player_color, setPageContext]);
}
