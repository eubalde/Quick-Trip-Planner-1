import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(mode === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }
    if (isRegister && !name.trim()) {
      Alert.alert("Missing name", "Please enter your name.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={18} color="#fff" />
            </View>
            <Text style={[styles.logoText, { color: colors.primary }]}>Wandr</Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {isRegister ? "Create account" : "Welcome back"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isRegister
              ? "Sign up to save and revisit your itineraries"
              : "Sign in to access your saved trips"}
          </Text>

          <View style={styles.form}>
            {isRegister && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full Name</Text>
                <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Your name"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Email</Text>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Password</Text>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: isLoading ? colors.muted : colors.primary }]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchMode}
              onPress={() => {
                Haptics.selectionAsync();
                setIsRegister(!isRegister);
              }}
            >
              <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
                {isRegister ? "Already have an account? " : "Don't have an account? "}
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                  {isRegister ? "Sign In" : "Create one"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: { paddingHorizontal: 20, paddingBottom: 8 },
    closeBtn: { alignSelf: "flex-start", padding: 4 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 32, marginTop: 8 },
    logoCircle: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    logoText: { fontSize: 20, fontFamily: "Inter_700Bold" },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 32, lineHeight: 22 },
    form: { gap: 16 },
    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    submitBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    switchMode: { alignItems: "center", paddingTop: 8 },
    switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  });
}
