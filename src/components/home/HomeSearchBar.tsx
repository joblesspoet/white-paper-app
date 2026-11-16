import { memo } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { ThemeColors } from '../../theme';
import { CloseIcon, SearchIcon } from '../icons';
import { homeSearchBarStyles as styles } from './HomeSearchBar.styles';

type HomeSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  theme: ThemeColors;
};

export const HomeSearchBar = memo(function HomeSearchBar({
  value,
  onChangeText,
  onClear,
  theme,
}: HomeSearchBarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
      ]}
    >
      <SearchIcon size={18} color={theme.primary} />
      <TextInput
        accessibilityLabel="Search boards"
        placeholder="Search boards..."
        placeholderTextColor={`${theme.foreground}77`}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.foreground }]}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear board search"
          onPress={onClear}
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearPressed]}
        >
          <CloseIcon size={18} color={theme.foreground} />
        </Pressable>
      )}
    </View>
  );
});
