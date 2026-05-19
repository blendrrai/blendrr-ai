import { router } from 'expo-router';
import { Flower2 } from 'lucide-react-native';
import { CategoryHome } from '../../components/CategoryHome';
import { useLook } from '../../lib/state';

export default function FragranceTab() {
  const { resetRoutine } = useLook();

  return (
    <CategoryHome
      eyebrow="Fragrance"
      title={'Find your\nsignature scent.'}
      subtitle="A few questions about your taste, your mood, your season — and we'll point you at the bottle."
      Icon={Flower2}
      ctaLabel="Start quiz"
      onStart={() => {
        resetRoutine('fragrance');
        router.push('/fragrance-quiz');
      }}
    />
  );
}
