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
  const [showPw, setShowPw] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSubmit = async () => {
    if (!email.trim() || !password) { Alert.alert("Missing Fields", "Fill in all required fields."); return; }
    if (isRegister && !name.trim()) { Alert.alert("Missing Name", "Enter your full name."); return; }
    if (password.length < 8) { Alert.alert("Weak Password", "Minimum 8 characters required."); return; }

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

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.brandName}>Voyager.</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {isRegister
              ? "Create your explorer profile to save and revisit itineraries."
              : "Welcome back. Your postcards are waiting."}
          </Text>

          <View style={s.form}>
            {isRegister && (
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
                <View style={[s.inputRow, { borderColor: colors.border }]}>
                  <Feather name="user" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
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

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
              <View style={[s.inputRow, { borderColor: colors.border }]}>
                <Feather name="mail" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={[s.input, { color: colors.foreground }]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
              <View style={[s.inputRow, { borderColor: colors.border }]}>
                <Feather name="lock" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={[s.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                  <Feather name={showPw ? "eye-off" : "eye"} size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>
                  {isRegister ? "CREATE PROFILE" : "RESTORE SESSION"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.switchMode} onPress={() => { Haptics.selectionAsync(); setIsRegister(!isRegister); }}>
              <Text style={[s.switchText, { color: colors.mutedForeground }]}>
                {isRegister ? "Already registered? " : "New explorer? "}
                <Text style={{ color: colors.primary, fontFamily: "SpaceMono_700Bold" }}>
                  {isRegister ? "SIGN IN" : "CREATE ACCOUNT"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    topBar: { paddingHorizontal: 20, paddingBottom: 8 },
    closeBtn: { alignSelf: "flex-start", padding: 4 },
    scroll: { paddingHorizontal: 24, paddingBottom: 40 },
    sysLine: { fontFamily: "SpaceMono_400Regular", fontSize: 9, marginBottom: 4, marginTop: 8 },
    brandName: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 44, color: "#451A03", marginBottom: 12 },
    subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginBottom: 28 },
    form: { gap: 16 },
    field: { gap: 6 },
    fieldLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 2 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 2,
      borderRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: "#FFFBEB",
    },
    input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15 },
    submitBtn: {
      paddingVertical: 18,
      alignItems: "center",
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
      marginTop: 8,
    },
    submitBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 12, color: "#fff", letterSpacing: 2 },
    switchMode: { alignItems: "center", paddingTop: 8 },
    switchText: { fontFamily: "SpaceMono_400Regular", fontSize: 10, textAlign: "center" },
  });
}
