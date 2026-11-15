import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { normalizeRoomCode } from '../classroom/protocol';
import type { ThemeColors } from '../theme';
import { joinClassStyles as styles } from './JoinClassModal.styles';

type JoinClassModalProps = {
  visible: boolean;
  initialCode?: string | null;
  theme: ThemeColors;
  onClose: () => void;
  onJoin: (params: { roomCode: string; displayName: string; projectorMode: boolean }) => void;
};

export const JoinClassModal = React.memo(function JoinClassModal({
  visible,
  initialCode,
  theme,
  onClose,
  onJoin,
}: JoinClassModalProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const minModalHeight = Math.round(height * (isLandscape ? 0.75 : 0.70));
  const maxModalHeight = Math.round(height * 0.90);
  const [codeInput, setCodeInput] = useState(initialCode ?? '');
  const [displayName, setDisplayName] = useState('');
  const [projectorMode, setProjectorMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialCode) setCodeInput(initialCode);
      setError(null);
    }
  }, [initialCode, visible]);

  const handleCodeChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCodeInput(digits);
    setError(null);
  }, []);

  const handleNameChange = useCallback((text: string) => {
    setDisplayName(text);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const normalized = normalizeRoomCode(codeInput);
    if (!normalized) {
      setError('Please enter the 6-digit classroom code.');
      return;
    }
    const trimmedName = displayName.trim();
    if (!projectorMode && !trimmedName) {
      setError('Please enter your name so your teacher knows who joined.');
      return;
    }
    const cleanName = trimmedName || 'Classroom Projector';
    onJoin({
      roomCode: normalized,
      displayName: cleanName,
      projectorMode,
    });
  }, [codeInput, displayName, onJoin, projectorMode]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close join class modal"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              {
                minHeight: minModalHeight,
                maxHeight: maxModalHeight,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardContent}
            >
              <View style={styles.formBody}>
              <View style={styles.header}>
              <Text style={[styles.title, { color: theme.foreground }]}>Join live class</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close join class modal"
                onPress={onClose}
                style={styles.closeButton}
              >
                <Text style={[styles.closeText, { color: theme.foreground }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { color: theme.foreground }]}>
              Enter the 6-digit code from your teacher’s screen. No account needed.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>6-Digit Class Code</Text>
              <TextInput
                accessibilityLabel="6-digit classroom code"
                value={codeInput}
                onChangeText={handleCodeChange}
                placeholder="482910"
                placeholderTextColor={theme.border}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={!initialCode}
                style={[
                  styles.codeInput,
                  {
                    color: theme.foreground,
                    borderColor: error ? theme.destructive : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>
                {projectorMode ? 'Display Name (optional)' : 'Your Name *'}
              </Text>
              <TextInput
                accessibilityLabel="Your display name"
                value={displayName}
                onChangeText={handleNameChange}
                placeholder={projectorMode ? 'Classroom Projector' : 'e.g. Sara Khan'}
                placeholderTextColor={theme.border}
                maxLength={32}
                style={[
                  styles.nameInput,
                  {
                    color: theme.foreground,
                    borderColor: error && !projectorMode && !displayName.trim() ? theme.destructive : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={[styles.toggleTitle, { color: theme.foreground }]}>
                  Projector / Clean Mirror Mode
                </Text>
                <Text style={[styles.toggleHint, { color: theme.foreground }]}>
                  Hides student toolbars and follows the teacher’s camera automatically.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Projector clean mirror mode"
                value={projectorMode}
                onValueChange={setProjectorMode}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>

            {error && (
              <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
            )}
              </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={[styles.cancelButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.cancelText, { color: theme.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Join live class"
                onPress={handleSubmit}
                style={[styles.joinButton, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.joinText}>Join Live Class</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});
