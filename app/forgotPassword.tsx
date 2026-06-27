import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_URL = 'http://16.171.208.58/api';

export default function ForgotPassword() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2 | 3>(1); 
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 1. إرسال كود الـ OTP
  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/password/forgot`, { email: email.trim() });
      Alert.alert("Success", response.data.message || "OTP code sent to your email!");
      setStep(2);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Email not found or server error");
    } finally {
      setLoading(false);
    }
  };

  // 2. التحقق من الـ OTP
  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter the OTP code");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/password/verify-otp`, { 
        email: email.trim(), 
        otp: otp 
      });
      Alert.alert("Verified", response.data.message || "Code is valid, change your password");
      setStep(3);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  // 3. حفظ الباسورد الجديد
  const handleResetPassword = async () => {
    if (!password || !passwordConfirmation) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== passwordConfirmation) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/password/reset`, {
        email: email.trim(),
        otp: otp,
        password: password,
        password_confirmation: passwordConfirmation
      });
      Alert.alert("Success 🎉", response.data.message || "Password updated successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          
         <TouchableOpacity 
  style={styles.backButton} 
  onPress={() => {
    if (step === 3) {
      setStep(2); // لو واقف في خطوة الباسورد يرجع لخطوة الكود
    } else if (step === 2) {
      setStep(1); // لو واقف في خطوة الكود يرجع لخطوة الإيميل
    } else {
      router.back(); // لو واقف في خطوة الإيميل يرجع للشاشة اللي قبلها بالكامل (الـ Login)
    }
  }}
>
  <Ionicons name="arrow-back" size={24} color="#0288D1" />
</TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons 
                  name={step === 1 ? "mail-open-outline" : step === 2 ? "key-outline" : "lock-open-outline"} 
                  size={50} 
                  color="#0D47A1" 
                />
              </View>
            </View>

            <Text style={styles.title}>
              {step === 1 ? "Reset Password" : step === 2 ? "Enter OTP" : "New Password"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 && "Enter your email to receive a verification code."}
              {step === 2 && `We sent a 6-digit code to:\n${email}`}
              {step === 3 && "Set your new secure password below."}
            </Text>

            {/* STEP 1: Email */}
            {step === 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. parent@test.com" 
                  placeholderTextColor="#90CAF9"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}

            {/* STEP 2: OTP */}
            {step === 2 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter 6-digit code" 
                  placeholderTextColor="#90CAF9"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            )}

            {/* STEP 3: Passwords */}
            {step === 3 && (
              <View style={{ width: '100%' }}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput 
                      style={[styles.input, { marginBottom: 0 }]} 
                      placeholder="Enter new password" 
                      placeholderTextColor="#90CAF9"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#90CAF9" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Confirm your password" 
                    placeholderTextColor="#90CAF9"
                    secureTextEntry={!showPassword}
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                  />
                </View>
              </View>
            )}

            {/* Button */}
            <TouchableOpacity 
              style={[styles.actionBtn, loading && { backgroundColor: '#BBDEFB' }]}
              onPress={step === 1 ? handleSendOtp : step === 2 ? handleVerifyOtp : handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D47A1" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {step === 1 ? "Send Code" : step === 2 ? "Verify Code" : "Update Password"}
                </Text>
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD' },
backButton: { 
  position: 'absolute', // نخليه حر الحركة فوق العناصر
  top: 50,              // ننزله شوية من السقف عشان الـ Notch أو الكاميرا
  left: 20,             // نحدد مكانه من الشمال
  zIndex: 10,           // نرفعه فوق الـ ScrollView والـ View الأساسي
  padding: 10,          // نكبر مساحة الضغطة شوية عشان يلقط بسهولة
},
  content: { flex: 1, paddingHorizontal: 30, alignItems: 'center', paddingTop: 20 },
  logoContainer: { marginBottom: 30 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BBDEFB' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#01579B', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#64B5F6', marginBottom: 40, textAlign: 'center' },
  inputGroup: { width: '100%', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#0288D1', marginBottom: 8, marginLeft: 5 },
  input: { width: '100%', height: 55, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 20, fontSize: 14, borderWidth: 1, borderColor: '#BBDEFB', color: '#01579B' },
  passwordWrapper: { width: '100%', position: 'relative' },
  eyeIcon: { position: 'absolute', right: 20, top: 15 },
  actionBtn: { width: '100%', height: 55, backgroundColor: '#90CAF9', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 40, marginTop: 20 },
  actionBtnText: { color: '#0D47A1', fontSize: 18, fontWeight: 'bold' },
});