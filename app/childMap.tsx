import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface MapProps {
  childId: number | string | null;
}

export default function ChildMap({ childId }: MapProps) {
  // إحداثيات افتراضية للقاهرة لضمان ظهور الخريطة فوراً
  const [region, setRegion] = useState<any>({
    latitude: 30.0444,
    longitude: 31.2357,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  const [markerPos, setMarkerPos] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const getChildLocation = async () => {
    if (!childId) {
      setLoading(false);
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`http://16.171.208.58/api/parent/locations/show/${childId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });

      const locations = response.data.data?.locations;
      if (locations && locations.length > 0) {
        const lastLoc = locations[0];
        const newCoords = {
          latitude: parseFloat(lastLoc.latitude),
          longitude: parseFloat(lastLoc.longitude),
        };
        
        setMarkerPos(newCoords);
        // تحريك الخريطة لمكان الطفل عند وصول بيانات حقيقية
        setRegion({ ...newCoords, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      }
    } catch (error) {
      console.error("❌ Map Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getChildLocation();
    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(getChildLocation, 30000);
    return () => clearInterval(interval);
  }, [childId]);

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        region={region} 
        provider={PROVIDER_GOOGLE}
        scrollEnabled={true}
        zoomEnabled={true}
      >
        {/* الماركر يظهر فقط عند وجود بيانات حقيقية */}
        {markerPos && (
          <Marker coordinate={markerPos}>
            <View style={styles.markerContainer}>
               <View style={styles.markerDot} />
            </View>
          </Marker>
        )}
      </MapView>
      
      {/* مؤشر تحميل صغير لا يغطي الخريطة بالكامل */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0288D1" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#BBDEFB' },
  map: { width: '100%', height: '100%' },
  loadingOverlay: { position: 'absolute', top: 10, right: 10 },
  markerContainer: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(2, 136, 209, 0.3)', justifyContent: 'center', alignItems: 'center' },
  markerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0288D1', borderWidth: 2, borderColor: '#fff' }
});