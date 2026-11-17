import { memo, useMemo } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  REWARDED_FEATURE_META,
  type PaywallTrigger,
} from '../../monetization/entitlement-service';
import {
  IAP_PRODUCTS,
  type IapEnvironment,
  type IapProductDefinition,
  type UserPlanTier,
} from '../../monetization/iap-catalog';
import { resolveFlowModalLayout } from '../../responsive/layout';
import { spacing, type ThemeColors } from '../../theme';
import { paywallStyles as styles } from './PaywallModal.styles';
import { ProBadge } from './ProBadge';

type PaywallModalProps = {
  visible: boolean;
  trigger: PaywallTrigger | null;
  currentTier: UserPlanTier;
  liveClassPasses: number;
  environment: IapEnvironment;
  theme: ThemeColors;
  reducedMotion?: boolean;
  busyProductKey: string | null;
  onPurchase: (product: IapProductDefinition) => void;
  onRestorePurchases: () => void;
  onResetDevPurchases?: () => void;
  onClose: () => void;
};

function getHeaderCopy(trigger: PaywallTrigger | null): { title: string; subtitle: string } {
  if (!trigger) {
    return {
      title: 'FlowCanvas Pro Plans',
      subtitle: 'Pick the plan that fits your teaching & study workflow.',
    };
  }
  switch (trigger.reason) {
    case 'board_limit':
      return {
        title: `${trigger.currentCount} / ${trigger.maxBoards} Free Boards Used`,
        subtitle: 'Unlock unlimited boards & multi-page PDFs forever, or go Teacher Pro.',
      };
    case 'remove_ads':
      return {
        title: 'Go Ad-Free',
        subtitle: 'Remove all ads forever for $1.99, or unlock the full Offline Studio.',
      };
    case 'lesson_recorder_hd':
      return {
        title: 'Unlimited HD Lesson Video',
        subtitle: 'Free accounts record up to 4 min (480p). Upgrade for unlimited 1080p + Face-Cam.',
      };
    case 'live_voice':
      return {
        title: 'Host Live Voice Classes',
        subtitle: 'Stream your board + live voice up to 40 students. Students always join free.',
      };
    case 'feature': {
      const meta = REWARDED_FEATURE_META[trigger.feature];
      return { title: meta.title, subtitle: meta.description };
    }
    case 'upgrade':
    default:
      return {
        title: 'Upgrade FlowCanvas',
        subtitle: 'Lowest-cost teaching whiteboard — start with a 7-day free trial.',
      };
  }
}

export const PaywallModal = memo(function PaywallModal({
  visible,
  trigger,
  currentTier,
  liveClassPasses,
  environment,
  theme,
  reducedMotion = false,
  busyProductKey,
  onPurchase,
  onRestorePurchases,
  onResetDevPurchases,
  onClose,
}: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centeredModal } = resolveFlowModalLayout(width, height);
  const { title, subtitle } = useMemo(() => getHeaderCopy(trigger), [trigger]);

  const byKey = useMemo(() => {
    const map = new Map<IapProductDefinition['key'], IapProductDefinition>();
    for (const p of IAP_PRODUCTS) map.set(p.key, p);
    return map;
  }, []);

  const annual = byKey.get('teacher_pro_annual')!;
  const monthly = byKey.get('teacher_pro_monthly')!;
  const studio = byKey.get('offline_studio')!;
  const removeAds = byKey.get('remove_ads')!;
  const pass5 = byKey.get('live_class_5_pack')!;
  const pass20 = byKey.get('live_class_20_pack')!;

  const isTeacherPro = currentTier === 'teacher_pro';
  const hasStudio = currentTier === 'offline_studio' || isTeacherPro;
  const hasAdFree = currentTier === 'ad_free' || hasStudio;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : centeredModal ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, centeredModal && styles.backdropCentered]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            centeredModal && styles.sheetCentered,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(spacing.md, insets.bottom),
            },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
                <ProBadge
                  label={isTeacherPro ? 'PRO ACTIVE' : 'PLANS'}
                  variant={isTeacherPro ? 'live' : 'pro'}
                  theme={theme}
                />
              </View>
              <Text style={[styles.subtitle, { color: theme.foreground }]}>{subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close upgrade options"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          {environment === 'development' && (
            <View
              style={[
                styles.devBanner,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.devBannerText, { color: theme.foreground }]}>
                DEV SANDBOX · Local IAP simulation ({currentTier} · {liveClassPasses} passes)
              </Text>
              {onResetDevPurchases && (
                <Pressable onPress={onResetDevPurchases} hitSlop={8}>
                  <Text style={[styles.devResetText, { color: theme.destructive }]}>Reset</Text>
                </Pressable>
              )}
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>
              Subscriptions (Live Class + HD Video + Everything)
            </Text>

            {/* Teacher Pro Annual (Featured) */}
            <View
              style={[
                styles.planCard,
                styles.planCardFeatured,
                { borderColor: theme.primary, backgroundColor: theme.background },
              ]}
            >
              <View style={styles.planTopRow}>
                <View style={styles.planTitleRow}>
                  <Text style={[styles.planTitle, { color: theme.foreground }]}>
                    {annual.title}
                  </Text>
                  <ProBadge label="7-DAY FREE TRIAL · SAVE 44%" variant="pro" theme={theme} />
                </View>
                <Text style={[styles.planPrice, { color: theme.primary }]}>
                  {annual.referenceUsdPrice}
                </Text>
              </View>
              <Text style={[styles.planDesc, { color: theme.foreground }]}>{annual.subtitle}</Text>
              <View style={styles.bullets}>
                <Text style={[styles.bulletText, { color: theme.foreground }]}>
                  • Live Classroom + LiveKit Voice (up to 40 students, 25 voice hrs/mo)
                </Text>
                <Text style={[styles.bulletText, { color: theme.foreground }]}>
                  • Unlimited 1080p Lesson Video + Face-Cam PiP (no watermark)
                </Text>
                <Text style={[styles.bulletText, { color: theme.foreground }]}>
                  • Full Offline Studio (PDF markup, Geometry, STEM, Active Recall) + Ad-Free
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start 7-day free trial for Teacher Pro Annual"
                disabled={isTeacherPro || busyProductKey !== null}
                onPress={() => onPurchase(annual)}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  {
                    backgroundColor: isTeacherPro ? theme.muted : theme.primary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.ctaBtnText,
                    { color: isTeacherPro ? theme.foreground : theme.onPrimary },
                  ]}
                >
                  {isTeacherPro
                    ? 'Active Plan'
                    : busyProductKey === annual.key
                      ? 'Activating…'
                      : 'Start 7-Day Free Trial · Then $19.99/yr'}
                </Text>
              </Pressable>
            </View>

            {/* Teacher Pro Monthly */}
            <View
              style={[
                styles.planCard,
                { borderColor: theme.border, backgroundColor: theme.background },
              ]}
            >
              <View style={styles.planTopRow}>
                <Text style={[styles.planTitle, { color: theme.foreground }]}>
                  {monthly.title}
                </Text>
                <Text style={[styles.planPrice, { color: theme.foreground }]}>
                  {monthly.referenceUsdPrice}
                </Text>
              </View>
              <Text style={[styles.planDesc, { color: theme.foreground }]}>{monthly.subtitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Subscribe to Teacher Pro Monthly"
                disabled={isTeacherPro || busyProductKey !== null}
                onPress={() => onPurchase(monthly)}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  {
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: isTeacherPro ? theme.border : theme.primary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.ctaBtnText, { color: theme.primary }]}>
                  {isTeacherPro
                    ? 'Included in Active Plan'
                    : busyProductKey === monthly.key
                      ? 'Activating…'
                      : 'Subscribe Monthly · $2.99/mo'}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.primary }]}>
              One-Time Purchases (No Subscription)
            </Text>

            <View style={styles.twoColRow}>
              <View
                style={[
                  styles.compactCard,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <View>
                  <Text style={[styles.compactTitle, { color: theme.foreground }]}>
                    {studio.title}
                  </Text>
                  <Text style={[styles.compactSub, { color: theme.foreground }]}>
                    Unlimited boards & pages, PDF markup, Geometry, Math/Plotter, Active Recall & Ad-Free forever.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={hasStudio || busyProductKey !== null}
                  onPress={() => onPurchase(studio)}
                  style={({ pressed }) => [
                    styles.compactPriceBtn,
                    { backgroundColor: hasStudio ? theme.muted : theme.accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.compactPriceText,
                      { color: hasStudio ? theme.foreground : theme.onAccent },
                    ]}
                  >
                    {hasStudio
                      ? 'Owned'
                      : busyProductKey === studio.key
                        ? 'Unlocking…'
                        : `Unlock · ${studio.referenceUsdPrice}`}
                  </Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.compactCard,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <View>
                  <Text style={[styles.compactTitle, { color: theme.foreground }]}>
                    {removeAds.title}
                  </Text>
                  <Text style={[styles.compactSub, { color: theme.foreground }]}>
                    Removes Home & Export ads forever, bumps boards to 15 & ad-free Board-Only Live Sync.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={hasAdFree || busyProductKey !== null}
                  onPress={() => onPurchase(removeAds)}
                  style={({ pressed }) => [
                    styles.compactPriceBtn,
                    {
                      backgroundColor: hasAdFree ? theme.muted : theme.surface,
                      borderWidth: 1,
                      borderColor: hasAdFree ? theme.border : theme.primary,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.compactPriceText,
                      { color: hasAdFree ? theme.foreground : theme.primary },
                    ]}
                  >
                    {hasAdFree
                      ? 'Owned'
                      : busyProductKey === removeAds.key
                        ? 'Unlocking…'
                        : `Buy · ${removeAds.referenceUsdPrice}`}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.primary }]}>
              Pay-As-You-Go Live Voice Passes (Balance: {liveClassPasses})
            </Text>

            <View style={styles.twoColRow}>
              {[pass5, pass20].map((pack) => (
                <View
                  key={pack.key}
                  style={[
                    styles.compactCard,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <View>
                    <Text style={[styles.compactTitle, { color: theme.foreground }]}>
                      {pack.title}
                    </Text>
                    <Text style={[styles.compactSub, { color: theme.foreground }]}>
                      {pack.subtitle}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyProductKey !== null}
                    onPress={() => onPurchase(pack)}
                    style={({ pressed }) => [
                      styles.compactPriceBtn,
                      { backgroundColor: theme.primary },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.compactPriceText, { color: theme.onPrimary }]}>
                      {busyProductKey === pack.key ? 'Adding…' : `Buy · ${pack.referenceUsdPrice}`}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.footerActions}>
              <Pressable accessibilityRole="button" onPress={onRestorePurchases}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>Restore Purchases</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Terms of Use',
                    'Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period in App Store / Google Play settings.',
                  )
                }
              >
                <Text style={[styles.footerLink, { color: theme.foreground }]}>Terms (EULA)</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Privacy Policy',
                    'Your boards and drawings remain stored locally on your device. Live Class sessions transmit ephemeral canvas/audio streams only while active.',
                  )
                }
              >
                <Text style={[styles.footerLink, { color: theme.foreground }]}>Privacy</Text>
              </Pressable>
            </View>
            <Text style={[styles.legalNote, { color: theme.foreground }]}>
              7-day free trial on Teacher Pro Annual, then $19.99/year unless canceled. Prices
              shown in USD; local store taxes and regional PPP pricing apply at checkout.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
