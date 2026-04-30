import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
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

  { path: '*', element: <NotFoundPage /> },
]);
