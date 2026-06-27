import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRootNavigationState, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import SharedPreferences from 'react-native-shared-preferences';

export default function ChildLogin() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState(); // 🚀 بيقولنا الـ Navigator خلص يستعد ولا لسه
  const params = useLocalSearchParams();
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // تم تعديل الـ useEffect ليفحص الجلسة بدلاً من مسحها
  useEffect(() => {
    // 🚀 لو الـ Navigator لسه مش جاهز، منعملش أي navigate ومنستناه يجهز
    if (!rootNavigationState?.key) return;

    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const isPaired = await AsyncStorage.getItem('isPaired');
        
        if (token) {
          if (isPaired === 'true') {
            router.replace('/welcomeChild');
          } else {
            router.replace('/pairingScreen');
          }
        }
      } catch (error) {
        console.log("Error checking existing session:", error);
      }
    };

    // فقط إذا لم يكن هناك كود ربط قادم (حالة تسجيل دخول جديد)
    if (!params.code) {
      checkSession();
    }
  }, [rootNavigationState?.key]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://16.171.208.58/api/child/login', {
        email: email.trim(),
        password: password,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (response.data && response.data.access_token) {
        const cleanToken = response.data.access_token.replace(/"/g, '');
        const childData = response.data.user;

        try {
          SharedPreferences.setName("UserPrefs");
          SharedPreferences.setItem("child_id", childData.id.toString());
          // ✅ جديد: نحفظ التوكن هنا كمان في الـ Native Storage (وليس فقط AsyncStorage)
          // لأن AppMonitorService.kt كود Native شغال في الخلفية ومش بيوصل لـ
          // AsyncStorage (تخزين الجافاسكريبت)، فهو محتاج التوكن من هنا عشان يقدر
          // يبعت طلبات محمية (auth:child) للسيرفر مثل مزامنة الاستخدام.
          SharedPreferences.setItem("auth_token", cleanToken);
        } catch (e) {
          console.log("Could not save to Native SharedPreferences");
        }

        await AsyncStorage.setItem('userToken', cleanToken);
        await AsyncStorage.setItem('childInfo', JSON.stringify(childData)); 
        await AsyncStorage.setItem('userType', 'child'); 

        const isActive = childData.is_active;

        if (isActive === 1 || isActive === true) {
          await AsyncStorage.setItem('isPaired', 'true');
          router.replace('/welcomeChild'); 
        } else {
          await AsyncStorage.removeItem('isPaired');
          router.replace('/pairingScreen'); 
        }

      } else {
        Alert.alert("Login Failed", "Unexpected response from server.");
      }

    } catch (error: any) {
      console.log("❌ Login Error Details:", error.response?.data);
      const errorMsg = error.response?.data?.message || "Invalid email or password";
      Alert.alert("Login Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#0288D1" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
             <Ionicons name="people" size={50} color="#0D47A1" />
          </View>
        </View>

        <Text style={styles.title}>Child Login</Text>
        <Text style={styles.subtitle}>Enter your child's details to proceed.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Anas@test.com" 
            placeholderTextColor="#90CAF9"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {/* خانة الباسورد الحالية في ملفك */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput 
              style={[styles.input, { marginBottom: 0 }]} 
              placeholder="Enter your password" 
              placeholderTextColor="#90CAF9"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={22} 
                color="#90CAF9" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 🚀 ضيفي زرار Forgot Password هنا بالظبط تحت الـ inputGroup وقبل الـ loginBtn */}
        <TouchableOpacity 
          style={styles.forgotPassContainer}
          onPress={() => router.push('/forgotPassword')}
          activeOpacity={0.6}
        >
          <Text style={styles.forgotPassText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* زرار الـ Login الحالي بتاعك */}
        <TouchableOpacity 
          style={[styles.loginBtn, loading && { backgroundColor: '#BBDEFB' }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D47A1" />
          ) : (
            <Text style={styles.loginBtnText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Child need an account? </Text>
          <TouchableOpacity onPress={() => router.push('/childSignUp')}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD' },
// في جزء الـ Styles تحت:
backButton: { 
  padding: 15,          // زيادة الـ padding لتوسيع منطقة الضغط
  alignSelf: 'flex-start', // لضمان عدم أخذ مساحة العرض بالكامل
  marginLeft: 10,
  marginTop: 10 
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
  loginBtn: { width: '100%', height: 55, backgroundColor: '#90CAF9', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 40, marginTop: 20 },
  loginBtnText: { color: '#0D47A1', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: '#90CAF9', fontSize: 13 },
  signUpLink: { color: '#03A9F4', fontWeight: 'bold', fontSize: 13 },
  
  // 🚀 دول اللي كانو ناقصين ومسببين المشكلة:
  forgotPassContainer: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginTop: -5,
    paddingRight: 5
  },
  forgotPassText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 14
  },
});