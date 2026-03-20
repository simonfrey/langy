import { useLocation, useNavigate } from 'react-router-dom';
import { useHasDecks } from '../hooks/useDecks';

const tabs = [
  {
    path: '/',
    label: 'Decks',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    path: '/review',
    label: 'Review',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    path: '/generate',
    label: 'Generate',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasDecks = useHasDecks();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-warm-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 max-w-[700px] mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const disabled = !hasDecks && tab.path !== '/';
          return (
            <button
              key={tab.path}
              onClick={() => !disabled && navigate(tab.path)}
              disabled={disabled}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                disabled ? 'text-warm-300 opacity-40 cursor-not-allowed' :
                active ? 'text-coral' : 'text-warm-400 hover:text-warm-700'
              }`}
            >
              {tab.icon}
              <span className={`text-xs ${active ? 'font-bold' : 'font-semibold'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
