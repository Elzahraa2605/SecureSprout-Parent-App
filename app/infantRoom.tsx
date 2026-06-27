import React, { useEffect, useState, useRef } from 'react';
import { Text, View, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useRouter } from 'expo-router';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const BACKGROUND_TASK_NAME = 'baby-monitor-cry-check';
const API = "http://16.171.208.58/api";

interface AlertItemType {
  message: string;
  time: string;
  type?: string;
}

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const res = await fetch(API + "/hardware/light-status");
    const data = await res.json();
    if (data.is_online) {
      // منطق الخلفية الاحتياطي
    }
  } catch (err) {
    console.log("Background task error:", err);
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

async function registerBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: 15,
      });
      console.log("✅ Background task registered");
    }
  } catch (err) {
    console.log("❌ Background task registration failed:", err);
  }
}

export default function App({ navigation }: any) {
  const router = useRouter();
  const [cry, setCry] = useState(false);
  const [online, setOnline] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const [lightMessage, setLightMessage] = useState('');
  const [alerts, setAlerts] = useState<AlertItemType[]>([]);

  const lastCryRef = useRef(false);
  const glowValue = useRef(new Animated.Value(0)).current;
  const screenGlow = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const setup = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await registerBackgroundTask();
      } else {
        console.log("Notification permission denied");
      }
    };
    setup();

    getStatus();
    const interval = setInterval(getStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendCryNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "👶 Baby Monitor",
        body: "Baby Crying Detected!",
        sound: true,
      },
      trigger: null,
    });
  };

  const getStatus = async () => {
    let isDeviceOnline = false;

    try {
      const statusRes = await axios.get(API + "/hardware/light-status");
      isDeviceOnline = statusRes.data.is_online;
      
      setOnline(isDeviceOnline);
      setLightOn(statusRes.data.is_light_on === 1);
    } catch (error) {
      console.log("Hardware status check failed:", error);
      setOnline(false); 
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

     // ❌ السطر القديم اللي كان بيسحب كل الإشعارات:
// const alertsRes = await axios.get(API + "/parent/alerts", { headers });

//  السطر الجديد المعدل عشان يطلب إشعارات الرضيع الفاضية (null) فقط:
const alertsRes = await axios.get(API + "/parent/alerts?child_id=null", { headers }); // 🔥 مررنا null صراحة
      const backendAlerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];

      console.log("Fetched Alerts Count:", backendAlerts.length);

      const formattedAlerts: AlertItemType[] = backendAlerts.map((alert: any) => {
        const dateObj = new Date(alert.created_at);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }); 
        const calendarDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }); 
        const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); 

        return {
          // هنا تم تعديل الحتة دي وتوحيد النص ليصبح دائماً نفس الاسم لكل الإشعارات القادمة من السيرفر
          message: "🚨 Baby Crying Detected",
          time: `${dayName} - ${calendarDate} | ${timeFormatted}`,
          type: alert.type
        };
      });

      setAlerts(formattedAlerts);

      const unreadCry = backendAlerts.find((alert: any) => 
        (alert.type === 'crying_detected' || alert.type === 'Cry') && !alert.is_read
      );

      if (unreadCry && isDeviceOnline) {
        if (!lastCryRef.current) {
          sendCryNotification();
          setCry(true);
          lastCryRef.current = true;
        }
      } else {
        setCry(false);
        lastCryRef.current = false;
      }

    } catch (error) {
      console.log("Failed to fetch alerts from server:", error);
    }
  };

  useEffect(() => {
    if (cry && online) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [cry, online]);

  const showMessage = (msg: string) => {
    setLightMessage(msg);
    messageOpacity.setValue(1);
    Animated.timing(messageOpacity, {
      toValue: 0,
      duration: 1800,
      delay: 1000,
      useNativeDriver: true,
    }).start();
  };

  const toggleLight = async () => {
    const newStatus = lightOn ? 0 : 1;
    setLightOn(!lightOn);
    showMessage(newStatus === 1 ? '💡 Lamp turned ON' : '🌙 Lamp turned OFF');
    
    try {
      await axios.post(API + "/hardware/light-toggle", { status: newStatus });
    } catch (error) {
      console.log("Failed to toggle light:", error);
      setLightOn(lightOn);
      showMessage('❌ Connection Error');
    }
  };

  useEffect(() => {
    Animated.spring(glowValue, { toValue: lightOn ? 1 : 0, useNativeDriver: false, friction: 4 }).start();
    Animated.spring(screenGlow, { toValue: lightOn ? 1 : 0, useNativeDriver: false, friction: 6 }).start();
  }, [lightOn]);

  const connection = online
    ? { text: "ONLINE", color: "#2E86C1", bg: "#D6EAF8" }
    : { text: "OFFLINE", color: "#E74C3C", bg: "#FADBD8" };

  const bgColor = screenGlow.interpolate({ inputRange: [0, 1], outputRange: ['#DDEEF8', '#EAF4FF'] });

  const handleBackPress = () => {
    if (navigation && typeof navigation.goBack === 'function') {
      navigation.goBack();
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaProvider>
      <Animated.View style={[styles.outerContainer, { backgroundColor: bgColor }]}>
        <SafeAreaView style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }} style={{ width: '100%' }}>

            {/* Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={handleBackPress}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="arrow-left" size={26} color="#1A5276" />
              </TouchableOpacity>
              
              <View style={styles.headerTitleContainer}>
                <MaterialCommunityIcons name="baby-face-outline" size={28} color="#2E86C1" />
                <Text style={styles.headerTitle}>Infant Room</Text>
              </View>
            </View>

            {/* Cry Sensor Card */}
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <MaterialCommunityIcons
                    name="waveform"
                    size={50}
                    color={online ? (cry ? '#FF6B35' : '#2E86C1') : '#A0B4C8'}
                  />
                </Animated.View>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>Cry Sensor</Text>

                <View style={[styles.statusBadge, { backgroundColor: connection.bg, marginBottom: (online && cry) ? 8 : 0 }]}>
                  <View style={[styles.statusDot, { backgroundColor: connection.color }]} />
                  <Text style={[styles.statusText, { color: connection.color }]}>
                    {connection.text}
                  </Text>
                </View>

                {online && cry && (
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF5E7', borderColor: '#FAD7A0', borderWidth: 1 }]}>
                    <MaterialCommunityIcons name="alert" size={14} color="#FF6B35" style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, { color: '#FF6B35' }]}>
                      CRY DETECTED!
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Lamp Card */}
            <TouchableOpacity activeOpacity={0.85} onPress={toggleLight} style={[styles.lightCard, { backgroundColor: lightOn ? '#D6EAF8' : '#EBF5FB' }]}>
              <Animated.View style={[styles.glowOverlay, { opacity: glowValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]} />
              <View style={styles.lightInfo}>
                <Text style={styles.lightLabel}>Cute Lamp</Text>
                <Text style={styles.lightSubLabel}>{lightOn ? "Tap to turn OFF" : "Tap to turn ON"}</Text>
                <Animated.Text style={[styles.lightToast, { opacity: messageOpacity }]}>{lightMessage}</Animated.Text>
              </View>
              <View style={styles.svgWrapper}>
                <Svg height="150" width="120" viewBox="0 0 100 120">
                  <AnimatedCircle cx="50" cy="35" r="48" fill="#AED6F1" fillOpacity={glowValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] })} />
                  <AnimatedCircle cx="50" cy="35" r="30" fill="#D6EAF8" fillOpacity={glowValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })} />
                  <AnimatedPath d="M25,60 L75,60 L65,15 L35,15 Z" fill={lightOn ? "#5DADE2" : "#A0B4C8"} />

                  {lightOn ? (
                    <>
                      <Circle cx="44" cy="38" r="2.5" fill="#1A5276" />
                      <Circle cx="56" cy="38" r="2.5" fill="#1A5276" />
                    </>
                  ) : (
                    <>
                      <Path d="M41.5,37 Q44,41 46.5,37" stroke="#5D6D7E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      <Path d="M53.5,37 Q56,41 58.5,37" stroke="#5D6D7E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    </>
                  )}

                  <Path d="M47,48 Q50,52 53,48" stroke={lightOn ? "#1A5276" : "#5D6D7E"} strokeWidth="1.5" fill="none" />
                  <Rect x="48" y="60" width="4" height="35" fill="#AED6F1" />
                  <Rect x="35" y="95" width="30" height="6" rx="3" fill="#AED6F1" />
                </Svg>
              </View>
            </TouchableOpacity>

            {/* Recent Alerts */}
            <Text style={styles.recentAlerts}>Recent Alerts</Text>
            {alerts.length === 0 ? (
              <View style={styles.alertCard}>
                <MaterialCommunityIcons name="bell-outline" size={24} color="#3A6E8A" />
                <Text style={styles.alertText}>No alerts yet. Baby is sleeping well! 😴</Text>
              </View>
            ) : (
              alerts.map((alert, index) => (
                <View key={index} style={styles.alertCard}>
                  <MaterialCommunityIcons name="bell" size={24} color="#FF6B35" />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertText}>{alert.message}</Text>
                    <Text style={styles.alertTime}>{alert.time}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1 },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%', 
    marginVertical: 25,
    position: 'relative',
    justifyContent: 'center'
  },
  backButton: {
    position: 'absolute',
    left: '2%',
    padding: 5,
    zIndex: 10
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A5276', marginLeft: 6 },
  card: { width: '95%', backgroundColor: '#FFFFFF', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 22, marginBottom: 18, elevation: 6, shadowColor: '#AED6F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, borderWidth: 1.5, borderColor: '#D6EAF8' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  cardContent: { flex: 1 },
  cardLabel: { color: '#1A5276', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontWeight: 'bold', fontSize: 13 },
  lightCard: { width: '95%', borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, height: 160, elevation: 6, shadowColor: '#AED6F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AED6F1' },
  glowOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#AED6F1', borderRadius: 25 },
  lightInfo: { zIndex: 1 },
  lightLabel: { color: '#1A5276', fontSize: 20, fontWeight: 'bold' },
  lightSubLabel: { color: '#5DADE2', fontSize: 13, marginTop: 5 },
  lightToast: { color: '#2E86C1', fontSize: 13, fontWeight: 'bold', marginTop: 8 },
  svgWrapper: { width: 120, height: 150, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  recentAlerts: { 
    alignSelf: 'flex-start', 
    marginLeft: '5%',        
    marginTop: 25, 
    color: '#1A5276', 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 10 
  },  
  alertCard: { width: '95%', backgroundColor: '#F0F8FF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12, elevation: 3 },
  alertContent: { flex: 1, marginLeft: 12 },
  alertText: { color: '#1A5276', fontWeight: '600', fontSize: 14 },
  alertTime: { color: '#1A9FFF', fontSize: 11, fontWeight: '600', marginTop: 4 },
});