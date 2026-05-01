import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
// NotFoundPage is rendered only inside LocaleRoot (locale child `*` route)
// so its LocaleLink usage is safe. Unprefixed unknown paths redirect.
import AdminRoute from './admin/AdminRoute';
import LocaleRoot from './components/seo/LocaleRoot';
import LocaleRedirect from './components/seo/LocaleRedirect';
import HowToPlayPage from './pages/seo/HowToPlayPage';
import EurovisionNightPage from './pages/seo/EurovisionNightPage';
import EurovisionGamesPage from './pages/seo/EurovisionGamesPage';
import EurovisionPartyPage from './pages/seo/EurovisionPartyPage';
import EurovisionTriviaPage from './pages/seo/EurovisionTriviaPage';
import Predictions2026Page from './pages/seo/Predictions2026Page';
import FAQPage from './pages/seo/FAQPage';
import RulesPage from './pages/seo/RulesPage';
import ScoringPage from './pages/seo/ScoringPage';
import AboutPage from './pages/seo/AboutPage';
import PrivacyPage from './pages/seo/PrivacyPage';
import TermsPage from './pages/seo/TermsPage';
import EurovisionDuelsPage from './pages/seo/EurovisionDuelsPage';
import DashboardPage from './pages/seo/DashboardPage';
import CookiesPage from './pages/seo/CookiesPage';
import WinnersPage from './pages/seo/WinnersPage';

export const router = createBrowserRouter([
  // Game + admin own their own chrome
  { path: '/room/:roomCode', element: <RoomPage /> },
  { path: '/admin', element: <AdminRoute /> },

  // Locale-prefixed public surface
  {
    path: '/:locale',
    element: <LocaleRoot />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'how-to-play', element: <HowToPlayPage /> },
      { path: 'eurovision-night', element: <EurovisionNightPage /> },
      { path: 'eurovision-games', element: <EurovisionGamesPage /> },
      { path: 'eurovision-party', element: <EurovisionPartyPage /> },
      { path: 'eurovision-trivia', element: <EurovisionTriviaPage /> },
      { path: 'eurovision-2026-predictions', element: <Predictions2026Page /> },
      { path: 'faq', element: <FAQPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'scoring', element: <ScoringPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'duels', element: <EurovisionDuelsPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'cookies', element: <CookiesPage /> },
      { path: 'winners', element: <WinnersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // Legacy unprefixed → redirect to locale
  { path: '/', element: <LocaleRedirect /> },
  { path: '/online-games', element: <Navigate to="/en/eurovision-games" replace /> },
  { path: '/mobile-games', element: <Navigate to="/en/eurovision-games" replace /> },
  { path: '/how-to-play', element: <LocaleRedirect /> },
  { path: '/eurovision-night', element: <LocaleRedirect /> },
  { path: '/eurovision-games', element: <LocaleRedirect /> },
  { path: '/eurovision-party', element: <LocaleRedirect /> },
  { path: '/eurovision-trivia', element: <LocaleRedirect /> },
  { path: '/eurovision-2026-predictions', element: <LocaleRedirect /> },
  { path: '/faq', element: <LocaleRedirect /> },
  { path: '/rules', element: <LocaleRedirect /> },
  { path: '/scoring', element: <LocaleRedirect /> },
  { path: '/about', element: <LocaleRedirect /> },
  { path: '/privacy', element: <LocaleRedirect /> },
  { path: '/terms', element: <LocaleRedirect /> },
  { path: '/duels', element: <LocaleRedirect /> },
  { path: '/dashboard', element: <LocaleRedirect /> },
  { path: '/cookies', element: <LocaleRedirect /> },
  { path: '/winners', element: <LocaleRedirect /> },

  // Catch-all: redirect unknown unprefixed paths into the locale-scoped
  // tree so NotFoundPage renders inside LocaleProvider (LocaleLink needs it).
  { path: '*', element: <LocaleRedirect /> },
]);
