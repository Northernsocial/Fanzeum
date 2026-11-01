import React from 'react';
import {
  Award,
  BookOpen,
  Coins,
  Disc3,
  Gamepad2,
  Sparkles,
  Stamp,
  Trophy,
} from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';

interface CategoryIconProps {
  category: CategorySlug;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-5 h-5',
}) => {
  const iconName = CATEGORIES[category]?.iconName || 'Award';
  const props = { className, strokeWidth: 1.5 };

  switch (iconName) {
    case 'Trophy':
      return <Trophy {...props} />;
    case 'Sparkles':
      return <Sparkles {...props} />;
    case 'Coins':
      return <Coins {...props} />;
    case 'Stamp':
      return <Stamp {...props} />;
    case 'BookOpen':
      return <BookOpen {...props} />;
    case 'Disc3':
      return <Disc3 {...props} />;
    case 'Gamepad2':
      return <Gamepad2 {...props} />;
    case 'Award':
    default:
      return <Award {...props} />;
  }
};
