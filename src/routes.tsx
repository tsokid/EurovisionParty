import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
import AdminRoute from './admin/AdminRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/room/:roomCode',
    element: <RoomPage />,
  },
  {
    path: '/admin',
    element: <AdminRoute />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
