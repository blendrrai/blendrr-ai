import { router } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { CategoryHome } from '../../components/CategoryHome';
import { useLook } from '../../lib/state';

export default function IngredientsTab() {
  const { resetIngredients } = useLook();

  return (
    <CategoryHome
      eyebrow="Ingredients"
      title={'What’s in\nyour bottle?'}
      subtitle="Snap or paste any product's ingredient list. Get a 0–100 health score with the good, the bad, and what suits you."
      Icon={ScanLine}
      ctaLabel="Check ingredient health score"
      onStart={() => {
        resetIngredients();
        router.push('/ingredient-scan');
      }}
    />
  );
}
