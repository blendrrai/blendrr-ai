import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Brain,
  HelpCircle,
  Lock,
  Palette,
  ScrollText,
  Sparkles,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';

type IconProps = { size: number; color: string; strokeWidth: number };

export default function HowItWorks() {
  return (
    <Screen>
      <StepHeader
        title="How BLENDRR Ai works"
        subtitle="The AI, the quizzes, your privacy, and the questions we hear most."
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <Section
          Icon={Sparkles}
          eyebrow="The AI"
          title="State-of-the-art shade matching"
        >
          <P>
            BLENDRR uses a <B>state-of-the-art image AI</B> tuned for identity-preserving
            edits — your face, pose, lighting, and background stay exactly as they are, only
            the shade or finish you asked for changes.
          </P>
          <P>
            Before applying anything, we run a two-step shade analysis:
          </P>
          <Bullet
            n={1}
            title="Read the colour"
            body="A vision model studies your product image and extracts the actual shade — finding the hex code, undertone (warm / cool / neutral), and finish (matte, satin, glossy, shimmer). It deliberately ignores packaging colour, so a clear plastic tube doesn't fool it."
          />
          <Bullet
            n={2}
            title="Apply the exact shade"
            body="The image model then composites only the lips, face, or hair zone — using that exact hex as the source of truth instead of guessing from the photo alone."
          />
          <P>
            That two-step pass is why a shade you save from Sephora looks like the shade you'd
            actually see on your face — not a fuzzy average.
          </P>
        </Section>

        <Section Icon={Palette} eyebrow="Why screenshots beat links" title="Most accurate input">
          <P>
            Links work, but most cosmetic sites only expose their <B>packaging shot</B> for
            previews — the lipstick tube, not the bullet. Screenshots from a swatch image or an
            on-model photo give the AI a far better starting point. That's why screenshot is
            tagged <B>Recommended</B> in the try-on flow.
          </P>
        </Section>

        <Section Icon={Brain} eyebrow="The quizzes" title="How the analyses work">
          <P>
            Skincare, haircare, and fragrance each have a short quiz — 5-6 questions covering
            type, concerns, habits, climate, and (for fragrance) scent families and mood.
          </P>
          <P>
            For skincare and haircare, you also add a photo. Our vision AI reads what's on
            your face or in your hair — texture, signs of dryness, frizz, undertone — and
            combines that with your answers to suggest a routine that's actually personalised.
            Not a generic checklist.
          </P>
          <P>
            For fragrance, our AI runs with <B>live web search</B> — so recommendations
            include currently trending and recently-released bottles, not whatever a model
            trained on a year ago.
          </P>
          <P>
            Each analysis costs 1 credit. Pro members get 30 credits a month shared across all
            try-ons and analyses.
          </P>
        </Section>

        <Section Icon={Lock} eyebrow="Your privacy" title="Everything lives on this phone">
          <Bullet
            n="•"
            title="No accounts, ever"
            body="There's no signup. No login. No password to forget."
          />
          <Bullet
            n="•"
            title="Photos stay local"
            body="Your selfies, hair photos, and generated try-ons are stored in this app's private storage on your phone only. They're not uploaded to any BLENDRR server — we don't have one."
          />
          <Bullet
            n="•"
            title="What our AI sees"
            body="Photos are sent to our AI providers only when you tap a quiz or try-on — for the few seconds the AI is generating. They process them and do not store them or use them for training. See our Privacy Policy for the full list of providers and their data terms."
          />
          <Bullet
            n="•"
            title="Your wishlist + history"
            body="Saved products, routine answers, past analyses, subscription state — all of it lives in your phone's encrypted app storage. Delete the app and it's all gone."
          />
        </Section>

        <Section Icon={HelpCircle} eyebrow="FAQ" title="Common questions">
          <Faq q="Why does my try-on take a few seconds?">
            Image generation is the slowest step — usually 3-6 seconds. The shade-analysis
            preprocess happens in parallel with image encoding so it doesn't add real time.
          </Faq>
          <Faq q="Why do some try-ons look slightly off?">
            All AI try-on tools — including Sephora's and L'Oréal's — are best for "vibes",
            not exact colour-matching for a £40 purchase. We get closer than most because of
            the two-step shade pass, but if a product photo shows only packaging, the AI has
            to infer the bullet colour from context. Use a swatch screenshot when you can.
          </Faq>
          <Faq q="Can I save try-ons?">
            Yes — every successful try-on goes to your History tab. From the result page you
            can also tap "Save to camera roll" to drop the image into your Photos app, or
            "Share to friends" for the native share sheet.
          </Faq>
          <Faq q="What's the difference between Free and Pro?">
            Free starts with 3 credits. Pro is £9.99/month and gives you 30 credits a month,
            shared across try-ons and analyses. You can also buy one-off credit packs (10,
            30, or 100).
          </Faq>
          <Faq q="What costs a credit?">
            Every AI generation: try-ons, skincare analyses, haircare analyses, and
            fragrance discovery. Browsing your wishlist, retaking a quiz without
            re-generating, copying or sharing — all free.
          </Faq>
          <Faq q="Why does the fragrance section know what's trending?">
            We give our AI access to live web search when running fragrance discovery, so
            it can pull current TikTok-viral and recently-released picks instead of relying
            on its training data.
          </Faq>
          <Faq q="Can my friends see my wishlist?">
            Not unless you share. There are no public profiles. Use the share button on any
            wishlist item or routine pick to send the details via Messages, Instagram, etc.
          </Faq>
        </Section>

        <Section Icon={ScrollText} eyebrow="More" title="Find a bug, got an idea?">
          <P>
            BLENDRR is being actively built. If something's off or you'd love a feature,
            send a note via the share sheet from any page — the version, what you were
            doing, and the issue.
          </P>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({
  Icon,
  eyebrow,
  title,
  children,
}: {
  Icon: ComponentType<IconProps>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, shadow.card]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon size={20} color={colors.primary} strokeWidth={1.8} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function Bullet({
  n,
  title,
  body,
}: {
  n: number | string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletNumber}>
        <Text style={styles.bulletNumberText}>{n}</Text>
      </View>
      <View style={styles.bulletText}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
    </View>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <View style={styles.faq}>
      <Text style={styles.faqQ}>{q}</Text>
      <Text style={styles.faqA}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  section: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderText: { flex: 1, gap: 2 },
  sectionEyebrow: { ...type.eyebrow, color: colors.textMuted },
  sectionTitle: { ...type.heading, fontSize: 18, color: colors.text },
  sectionBody: { gap: spacing.sm },
  paragraph: {
    ...type.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  bold: { fontWeight: '700' },
  bullet: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 },
  bulletNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletNumberText: {
    ...type.caption,
    color: colors.primaryOn,
    fontSize: 12,
    fontWeight: '700',
  },
  bulletText: { flex: 1, gap: 2 },
  bulletTitle: { ...type.heading, fontSize: 14, color: colors.text },
  bulletBody: {
    ...type.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  faq: { gap: 6, paddingVertical: 6 },
  faqQ: { ...type.heading, fontSize: 14, color: colors.text },
  faqA: { ...type.body, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
