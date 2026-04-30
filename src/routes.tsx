import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
import AdminRoute from './admin/AdminRoute';
import PublicLayout from './components/seo/PublicLayout';
import HowToPlayPage from './pages/seo/HowToPlayPage';
import EurovisionNightPage from './pages/seo/EurovisionNightPage';
import EurovisionGamesPage from './pages/seo/EurovisionGamesPage';
import EurovisionPartyPage from './pages/seo/EurovisionPartyPage';
import EurovisionTriviaPage from './pages/seo/EurovisionTriviaPage';
import Predictions2026Page from './pages/seo/Predictions2026Page';
import OnlineGamesPage from './pages/seo/OnlineGamesPage';
import MobileGamesPage from './pages/seo/MobileGamesPage';
import FAQPage from './pages/seo/FAQPage';
import RulesPage from './pages/seo/RulesPage';
import ScoringPage from './pages/seo/ScoringPage';
import AboutPage from './pages/seo/AboutPage';
import PrivacyPage from './pages/seo/PrivacyPage';
import TermsPage from './pages/seo/TermsPage';

export const router = createBrowserRouter([
  // In-game and admin surfaces own their chrome — no SiteHeader.
  { path: '/room/:roomCode', element: <RoomPage /> },
  { path: '/admin', element: <AdminRoute /> },

  // Public surface — wrapped in PublicLayout so every page gets the same
  // sticky header + hamburger drawer.
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/how-to-play', element: <HowToPlayPage /> },
      { path: '/eurovision-night', element: <EurovisionNightPage /> },
      { path: '/eurovision-games', element: <EurovisionGamesPage /> },
      { path: '/eurovision-party', element: <EurovisionPartyPage /> },
      { path: '/eurovision-trivia', element: <EurovisionTriviaPage /> },
      { path: '/eurovision-2026-predictions', element: <Predictions2026Page /> },
      { path: '/online-games', element: <OnlineGamesPage /> },
      { path: '/mobile-games', element: <MobileGamesPage /> },
      { path: '/faq', element: <FAQPage /> },
      { path: '/rules', element: <RulesPage /> },
      { path: '/scoring', element: <ScoringPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
