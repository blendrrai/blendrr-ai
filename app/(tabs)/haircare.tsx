import { router } from 'expo-router';
import { Wind } from 'lucide-react-native';
import { CategoryHome } from '../../components/CategoryHome';
import { useLook } from '../../lib/state';

export default function HaircareTab() {
  const { resetRoutine } = useLook();

  return (
    <CategoryHome
      eyebrow="Haircare"
      title={'Hair goals,\nunlocked.'}
      subtitle="Tell us about your hair, send a photo, and we'll map out a routine that actually fits."
      Icon={Wind}
      ctaLabel="Start quiz"
      onStart={() => {
        resetRoutine('haircare');
        router.push('/haircare-quiz');
      }}
    />
  );
}
