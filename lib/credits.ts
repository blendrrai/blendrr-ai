import { Alert } from 'react-native';
import { router } from 'expo-router';
import { consumeCredit, type Subscription } from './storage';

let promptInFlight = false;

function showOutOfCreditsPrompt() {
  if (promptInFlight) return;
  promptInFlight = true;
  setTimeout(() => {
    Alert.alert(
      "You're out of credits",
      'Upgrade to Pro for 30 credits a month, or buy a one-off credit pack to keep going.',
      [
        { text: 'Maybe later', style: 'cancel', onPress: () => { promptInFlight = false; } },
        {
          text: 'Open credits',
          onPress: () => {
            promptInFlight = false;
            router.push('/menu/credits');
          },
        },
      ],
      { onDismiss: () => { promptInFlight = false; } },
    );
  }, 600);
}

/**
 * Consume one credit and, if it brings the user to zero, surface the upgrade prompt.
 * Use this in place of `consumeCredit` after any successful AI call.
 */
export async function consumeCreditWithPrompt(): Promise<Subscription> {
  const next = await consumeCredit();
  if (next.credits === 0) showOutOfCreditsPrompt();
  return next;
}
