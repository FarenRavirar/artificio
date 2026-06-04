import {
  Clock,
  Monitor,
  Coins,
  Sparkles,
  Shield,
  Heart,
  Zap,
  Users,
  Trophy,
  Headphones,
  Mic,
  Video,
  Film,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

interface SellingPoint {
  icon: string;
  title: string;
  description: string;
  highlight?: string;
}

interface Props {
  sellingPoints: SellingPoint[] | null | undefined;
}

const SELLING_POINT_ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  monitor: Monitor,
  coins: Coins,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  zap: Zap,
  users: Users,
  trophy: Trophy,
  headphones: Headphones,
  mic: Mic,
  video: Video,
  film: Film,
  book: BookOpen,
};

export function MestreSellingPoints({ sellingPoints }: Props) {
  if (!Array.isArray(sellingPoints) || sellingPoints.length === 0) return null;

  return (
    <section className="why-section">
      <div className="container">
        <h2 className="section-title">O que eu ofereço</h2>
        <div className="benefits-grid">
          {sellingPoints.map((sp, idx) => {
            const Icon = SELLING_POINT_ICONS[sp.icon?.toLowerCase()] ?? Sparkles;
            return (
              <div key={idx} className="benefit-card">
                <Icon className="benefit-icon" />
                <h3>{sp.title}</h3>
                <p>{sp.description}</p>
                {sp.highlight && (
                  <span className="benefit-highlight">{sp.highlight}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
