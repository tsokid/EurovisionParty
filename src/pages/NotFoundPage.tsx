import { Link } from 'react-router-dom';
import GlowText from '../components/ui/GlowText';
import Button from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-svh bg-euro-gradient flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-7xl mb-6">🎤</div>
        <GlowText as="h1" color="pink" className="text-5xl mb-3">
          404
        </GlowText>
        <p className="text-white/60 text-lg mb-8">
          This stage doesn't exist!
        </p>
        <Link to="/">
          <Button variant="primary" size="lg">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
