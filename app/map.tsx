import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Linking, Alert } from 'react-native';

export default function MapScreen() {
  const router = useRouter();
  const { childId, name } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState({
    latitude: 30.0444,
    longitude: 31.2357,
    address: "Connecting...",
  });

  // المرجع (Ref) لتخزين الـ Interval وإيقافه عند الخروج من الصفحة
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLocation = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await axios.get(`http://16.171.208.58/api/parent/locations/show/${childId || 8}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const locData = response.data.data?.location; 
      
      if (locData) {
        setLocation({
          latitude: parseFloat(locData.latitude),
          longitude: parseFloat(locData.longitude),
          address: locData.address || "Location updated",
        });
      }
    } catch (error: any) {
      console.error("📍 Live Update Error:", error.message);
    }
  };

  // دالة تشغيل تطبيق خرائط جوجل الخارجي بالإحداثيات المستلمة
  const openExternalGoogleMaps = () => {
    const lat = location.latitude;
    const lng = location.longitude;
    
    // رابط لفتح تطبيق خرائط جوجل وإسقاط دبوس محدد باسم الطفل
    const url = `geo:${lat},${lng}?q=${lat},${lng}(${name || 'Child'}'s Location)`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // حل احتياطي في حال عدم وجود التطبيق يفتح من المتصفح
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Alert.alert("Error", "Could not open Google Maps app");
      });
  };

  useEffect(() => {
    // 1. جلب الموقع فوراً عند فتح الصفحة
    fetchLocation().then(() => setLoading(false));

    // 2. تفعيل التحديث التلقائي كل 15 ثانية
    intervalRef.current = setInterval(() => {
      fetchLocation();
    }, 15000); 

    // 3. تنظيف التايمر عند إغلاق الصفحة (لمنع تسريب الذاكرة)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [childId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Live Tracking</Text>
        {/* زر تحديث يدوي إضافي */}
        <TouchableOpacity onPress={fetchLocation} style={{ marginLeft: 'auto' }}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0288D1" />
          <Text style={{marginTop: 10}}>Tracking {name || 'Child'}...</Text>
        </View>
      ) : (
        <View style={styles.dashboardBody}>
          
          {/* كارت عرض تفاصيل حالة الـ GPS والاتصال بالسيرفر */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🛰️ Tracking Status</Text>
            <View style={styles.divider} />
            <Text style={styles.infoText}>Target Device: <Text style={{fontWeight: 'bold', color: '#01579B'}}>{name || 'Child'}</Text></Text>
            <Text style={styles.infoText}>Latitude: {location.latitude}</Text>
            <Text style={styles.infoText}>Longitude: {location.longitude}</Text>
          </View>

          {/* الزرار السحري الجديد لفتح جوجل ماب */}
          <TouchableOpacity style={styles.mapButton} onPress={openExternalGoogleMaps}>
            <Text style={styles.mapButtonText}>🗺️ View Location on Google Maps</Text>
          </TouchableOpacity>

        </View>
      )}

      {/* كارت عرض العنوان الحالي أسفل الشاشة */}
      <View style={styles.detailCard}>
        <Text style={styles.childName}>{name || 'Child'}'s Last Location</Text>
        <Text style={styles.address}>📍 {location.address}</Text>
        <Text style={{fontSize: 10, color: '#999', marginTop: 5}}>Auto-updates every 15s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#fff', paddingBottom: 15, elevation: 5, zIndex: 10 
  },
  backBtn: { fontSize: 18, color: '#0288D1', marginRight: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#01579B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  
  dashboardBody: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 100 // ترك مسافة للكارد السفلي
  },
  infoCard: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 20,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 30
  },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#ECEFF1', marginVertical: 10 },
  infoText: { fontSize: 14, color: '#546E7A', marginBottom: 6, lineHeight: 20 },

  mapButton: {
    backgroundColor: '#0288D1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#0288D1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  mapButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  detailCard: { 
    position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', 
    padding: 20, borderRadius: 25, elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 5
  },
  childName: { fontSize: 18, fontWeight: 'bold', color: '#0D47A1', marginBottom: 5 },
  address: { fontSize: 14, color: '#546E7A' }
});