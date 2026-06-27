import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Image // 👈 تم استيراد الـ Image هنا لعرض الأيقونات
} from 'react-native';
import ChildMap from './childMap';

const API_BASE_URL = 'http://16.171.208.58/api/parent';

export default function ChildProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appRequests, setAppRequests] = useState<any[]>([]); 

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

      const res = await axios.get(`${API_BASE_URL}/childs`, { headers });
      const childrenData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      const current = childrenData.find((c: any) => c.id.toString() === id?.toString());
      setChild(current);

      try {
        const appsRes = await axios.get(`${API_BASE_URL}/app-requests/${id}`, { headers });
        const relevantApps = (appsRes.data.data || []).filter(
          (req: any) => req.status === 'pending' || req.status === 'rejected'
        );
        setAppRequests(relevantApps);
      } catch (e) {
        setAppRequests([]); 
      }
    } catch (error) {
      console.log("🚨 Profile Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAppAction = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

      await axios.post(`${API_BASE_URL}/app-requests/update`, {
        request_id: requestId,
        status: status
      }, { headers });

      fetchData(); 
      Alert.alert("نجاح", status === 'approved' ? "تم تحديث حالة التطبيق بنجاح" : "تم رفض التطبيق");
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث حالة التطبيق");
    }
  };

  useEffect(() => { 
    if (id) fetchData(); 
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (id) fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <View style={styles.loadingCenter}><ActivityIndicator size="large" color="#0288D1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#0288D1" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>“{child?.name || 'Child'}” Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
             <Ionicons name="person-outline" size={55} color="#0288D1" />
          </View>
          <Text style={styles.childIdText}>{child?.name}</Text>
        </View>

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.push({ pathname: '/Downtime', params: { childId: id, childName: child?.name } })}>
            <Ionicons name="moon" size={24} color="#01579B" />
            <Text style={styles.topBtnText}>Downtime</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.topBtn} onPress={() => router.push({ pathname: '/Reports', params: { childId: id } })}>
            <Ionicons name="bar-chart" size={24} color="#01579B" />
            <Text style={styles.topBtnText}>Reports</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapViewWrapper}>
             {id ? <ChildMap childId={Number(id)} /> : null}
          </View>
          <View style={styles.mapInfoOverlay}>
             <Text style={styles.locStatusText}>Current Location</Text>
             <Text style={styles.locNameText}>“{child?.name || 'Child'} Location”</Text>
             <Text style={styles.locTimeText}>Last updated: Just now • Precise location sharing is on</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>App Requests</Text>
        
        {appRequests.length > 0 ? (
          appRequests.map((app) => (
            <View key={app.id} style={[styles.appRequestCard, app.status === 'rejected' && { opacity: 0.6 }]}>
              
              {/* 👈 تم تغيير الأيقونة الثابتة هنا لعرض الأيقونة المباشرة المستقلة للطلب المعلق */}
              <View style={styles.appIconWrapperCustom}>
                <Image 
                  source={{ 
                    uri: app.app_icon && app.app_icon.startsWith('http') 
                      ? app.app_icon 
                      : 'https://via.placeholder.com/50' 
                  }}
                  style={styles.imageIconStyleCustom}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.appName}>{app.app_name} {app.status === 'rejected' && '(Rejected)'}</Text>
              
              <View style={styles.actionIcons}>
                {app.status === 'rejected' ? (
                  <TouchableOpacity onPress={() => handleAppAction(app.id, 'approved')}>
                    <Ionicons name="checkmark-circle" size={38} color="#4CAF50" />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => handleAppAction(app.id, 'rejected')}>
                      <Ionicons name="close-circle" size={38} color="#0288D1" style={{marginRight: 8}} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAppAction(app.id, 'approved')}>
                      <Ionicons name="checkmark-circle" size={38} color="#29B6F6" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noAppsText}>No new pending requests</Text>
        )}

        <TouchableOpacity style={styles.manageBtn} onPress={() => router.push({ pathname: '/manageApps', params: { childId: id } })}>
            <Text style={styles.manageBtnText}>Manage App Settings</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD', paddingTop: 40 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 60 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#01579B' },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#90CAF9', justifyContent: 'center', alignItems: 'center' },
  childIdText: { marginTop: 10, fontSize: 18, fontWeight: 'bold', color: '#01579B' },
  deviceModel: { color: '#4FC3F7', fontSize: 14, marginTop: 4 },
  rowButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  topBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#BBDEFB', paddingVertical: 15, width: '48%', borderRadius: 15, justifyContent: 'center' },
  topBtnText: { marginLeft: 10, color: '#01579B', fontWeight: 'bold', fontSize: 16 },
  mapCard: { marginHorizontal: 20, borderRadius: 25, overflow: 'hidden', backgroundColor: '#BBDEFB', marginBottom: 20 },
  mapViewWrapper: { height: 200, width: '100%' },
  mapInfoOverlay: { padding: 15 },
  locStatusText: { color: '#0288D1', fontSize: 12, fontWeight: 'bold' },
  locNameText: { fontSize: 22, fontWeight: 'bold', color: '#01579B', marginVertical: 2 },
  locTimeText: { color: '#0288D1', fontSize: 11 },
  sectionLabel: { fontSize: 20, fontWeight: 'bold', color: '#01579B', marginLeft: 20, marginBottom: 15, marginTop: 10 },
  noAppsText: { textAlign: 'center', color: '#01579B', fontSize: 15, fontStyle: 'italic', marginVertical: 10 },
  appRequestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#BBDEFB', marginHorizontal: 20, padding: 15, borderRadius: 20, marginBottom: 12 },
  
  // ستايلات جديدة ومنعزلة لبوكس الصورة لمنع الاختلاط
  appIconWrapperCustom: { width: 50, height: 50, backgroundColor: '#E1F5FE', borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageIconStyleCustom: { width: '100%', height: '100%' },
  
  appName: { flex: 1, marginLeft: 15, fontSize: 18, fontWeight: 'bold', color: '#01579B' },
  actionIcons: { flexDirection: 'row', alignItems: 'center' },
  manageBtn: { backgroundColor: '#90CAF9', marginHorizontal: 20, padding: 20, borderRadius: 25, alignItems: 'center', marginTop: 10 },
  manageBtnText: { color: '#01579B', fontWeight: 'bold', fontSize: 18 }
});