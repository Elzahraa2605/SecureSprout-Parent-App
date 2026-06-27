import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function NextStepScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* زر الرجوع المحدث - تم نقله وتغيير لونه وتنسيقه */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#01579B" />
        </TouchableOpacity>
      </View>

      {/* Container التمرير */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>What would you like to do next?</Text>

        {/* Card 1: Go to Dashboard */}
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => router.push('/parentDashboard')}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="view-dashboard" size={35} color="#0288D1" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Go to Dashboard</Text>
            <Text style={styles.cardSub}>View family activity and manage settings.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#0288D1" />
        </TouchableOpacity>

        {/* Card 2: Connect to Child Device */}
        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push('/childSignUp')}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="cellphone-link" size={35} color="#0288D1" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Connect to Child Device</Text>
            <Text style={styles.cardSub}>Set up and pair a new phone or tablet.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#0288D1" />
        </TouchableOpacity>

        {/* Important Instructions Box */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionHeader}>
            <Ionicons name="information-circle" size={20} color="#01579B" style={{ marginRight: 6 }} />
            <Text style={styles.instructionTitle}>Important Setup for Child's Device</Text>
          </View>
          <Text style={styles.instructionText}>
            Before connecting, please configure your child's device settings first to ensure the app works properly:
          </Text>
          
          <View style={styles.stepsList}>
            <Text style={styles.stepItem}>
              1. Open <Text style={styles.boldText}>Settings</Text> on your child's device, then go to <Text style={styles.boldText}>Apps</Text>.
            </Text>
            <Text style={styles.stepItem}>
              2. Select <Text style={styles.boldText}>Special app access</Text>.
            </Text>
            <Text style={styles.stepItem}>
              3. Enable <Text style={styles.boldText}>Display over the apps</Text> for Secure Sprout.
            </Text>
            <Text style={styles.stepItem}>
              4. Enable <Text style={styles.boldText}>App usage data</Text> permission.
            </Text>
            <Text style={styles.stepItem}>
              5. Go back to <Text style={styles.boldText}>Apps</Text>, then select <Text style={styles.boldText}>Default apps</Text>.
            </Text>
            <Text style={styles.stepItem}>
              6. Set <Text style={styles.boldText}>Secure Sprout</Text> as your default Home app.
            </Text>
          </View>
        </View>

        {/* Help Link */}
        <TouchableOpacity style={styles.needHelp}>
          <Text style={styles.needHelpText}>Need Help?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD' },
  
  // تنسيق الـ Header وزر الرجوع الجديد لضمان الضغط عليه بسهولة وضمان ظهوره
  // 🛠️ التعديل الجديد لضمان نزول السهم واستجابته للمس
  headerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 35,       // 👈 قمنا بزيادتها من 15 إلى 35 ليفصل تماماً عن شريط الهاتف العلوي
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,           // 👈 إضافة zIndex لضمان أن الزر فوق أي عناصر أخرى ولا يُحجب اللمس عنه
  },
  
  backButton: { 
    padding: 10, // زيادة مساحة الضغط (Hit Slop) لتسهيل الضغط على السهم
    borderRadius: 50,
  },

  scrollContent: { paddingHorizontal: 25, paddingTop: 10, paddingBottom: 60 },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#01579B', 
    lineHeight: 38, 
    marginBottom: 30,
    width: '80%' 
  },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#BBDEFB', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: { marginRight: 15 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#01579B' },
  cardSub: { fontSize: 13, color: '#0288D1', marginTop: 4 },
  
  // Instructions Section Styles
  instructionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', 
    borderRadius: 15,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#01579B',
  },
  instructionText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  stepsList: {
    paddingLeft: 5,
  },
  stepItem: {
    fontSize: 13,
    color: '#333',
    lineHeight: 22,
    marginBottom: 6,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#01579B',
  },

  needHelp: { 
    marginTop: 40,
    alignSelf: 'center' 
  },
  needHelpText: { color: '#03A9F4', fontSize: 16, fontWeight: '500' }
});